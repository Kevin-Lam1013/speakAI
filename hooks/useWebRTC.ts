'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { SFUConnectionManager } from '@/lib/webrtc/SFUConnectionManager';
import { socketClient } from '@/lib/socket/client';

interface Participant {
  userId: string;
  email: string;
  stream?: MediaStream;
  mediaState?: { video: boolean; audio: boolean };
}

export function useWebRTC(roomId: string, userId: string, token: string) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>();
  const sfuManagerRef = useRef<SFUConnectionManager>();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaState, setMediaState] = useState({ video: false, audio: false });
  const [botStream, setBotStream] = useState<MediaStream | null>(null);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  // Buffer for sfu:new-producer events that arrive before recv transport is ready
  const pendingProducers = useRef<{ producerId: string; userId: string; kind: string }[]>([]);
  const recvTransportReady = useRef(false);
  // Accumulates one MediaStream per TTS producer so multiple speakers are all heard
  const ttsStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  useEffect(() => {
    if (!roomId || !userId || !token) return;

    const sfuManager = new SFUConnectionManager({
      connectTransport: (transportId, dtlsParameters) =>
        socketClient.connectSfuTransport(transportId, dtlsParameters),

      produce: (transportId, kind, rtpParameters) =>
        socketClient.sfuProduce(roomIdRef.current, transportId, kind, rtpParameters),

      closeProducer: (kind) =>
        socketClient.sfuCloseProducer(roomIdRef.current, kind),

      consume: (producerId, rtpCapabilities) =>
        socketClient.sfuConsume(roomIdRef.current, producerId, rtpCapabilities),

      resumeConsumer: consumerId => socketClient.sfuResumeConsumer(consumerId),
    });

    // Route incoming streams to the correct state
    sfuManager.onStream = (producerUserId, stream) => {
      if (producerUserId.startsWith('tts:')) {
        ttsStreamsRef.current.set(producerUserId, stream);
        const allTracks = Array.from(ttsStreamsRef.current.values()).flatMap(s => s.getTracks());
        setBotStream(allTracks.length > 0 ? new MediaStream(allTracks) : null);
        return;
      }
      setParticipants(prev =>
        prev.map(p => (p.userId === producerUserId ? { ...p, stream } : p))
      );
    };

    sfuManager.onStreamRemoved = producerUserId => {
      if (producerUserId.startsWith('tts:')) {
        ttsStreamsRef.current.delete(producerUserId);
        const allTracks = Array.from(ttsStreamsRef.current.values()).flatMap(s => s.getTracks());
        setBotStream(allTracks.length > 0 ? new MediaStream(allTracks) : null);
        return;
      }
      setParticipants(prev =>
        prev.map(p => (p.userId === producerUserId ? { ...p, stream: undefined } : p))
      );
    };

    sfuManagerRef.current = sfuManager;

    // Refs hold unsubscribe functions so the cleanup callback can call them
    // even though they are assigned inside the async setup function.
    const unsubNewProducerRef = { current: () => {} };
    const unsubProducerClosedRef = { current: () => {} };

    const setup = async () => {
      try {
        await socketClient.connect(token);

        // Register AFTER connect (socket now exists) but BEFORE joinRoom (no events missed).
        unsubNewProducerRef.current = socketClient.onSfuNewProducer(async ({ producerId, userId: producerUserId, kind }) => {
          if (producerUserId === userId) return;
          if (!recvTransportReady.current) {
            pendingProducers.current.push({ producerId, userId: producerUserId, kind });
            return;
          }
          // A producer existing means that media kind is active. Update mediaState so the
          // audio element isn't muted when joining a room where someone already has mic on.
          if (!producerUserId.startsWith('tts:') && (kind === 'audio' || kind === 'video')) {
            setParticipants(prev =>
              prev.map(p => {
                if (p.userId !== producerUserId) return p;
                const cur = p.mediaState ?? { video: false, audio: false };
                return { ...p, mediaState: { ...cur, [kind]: true } };
              })
            );
          }
          await consumeProducer(sfuManager, producerId, producerUserId);
        });

        unsubProducerClosedRef.current = socketClient.onSfuProducerClosed(({ producerId, userId: producerUserId }) => {
          sfuManager.removeConsumerByProducerId(producerId, producerUserId);
        });

        const roomParticipants = await socketClient.joinRoom(roomId);
        // Seed participants state immediately so streams can be attached when
        // sfu:new-producer events arrive during setup.
        setParticipants(
          roomParticipants.map(p => ({
            ...p,
            stream: undefined,
            mediaState: { video: false, audio: false },
          }))
        );

        // Load mediasoup Device with the router's RTP capabilities
        const caps = await socketClient.getSfuRouterRtpCapabilities(roomId);
        await sfuManager.load(caps);

        // Create WebRTC transports
        const sendParams = await socketClient.createSfuTransport(roomId, 'send');
        await sfuManager.createSendTransport(sendParams);

        const recvParams = await socketClient.createSfuTransport(roomId, 'recv');
        await sfuManager.createRecvTransport(recvParams);

        recvTransportReady.current = true;

        // Drain any sfu:new-producer events that arrived before recv transport was ready
        const buffered = pendingProducers.current.splice(0);
        for (const ev of buffered) {
          if (!ev.userId.startsWith('tts:') && (ev.kind === 'audio' || ev.kind === 'video')) {
            setParticipants(prev =>
              prev.map(p => {
                if (p.userId !== ev.userId) return p;
                const cur = p.mediaState ?? { video: false, audio: false };
                return { ...p, mediaState: { ...cur, [ev.kind]: true } };
              })
            );
          }
          await consumeProducer(sfuManager, ev.producerId, ev.userId);
        }

        // Start with media off; send initial media state
        await socketClient.sendMediaState({ video: false, audio: false });
        setIsConnected(true);
      } catch (err: any) {
        setError(err?.message || 'Failed to connect');
        setIsConnected(false);
      }
    };

    setup();

    return () => {
      unsubNewProducerRef.current();
      unsubProducerClosedRef.current();
      sfuManager.closeAllConnections();
      socketClient.leaveRoom(roomId).catch(console.error);
      recvTransportReady.current = false;
      pendingProducers.current = [];
      ttsStreamsRef.current.clear();
    };
  }, [roomId, userId, token]);

  // Helper to consume a producer and route its stream
  async function consumeProducer(
    sfuManager: SFUConnectionManager,
    producerId: string,
    producerUserId: string
  ) {
    try {
      await sfuManager.consumeProducer(producerId, producerUserId);
    } catch (err) {
      console.error('Failed to consume producer', producerId, err);
    }
  }

  // Handle socket events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribes = [
      socketClient.onParticipantJoined(data => {
        setParticipants(prev => [
          ...prev,
          { ...data, stream: undefined, mediaState: { video: false, audio: false } },
        ]);
        // The new participant will produce, which triggers sfu:new-producer
      }),

      socketClient.onParticipantLeft(data => {
        setParticipants(prev => prev.filter(p => p.userId !== data.userId));
      }),

      socketClient.onMediaStateChange(data => {
        setParticipants(prev =>
          prev.map(p => (p.userId === data.userId ? { ...p, mediaState: data.mediaState } : p))
        );
      }),

    ];

    return () => unsubscribes.forEach(unsub => unsub());
  }, [isConnected, userId]);

  const toggleCamera = useCallback(async () => {
    const sfuManager = sfuManagerRef.current;
    if (!sfuManager) return;
    try {
      const isOn = await sfuManager.toggleVideo();
      const newMediaState = { ...sfuManager.getMediaState(), video: isOn };
      setMediaState(newMediaState);
      setLocalStream(sfuManager.getLocalStream());
      await socketClient.sendMediaState(newMediaState);
    } catch {
      setError('Failed to access camera');
    }
  }, []);

  const toggleAudio = useCallback(async () => {
    const sfuManager = sfuManagerRef.current;
    if (!sfuManager) return;
    try {
      const isOn = await sfuManager.toggleAudio();
      const newMediaState = { ...sfuManager.getMediaState(), audio: isOn };
      setMediaState(newMediaState);
      setLocalStream(sfuManager.getLocalStream());
      await socketClient.sendMediaState(newMediaState);
    } catch {
      setError('Failed to access microphone');
    }
  }, []);

  return {
    participants,
    localStream,
    isConnected,
    error,
    mediaState,
    toggleCamera,
    toggleAudio,
    botStream,
  };
}
