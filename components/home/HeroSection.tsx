import { Box, Button, Container, Stack, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import AnimatedText from '../shared/AnimatedText';
import { FC } from 'react';

const HeroSection: FC = () => {
  const theme = useTheme();

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          py: 8,
        }}
      >
        <AnimatedText
          TypographyProps={{
            variant: 'h1',
            component: 'h1',
            mb: 2,
            fontWeight: 'bold',
            sx: {
              background:
                theme.palette.mode === 'dark'
                  ? 'linear-gradient(180deg, #F8FAFC 0%, #CBD5E1 100%)'
                  : 'inherit',
              WebkitBackgroundClip: theme.palette.mode === 'dark' ? 'text' : 'inherit',
              WebkitTextFillColor: theme.palette.mode === 'dark' ? 'transparent' : 'inherit',
              textShadow: theme.palette.mode === 'dark' ? '0 2px 4px rgba(0, 0, 0, 0.3)' : 'none',
            },
          }}
        >
          Real-time Translation
          <br />
          Made Simple
        </AnimatedText>

        <AnimatedText
          delay={0.2}
          TypographyProps={{
            variant: 'h5',
            color: 'text.secondary',
            mb: 4,
            sx: {
              textShadow: theme.palette.mode === 'dark' ? '0 1px 2px rgba(0, 0, 0, 0.2)' : 'none',
            },
          }}
        >
          Break Language Barriers Instantly
        </AnimatedText>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
            <Button variant="contained" size="large" color="primary" href="/create-room">
              Get Started
            </Button>
            <Button variant="outlined" size="large" color="primary" href="#features">
              Learn More
            </Button>
          </Stack>
        </motion.div>

        <Box sx={{ mt: 8 }}>
          <TranslationDemo />
        </Box>
      </Box>
    </Container>
  );
};

// Translation demo component with floating bubbles
const TranslationDemo: FC = () => {
  const bubbles = [
    { text: 'Hello', lang: 'EN' },
    { text: 'Hola', lang: 'ES' },
    { text: '你好', lang: 'ZH' },
  ];

  return (
    <Box
      sx={{
        position: 'relative',
        height: '200px',
        width: '100%',
      }}
    >
      {bubbles.map((bubble, index) => (
        <motion.div
          key={bubble.lang}
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [-20, 0, 0, 20],
          }}
          transition={{
            duration: 3,
            delay: index * 1,
            repeat: Infinity,
            repeatDelay: bubbles.length * 1,
          }}
          style={{
            position: 'absolute',
            left: `${30 + index * 30}%`,
            top: '50%',
          }}
        >
          <Box
            sx={{
              bgcolor: 'background.paper',
              p: 2,
              borderRadius: 2,
              boxShadow: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <AnimatedText TypographyProps={{ variant: 'h6' }}>{bubble.text}</AnimatedText>
            <AnimatedText
              TypographyProps={{
                variant: 'caption',
                color: 'text.secondary',
              }}
            >
              {bubble.lang}
            </AnimatedText>
          </Box>
        </motion.div>
      ))}
    </Box>
  );
};

export default HeroSection;
