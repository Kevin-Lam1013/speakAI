'use client';

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
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      sx={{
        position: 'fixed',
        bottom: theme.spacing(2),
        right: theme.spacing(2),
        bgcolor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        border: `2px solid ${theme.palette.divider}`,
        boxShadow: theme.shadows[2],
        '&:hover': {
          bgcolor: theme.palette.background.paper,
          opacity: 0.9,
        },
        zIndex: theme.zIndex.appBar + 1,
      }}
    >
      {isDarkMode ? <Brightness7 /> : <Brightness4 />}
    </IconButton>
  );
};

export default ThemeToggle;
