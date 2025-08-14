'use client';

import { Box, Typography, useTheme, styled } from '@mui/material';
import { motion } from 'framer-motion';
import { useRef, useEffect } from 'react';

const VideoContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  backgroundColor:
    theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
  border: `1px solid ${
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  }`,
}));

const Video = styled('video')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

const NameOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(2),
  left: theme.spacing(2),
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius,
  background: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(10px)',
  border: `1px solid ${
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  }`,
  boxShadow: theme.shadows[2],
}));

interface ParticipantVideoProps {
  stream?: MediaStream;
  name: string;
  isMuted?: boolean;
}

export default function ParticipantVideo({ stream, name, isMuted = false }: ParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{ height: '100%' }}
    >
      <VideoContainer>
        <Video ref={videoRef} autoPlay playsInline muted={isMuted} />
        <NameOverlay>
          <Typography variant="body2" fontWeight={500}>
            {name}
          </Typography>
        </NameOverlay>
      </VideoContainer>
    </motion.div>
  );
}
