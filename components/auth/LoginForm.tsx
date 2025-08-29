'use client';

import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Paper,
  InputAdornment,
  IconButton,
  useTheme,
  styled,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { api } from '@/lib/api';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: theme.shape.borderRadius,
  background: theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(10px)',
  border: `1px solid ${
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  }`,
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)'
      : '0 4px 6px rgba(59, 130, 246, 0.04), 0 1px 3px rgba(59, 130, 246, 0.08)',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.shape.borderRadius,
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
  paddingTop: theme.spacing(1.5),
  paddingBottom: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  textTransform: 'none',
  fontSize: '1.1rem',
  fontWeight: 600,
  background:
    theme.palette.mode === 'dark'
      ? 'linear-gradient(45deg, #60A5FA 30%, #3B82F6 90%)'
      : 'linear-gradient(45deg, #3B82F6 30%, #2563EB 90%)',
  '&:hover': {
    background:
      theme.palette.mode === 'dark'
        ? 'linear-gradient(45deg, #93C5FD 30%, #60A5FA 90%)'
        : 'linear-gradient(45deg, #60A5FA 30%, #3B82F6 90%)',
    transform: 'translateY(-1px)',
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 4px 8px rgba(96, 165, 250, 0.2)'
        : '0 4px 8px rgba(59, 130, 246, 0.2)',
  },
}));

const BottomBox = styled(Box)({
  textAlign: 'center',
  marginTop: 16,
});

export default function LoginForm() {
  const router = useRouter();
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/api/auth/login', formData, { skipAuth: true });
      const data = await response.json();

      if (data.success) {
        // Get redirect URL from query params or default to dashboard
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect') || '/dashboard';

        // Use replace instead of push to prevent back button from going back to login
        router.replace(redirectUrl);
      } else {
        setError(data.message || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSignupLinkOnClick = () => {
    // Preserve redirect URL when going to signup
    const params = new URLSearchParams(window.location.search);
    const redirectUrl = params.get('redirect');
    const signupUrl = redirectUrl
      ? `/signup?redirect=${encodeURIComponent(redirectUrl)}`
      : '/signup';
    router.push(signupUrl);
  };

  return (
    <StyledPaper elevation={3}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          align="center"
          fontWeight="bold"
          sx={{
            color: theme =>
              theme.palette.mode === 'dark'
                ? theme.palette.primary.light
                : theme.palette.primary.main,
          }}
        >
          Welcome Back
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Sign in to continue your translation journey
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          {error && (
            <Typography
              color="error"
              variant="body2"
              align="center"
              sx={{
                mb: 2,
                p: 1,
                bgcolor: 'error.light',
                borderRadius: 1,
                color: 'error.contrastText',
              }}
            >
              {error}
            </Typography>
          )}

          <StyledTextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
          />
          <StyledTextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading}
            sx={{ marginBottom: 3 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    disabled={isLoading}
                    sx={{
                      color: theme =>
                        theme.palette.mode === 'dark'
                          ? theme.palette.primary.light
                          : theme.palette.primary.main,
                    }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <StyledButton
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </StyledButton>

          <BottomBox>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={handleSignupLinkOnClick}
                sx={{
                  fontWeight: 'bold',
                  color: theme =>
                    theme.palette.mode === 'dark'
                      ? theme.palette.primary.light
                      : theme.palette.primary.main,
                  '&:hover': {
                    color: theme =>
                      theme.palette.mode === 'dark'
                        ? theme.palette.primary.main
                        : theme.palette.primary.dark,
                  },
                }}
              >
                Sign up
              </Link>
            </Typography>
          </BottomBox>
        </Box>
      </motion.div>
    </StyledPaper>
  );
}
