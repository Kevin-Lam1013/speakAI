import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import * as jose from 'jose';
import wrtc from 'wrtc';
import dotenv from 'dotenv';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from '@aws-sdk/client-transcribe-streaming';

// Load env for the custom server
dotenv.config({ path: '.env.local' });
dotenv.config();
// Translation event names (define locally to avoid TS imports in Node)
const EVENT_TRANSLATION_PREFERENCE = 'translation:preference';
const EVENT_TRANSLATION_TRACK_READY = 'translation:track-ready';
const EVENT_TRANSLATION_PIPELINE_STATUS = 'translation:pipeline-status';

// --- Translation in-memory state (room-scoped) ---
const GRACE_PERIOD_MS = 15000; // 15s
const SUPPORTED_LANGUAGES = new Set(['en-US', 'fr-FR', 'es-ES', 'zh-CN']);
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const GOOGLE_MT_KEY = process.env.GOOGLE_MT_KEY;
const AZURE_TTS_KEY = process.env.AZURE_TTS_KEY;
const AZURE_TTS_REGION = process.env.AZURE_TTS_REGION || 'eastus';
const AZURE_TTS_VOICE = process.env.AZURE_TTS_VOICE || 'en-US-FableMultilingualNeural';
const LANGUAGE_OPTIONS = ['en-US', 'fr-FR', 'es-US', 'zh-CN'];
const DEFAULT_LANGUAGE_CODE = 'en-US';

/**
 * roomId -> {
 *   preferences: Map<userId, language|null>,
 *   pipelines: Map<speakerId, Map<language, {
 *      subscribers:Set<userId>, state:string, timeout?:NodeJS.Timeout,
 *      source?: any, track?: MediaStreamTrack,
 *      senders?: Map<userId, RTCRtpSender>,
 *      silenceTimer?: NodeJS.Timeout
 *   }>>
 * }
 */
const translationRooms = new Map();
const botPeersByRoom = new Map(); // roomId -> Map<userId, RTCPeerConnection>
const BOT_USER_ID = 'translator-bot';
const botPendingIce = new Map(); // roomId -> Map<userId, RTCIceCandidateInit[]>

function getBotPeers(roomId) {
  if (!botPeersByRoom.has(roomId)) botPeersByRoom.set(roomId, new Map());
  return botPeersByRoom.get(roomId);
}

function queueBotIce(roomId, userId, cand) {
  if (!botPendingIce.has(roomId)) botPendingIce.set(roomId, new Map());
  const m = botPendingIce.get(roomId);
  if (!m.has(userId)) m.set(userId, []);
  m.get(userId).push(cand);
}

function drainBotIce(roomId, userId, pc) {
  const m = botPendingIce.get(roomId);
  if (!m) return;
  const list = m.get(userId);
  if (!list) return;
  list.forEach(c => {
    pc.addIceCandidate(new wrtc.RTCIceCandidate(c)).catch(e => {
      console.warn('Bot addIceCandidate (drain) failed', e);
    });
  });
  m.delete(userId);
}

async function emitSignalToUser(io, roomId, targetUserId, signal) {
  const sockets = await io.in(roomId).fetchSockets();
  const target = sockets.find(s => s.data.userId === targetUserId);
  if (target) {
    io.to(target.id).emit('signal', signal);
  }
}

async function createBotPeerForUser(io, roomId, targetUserId) {
  const peers = getBotPeers(roomId);
  if (peers.has(targetUserId)) return peers.get(targetUserId);

  const pc = new wrtc.RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  // Receive user's audio (speaker track)
  pc.addTransceiver('audio', { direction: 'recvonly' });

  // Placeholder: publish one silent audio track (later per-language)
  const source = new wrtc.nonstandard.RTCAudioSource();
  const track = source.createTrack();
  pc.addTrack(track);

  pc.onicecandidate = event => {
    if (event.candidate) {
      emitSignalToUser(io, roomId, targetUserId, {
        type: 'ice-candidate',
        payload: event.candidate,
        fromUserId: BOT_USER_ID,
        targetUserId,
      });
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      try {
        pc.close();
      } catch {}
      peers.delete(targetUserId);
    }
  };

  pc.ontrack = event => {
    // User's inbound audio; attach sink for ASR once
    const track = event.track;
    const room = getRoomState(roomId);
    const speakers = room.speakers || new Map();
    if (!room.speakers) room.speakers = speakers;
    let speaker = speakers.get(targetUserId);
    if (!speaker) {
      speaker = { pcUserId: targetUserId };
      speakers.set(targetUserId, speaker);
    }
    if (!speaker.sink && track.kind === 'audio') {
      try {
        const sink = new wrtc.nonstandard.RTCAudioSink(track);
        speaker.sink = sink;
        // Start ASR session lazily when a first language channel becomes active
      } catch (e) {
        console.error('Failed to create RTCAudioSink', e);
      }
    }
  };

  peers.set(targetUserId, pc);

  // Create offer from bot to user
  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
  await pc.setLocalDescription(offer);
  await emitSignalToUser(io, roomId, targetUserId, {
    type: 'offer',
    payload: offer,
    fromUserId: BOT_USER_ID,
    targetUserId,
  });

  return pc;
}

function getRoomState(roomId) {
  if (!translationRooms.has(roomId)) {
    translationRooms.set(roomId, {
      preferences: new Map(),
      pipelines: new Map(),
    });
  }
  return translationRooms.get(roomId);
}

function incSubscriber(io, roomId, speakerId, language, userId) {
  const room = getRoomState(roomId);
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
    io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, {
      speakerId,
      language,
      state: 'starting',
    });
    // Start channel: create source/track and add to all bot peers in room
    startLanguageChannel(io, roomId, speakerId, language)
      .then(() => {
        entry.state = 'active';
        io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, {
          speakerId,
          language,
          state: 'active',
        });
        io.to(roomId).emit(EVENT_TRANSLATION_TRACK_READY, {
          speakerId,
          language,
          trackId: `${speakerId}:${language}`,
        });
      })
      .catch(err => {
        console.error('Failed to start language channel', speakerId, language, err);
        entry.state = 'error';
        io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, {
          speakerId,
          language,
          state: 'error',
        });
      });
  } else if (entry.state === 'active') {
    // Attach this language track to the new subscriber's bot peer only
    const peers = getBotPeers(roomId);
    const pc = peers.get(userId);
    if (pc && entry.track) {
      (async () => {
        try {
          const sender = pc.addTrack(entry.track);
          entry.senders = entry.senders || new Map();
          entry.senders.set(userId, sender);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await emitSignalToUser(io, roomId, userId, {
            type: 'offer',
            payload: offer,
            fromUserId: BOT_USER_ID,
            targetUserId: userId,
          });
        } catch (e) {
          console.error('Failed to attach active channel to new subscriber', userId, e);
        }
      })();
    }
  }
}

function decSubscriber(io, roomId, speakerId, language, userId) {
  const room = getRoomState(roomId);
  const langMap = room.pipelines.get(speakerId);
  if (!langMap) return;
  const entry = langMap.get(language);
  if (!entry) return;
  entry.subscribers.delete(userId);
  // Detach this user from the language track if attached
  const peers = getBotPeers(roomId);
  const pc = peers.get(userId);
  const sender = entry.senders?.get(userId);
  if (pc && sender) {
    (async () => {
      try {
        pc.removeTrack(sender);
        entry.senders?.delete(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await emitSignalToUser(io, roomId, userId, {
          type: 'offer',
          payload: offer,
          fromUserId: BOT_USER_ID,
          targetUserId: userId,
        });
      } catch (e) {
        console.error('Failed to detach channel from user', userId, e);
      }
    })();
  }
  if (entry.subscribers.size === 0 && (entry.state === 'active' || entry.state === 'starting')) {
    entry.state = 'stopping';
    io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, {
      speakerId,
      language,
      state: 'stopping',
    });
    entry.timeout = setTimeout(() => {
      stopLanguageChannel(io, roomId, speakerId, language).finally(() => {
        entry.state = 'stopped';
        io.to(roomId).emit(EVENT_TRANSLATION_PIPELINE_STATUS, {
          speakerId,
          language,
          state: 'stopped',
        });
      });
    }, GRACE_PERIOD_MS);
  }
}

async function startLanguageChannel(io, roomId, speakerId, language) {
  const room = getRoomState(roomId);
  // ensure speakers map exists
  if (!room.speakers) room.speakers = new Map();
  if (!room.pipelines.has(speakerId)) room.pipelines.set(speakerId, new Map());
  const langMap = room.pipelines.get(speakerId);
  const entry = langMap.get(language) || { subscribers: new Set(), state: 'starting' };
  langMap.set(language, entry);

  // Create audio source/track for this channel
  const source = new wrtc.nonstandard.RTCAudioSource();
  const track = source.createTrack();
  entry.source = source;
  entry.track = track;
  entry.senders = entry.senders || new Map();

  // Attach only to current subscribers' peers and renegotiate
  const peers = getBotPeers(roomId);
  await Promise.all(
    Array.from(entry.subscribers.values()).map(async targetUserId => {
      const pc = peers.get(targetUserId);
      if (!pc) return;
      try {
        const sender = pc.addTrack(track);
        entry.senders.set(targetUserId, sender);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await emitSignalToUser(io, roomId, targetUserId, {
          type: 'offer',
          payload: offer,
          fromUserId: BOT_USER_ID,
          targetUserId,
        });
      } catch (e) {
        console.error('Failed to attach channel to peer', targetUserId, e);
      }
    })
  );

  // Push silence frames to keep track alive; replaced later by TTS audio
  const sampleRate = 48000;
  const channelCount = 1;
  const frameDurationMs = 20;
  entry.silenceTimer = setInterval(() => {
    try {
      const numberOfFrames = (sampleRate * frameDurationMs) / 1000;
      const samples = new Int16Array(numberOfFrames * channelCount);
      source.onData({
        samples,
        sampleRate,
        bitsPerSample: 16,
        channelCount,
        numberOfFrames,
      });
    } catch {}
  }, frameDurationMs);

  // Start ASR for this speaker (lazy), so we receive finalized transcripts to drive MT+TTS
  const asrPromise = ensureASRSession(io, roomId, speakerId);
  if (asrPromise?.catch) {
    asrPromise.catch(err => {
      console.error('ASR session error', err);
    });
  }
}

async function stopLanguageChannel(io, roomId, speakerId, language) {
  const room = getRoomState(roomId);
  const langMap = room.pipelines.get(speakerId);
  if (!langMap) return;
  const entry = langMap.get(language);
  if (!entry) return;

  if (entry.silenceTimer) {
    clearInterval(entry.silenceTimer);
    entry.silenceTimer = undefined;
  }

  const peers = getBotPeers(roomId);
  // Remove track from all peers and renegotiate
  await Promise.all(
    Array.from(peers.entries()).map(async ([targetUserId, pc]) => {
      const sender = entry.senders?.get(targetUserId);
      if (!sender) return;
      try {
        pc.removeTrack(sender);
        entry.senders?.delete(targetUserId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await emitSignalToUser(io, roomId, targetUserId, {
          type: 'offer',
          payload: offer,
          fromUserId: BOT_USER_ID,
          targetUserId,
        });
      } catch (e) {
        console.error('Failed to remove channel from peer', targetUserId, e);
      }
    })
  );

  try {
    entry.track?.stop?.();
  } catch {}
  entry.track = undefined;
  entry.source = undefined;
  entry.lastSpokenText = '';

  // If this speaker has no active channels with subscribers, stop ASR session
  const langMap2 = room.pipelines.get(speakerId);
  const stillActive =
    !!langMap2 &&
    Array.from(langMap2.values()).some(e => e.state === 'active' && e.subscribers?.size > 0);
  if (!stillActive && room.speakers?.has(speakerId)) {
    const sp = room.speakers.get(speakerId);
    try {
      sp?.transcribeAbort?.abort?.();
    } catch {}
    try {
      sp?.transcribeClient?.destroy?.();
    } catch {}
    try {
      sp?.sink?.stop?.();
    } catch {}
    if (sp) sp.asrActive = false;
  }
}

function ensureASRSession(io, roomId, speakerId) {
  const room = getRoomState(roomId);
  if (!room.speakers) room.speakers = new Map();
  const speaker = room.speakers.get(speakerId);
  if (!speaker || speaker.asrActive) return Promise.resolve();

  if (!AWS_REGION) {
    console.warn('AWS_REGION not set; ASR disabled');
    speaker.asrActive = false;
    return Promise.resolve();
  }
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.warn('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set; ASR disabled');
    speaker.asrActive = false;
    return Promise.resolve();
  }
  if (!speaker.sink) {
    // No audio yet
    return Promise.resolve();
  }

  speaker.asrActive = true;

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

  // Avoid unbounded queue growth in bad network conditions
  const MAX_QUEUE = 50;

  const signalDone = () => {
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  };

  speaker.sink.ondata = data => {
    try {
      const down = downsampleBuffer(data.samples, 48000, 16000);
      if (audioQueue.length < MAX_QUEUE) {
        audioQueue.push(Buffer.from(down.buffer));
      }
      signalDone();
    } catch (e) {
      console.error('Failed to enqueue audio chunk', e);
    }
  };

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

  speaker.transcribeClient = client;
  speaker.transcribeAbort = abortController;

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
          await handleFinalTranscript(io, roomId, speakerId, transcript, true);
        }
      }
    }
  }

  (async () => {
    try {
      // First try with language ID
      await startStream({ identify: true });
    } catch (err) {
      console.error(
        'Transcribe stream (identify) failed, falling back to fixed language',
        err?.name || err?.code || err,
        err?.message,
        err?.$metadata
      );
      try {
        // Fallback to a fixed language to keep pipeline alive
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
      speaker.asrActive = false;
      abortController.abort();
    }
  })();
}

async function handleFinalTranscript(io, roomId, speakerId, text, isFinal) {
  const room = getRoomState(roomId);
  const langMap = room.pipelines.get(speakerId);
  if (!langMap) return;
  const entries = Array.from(langMap.entries()).filter(([, e]) => e.state === 'active');
  await Promise.all(
    entries.map(async ([language, entry]) => {
      try {
        const translated = await googleTranslate(text, language);
        const spoken = decodeEntities(translated);
        await ttsToChannel(entry, spoken, language);
      } catch (e) {
        console.error('MT/TTS failed', e);
      }
    })
  );
}

async function googleTranslate(text, target) {
  if (!GOOGLE_MT_KEY) return text;
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
    return translated || text;
  } catch {
    return text;
  }
}

async function ttsToChannel(entry, text, language) {
  if (!AZURE_TTS_KEY) return;
  try {
    const pcm = await azureTTS(text, language);
    if (!pcm || !entry.source) return;
    entry.ttsQueue = (entry.ttsQueue || Promise.resolve()).then(() =>
      writePcmToSource(entry.source, pcm, 48000)
    );
    await entry.ttsQueue;
  } catch (e) {
    console.error('Azure TTS error', e);
  }
}

async function azureTTS(text, language) {
  const endpoint = `https://${AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<?xml version="1.0" encoding="utf-8"?>\n<speak version=\"1.0\" xml:lang=\"${language}\">\n  <voice name=\"${AZURE_TTS_VOICE}\">\n    ${escapeXml(text)}\n  </voice>\n</speak>`;
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
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function writePcmToSource(source, pcmBuffer, sampleRate) {
  const bitsPerSample = 16;
  const channelCount = 1;
  const bytesPerSample = bitsPerSample / 8;
  const samples = new Int16Array(
    pcmBuffer.buffer,
    pcmBuffer.byteOffset,
    Math.floor(pcmBuffer.byteLength / bytesPerSample)
  );
  // RTCAudioSource expects a fixed numberOfFrames; use 10ms @ 48kHz = 480 samples
  const chunkSize = Math.floor((sampleRate / 1000) * 10); // 10ms chunks
  for (let i = 0; i < samples.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, samples.length);
    const slice = samples.subarray(i, end);

    // Always copy into a fresh buffer of exactly chunkSize to satisfy byteLength expectations
    const payload = new Int16Array(chunkSize);
    payload.set(slice);

    source.onData({
      samples: payload,
      sampleRate,
      bitsPerSample,
      channelCount,
      numberOfFrames: payload.length / channelCount,
    });
  }
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
  return (
    String(str)
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      // numeric decimal entities
      .replace(/&#(\d+);/g, (_, d) => {
        const code = Number(d);
        return Number.isFinite(code) ? String.fromCharCode(code) : _;
      })
      // numeric hex entities
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
        const code = parseInt(h, 16);
        return Number.isFinite(code) ? String.fromCharCode(code) : _;
      })
  );
}

// Simple downsampler from 48k to 16k (mono) for Transcribe requirements
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

// JWT verification function
async function verifyAccessToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    throw new Error('Invalid access token');
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
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

  // Initialize Socket.IO server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication failed - no token'));
      }

      const decoded = await verifyAccessToken(token);
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      next();
    } catch (error) {
      next(new Error('Authentication failed - invalid token'));
    }
  });

  // Handle socket connections
  io.on('connection', socket => {
    console.log(`User connected: ${socket.data.userId}`);

    // Handle joining a room
    socket.on('join-room', async roomId => {
      try {
        // Join the Socket.IO room
        await socket.join(roomId);

        // Get all participants in the room
        const sockets = await io.in(roomId).fetchSockets();
        const participants = sockets
          .filter(s => !s.data?.isTranslatorBot)
          .map(s => ({
            userId: s.data.userId,
            email: s.data.email,
          }));

        // Notify everyone in the room about the new participant
        io.to(roomId).emit('participant-joined', {
          userId: socket.data.userId,
          email: socket.data.email,
        });

        // Send the list of existing participants to the new participant
        socket.emit('room-participants', participants);

        // Ensure bot peer offers to this user (without listing as participant)
        try {
          await createBotPeerForUser(io, roomId, socket.data.userId);
        } catch (e) {
          console.error('Failed to create bot peer for user', socket.data.userId, e);
        }
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle WebRTC signaling
    socket.on('signal', data => {
      const { type, payload, targetUserId } = data;

      // Find sockets for the target user in the same rooms as the sender
      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);

      rooms.forEach(async roomId => {
        if (targetUserId === BOT_USER_ID) {
          // Handle signaling to server-side bot
          const peers = getBotPeers(roomId);
          let pc = peers.get(socket.data.userId);
          if (!pc && type === 'answer') {
            // Might happen if offer was created earlier
            pc = await createBotPeerForUser(io, roomId, socket.data.userId);
          }
          if (!pc) return;
          if (type === 'answer') {
            try {
              await pc.setRemoteDescription(new wrtc.RTCSessionDescription(payload));
              drainBotIce(roomId, socket.data.userId, pc);
            } catch (err) {
              console.error('Bot setRemoteDescription(answer) failed', err);
            }
          } else if (type === 'ice-candidate' && payload) {
            if (!pc.remoteDescription) {
              queueBotIce(roomId, socket.data.userId, payload);
              return;
            }
            pc.addIceCandidate(new wrtc.RTCIceCandidate(payload)).catch(err => {
              console.error('Bot addIceCandidate failed', err);
            });
          } else if (type === 'offer') {
            // Client initiated renegotiation
            try {
              await pc.setRemoteDescription(new wrtc.RTCSessionDescription(payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              drainBotIce(roomId, socket.data.userId, pc);
              await emitSignalToUser(io, roomId, socket.data.userId, {
                type: 'answer',
                payload: answer,
                fromUserId: BOT_USER_ID,
                targetUserId: socket.data.userId,
              });
            } catch (err) {
              console.error('Bot handle offer failed', err);
            }
          }
        } else {
          // Forward the signal only to the intended user
          try {
            await emitSignalToUser(io, roomId, targetUserId, {
              type,
              payload,
              fromUserId: socket.data.userId,
              targetUserId,
            });
          } catch (e) {
            console.error('Error forwarding signal to target', e);
          }
        }
      });
    });

    // Relay media state changes to room
    socket.on('media-state-change', mediaState => {
      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      rooms.forEach(roomId => {
        socket.to(roomId).emit('media-state-change', {
          userId: socket.data.userId,
          mediaState,
        });
      });
    });

    // Translation: listener preference updates
    socket.on(EVENT_TRANSLATION_PREFERENCE, data => {
      const { language } = data || {};
      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      rooms.forEach(roomId => {
        const state = getRoomState(roomId);
        const userId = socket.data.userId;
        const oldLang = state.preferences.get(userId) ?? null;
        const newLang = language && SUPPORTED_LANGUAGES.has(language) ? language : null;
        if (oldLang === newLang) return;
        state.preferences.set(userId, newLang);

        // For each speaker currently in the room, adjust subscriber counts
        io.in(roomId)
          .fetchSockets()
          .then(socketsInRoom => {
            const speakerIds = socketsInRoom
              .filter(s => s.id !== socket.id && !s.data?.isTranslatorBot)
              .map(s => s.data.userId);
            speakerIds.forEach(speakerId => {
              if (oldLang) {
                decSubscriber(io, roomId, speakerId, oldLang, userId);
              }
              if (newLang) {
                incSubscriber(io, roomId, speakerId, newLang, userId);
              }
            });
          })
          .catch(() => {});
      });
    });

    // Handle leaving a room
    socket.on('leave-room', async roomId => {
      try {
        await socket.leave(roomId);
        io.to(roomId).emit('participant-left', {
          userId: socket.data.userId,
        });

        // Decrement translation subscribers for this user
        const state = getRoomState(roomId);
        const oldLang = state.preferences.get(socket.data.userId) ?? null;
        if (oldLang) {
          const socketsInRoom = await io.in(roomId).fetchSockets();
          const speakerIds = socketsInRoom
            .filter(s => !s.data?.isTranslatorBot)
            .map(s => s.data.userId);
          speakerIds.forEach(speakerId => {
            decSubscriber(io, roomId, speakerId, oldLang, socket.data.userId);
          });
        }
        state.preferences.delete(socket.data.userId);
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.userId}`);
      // Notify all rooms this user was in
      socket.rooms.forEach(roomId => {
        if (roomId !== socket.id) {
          io.to(roomId).emit('participant-left', {
            userId: socket.data.userId,
          });
          // Decrement translation subscribers for this user
          const state = getRoomState(roomId);
          const oldLang = state.preferences.get(socket.data.userId) ?? null;
          if (oldLang) {
            io.in(roomId)
              .fetchSockets()
              .then(socketsInRoom => {
                const speakerIds = socketsInRoom
                  .filter(s => !s.data?.isTranslatorBot)
                  .map(s => s.data.userId);
                speakerIds.forEach(speakerId => {
                  decSubscriber(io, roomId, speakerId, oldLang, socket.data.userId);
                });
              })
              .catch(() => {});
          }
          state.preferences.delete(socket.data.userId);
        }
      });
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
