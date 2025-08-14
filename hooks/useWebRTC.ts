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

  // Handle socket events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribes = [
      socketClient.onParticipantJoined(async data => {
        setParticipants(prev => [...prev, { ...data, stream: undefined }]);

        // Create and send offer to new participant
        if (peerManagerRef.current && localStream) {
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
        setParticipants(participants.map(p => ({ ...p, stream: undefined })));
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

  // Set up ICE candidate handling
  useEffect(() => {
    if (!peerManagerRef.current) return;

    peerManagerRef.current.onIceCandidate = (targetUserId, candidate) => {
      socketClient.sendSignal({
        type: 'ice-candidate',
        payload: candidate,
        targetUserId,
      });
    };
  }, []);

  const toggleCamera = useCallback(async () => {
    try {
      if (!peerManagerRef.current) return;
      const isOn = await peerManagerRef.current.toggleVideo();
      setMediaState(prev => ({ ...prev, video: isOn }));
      setLocalStream(peerManagerRef.current.getLocalStream());
    } catch (err) {
      console.error('Error toggling camera:', err);
      setError('Failed to access camera');
    }
  }, []);

  const toggleAudio = useCallback(async () => {
    try {
      if (!peerManagerRef.current) return;
      const isOn = await peerManagerRef.current.toggleAudio();
      setMediaState(prev => ({ ...prev, audio: isOn }));
      setLocalStream(peerManagerRef.current.getLocalStream());
    } catch (err) {
      console.error('Error toggling audio:', err);
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
  };
}
