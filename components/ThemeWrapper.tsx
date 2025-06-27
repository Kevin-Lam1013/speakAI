'use client';

import { ThemeProvider, CssBaseline } from '@mui/material';
import { useEffect, useState } from 'react';
import { lightTheme, darkTheme } from '@/theme';
import ThemeToggle from '@/components/home/ThemeToggle';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  if (!mounted) {
    return null;
  }

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <div style={{ minHeight: '100vh', background: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
        <ThemeToggle onToggle={toggleTheme} isDarkMode={isDarkMode} />
        {children}
      </div>
    </ThemeProvider>
  );
}
