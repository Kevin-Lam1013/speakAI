'use client';

import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DashboardPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Clear any stored tokens from localStorage/sessionStorage
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('accessToken');

        // Redirect to home page
        router.push('/');
        router.refresh();
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          borderRadius: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 'bold',
            mb: 3,
          }}
        >
          Welcome to the Dashboard
        </Typography>

        <Typography
          variant="h6"
          sx={{
            mb: 4,
            opacity: 0.9,
          }}
        >
          You have successfully logged in to SpeakAI!
        </Typography>

        <Button
          variant="contained"
          size="large"
          onClick={handleLogout}
          disabled={isLoggingOut}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: 'white',
            px: 4,
            py: 1.5,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.3)',
            },
            '&:disabled': {
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.5)',
            },
          }}
        >
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </Button>
      </Paper>
    </Container>
  );
}
