'use client';

import { Box, Typography, useTheme, styled, Avatar } from '@mui/material';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { motion } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

interface VideoContainerProps {
  isSpeaking: boolean;
}

const VideoContainer = styled(Box)<VideoContainerProps>(({ theme, isSpeaking }) => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  backgroundColor:
    theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
  border: `3px solid ${
    isSpeaking
      ? theme.palette.primary.main // Speaking border color
      : theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.1)'
  }`,
  boxShadow: isSpeaking ? `0 0 10px ${theme.palette.primary.main}` : 'none',
  transition: 'border-color 0.2s ease-in-out',
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasVideo, setHasVideo] = useState<boolean>(Boolean(stream?.getVideoTracks().length));
  const theme = useTheme();

  // Initialize audio analysis
  useEffect(() => {
    console.log('[ParticipantVideo] mount', name, {
      hasStream: Boolean(stream),
      isMuted,
      audioTracks: stream?.getAudioTracks().length || 0,
      videoTracks: stream?.getVideoTracks().length || 0,
    });
    if (!stream || isMuted) {
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      console.warn('[ParticipantVideo] no audioTrack present', name);
      return;
    }

    // Create audio context and analyzer
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;

    // Connect stream to analyzer
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    // Start monitoring audio levels
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let speakingTimeout: NodeJS.Timeout;

    const checkAudioLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const isSpeakingNow = average > 30;

      if (isSpeakingNow) {
        setIsSpeaking(true);
        if (speakingTimeout) clearTimeout(speakingTimeout);
        speakingTimeout = setTimeout(() => setIsSpeaking(false), 300);
      }

      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (speakingTimeout) {
        clearTimeout(speakingTimeout);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      setIsSpeaking(false);
      console.log('[ParticipantVideo] cleanup', name);
    };
  }, [stream, isMuted]);

  // Attach media and react to tracks being added/removed on the same stream
  useEffect(() => {
    const attach = () => {
      if (!stream) {
        if (videoRef.current) videoRef.current.srcObject = null;
        if (audioRef.current) audioRef.current.srcObject = null;
        setHasVideo(false);
        return;
      }
      const liveVideoTracks = stream
        .getVideoTracks()
        .filter(t => t.readyState === 'live' && !t.muted);
      const liveAudioTracks = stream.getAudioTracks().filter(t => t.readyState === 'live');
      const hasVideo = liveVideoTracks.length > 0;
      const hasAudio = liveAudioTracks.length > 0;
      setHasVideo(hasVideo);
      console.log('[ParticipantVideo] attach stream to media element', name, {
        isMuted,
        audioTracks: liveAudioTracks.length,
        videoTracks: liveVideoTracks.length,
      });
      // Always route audio to the hidden <audio> so audio is reliable even when video is present
      if (audioRef.current) {
        if (hasAudio) {
          const audioOnly = new MediaStream(liveAudioTracks);
          audioRef.current.srcObject = audioOnly;
          audioRef.current.muted = isMuted;
          audioRef.current.play?.().catch(() => {});
        } else {
          audioRef.current.srcObject = null;
        }
      }

      // Attach only the video tracks to the <video> element
      if (videoRef.current) {
        if (hasVideo) {
          const videoOnly = new MediaStream(liveVideoTracks);
          videoRef.current.srcObject = videoOnly;
          videoRef.current.muted = isMuted; // local tiles muted, remotes unmuted doesn't matter as audio is via <audio>
          videoRef.current.play?.().catch(() => {});
        } else {
          videoRef.current.srcObject = null;
        }
      }

      if (!hasAudio && !hasVideo) {
        if (videoRef.current) videoRef.current.srcObject = null;
        if (audioRef.current) audioRef.current.srcObject = null;
      }
    };

    attach();

    if (!stream) return;
    const handleAdd = () => attach();
    const handleRemove = () => attach();
    stream.addEventListener?.('addtrack', handleAdd as EventListener);
    stream.addEventListener?.('removetrack', handleRemove as EventListener);

    return () => {
      stream.removeEventListener?.('addtrack', handleAdd as EventListener);
      stream.removeEventListener?.('removetrack', handleRemove as EventListener);
    };
  }, [stream, name, isMuted]);

  // Keep muted state in sync if it changes later
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
    if (audioRef.current) audioRef.current.muted = isMuted;
  }, [isMuted]);

  // Show video based on live track detection (kept in state to react to addtrack/removetrack)
  const showVideo = hasVideo;

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
      <VideoContainer isSpeaking={isSpeaking}>
        {/* Always render the video element so ref is present before tracks arrive */}
        <Video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          style={{ display: showVideo ? 'block' : 'none' }}
        />
        {!showVideo && (
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

        {/* Hidden audio element to play audio when there is no video track */}
        <audio ref={audioRef} style={{ display: 'none' }} />

        <NameOverlay>
          <Typography variant="body2" fontWeight={500}>
            {name}
          </Typography>
        </NameOverlay>
      </VideoContainer>
    </motion.div>
  );
}
