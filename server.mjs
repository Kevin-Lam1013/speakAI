import { createServer } from 'http';
import { parse } from 'url';
import dgram from 'dgram';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import * as jose from 'jose';
import dotenv from 'dotenv';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from '@aws-sdk/client-transcribe-streaming';
import OpusScript from 'opusscript';
import {
  init as sfuInit,
  getOrCreateRouter,
  closeRouter,
  webRtcTransportOptions,
} from './lib/mediasoup/sfuServer.mjs';

// Load env for the custom server
dotenv.config({ path: '.env.local' });
dotenv.config();

// Translation event names (define locally to avoid TS imports in Node)
const EVENT_TRANSLATION_PREFERENCE = 'translation:preference';
const EVENT_TRANSLATION_TRACK_READY = 'translation:track-ready';
const EVENT_TRANSLATION_PIPELINE_STATUS = 'translation:pipeline-status';

// SFU event names
const SFU_GET_ROUTER_RTP_CAPABILITIES = 'sfu:get-router-rtp-capabilities';
const SFU_CREATE_TRANSPORT = 'sfu:create-transport';
const SFU_CONNECT_TRANSPORT = 'sfu:connect-transport';
const SFU_PRODUCE = 'sfu:produce';
const SFU_CONSUME = 'sfu:consume';
const SFU_RESUME_CONSUMER = 'sfu:resume-consumer';
const SFU_NEW_PRODUCER = 'sfu:new-producer';
const SFU_CLOSE_PRODUCER = 'sfu:close-producer';
const SFU_PRODUCER_CLOSED = 'sfu:producer-closed';

// Translation constants
const GRACE_PERIOD_MS = 15000;
const SUPPORTED_LANGUAGES = new Set(['en-US', 'fr-FR', 'es-ES', 'zh-CN']);
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const GOOGLE_MT_KEY = process.env.GOOGLE_MT_KEY;
const AZURE_TTS_KEY = process.env.AZURE_TTS_KEY;
const AZURE_TTS_REGION = process.env.AZURE_TTS_REGION || 'eastus';
const AZURE_TTS_VOICE = process.env.AZURE_TTS_VOICE || 'en-US-FableMultilingualNeural';
const LANGUAGE_OPTIONS = 'en-US,fr-FR,es-ES,zh-CN';
const DEFAULT_LANGUAGE_CODE = 'en-US';

// RTP constants for TTS injection
const TTS_PAYLOAD_TYPE = 101;
const TTS_CLOCK_RATE = 48000;
const TTS_FRAME_SAMPLES = 960; // 20ms @ 48kHz

/**
 * Per-room session state (replaces separate translationRooms + botPeersByRoom maps).
 *
 * roomId -> {
 *   router: Router | null,
 *   transports: Map<userId, { send: WebRtcTransport, recv: WebRtcTransport }>,
 *   producers: Map<userId, Map<kind, Producer>>,
 *   consumers: Map<userId, Map<producerId, Consumer>>,
 *   preferences: Map<userId, language|null>,
 *   pipelines: Map<speakerId, Map<language, PipelineEntry>>,
 *   speakers: Map<speakerId, SpeakerEntry>,
 * }
 *
 * PipelineEntry: {
 *   subscribers: Set<userId>,
 *   state: 'stopped'|'starting'|'active'|'stopping'|'error',
 *   timeout?: NodeJS.Timeout,
 *   ttsPlainTransport?: PlainTransport,
 *   ttsProducer?: Producer,
 *   ttsProducerPort?: number,
 *   ttsUdpSocket?: dgram.Socket,
 *   ttsOpusEncoder?: OpusScript,
 *   ttsRtpSeq?: number,
 *   ttsRtpTimestamp?: number,
 *   ttsSsrc?: number,
 *   ttsQueue?: Promise<void>,
 *   silenceTimer?: NodeJS.Timeout,
 *   lastSpokenText?: string,
 * }
 *
 * SpeakerEntry: {
 *   pcUserId: string,
 *   asrActive: boolean,
 *   plainTransport?: PlainTransport,
 *   plainConsumer?: Consumer,
 *   udpSocket?: dgram.Socket,
 *   opusDecoder?: OpusScript,
 *   transcribeClient?: TranscribeStreamingClient,
 *   transcribeAbort?: AbortController,
 *   audioQueue?: Buffer[],
 *   resolveNext?: Function,
 * }
 */
const roomSessions = new Map();

function getSession(roomId) {
  if (!roomSessions.has(roomId)) {
    roomSessions.set(roomId, {
      router: null,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      preferences: new Map(),
      pipelines: new Map(),
      speakers: new Map(),
    });
  }
  return roomSessions.get(roomId);
}

// Alias used by translation pipeline functions
const getRoomState = getSession;

// --- RTP helpers ---

/**
 * Strip the RTP fixed + variable header and return the payload bytes.
 * Returns null if the packet is too short or malformed.
 */
function parseRtpPayload(buf) {
  if (buf.length < 12) return null;
  const firstByte = buf[0];
  const cc = firstByte & 0x0f;
  const hasExtension = (firstByte & 0x10) !== 0;
  let offset = 12 + cc * 4;
  if (hasExtension) {
    if (buf.length < offset + 4) return null;
    const extWords = (buf[offset + 2] << 8) | buf[offset + 3];
    offset += 4 + extWords * 4;
  }
  if (offset >= buf.length) return null;
  return buf.slice(offset);
}

/**
 * Build a minimal 12-byte fixed RTP packet with the given payload.
 */
function buildRtpPacket(payload, seq, timestamp, ssrc, payloadType = TTS_PAYLOAD_TYPE) {
  const header = Buffer.alloc(12);
  header[0] = 0x80; // V=2, P=0, X=0, CC=0
  header[1] = payloadType & 0x7f; // M=0
  header.writeUInt16BE(seq & 0xffff, 2);
  header.writeUInt32BE(timestamp >>> 0, 4);
  header.writeUInt32BE(ssrc >>> 0, 8);
  return Buffer.concat([header, payload]);
}

// writePcmViaRtp removed — replaced by streamTtsToRtp which streams directly from Azure response

/**
 * Close and clean up all SFU-related resources for a user in a room.
 */
async function cleanupUserSFU(io, roomId, userId) {
  const session = roomSessions.get(roomId);
  if (!session) return;

  // Close consumers
  const userConsumers = session.consumers.get(userId);
  if (userConsumers) {
    for (const consumer of userConsumers.values()) {
      try { consumer.close(); } catch {}
    }
    session.consumers.delete(userId);
  }

  // Close all producers (audio + video)
  const userProducers = session.producers.get(userId);
  if (userProducers) {
    for (const producer of userProducers.values()) {
      try { producer.close(); } catch {}
    }
    session.producers.delete(userId);
  }

  // Close ASR resources
  const speaker = session.speakers.get(userId);
  if (speaker) {
    // Null out opusDecoder reference BEFORE closing the UDP socket so any
    // in-flight 'message' callbacks see undefined and skip decoding.
    const decoderToDelete = speaker.opusDecoder;
    speaker.opusDecoder = undefined;
    if (speaker.udpSocket) {
      speaker.udpSocket.removeAllListeners('message');
    }
    try { speaker.transcribeAbort?.abort?.(); } catch {}
    try { speaker.transcribeClient?.destroy?.(); } catch {}
    try { speaker.plainConsumer?.close?.(); } catch {}
    try { speaker.plainTransport?.close?.(); } catch {}
    try { speaker.udpSocket?.close?.(); } catch {}
    try { decoderToDelete?.delete?.(); } catch {}
    session.speakers.delete(userId);
  }

  // Close transports
  const userTransports = session.transports.get(userId);
  if (userTransports) {
    try { userTransports.send?.close?.(); } catch {}
    try { userTransports.recv?.close?.(); } catch {}
    session.transports.delete(userId);
  }

  // If room is empty after cleanup, close the router
  const sockets = await io.in(roomId).fetchSockets().catch(() => []);
  const remaining = sockets.filter(s => s.data.userId !== userId);
  if (remaining.length === 0) {
    await closeRouter(roomId);
    roomSessions.delete(roomId);
  }
}

// --- Translation pipeline ---

function incSubscriber(io, roomId, speakerId, language, userId) {
  const room = getSession(roomId);
  if (!room.pipelines.has(speakerId)) room.pipelines.set(speakerId, new Map());
  const langMap = room.pipelines.get(speakerId);
  if (!langMap.has(language)) langMap.set(language, { subscribers: new Set(), state: 'stopped' });
  const entry = langMap.get(language);
  entry.subscribers.add(userId);
  if (entry.timeout) {
    clearTimeout(entry.timeout);
    entry.timeout = undefined;
  }
  if (entry.state === 'stopped') {
    entry.state = 'starting';
    io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, { speakerId, language, state: 'starting' });
    startLanguageChannel(io, roomId, speakerId, language)
      .then(async () => {
        entry.state = 'active';
        io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, { speakerId, language, state: 'active' });
        io.to(roomId).emit(EVENT_TRANSLATION_TRACK_READY, {
          speakerId,
          language,
          trackId: `${speakerId}:${language}`,
        });
        // Notify all current subscribers about the new TTS producer
        if (entry.ttsProducer) {
          const sockets = await io.in(roomId).fetchSockets();
          for (const subId of entry.subscribers) {
            const sub = sockets.find(s => s.data.userId === subId);
            if (sub) {
              io.to(sub.id).emit(SFU_NEW_PRODUCER, {
                producerId: entry.ttsProducer.id,
                userId: `tts:${speakerId}:${language}`,
                kind: 'audio',
              });
            }
          }
        }
      })
      .catch(err => {
        console.error('Failed to start language channel', speakerId, language, err);
        entry.state = 'error';
        io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, { speakerId, language, state: 'error' });
      });
  } else if (entry.state === 'active' && entry.ttsProducer) {
    // Channel already active — notify only this new subscriber
    io.in(roomId)
      .fetchSockets()
      .then(sockets => {
        const sub = sockets.find(s => s.data.userId === userId);
        if (sub && entry.ttsProducer) {
          io.to(sub.id).emit(SFU_NEW_PRODUCER, {
            producerId: entry.ttsProducer.id,
            userId: `tts:${speakerId}:${language}`,
            kind: 'audio',
          });
        }
      })
      .catch(() => {});
  }
}

function decSubscriber(io, roomId, speakerId, language, userId) {
  const room = getSession(roomId);
  const langMap = room.pipelines.get(speakerId);
  if (!langMap) return;
  const entry = langMap.get(language);
  if (!entry) return;
  entry.subscribers.delete(userId);

  // Close the consumer for this TTS producer on the departing subscriber's recv transport
  if (entry.ttsProducer) {
    const session = roomSessions.get(roomId);
    const userConsumers = session?.consumers.get(userId);
    if (userConsumers) {
      const consumer = userConsumers.get(entry.ttsProducer.id);
      if (consumer) {
        try { consumer.close(); } catch {}
        userConsumers.delete(entry.ttsProducer.id);
      }
    }
  }

  if (entry.subscribers.size === 0 && (entry.state === 'active' || entry.state === 'starting')) {
    entry.state = 'stopping';
    io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, { speakerId, language, state: 'stopping' });
    entry.timeout = setTimeout(() => {
      stopLanguageChannel(io, roomId, speakerId, language).finally(() => {
        entry.state = 'stopped';
        io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, { speakerId, language, state: 'stopped' });
      });
    }, GRACE_PERIOD_MS);
  }
}

async function startLanguageChannel(io, roomId, speakerId, language) {
  const session = getSession(roomId);
  if (!session.speakers) session.speakers = new Map();
  if (!session.pipelines.has(speakerId)) session.pipelines.set(speakerId, new Map());
  const langMap = session.pipelines.get(speakerId);
  const entry = langMap.get(language) || { subscribers: new Set(), state: 'starting' };
  langMap.set(language, entry);

  const router = session.router;
  if (!router) throw new Error('No router for room ' + roomId);

  // Create PlainTransport for TTS RTP injection (server → mediasoup Producer)
  const ttsPlainTransport = await router.createPlainTransport({
    listenIp: { ip: '127.0.0.1', announcedIp: null },
    rtcpMux: true,
    comedia: true,
  });

  const ttsSsrc = Math.floor(Math.random() * 0xffffffff);

  // Produce audio on the PlainTransport — mediasoup will receive our RTP
  const ttsProducer = await ttsPlainTransport.produce({
    kind: 'audio',
    rtpParameters: {
      codecs: [
        {
          mimeType: 'audio/opus',
          payloadType: TTS_PAYLOAD_TYPE,
          clockRate: TTS_CLOCK_RATE,
          channels: 2,
          parameters: { useinbandfec: 1 },
        },
      ],
      encodings: [{ ssrc: ttsSsrc }],
    },
  });

  const ttsProducerPort = ttsPlainTransport.tuple.localPort;

  // UDP socket used to send RTP to mediasoup
  const ttsUdpSocket = dgram.createSocket('udp4');

  // Opus encoder for TTS PCM → Opus
  const ttsOpusEncoder = new OpusScript(TTS_CLOCK_RATE, 1, OpusScript.Application.VOIP);

  entry.ttsPlainTransport = ttsPlainTransport;
  entry.ttsProducer = ttsProducer;
  entry.ttsProducerPort = ttsProducerPort;
  entry.ttsUdpSocket = ttsUdpSocket;
  entry.ttsOpusEncoder = ttsOpusEncoder;
  entry.ttsRtpSeq = 0;
  entry.ttsRtpTimestamp = 0;
  entry.ttsSsrc = ttsSsrc;

  // Push silence frames to keep producer alive while waiting for TTS audio
  entry.ttsSpeaking = false;
  const silenceFrame = Buffer.alloc(TTS_FRAME_SAMPLES * 2); // zeroed Int16 PCM
  entry.silenceTimer = setInterval(() => {
    if (entry.ttsSpeaking) return; // TTS is streaming — don't interleave silence
    try {
      const encoded = entry.ttsOpusEncoder.encode(silenceFrame, TTS_FRAME_SAMPLES);
      const pkt = buildRtpPacket(encoded, entry.ttsRtpSeq++, entry.ttsRtpTimestamp, ttsSsrc);
      entry.ttsRtpTimestamp += TTS_FRAME_SAMPLES;
      ttsUdpSocket.send(pkt, ttsProducerPort, '127.0.0.1');
    } catch {}
  }, 20);

  // Start ASR for this speaker (lazy)
  const asrPromise = ensureASRSession(io, roomId, speakerId);
  if (asrPromise?.catch) {
    asrPromise.catch(err => console.error('ASR session error', err));
  }
}

async function stopLanguageChannel(io, roomId, speakerId, language) {
  const session = roomSessions.get(roomId);
  if (!session) return;
  const langMap = session.pipelines.get(speakerId);
  if (!langMap) return;
  const entry = langMap.get(language);
  if (!entry) return;

  if (entry.silenceTimer) {
    clearInterval(entry.silenceTimer);
    entry.silenceTimer = undefined;
  }

  // Drain any in-flight ttsToChannel promise before tearing down the encoder/socket
  if (entry.ttsQueue) {
    await entry.ttsQueue.catch(() => {});
    entry.ttsQueue = undefined;
  }

  // Abort any in-flight TTS streaming
  if (entry.ttsAbortController) {
    try { entry.ttsAbortController.abort(); } catch {}
    entry.ttsAbortController = undefined;
  }

  // Close consumers on all subscribers' recv transports and notify clients
  if (entry.ttsProducer) {
    const producerId = entry.ttsProducer.id;
    io.to(roomId).emit(SFU_PRODUCER_CLOSED, {
      producerId,
      userId: `tts:${speakerId}:${language}`,
    });
    for (const subId of entry.subscribers) {
      const userConsumers = session.consumers.get(subId);
      if (userConsumers) {
        const consumer = userConsumers.get(producerId);
        if (consumer) {
          try { consumer.close(); } catch {}
          userConsumers.delete(producerId);
        }
      }
    }
    try { entry.ttsProducer.close(); } catch {}
    entry.ttsProducer = undefined;
  }

  if (entry.ttsPlainTransport) {
    try { entry.ttsPlainTransport.close(); } catch {}
    entry.ttsPlainTransport = undefined;
  }
  if (entry.ttsUdpSocket) {
    try { entry.ttsUdpSocket.close(); } catch {}
    entry.ttsUdpSocket = undefined;
  }
  if (entry.ttsOpusEncoder) {
    // Null ref first so silenceTimer/streamTtsToRtp callbacks see undefined
    const encoderToDelete = entry.ttsOpusEncoder;
    entry.ttsOpusEncoder = undefined;
    try { encoderToDelete.delete(); } catch {}
  }
  entry.lastSpokenText = '';

  // Stop ASR if no active channels remain for this speaker
  const langMap2 = session.pipelines.get(speakerId);
  const stillActive =
    !!langMap2 &&
    Array.from(langMap2.values()).some(e => e.state === 'active' && e.subscribers?.size > 0);
  if (!stillActive && session.speakers?.has(speakerId)) {
    const sp = session.speakers.get(speakerId);
    try { sp?.transcribeAbort?.abort?.(); } catch {}
    try { sp?.transcribeClient?.destroy?.(); } catch {}
    try { sp?.plainConsumer?.close?.(); } catch {}
    try { sp?.plainTransport?.close?.(); } catch {}
    try { sp?.udpSocket?.close?.(); } catch {}
    try { sp?.opusDecoder?.delete?.(); } catch {}
    if (sp) {
      sp.asrActive = false;
      sp.plainConsumer = undefined;
      sp.plainTransport = undefined;
      sp.udpSocket = undefined;
      sp.opusDecoder = undefined;
    }
  }
}

async function ensureASRSession(io, roomId, speakerId) {
  const session = getSession(roomId);
  if (!session.speakers) session.speakers = new Map();
  const speaker = session.speakers.get(speakerId);
  if (!speaker || speaker.asrActive) return;

  if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.warn('AWS credentials not set; ASR disabled');
    return;
  }

  const userProducer = session.producers.get(speakerId)?.get('audio');
  if (!userProducer) {
    // Audio producer not yet created (user hasn't called sfu:produce yet)
    return;
  }

  const router = session.router;
  if (!router) return;

  speaker.asrActive = true;

  // Create PlainTransport to receive this speaker's audio as RTP
  const plainTransport = await router.createPlainTransport({
    listenIp: { ip: '127.0.0.1', announcedIp: null },
    rtcpMux: false,
    comedia: false,
  });

  // Bind a UDP socket to receive incoming RTP
  const udpSocket = dgram.createSocket('udp4');
  await new Promise(resolve => udpSocket.bind(0, '127.0.0.1', () => resolve()));
  const { port: udpPort } = udpSocket.address();

  // Tell mediasoup where to forward RTP
  await plainTransport.connect({ ip: '127.0.0.1', port: udpPort, rtcpPort: udpPort + 1 });

  // Consume the user's audio producer on this PlainTransport
  const plainConsumer = await plainTransport.consume({
    producerId: userProducer.id,
    rtpCapabilities: router.rtpCapabilities,
    paused: false,
  });

  speaker.plainTransport = plainTransport;
  speaker.plainConsumer = plainConsumer;
  speaker.udpSocket = udpSocket;

  const opusDecoder = new OpusScript(48000, 1, OpusScript.Application.AUDIO);
  speaker.opusDecoder = opusDecoder;

  const client = new TranscribeStreamingClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
  const abortController = new AbortController();
  const audioQueue = [];
  let resolveNext;

  const MAX_QUEUE = 50;

  const signalDone = () => {
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  };

  // Receive Opus RTP, decode to PCM, downsample, enqueue for Transcribe
  udpSocket.on('message', buf => {
    try {
      const payload = parseRtpPayload(buf);
      if (!payload || !speaker.opusDecoder) return;
      const pcm = speaker.opusDecoder.decode(payload, TTS_FRAME_SAMPLES);
      if (!pcm) return;
      const int16 = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2);
      const down = downsampleBuffer(int16, 48000, 16000);
      if (audioQueue.length < MAX_QUEUE) {
        audioQueue.push(Buffer.from(down.buffer));
      }
      signalDone();
    } catch {
      // tolerate occasional decode errors
    }
  });

  speaker.transcribeClient = client;
  speaker.transcribeAbort = abortController;

  async function* audioStream() {
    while (!abortController.signal.aborted) {
      if (audioQueue.length === 0) {
        await new Promise(resolve => {
          resolveNext = resolve;
        });
        continue;
      }
      const chunk = audioQueue.shift();
      yield { AudioEvent: { AudioChunk: chunk } };
    }
  }

  async function startStream({ identify }) {
    const base = {
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: 16000,
      AudioStream: audioStream(),
    };
    const params = identify
      ? { ...base, IdentifyLanguage: true, LanguageOptions: LANGUAGE_OPTIONS }
      : { ...base, LanguageCode: DEFAULT_LANGUAGE_CODE };

    const command = new StartStreamTranscriptionCommand(params);
    const response = await client.send(command);
    for await (const evt of response.TranscriptResultStream ?? []) {
      const results = evt.TranscriptEvent?.Transcript?.Results;
      if (!results || !results.length) continue;
      for (const r of results) {
        if (r.IsPartial) continue;
        const alt = r.Alternatives && r.Alternatives[0];
        const transcript = alt?.Transcript;
        if (transcript) {
          console.log(`[ASR] ${speakerId}: "${transcript}"`);
          // Fire-and-forget: don't block ASR stream reading while TTS plays.
          // handleFinalTranscript queues TTS internally per language channel.
          handleFinalTranscript(io, roomId, speakerId, transcript).catch(err =>
            console.error('handleFinalTranscript error', err)
          );
        }
      }
    }
  }

  (async () => {
    try {
      await startStream({ identify: true });
    } catch (err) {
      console.error(
        'Transcribe stream (identify) failed, falling back to fixed language',
        err?.name || err?.code || err,
        err?.message,
        err?.$metadata
      );
      try {
        await startStream({ identify: false });
      } catch (err2) {
        console.error(
          'Transcribe stream (fixed language) failed',
          err2?.name || err2?.code || err2,
          err2?.message,
          err2?.$metadata
        );
      }
    } finally {
      if (speaker) speaker.asrActive = false;
      abortController.abort();
    }
  })();
}

async function handleFinalTranscript(io, roomId, speakerId, text) {
  const room = getSession(roomId);
  const langMap = room.pipelines.get(speakerId);
  if (!langMap) return;
  const entries = Array.from(langMap.entries()).filter(([, e]) => e.state === 'active');
  if (entries.length === 0) {
    console.log(`[MT] No active language channels for ${speakerId}, skipping: "${text}"`);
    return;
  }
  await Promise.all(
    entries.map(async ([language, entry]) => {
      try {
        const translated = await googleTranslate(text, language);
        const spoken = decodeEntities(translated);
        console.log(`[MT] ${language}: "${text}" → "${spoken}"`);
        await ttsToChannel(entry, spoken, language);
      } catch (e) {
        console.error('MT/TTS failed', e);
      }
    })
  );
}

// --- Translation cache ---
const translationCache = new Map(); // key: `${text}|${target}` → { result, ts }
const TRANSLATION_CACHE_TTL = 300_000; // 5 minutes
const TRANSLATION_CACHE_MAX = 500;

async function googleTranslate(text, target) {
  if (!GOOGLE_MT_KEY) return text;

  const cacheKey = `${text}|${target}`;
  const cached = translationCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TRANSLATION_CACHE_TTL) return cached.result;

  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_MT_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target }),
      }
    );
    const json = await res.json();
    const translated = json?.data?.translations?.[0]?.translatedText;
    const result = translated || text;

    // Store in cache, evict oldest if full
    if (translationCache.size >= TRANSLATION_CACHE_MAX) {
      const oldest = translationCache.keys().next().value;
      translationCache.delete(oldest);
    }
    translationCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  } catch {
    return text;
  }
}

async function ttsToChannel(entry, text, language) {
  if (!AZURE_TTS_KEY) return;
  // Queue TTS jobs sequentially so every sentence is heard in order, none skipped
  entry.ttsQueue = (entry.ttsQueue || Promise.resolve()).then(async () => {
    try {
      const responseBody = await azureTTSStream(text, language);
      if (!responseBody || !entry.ttsUdpSocket) return;
      await streamTtsToRtp(entry, responseBody);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('Azure TTS error', e);
    }
  });
  await entry.ttsQueue;
}

async function azureTTSStream(text, language) {
  const endpoint = `https://${AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<?xml version="1.0" encoding="utf-8"?>\n<speak version=\"1.0\" xml:lang=\"${language}\">\n  <voice name=\"${AZURE_TTS_VOICE}\">\n    <prosody rate=\"+10%\">${escapeXml(text)}</prosody>\n  </voice>\n</speak>`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_TTS_KEY,
      'Ocp-Apim-Subscription-Region': AZURE_TTS_REGION,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'raw-48khz-16bit-mono-pcm',
      'User-Agent': 'speak-ai-translator-bot',
    },
    body: ssml,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Azure TTS failed: ${res.status} ${txt}`);
  }
  return res.body; // ReadableStream — consumed incrementally by streamTtsToRtp
}

async function streamTtsToRtp(entry, responseBody) {
  if (!entry.ttsUdpSocket || !entry.ttsOpusEncoder || !entry.ttsProducerPort) return;
  const bytesPerFrame = TTS_FRAME_SAMPLES * 2; // 960 samples × 2 bytes = 1920

  // Collect the full PCM from the streaming response first
  const chunks = [];
  for await (const chunk of responseBody) {
    chunks.push(Buffer.from(chunk));
  }
  const pcmBuffer = Buffer.concat(chunks);
  if (pcmBuffer.length === 0) return;

  entry.ttsSpeaking = true; // pause silence timer

  // Send frames paced at 20ms intervals (real-time playback rate)
  // This prevents jitter buffer overflow from burst sending
  return new Promise(resolve => {
    let offset = 0;
    const iv = setInterval(() => {
      if (offset >= pcmBuffer.length || !entry.ttsOpusEncoder) {
        clearInterval(iv);
        entry.ttsSpeaking = false;
        resolve();
        return;
      }
      const frame = Buffer.alloc(bytesPerFrame);
      pcmBuffer.copy(frame, 0, offset, Math.min(offset + bytesPerFrame, pcmBuffer.length));
      offset += bytesPerFrame;
      let encoded;
      try {
        encoded = entry.ttsOpusEncoder.encode(frame, TTS_FRAME_SAMPLES);
      } catch {
        return;
      }
      const pkt = buildRtpPacket(encoded, entry.ttsRtpSeq++, entry.ttsRtpTimestamp, entry.ttsSsrc);
      entry.ttsRtpTimestamp += TTS_FRAME_SAMPLES;
      entry.ttsUdpSocket.send(pkt, entry.ttsProducerPort, '127.0.0.1');
    }, 20);
  });
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeEntities(str = '') {
  return String(str)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => {
      const code = Number(d);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

function downsampleBuffer(input, inRate, outRate) {
  if (outRate === inRate) return input;
  const ratio = inRate / outRate;
  const newLength = Math.round(input.length / ratio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffset = Math.round((offsetResult + 1) * ratio);
    let accum = 0,
      count = 0;
    for (let i = offsetBuffer; i < nextOffset && i < input.length; i++) {
      accum += input[i];
      count++;
    }
    result[offsetResult] = Math.round(accum / count);
    offsetResult++;
    offsetBuffer = nextOffset;
  }
  return result;
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

async function verifyAccessToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined in environment variables');
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload;
  } catch {
    throw new Error('Invalid access token');
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Initialize mediasoup workers before accepting connections
  await sfuInit();

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication failed - no token'));
      const decoded = await verifyAccessToken(token);
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      next();
    } catch {
      next(new Error('Authentication failed - invalid token'));
    }
  });

  io.on('connection', socket => {
    console.log(`User connected: ${socket.data.userId}`);

    // -----------------------------------------------------------------------
    // Room presence
    // -----------------------------------------------------------------------

    socket.on('join-room', async roomId => {
      try {
        await socket.join(roomId);

        // Ensure session and router exist for this room
        const session = getSession(roomId);
        session.router = await getOrCreateRouter(roomId);

        const sockets = await io.in(roomId).fetchSockets();
        const participants = sockets
          .filter(s => s.id !== socket.id)
          .map(s => ({ userId: s.data.userId, email: s.data.email }));

        io.to(roomId).emit('participant-joined', {
          userId: socket.data.userId,
          email: socket.data.email,
        });

        socket.emit('room-participants', participants);

        // Notify the new user about existing participants' producers (audio + video)
        for (const [existingUserId, producerMap] of session.producers) {
          for (const [kind, producer] of producerMap) {
            socket.emit(SFU_NEW_PRODUCER, {
              producerId: producer.id,
              userId: existingUserId,
              kind,
            });
          }
        }
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leave-room', async roomId => {
      try {
        await socket.leave(roomId);
        io.to(roomId).emit('participant-left', { userId: socket.data.userId });

        // Decrement translation subscribers
        const session = roomSessions.get(roomId);
        if (session) {
          const oldLang = session.preferences.get(socket.data.userId) ?? null;
          if (oldLang) {
            const socketsInRoom = await io.in(roomId).fetchSockets();
            const speakerIds = socketsInRoom.map(s => s.data.userId);
            speakerIds.forEach(speakerId => {
              decSubscriber(io, roomId, speakerId, oldLang, socket.data.userId);
            });
          }
          session.preferences.delete(socket.data.userId);
        }

        await cleanupUserSFU(io, roomId, socket.data.userId);
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.userId}`);
      socket.rooms.forEach(roomId => {
        if (roomId === socket.id) return;
        io.to(roomId).emit('participant-left', { userId: socket.data.userId });

        const session = roomSessions.get(roomId);
        if (session) {
          const oldLang = session.preferences.get(socket.data.userId) ?? null;
          if (oldLang) {
            io.in(roomId)
              .fetchSockets()
              .then(socketsInRoom => {
                socketsInRoom
                  .filter(s => s.id !== socket.id)
                  .forEach(s => {
                    decSubscriber(io, roomId, s.data.userId, oldLang, socket.data.userId);
                  });
              })
              .catch(() => {});
          }
          session.preferences.delete(socket.data.userId);
        }

        cleanupUserSFU(io, roomId, socket.data.userId).catch(() => {});
      });
    });

    // -----------------------------------------------------------------------
    // Media state relay
    // -----------------------------------------------------------------------

    socket.on('media-state-change', mediaState => {
      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      rooms.forEach(roomId => {
        socket.to(roomId).emit('media-state-change', {
          userId: socket.data.userId,
          mediaState,
        });
      });
    });

    // -----------------------------------------------------------------------
    // Translation preference
    // -----------------------------------------------------------------------

    socket.on(EVENT_TRANSLATION_PREFERENCE, data => {
      const { language } = data || {};
      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      rooms.forEach(roomId => {
        const state = getSession(roomId);
        const userId = socket.data.userId;
        const oldLang = state.preferences.get(userId) ?? null;
        const newLang = language && SUPPORTED_LANGUAGES.has(language) ? language : null;
        if (oldLang === newLang) return;
        state.preferences.set(userId, newLang);
        io.in(roomId)
          .fetchSockets()
          .then(socketsInRoom => {
            const speakerIds = socketsInRoom
              .filter(s => s.id !== socket.id)
              .map(s => s.data.userId);
            speakerIds.forEach(speakerId => {
              if (oldLang) decSubscriber(io, roomId, speakerId, oldLang, userId);
              if (newLang) incSubscriber(io, roomId, speakerId, newLang, userId);
            });
          })
          .catch(() => {});
      });
    });

    // -----------------------------------------------------------------------
    // SFU signaling
    // -----------------------------------------------------------------------

    socket.on(SFU_GET_ROUTER_RTP_CAPABILITIES, ({ roomId }, ack) => {
      const session = roomSessions.get(roomId);
      if (!session?.router) {
        if (typeof ack === 'function') ack({ error: 'No router for room' });
        return;
      }
      if (typeof ack === 'function') ack(session.router.rtpCapabilities);
    });

    socket.on(SFU_CREATE_TRANSPORT, async ({ roomId, direction }, ack) => {
      try {
        const session = getSession(roomId);
        const router = session.router;
        if (!router) throw new Error('No router for room ' + roomId);

        const transport = await router.createWebRtcTransport(webRtcTransportOptions);

        // Store transport
        if (!session.transports.has(socket.data.userId)) {
          session.transports.set(socket.data.userId, {});
        }
        session.transports.get(socket.data.userId)[direction] = transport;

        if (typeof ack === 'function') {
          ack({
            transportId: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          });
        }
      } catch (err) {
        console.error('sfu:create-transport error', err);
        if (typeof ack === 'function') ack({ error: err.message });
      }
    });

    socket.on(SFU_CONNECT_TRANSPORT, async ({ transportId, dtlsParameters }, ack) => {
      try {
        const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
        if (!roomId) throw new Error('Socket is not in any room');
        const session = roomSessions.get(roomId);
        if (!session) throw new Error('Session not found for room: ' + roomId);
        const userTransports = session.transports.get(socket.data.userId);
        if (!userTransports) throw new Error('No transports for user: ' + socket.data.userId);
        const transport = Object.values(userTransports).find(t => t?.id === transportId);
        if (!transport) throw new Error('Transport not found: ' + transportId);
        await transport.connect({ dtlsParameters });
        if (typeof ack === 'function') ack({});
      } catch (err) {
        console.error('sfu:connect-transport error', err);
        if (typeof ack === 'function') ack({ error: err.message });
      }
    });

    socket.on(SFU_PRODUCE, async ({ roomId, transportId, kind, rtpParameters }, ack) => {
      try {
        const session = getSession(roomId);
        const userId = socket.data.userId;
        const userTransports = session.transports.get(userId);
        const sendTransport = userTransports?.send;
        if (!sendTransport || sendTransport.id !== transportId) {
          throw new Error('Send transport not found: ' + transportId);
        }

        const producer = await sendTransport.produce({ kind, rtpParameters });
        if (!session.producers.has(userId)) session.producers.set(userId, new Map());
        session.producers.get(userId).set(kind, producer);

        // When the client closes this producer (e.g. camera/mic toggle off),
        // notify the room so other clients can remove the consumer + track.
        producer.observer.on('close', () => {
          session.producers.get(userId)?.delete(kind);
          io.to(roomId).emit(SFU_PRODUCER_CLOSED, {
            producerId: producer.id,
            userId,
          });
        });

        // Register speaker entry for ASR (audio only)
        if (kind === 'audio') {
          if (!session.speakers.has(userId)) {
            session.speakers.set(userId, { pcUserId: userId, asrActive: false });
          }
          // If language channels were already started (incSubscriber was called before
          // the producer existed), kick off ASR now that the producer is available.
          const langMap = session.pipelines.get(userId);
          if (langMap) {
            const hasWaiting = Array.from(langMap.values()).some(e => e.state !== 'stopped');
            if (hasWaiting) {
              ensureASRSession(io, roomId, userId).catch(err =>
                console.error('ASR session error (retroactive)', err)
              );
            }
          }
        }

        // Notify existing participants so they can consume this producer
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) {
          if (s.id !== socket.id) {
            io.to(s.id).emit(SFU_NEW_PRODUCER, {
              producerId: producer.id,
              userId,
              kind,
            });
          }
        }

        if (typeof ack === 'function') ack({ producerId: producer.id });
      } catch (err) {
        console.error('sfu:produce error', err);
        if (typeof ack === 'function') ack({ error: err.message });
      }
    });

    socket.on(SFU_CLOSE_PRODUCER, async ({ roomId, kind }, ack) => {
      try {
        const session = getSession(roomId);
        const userId = socket.data.userId;
        const producerMap = session.producers.get(userId);
        const producer = producerMap?.get(kind);
        if (producer) {
          producer.close(); // triggers producer.observer.on('close') → emits SFU_PRODUCER_CLOSED
        }
        if (typeof ack === 'function') ack({});
      } catch (err) {
        console.error('sfu:close-producer error', err);
        if (typeof ack === 'function') ack({ error: err.message });
      }
    });

    socket.on(SFU_CONSUME, async ({ roomId, producerId, rtpCapabilities }, ack) => {
      try {
        const session = getSession(roomId);
        const userId = socket.data.userId;
        const router = session.router;
        if (!router) throw new Error('No router for room ' + roomId);

        if (!router.canConsume({ producerId, rtpCapabilities })) {
          throw new Error('Cannot consume producerId: ' + producerId);
        }

        const recvTransport = session.transports.get(userId)?.recv;
        if (!recvTransport) throw new Error('Recv transport not found for user: ' + userId);

        const consumer = await recvTransport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });

        if (!session.consumers.has(userId)) session.consumers.set(userId, new Map());
        session.consumers.get(userId).set(producerId, consumer);

        consumer.on('transportclose', () => {
          session.consumers.get(userId)?.delete(producerId);
        });
        consumer.on('producerclose', () => {
          session.consumers.get(userId)?.delete(producerId);
        });

        if (typeof ack === 'function') {
          ack({
            consumerId: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          });
        }
      } catch (err) {
        console.error('sfu:consume error', err);
        if (typeof ack === 'function') ack({ error: err.message });
      }
    });

    socket.on(SFU_RESUME_CONSUMER, async ({ consumerId }, ack) => {
      try {
        const userId = socket.data.userId;
        // Find consumer across room sessions
        for (const [, session] of roomSessions) {
          const userConsumers = session.consumers.get(userId);
          if (userConsumers) {
            for (const [, consumer] of userConsumers) {
              if (consumer.id === consumerId) {
                await consumer.resume();
                if (typeof ack === 'function') ack({});
                return;
              }
            }
          }
        }
        throw new Error('Consumer not found: ' + consumerId);
      } catch (err) {
        console.error('sfu:resume-consumer error', err);
        if (typeof ack === 'function') ack({ error: err.message });
      }
    });
  });

  console.log('Socket.IO server initialized');

  httpServer
    .once('error', err => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
