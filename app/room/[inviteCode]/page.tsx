'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@mui/material';
import VideoGrid from '@/components/room/VideoGrid';
import RoomControls from '@/components/room/RoomControls';
import RoomHeader from '@/components/room/RoomHeader';
import LoadingState from '@/components/shared/LoadingState';
import { useWebRTC } from '@/hooks/useWebRTC';
import { socketClient } from '@/lib/socket/client';

interface RoomPageProps {
  params: {
    inviteCode: string;
  };
}

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

export default function RoomPage({ params }: RoomPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [room, setRoom] = useState<RoomData>();
  const [accessToken, setAccessToken] = useState<string>();
  const [userId, setUserId] = useState<string>();

  // Fetch room data and user info
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get room details
        const roomResponse = await fetch(`/api/rooms/${params.inviteCode}`);
        if (!roomResponse.ok) {
          throw new Error('Room not found or has ended');
        }
        const roomData = await roomResponse.json();
        setRoom(roomData.room);

        // Get current user info
        const userResponse = await fetch('/api/auth/me');
        if (!userResponse.ok) {
          throw new Error('Failed to get user info');
        }
        const userData = await userResponse.json();
        setUserId(userData.id);

        // Get access token for socket authentication
        const tokenResponse = await fetch('/api/auth/token');
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
  }, [params.inviteCode]);

  // Initialize WebRTC once we have the room and user info
  const {
    participants,
    localStream,
    isConnected,
    error: webRTCError,
    mediaState,
    toggleCamera,
    toggleAudio,
  } = useWebRTC(room?.id || '', userId || '', accessToken || '');

  const handleLeaveRoom = async () => {
    try {
      await socketClient.leaveRoom(room?.id || '');
      router.push('/dashboard');
    } catch (err) {
      console.error('Error leaving room:', err);
    }
  };

  const handleEndRoom = async () => {
    try {
      const response = await fetch(`/api/rooms/${params.inviteCode}/end`, {
        method: 'PUT',
      });
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

  if (webRTCError) {
    return <LoadingState message={`Connection error: ${webRTCError}`} />;
  }

  if (!isConnected) {
    return <LoadingState message="Connecting to room..." />;
  }

  const allParticipants: Participant[] = participants.map(p => ({
    id: p.userId,
    name: p.userId === userId ? 'You (Local)' : p.email,
    stream: p.userId === userId ? localStream || undefined : p.stream,
    isCameraOn: p.userId === userId ? mediaState.video : p.mediaState?.video || false,
    isAudioOn: p.userId === userId ? mediaState.audio : p.mediaState?.audio || false,
  }));

  return (
    <Container maxWidth="xl" sx={{ height: '100vh', pt: 8, pb: 8 }}>
      <RoomHeader
        roomName={room.name}
        participantCount={allParticipants.length}
        isCreator={room.creatorId === userId}
        onEndRoom={handleEndRoom}
      />

      <VideoGrid participants={allParticipants} localParticipantId={userId} />

      <RoomControls
        isCameraOn={mediaState.video}
        isAudioOn={mediaState.audio}
        onCameraToggle={toggleCamera}
        onAudioToggle={toggleAudio}
        onLeaveRoom={handleLeaveRoom}
      />
    </Container>
  );
}
