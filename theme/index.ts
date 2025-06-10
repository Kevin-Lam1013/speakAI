import { createTheme } from '@mui/material/styles';

// Modern light theme with tonal palette
export const theme = createTheme({
  palette: {
    primary: {
      main: '#3B82F6', // Modern blue
      light: '#60A5FA',
      dark: '#2563EB',
    },
    secondary: {
      main: '#EC4899', // Modern pink
      light: '#F472B6',
      dark: '#DB2777',
    },
    background: {
      default: '#F8FAFC', // Very light blue-gray
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B', // Slate-800
      secondary: '#64748B', // Slate-500
    },
    divider: '#E2E8F0', // Slate-200
    action: {
      hover: 'rgba(59, 130, 246, 0.04)', // Primary with low opacity
      selected: 'rgba(59, 130, 246, 0.08)',
      disabled: 'rgba(59, 130, 246, 0.3)',
      disabledBackground: 'rgba(59, 130, 246, 0.12)',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3.5rem',
      fontWeight: 700,
      color: '#1E293B', // Slate-800
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 600,
      color: '#1E293B',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '2rem',
      fontWeight: 600,
      color: '#1E293B',
    },
    body1: {
      color: '#64748B', // Slate-500
    },
    body2: {
      color: '#94A3B8', // Slate-400
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          '&:hover': {
            transform: 'translateY(-1px)',
            transition: 'transform 0.2s ease-in-out',
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 6px rgba(59, 130, 246, 0.04), 0 1px 3px rgba(59, 130, 246, 0.08)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 8px rgba(59, 130, 246, 0.04), 0 2px 4px rgba(59, 130, 246, 0.08)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(59, 130, 246, 0.05), 0 1px 2px rgba(59, 130, 246, 0.1)',
        },
      },
    },
  },
});

// Create dark theme variant with modern aesthetics
export const darkTheme = createTheme({
  ...theme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#60A5FA', // Modern bright blue
      light: '#93C5FD',
      dark: '#3B82F6',
    },
    secondary: {
      main: '#F472B6', // Modern bright pink
      light: '#F9A8D4',
      dark: '#EC4899',
    },
    background: {
      default: '#0F172A', // Slate-900
      paper: '#1E293B', // Slate-800
    },
    text: {
      primary: '#F8FAFC', // Slate-50
      secondary: '#CBD5E1', // Slate-300
    },
    divider: 'rgba(248, 250, 252, 0.08)', // Slate-50 with low opacity
    action: {
      active: '#F8FAFC',
      hover: 'rgba(248, 250, 252, 0.08)',
      selected: 'rgba(248, 250, 252, 0.16)',
      disabled: 'rgba(248, 250, 252, 0.3)',
      disabledBackground: 'rgba(248, 250, 252, 0.12)',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E293B', // Slate-800
          backgroundImage: 'none',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1)',
          '&:hover': {
            boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E293B', // Slate-800
          backgroundImage: 'none',
          '&:before': {
            display: 'none',
          },
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
        },
        contained: {
          backgroundColor: '#60A5FA',
          color: '#0F172A',
          '&:hover': {
            backgroundColor: '#93C5FD',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderColor: '#60A5FA',
          color: '#60A5FA',
          borderWidth: 2,
          '&:hover': {
            borderColor: '#93C5FD',
            borderWidth: 2,
            backgroundColor: 'rgba(96, 165, 250, 0.08)',
          },
        },
        text: {
          color: '#60A5FA',
          '&:hover': {
            backgroundColor: 'rgba(96, 165, 250, 0.08)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#F8FAFC',
          '&:hover': {
            backgroundColor: 'rgba(248, 250, 252, 0.08)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E293B',
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1E293B',
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1E293B',
          backgroundImage: 'none',
        },
      },
    },
  },
  typography: {
    ...theme.typography,
    h1: {
      ...theme.typography.h1,
      color: '#F8FAFC', // Slate-50 for maximum contrast
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    },
    h2: {
      ...theme.typography.h2,
      color: '#F1F5F9', // Slate-100
    },
    h3: {
      ...theme.typography.h3,
      color: '#E2E8F0', // Slate-200
    },
    h4: {
      ...theme.typography.h4,
      color: '#E2E8F0', // Slate-200
    },
    h5: {
      ...theme.typography.h5,
      color: '#CBD5E1', // Slate-300
    },
    h6: {
      ...theme.typography.h6,
      color: '#CBD5E1', // Slate-300
    },
    subtitle1: {
      ...theme.typography.subtitle1,
      color: '#94A3B8', // Slate-400
    },
    subtitle2: {
      ...theme.typography.subtitle2,
      color: '#94A3B8', // Slate-400
    },
    body1: {
      ...theme.typography.body1,
      color: '#CBD5E1', // Slate-300
    },
    body2: {
      ...theme.typography.body2,
      color: '#94A3B8', // Slate-400
    },
  },
});
