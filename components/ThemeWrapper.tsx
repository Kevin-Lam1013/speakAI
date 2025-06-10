'use client';

import { ThemeProvider, CssBaseline } from '@mui/material';
import { useState } from 'react';
import { theme, darkTheme } from '../theme';
import ThemeToggle from './home/ThemeToggle';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : theme}>
      <CssBaseline />
      <ThemeToggle onToggle={toggleTheme} isDarkMode={isDarkMode} />
      {children}
    </ThemeProvider>
  );
}
