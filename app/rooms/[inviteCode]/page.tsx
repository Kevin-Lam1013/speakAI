'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Container } from '@mui/material';
import VideoGrid from '@/components/room/VideoGrid';
import RoomControls from '@/components/room/RoomControls';
import RoomHeader from '@/components/room/RoomHeader';
import LoadingState from '@/components/shared/LoadingState';
import { useWebRTC } from '@/hooks/useWebRTC';
import { socketClient } from '@/lib/socket/client';
import { api } from '@/lib/api';
import TranslationControls from '@/components/room/TranslationControls';
import TranslatedAudioSink from '@/components/room/TranslatedAudioSink';

interface RoomData {
  id: string;
  name: string;
  creatorId: string;
  status: 'active' | 'ended';
}

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  isCameraOn?: boolean;
  isAudioOn?: boolean;
}

export default function RoomPage() {
  const router = useRouter();
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [room, setRoom] = useState<RoomData>();
  const [accessToken, setAccessToken] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const [selectedLanguage, setSelectedLanguage] = useState<null | 'en-US' | 'fr-FR' | 'es-ES' | 'zh-CN'>(null);
  const [translatedStreams, setTranslatedStreams] = useState<MediaStream[]>([]);

  // Fetch room data and user info
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get room details
        const roomResponse = await api.get(`/api/rooms/${inviteCode}`);
        if (!roomResponse.ok) {
          throw new Error('Room not found or has ended');
        }
        const roomData = await roomResponse.json();
        setRoom(roomData.room);

        // Get current user info
        const userResponse = await api.get('/api/auth/me');
        if (!userResponse.ok) {
          throw new Error('Failed to get user info');
        }
        const userData = await userResponse.json();
        setUserId(userData.id);

        // Get access token for socket authentication
        const tokenResponse = await api.get('/api/auth/token');
        if (!tokenResponse.ok) {
          throw new Error('Failed to get access token');
        }
        const tokenData = await tokenResponse.json();
        setAccessToken(tokenData.accessToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [inviteCode]);

  // Initialize WebRTC once we have the room and user info
  const {
    participants,
    localStream,
    isConnected,
    error: webRTCError,
    mediaState,
    toggleCamera,
    toggleAudio,
    botStream,
  } = useWebRTC(room?.id || '', userId || '', accessToken || '');

  // Handle translation preference change (emit only; server/bot to be implemented later)
  const handleLanguageChange = (language: 'en-US' | 'fr-FR' | 'es-ES' | 'zh-CN' | null) => {
    setSelectedLanguage(language);
    socketClient.sendTranslationPreference({ language }).catch(() => {});
  };

  const handleLeaveRoom = async () => {
    try {
      // Inform server via HTTP to mark participant as left
      if (inviteCode) {
        try {
          await api.put(`/api/rooms/${inviteCode}/leave`);
        } catch (e) {
          // Non-blocking: proceed even if HTTP call fails
        }
      }

      await socketClient.leaveRoom(room?.id || '');
      router.push('/dashboard');
    } catch (err) {
      console.error('Error leaving room:', err);
    }
  };

  const handleEndRoom = async () => {
    try {
      const response = await api.put(`/api/rooms/${inviteCode}/end`);
      if (response.ok) {
        handleLeaveRoom();
      }
    } catch (err) {
      console.error('Error ending room:', err);
    }
  };

  if (isLoading) {
    return <LoadingState message="Joining room..." />;
  }

  if (error || !room || !userId || !accessToken) {
    return <LoadingState message={error || 'Room not found'} />;
  }

  // TODO: Create an error page instead of this ???
  if (webRTCError) {
    return <LoadingState message={`Connection error: ${webRTCError}`} />;
  }

  if (!isConnected) {
    return <LoadingState message="Connecting to room..." />;
  }

  const allParticipants: Participant[] = participants.map(p => ({
    id: p.userId,
    name: p.userId === userId ? 'Me' : p.email,
    stream: p.userId === userId ? localStream || undefined : p.stream,
    isCameraOn: p.userId === userId ? mediaState.video : p.mediaState?.video || false,
    isAudioOn: p.userId === userId ? mediaState.audio : p.mediaState?.audio || false,
  }));

  // Replace-mode muting: only when a live translated audio track exists
  const translatedActive =
    !!selectedLanguage &&
    !!botStream?.getAudioTracks().some(t => t.readyState === 'live' && t.enabled && !t.muted);

  return (
    <Container maxWidth="xl" sx={{ height: '100vh', pt: 8, pb: 8 }}>
      <RoomHeader
        roomName={room.name}
        participantCount={allParticipants.length}
        isCreator={room.creatorId === userId}
        onEndRoom={handleEndRoom}
      />

      {/* Hidden audio sinks for translated tracks (Replace mode handled by track composition) */}
      <TranslatedAudioSink streams={botStream ? [botStream] : []} replaceMode />

      <VideoGrid
        participants={allParticipants.map(p => ({
          ...p,
          // Mute all remote originals when translation is active (simple global replace mode)
          isAudioOn:
            p.id === userId
              ? mediaState.audio
              : translatedActive
                ? false
                : p.isAudioOn,
        }))}
        localParticipantId={userId}
      />  

      <RoomControls
        isCameraOn={mediaState.video}
        isAudioOn={mediaState.audio}
        onCameraToggle={toggleCamera}
        onAudioToggle={toggleAudio}
        onLeaveRoom={handleLeaveRoom}
        translationControl={
          <TranslationControls
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
          />
        }
      />
    </Container>
  );
}
