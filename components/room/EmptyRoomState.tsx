import { Box, Typography, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface EmptyRoomStateProps {
  onCreateRoom: () => void;
}

export default function EmptyRoomState({ onCreateRoom }: EmptyRoomStateProps) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 8,
        px: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 1,
      }}
    >
      <Typography variant="h6" gutterBottom>
        No Rooms Yet
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Create your first room to start a video chat session
      </Typography>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateRoom}>
        Create Room
      </Button>
    </Box>
  );
}
