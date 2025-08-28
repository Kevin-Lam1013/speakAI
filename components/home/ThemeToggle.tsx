'use client';

import { IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { FC } from 'react';

interface ThemeToggleProps {
  onToggle: () => void;
  isDarkMode: boolean;
}

const FloatingIconButton = styled(IconButton)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  right: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  border: `2px solid ${theme.palette.divider}`,
  boxShadow: theme.shadows[2],
  zIndex: theme.zIndex.appBar + 1,
  '&:hover': {
    backgroundColor: theme.palette.background.paper,
    opacity: 0.9,
  },
}));

const ThemeToggle: FC<ThemeToggleProps> = ({ onToggle, isDarkMode }) => {
  return (
    <FloatingIconButton
      onClick={onToggle}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? <Brightness7 /> : <Brightness4 />}
    </FloatingIconButton>
  );
};

export default ThemeToggle;
