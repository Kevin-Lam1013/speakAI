'use client';

import { ThemeProvider, CssBaseline } from '@mui/material';
import { useState } from 'react';
import { lightTheme, darkTheme } from '@/theme';
import ThemeToggle from '@/components/home/ThemeToggle';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <ThemeToggle onToggle={toggleTheme} isDarkMode={isDarkMode} />
      {children}
    </ThemeProvider>
  );
}
