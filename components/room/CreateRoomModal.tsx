import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  CircularProgress,
} from '@mui/material';

interface CreateRoomModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export default function CreateRoomModal({ open, onClose, onSubmit }: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Room name is required');
      return;
    }

    setInProgress(true);
    try {
      await onSubmit(name.trim());
      handleClose();
    } catch (err) {
      setError('Failed to create room. Please try again.');
    } finally {
      setInProgress(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New Room</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              autoFocus
              label="Room Name"
              fullWidth
              value={name}
              onChange={e => setName(e.target.value)}
              error={!!error}
              helperText={error}
              disabled={inProgress}
              placeholder="Enter a name for your room"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={inProgress}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={inProgress}
            startIcon={inProgress ? <CircularProgress size={20} /> : null}
          >
            Create Room
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
