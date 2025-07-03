import { useState } from 'react';
import { Room } from '@/types/room';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VideocamIcon from '@mui/icons-material/Videocam';

interface RoomCardProps {
  room: Room;
  isCreator: boolean;
}

export default function RoomCard({ room, isCreator }: RoomCardProps) {
  const router = useRouter();
  const [copyTooltip, setCopyTooltip] = useState('Copy Invite Link');

  const handleCopyInvite = async () => {
    const inviteLink = `${window.location.origin}/room/${room.inviteCode}`;
    await navigator.clipboard.writeText(inviteLink);
    setCopyTooltip('Copied!');
    setTimeout(() => setCopyTooltip('Copy Invite Link'), 2000);
  };

  const handleJoinRoom = () => {
    router.push(`/room/${room.inviteCode}`);
  };

  const formattedDate = new Date(room.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '&:hover': {
          boxShadow: 6,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="h6" component="h2" noWrap>
            {room.name}
          </Typography>
          <Chip
            label={room.status === 'active' ? 'Active' : 'Ended'}
            color={room.status === 'active' ? 'success' : 'default'}
            size="small"
          />
        </Box>

        <Typography color="text.secondary" variant="body2" gutterBottom>
          Created on {formattedDate}
        </Typography>

        <Box mt={2} display="flex" gap={1}>
          <Tooltip title={copyTooltip}>
            <IconButton size="small" onClick={handleCopyInvite}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {room.status === 'active' && (
            <Button
              variant="contained"
              startIcon={<VideocamIcon />}
              onClick={handleJoinRoom}
              size="small"
              sx={{ ml: 'auto' }}
            >
              Join
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
