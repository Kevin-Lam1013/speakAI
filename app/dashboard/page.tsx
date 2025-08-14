'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Button, Container, Grid, CircularProgress, Alert } from '@mui/material';
import { useRouter } from 'next/navigation';
import AddIcon from '@mui/icons-material/Add';
import RoomCard from '@/components/room/RoomCard';
import CreateRoomModal from '@/components/room/CreateRoomModal';
import EmptyRoomState from '@/components/room/EmptyRoomState';
import { Room, CreateRoomData } from '@/types/room';

export default function DashboardPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms');
      if (!response.ok) throw new Error('Failed to fetch rooms');
      const data = await response.json();
      if (Array.isArray(data)) {
        setRooms(data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError('Failed to load rooms. Please try again later.');
      console.error('Error fetching rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (data: CreateRoomData) => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to create room');

      const result = await response.json();
      if (result.success && result.room) {
        // Redirect to the room page using the invite code
        router.push(`/room/${result.room.inviteCode}`);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error creating room:', err);
      throw err;
    }
  };

  const handleEndRoom = async (inviteCode: string) => {
    try {
      const response = await fetch(`/api/rooms/${inviteCode}/end`, {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error('Failed to end room');
      }

      // Refresh the rooms list
      await fetchRooms();
    } catch (err) {
      console.error('Error ending room:', err);
      setError('Failed to end room. Please try again later.');
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();

    const initializeData = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          signal: abortController.signal,
        });
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/');
            return;
          }
          throw new Error('Failed to fetch user data');
        }
        const data = await response.json();
        if (data.success && data.id) {
          setUserId(data.id);
        } else {
          throw new Error('Invalid user data format');
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Failed to fetch user:', err);
        setError('Failed to load user data. Please try again later.');
      }
    };

    initializeData();
    return () => abortController.abort();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const abortController = new AbortController();

    const loadRooms = async () => {
      try {
        const response = await fetch('/api/rooms', {
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch rooms');
        const data = await response.json();
        if (Array.isArray(data)) {
          setRooms(data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError('Failed to load rooms. Please try again later.');
        console.error('Error fetching rooms:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRooms();
    return () => abortController.abort();
  }, [userId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          My Rooms
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateModal(true)}
            sx={{ mr: 2 }}
          >
            Create Room
          </Button>
          <Button variant="outlined" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {rooms.length === 0 ? (
        <EmptyRoomState onCreateRoom={() => setShowCreateModal(true)} />
      ) : (
        <Grid container spacing={3}>
          {rooms.map(room => (
            <Grid item xs={12} sm={6} md={4} key={room.id}>
              <RoomCard
                room={room}
                isCreator={userId === room.creatorId}
                onEndRoom={handleEndRoom}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <CreateRoomModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateRoom}
      />
    </Container>
  );
}
