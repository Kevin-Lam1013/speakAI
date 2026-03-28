'use client';

import { Box, styled } from '@mui/material';
import ParticipantVideo from './ParticipantVideo';

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  isCameraOn?: boolean;
  isAudioOn?: boolean;
}

const GridContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  minHeight: 320,
  padding: theme.spacing(2),
  display: 'grid',
  gap: theme.spacing(2),
}));

function getGridColumns(count: number): number {
  if (count <= 2) return count || 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

interface VideoGridProps {
  participants: Participant[];
  localParticipantId: string;
}

export default function VideoGrid({ participants, localParticipantId }: VideoGridProps) {
  const count = participants.length;
  const cols = getGridColumns(count);
  // For ≤9 participants the grid fills the viewport height; for 10+ let it grow and scroll.
  const heightConstrained = count <= 9;

  return (
    <GridContainer
      sx={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        height: heightConstrained ? 'calc(100vh - 220px)' : 'auto',
        overflowY: heightConstrained ? 'hidden' : 'auto',
      }}
    >
      {participants.map(participant => (
        <Box
          key={participant.id}
          sx={{
            width: '100%',
            // Height-constrained layouts fill the row; unconstrained use aspect ratio.
            ...(heightConstrained ? { height: '100%' } : { aspectRatio: '16/9' }),
          }}
        >
          <ParticipantVideo
            stream={participant.stream}
            name={participant.name}
            isMuted={participant.id === localParticipantId ? true : !participant.isAudioOn}
            isCameraOn={participant.isCameraOn}
            showMicBadge={participant.id !== localParticipantId}
          />
        </Box>
      ))}
    </GridContainer>
  );
}
