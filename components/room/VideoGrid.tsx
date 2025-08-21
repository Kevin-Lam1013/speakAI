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
  height: 'calc(100vh - 160px)', // Account for header and controls
  padding: theme.spacing(2),
  display: 'grid',
  gap: theme.spacing(2),
}));

// Different grid layouts based on participant count
const gridConfigs = {
  1: {
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
  },
  2: {
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr',
  },
  3: {
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gridTemplateAreas: '"top-left top-right" "bottom bottom"',
  },
  4: {
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
  },
};

interface VideoGridProps {
  participants: Participant[];
  localParticipantId: string;
}

export default function VideoGrid({ participants, localParticipantId }: VideoGridProps) {
  const count = participants.length;
  const gridStyle = gridConfigs[count as keyof typeof gridConfigs] || gridConfigs[4];

  // For 3 participants, we need to apply special styles to the bottom video
  const getParticipantStyle = (index: number) => {
    if (count === 3 && index === 2) {
      return {
        gridArea: 'bottom',
        maxWidth: '50%',
        margin: '0 auto',
      };
    }
    return {};
  };

  return (
    <GridContainer sx={gridStyle}>
      {participants.map((participant, index) => (
        <Box
          key={participant.id}
          sx={{
            width: '100%',
            height: '100%',
            ...getParticipantStyle(index),
          }}
        >
          <ParticipantVideo
            stream={participant.stream}
            name={participant.name}
            isMuted={!participant.isAudioOn}
            isCameraOn={participant.isCameraOn}
          />
        </Box>
      ))}
    </GridContainer>
  );
}
