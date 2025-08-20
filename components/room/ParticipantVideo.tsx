'use client';

import { Box, Typography, useTheme, styled, Avatar } from '@mui/material';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
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
  objectFit: 'contain',
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

const CameraOffPlaceholder = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  backgroundColor:
    theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(248, 250, 252, 0.9)',
  color: theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.8)' : 'rgba(100, 116, 139, 0.8)',
}));

interface ParticipantVideoProps {
  stream?: MediaStream;
  name: string;
  isMuted?: boolean;
  isCameraOn?: boolean;
}

export default function ParticipantVideo({
  stream,
  name,
  isMuted = false,
  isCameraOn = true,
}: ParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    } else if (videoRef.current && !stream) {
      videoRef.current.srcObject = null;
    }
  }, [stream, name]);

  // Check if we have a video track in the stream
  const hasVideoTrack = stream?.getVideoTracks().length
    ? stream.getVideoTracks().length > 0
    : false;

  // Show video if we have a video track, regardless of isCameraOn state (in case of timing issues)
  const showVideo = hasVideoTrack && stream;

  // Generate initials from name for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{ height: '100%' }}
    >
      <VideoContainer>
        {showVideo ? (
          <Video ref={videoRef} autoPlay playsInline muted={isMuted} />
        ) : (
          <CameraOffPlaceholder>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                fontSize: '2rem',
                fontWeight: 600,
                mb: 2,
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(59, 130, 246, 0.3)'
                    : 'rgba(59, 130, 246, 0.2)',
                color:
                  theme.palette.mode === 'dark'
                    ? 'rgba(147, 197, 253, 0.9)'
                    : 'rgba(37, 99, 235, 0.8)',
                border: `2px solid ${
                  theme.palette.mode === 'dark'
                    ? 'rgba(147, 197, 253, 0.3)'
                    : 'rgba(59, 130, 246, 0.3)'
                }`,
              }}
            >
              {getInitials(name)}
            </Avatar>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VideocamOffIcon sx={{ fontSize: '1.2rem', opacity: 0.7 }} />
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Camera is off
              </Typography>
            </Box>
          </CameraOffPlaceholder>
        )}

        <NameOverlay>
          <Typography variant="body2" fontWeight={500}>
            {name}
          </Typography>
        </NameOverlay>
      </VideoContainer>
    </motion.div>
  );
}
