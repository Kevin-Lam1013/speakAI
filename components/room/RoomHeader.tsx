'use client';

import { Box, Typography, Button, useTheme, styled } from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import { motion } from 'framer-motion';

const HeaderContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  padding: theme.spacing(2),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(10px)',
  borderBottom: `1px solid ${
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  }`,
  zIndex: theme.zIndex.appBar,
}));

const ParticipantCount = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor:
    theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
  border: `1px solid ${
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  }`,
}));

interface RoomHeaderProps {
  roomName: string;
  participantCount: number;
  isCreator: boolean;
  onEndRoom?: () => void;
}

export default function RoomHeader({
  roomName,
  participantCount,
  isCreator,
  onEndRoom,
}: RoomHeaderProps) {
  const theme = useTheme();

  return (
    <motion.div initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.3 }}>
      <HeaderContainer>
        <Typography variant="h6" component="h1" fontWeight={600}>
          {roomName}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ParticipantCount>
            <Typography variant="body2" color="text.secondary">
              {participantCount} {participantCount === 1 ? 'Participant' : 'Participants'}
            </Typography>
          </ParticipantCount>

          {isCreator && onEndRoom && (
            <Button
              variant="contained"
              color="error"
              startIcon={<StopIcon />}
              onClick={onEndRoom}
              sx={{
                borderRadius: theme.shape.borderRadius,
                textTransform: 'none',
              }}
            >
              End Room
            </Button>
          )}
        </Box>
      </HeaderContainer>
    </motion.div>
  );
}
