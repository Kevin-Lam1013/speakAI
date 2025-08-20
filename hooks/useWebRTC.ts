'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PeerConnectionManager } from '@/lib/webrtc/PeerConnectionManager';
import { socketClient } from '@/lib/socket/client';

interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

interface Participant {
  userId: string;
  email: string;
  stream?: MediaStream;
  mediaState?: MediaState;
}

interface MediaState {
  video: boolean;
  audio: boolean;
}

type SignalingType = 'offer' | 'answer' | 'ice-candidate';

interface SignalingMessage {
  type: SignalingType;
  payload: any;
  fromUserId: string;
  targetUserId: string;
}

export function useWebRTC(roomId: string, userId: string, token: string) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>();
  const peerManagerRef = useRef<PeerConnectionManager>();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaState, setMediaState] = useState<MediaState>({ video: false, audio: false });
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize WebRTC and Socket connection
  useEffect(() => {
    // Don't connect if we don't have all required data
    if (!roomId || !userId || !token) {
      return;
    }

    const config: WebRTCConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Add TURN servers here for production
      ],
    };

    // Create peer connection manager
    const peerManager = new PeerConnectionManager(
      config,
      (userId, stream) => {
        setParticipants(prev => prev.map(p => (p.userId === userId ? { ...p, stream } : p)));
      },
      userId => {
        setParticipants(prev =>
          prev.map(p => (p.userId === userId ? { ...p, stream: undefined } : p))
        );
      }
    );

    peerManagerRef.current = peerManager;

    // Connect to signaling server
    socketClient
      .connect(token)
      .then(() => {
        setIsConnected(true);
        return socketClient.joinRoom(roomId);
      })
      .catch(err => {
        setError(err.message);
        setIsConnected(false);
      });

    return () => {
      peerManager.closeAllConnections();
      socketClient.leaveRoom(roomId).catch(console.error);
    };
  }, [roomId, userId, token]);

  // Initialize media streams when connected
  useEffect(() => {
    if (isConnected && !isInitialized) {
      const initializeMedia = async () => {
        try {
          if (peerManagerRef.current) {
            // Start with camera and mic off by default
            const initialMediaState = { video: false, audio: false };
            setMediaState(initialMediaState);

            // Send initial media state to other participants
            await socketClient.sendMediaState(initialMediaState);
            setIsInitialized(true);
          }
        } catch (err) {
          setError('Failed to initialize media');
        }
      };

      initializeMedia();
    }
  }, [isConnected, isInitialized]);

  // Handle socket events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribes = [
      socketClient.onParticipantJoined(async data => {
        setParticipants(prev => [
          ...prev,
          { ...data, stream: undefined, mediaState: { video: false, audio: false } },
        ]);

        // Create and send offer to new participant (always create offer, even if no local stream)
        if (peerManagerRef.current) {
          const offer = await peerManagerRef.current.createOffer(data.userId);
          socketClient.sendSignal({
            type: 'offer',
            payload: offer,
            targetUserId: data.userId,
          });
        }
      }),

      socketClient.onParticipantLeft(data => {
        setParticipants(prev => prev.filter(p => p.userId !== data.userId));
      }),

      socketClient.onRoomParticipants(participants => {
        setParticipants(
          participants.map(p => ({
            ...p,
            stream: undefined,
            mediaState: { video: false, audio: false },
          }))
        );
      }),

      socketClient.onMediaStateChange(data => {
        setParticipants(prev =>
          prev.map(p => (p.userId === data.userId ? { ...p, mediaState: data.mediaState } : p))
        );
      }),

      socketClient.onSignal(async (data: SignalingMessage) => {
        if (!peerManagerRef.current) return;

        const response = await peerManagerRef.current.handleSignalingMessage(data);
        if (response) {
          socketClient.sendSignal({
            type: response.type as SignalingType,
            payload: response.payload,
            targetUserId: data.fromUserId,
          });
        }
      }),
    ];

    return () => unsubscribes.forEach(unsub => unsub());
  }, [isConnected, localStream]);

  // Set up ICE candidate handling and renegotiation
  useEffect(() => {
    if (!peerManagerRef.current) return;

    peerManagerRef.current.onIceCandidate = (targetUserId, candidate) => {
      socketClient.sendSignal({
        type: 'ice-candidate',
        payload: candidate,
        targetUserId,
      });
    };

    peerManagerRef.current.onRenegotiationNeeded = (targetUserId, offer) => {
      socketClient.sendSignal({
        type: 'offer',
        payload: offer,
        targetUserId,
      });
    };
  }, [isConnected]);

  const toggleCamera = useCallback(async () => {
    try {
      if (!peerManagerRef.current) return;
      const isOn = await peerManagerRef.current.toggleVideo();
      const newMediaState = { ...mediaState, video: isOn };
      setMediaState(newMediaState);
      const newLocalStream = peerManagerRef.current.getLocalStream();
      setLocalStream(newLocalStream);

      // Ensure renegotiation callback is set
      if (peerManagerRef.current && !peerManagerRef.current.onRenegotiationNeeded) {
        peerManagerRef.current.onRenegotiationNeeded = (targetUserId, offer) => {
          socketClient.sendSignal({
            type: 'offer',
            payload: offer,
            targetUserId,
          });
        };
      }

      // Notify other participants of media state change
      await socketClient.sendMediaState(newMediaState);
    } catch (err) {
      setError('Failed to access camera');
    }
  }, [mediaState]);

  const toggleAudio = useCallback(async () => {
    try {
      if (!peerManagerRef.current) return;
      const isOn = await peerManagerRef.current.toggleAudio();
      const newMediaState = { ...mediaState, audio: isOn };
      setMediaState(newMediaState);
      setLocalStream(peerManagerRef.current.getLocalStream());

      // Notify other participants of media state change
      await socketClient.sendMediaState(newMediaState);
    } catch (err) {
      console.error('Error toggling audio:', err);
      setError('Failed to access microphone');
    }
  }, [mediaState]);

  return {
    participants,
    localStream,
    isConnected,
    error,
    mediaState,
    toggleCamera,
    toggleAudio,
  };
}
