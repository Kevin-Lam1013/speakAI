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

export default function SignupForm() {
  const router = useRouter();
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Client-side validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
        }),
        credentials: 'include', // Important for cookies
      });

      const data = await response.json();

      if (data.success) {
        // Get redirect URL from query params or default to dashboard
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect') || '/dashboard';

        // Redirect using replace to prevent back navigation
        router.replace(redirectUrl);
      } else {
        setError(data.message || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
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

  const handleLoginLinkOnClick = () => {
    // Preserve redirect URL when going to login
    const params = new URLSearchParams(window.location.search);
    const redirectUrl = params.get('redirect');
    const loginUrl = redirectUrl ? `/login?redirect=${encodeURIComponent(redirectUrl)}` : '/login';
    router.push(loginUrl);
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
          Create Account
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Join us and break language barriers instantly
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

          <Box sx={{ display: 'flex', gap: 2 }}>
            <StyledTextField
              margin="normal"
              required
              fullWidth
              id="firstName"
              label="First Name"
              name="firstName"
              autoComplete="given-name"
              value={formData.firstName}
              onChange={handleChange}
              disabled={isLoading}
            />
            <StyledTextField
              margin="normal"
              required
              fullWidth
              id="lastName"
              label="Last Name"
              name="lastName"
              autoComplete="family-name"
              value={formData.lastName}
              onChange={handleChange}
              disabled={isLoading}
            />
          </Box>

          <StyledTextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
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
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading}
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
          <StyledTextField
            margin="normal"
            required
            fullWidth
            name="confirmPassword"
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isLoading}
            sx={{ marginBottom: 3 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle confirm password visibility"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                    disabled={isLoading}
                    sx={{
                      color: theme =>
                        theme.palette.mode === 'dark'
                          ? theme.palette.primary.light
                          : theme.palette.primary.main,
                    }}
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </StyledButton>

          <BottomBox>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={handleLoginLinkOnClick}
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
                Sign in
              </Link>
            </Typography>
          </BottomBox>
        </Box>
      </motion.div>
    </StyledPaper>
  );
}
