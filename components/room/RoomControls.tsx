'use client';

import { Box, IconButton, Button, useTheme, styled } from '@mui/material';
import { ReactNode } from 'react';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { motion } from 'framer-motion';

const ControlsContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  padding: theme.spacing(2),
  display: 'flex',
  justifyContent: 'center',
  background: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  borderTop: `1px solid ${
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
  }`,
  zIndex: theme.zIndex.appBar,
}));

const ControlsInner = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 1280,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
}));

const ControlButton = styled(IconButton)(({ theme }) => ({
  backgroundColor:
    theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
  border: `1px solid ${
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  }`,
  '&:hover': {
    backgroundColor:
      theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.95)',
  },
}));

interface RoomControlsProps {
  isCameraOn: boolean;
  isAudioOn: boolean;
  onCameraToggle: () => void;
  onAudioToggle: () => void;
  onLeaveRoom: () => void;
  translationControl?: ReactNode;
}

export default function RoomControls({
  isCameraOn,
  isAudioOn,
  onCameraToggle,
  onAudioToggle,
  onLeaveRoom,
  translationControl,
}: RoomControlsProps) {
  const theme = useTheme();

  return (
    <motion.div initial={{ y: 100 }} animate={{ y: 0 }} transition={{ duration: 0.3 }}>
      <ControlsContainer>
        <ControlsInner>
          <Box sx={{ minWidth: 240, display: 'flex', justifyContent: 'center' }}>
            {translationControl}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ControlButton
              onClick={onCameraToggle}
              size="large"
              sx={{
                color: isCameraOn ? theme.palette.primary.main : theme.palette.error.main,
              }}
            >
              {isCameraOn ? <VideocamIcon /> : <VideocamOffIcon />}
            </ControlButton>

            <ControlButton
              onClick={onAudioToggle}
              size="large"
              sx={{
                color: isAudioOn ? theme.palette.primary.main : theme.palette.error.main,
              }}
            >
              {isAudioOn ? <MicIcon /> : <MicOffIcon />}
            </ControlButton>
          </Box>

          <Button
            variant="contained"
            color="error"
            startIcon={<ExitToAppIcon />}
            onClick={onLeaveRoom}
            sx={{
              borderRadius: theme.shape.borderRadius,
              textTransform: 'none',
              px: 3,
            }}
          >
            Leave Room
          </Button>
        </ControlsInner>
      </ControlsContainer>
    </motion.div>
  );
}
