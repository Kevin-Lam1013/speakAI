import { IconButton, useTheme } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { FC } from 'react';

interface ThemeToggleProps {
  onToggle: () => void;
  isDarkMode: boolean;
}

const ThemeToggle: FC<ThemeToggleProps> = ({ onToggle, isDarkMode }) => {
  const theme = useTheme();

  return (
    <IconButton
      onClick={onToggle}
      color="inherit"
      sx={{
        position: 'fixed',
        top: theme.spacing(2),
        right: theme.spacing(2),
        bgcolor: theme.palette.background.paper,
        boxShadow: theme.shadows[2],
        '&:hover': {
          bgcolor: theme.palette.background.paper,
        },
      }}
    >
      {isDarkMode ? <Brightness7 /> : <Brightness4 />}
    </IconButton>
  );
};

export default ThemeToggle;
