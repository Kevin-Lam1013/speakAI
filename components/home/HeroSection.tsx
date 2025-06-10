import { Box, Button, Container, Stack, useTheme, styled } from '@mui/material';
import { motion } from 'framer-motion';
import AnimatedText from '@/components/shared/AnimatedText';
import { FC, useEffect, useState } from 'react';

const HeroContainer = styled(Box)({
  minHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  paddingTop: 64,
  paddingBottom: 64,
});

const StyledTitle = styled(AnimatedText)(({ theme }) => ({
  '& .MuiTypography-root': {
    marginBottom: theme.spacing(2),
    fontWeight: 'bold',
    ...(theme.palette.mode === 'dark' && {
      background: 'linear-gradient(180deg, #F8FAFC 0%, #CBD5E1 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
    }),
  },
}));

const StyledSubtitle = styled(AnimatedText)(({ theme }) => ({
  '& .MuiTypography-root': {
    marginBottom: theme.spacing(4),
    ...(theme.palette.mode === 'dark' && {
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
    }),
  },
}));

const ButtonContainer = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(4),
}));

const DemoContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(8),
  width: '100%',
  position: 'relative',
  minHeight: '400px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

// Translation demo styled components
const DemoWrapper = styled(Box)({
  position: 'relative',
  height: '400px',
  width: '100%',
  maxWidth: '800px',
  overflow: 'visible',
  margin: '0 auto',
});

const BubbleWrapper = styled(motion.div)(({ theme }) => ({
  backgroundColor:
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.9)',
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 4px 30px rgba(255, 255, 255, 0.1)'
      : '0 4px 30px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(5px)',
  border: `1px solid ${
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)'
  }`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  zIndex: 2,
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 8px 40px rgba(255, 255, 255, 0.15)'
        : '0 8px 40px rgba(0, 0, 0, 0.15)',
  },
}));

const ParticleEffect = styled(motion.div)({
  position: 'absolute',
  width: '4px',
  height: '4px',
  borderRadius: '50%',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
});

const ConnectingLine = styled(motion.div)(({ theme }) => ({
  position: 'absolute',
  height: '1px',
  backgroundColor:
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  transformOrigin: 'left center',
}));

const HeroSection: FC = () => {
  return (
    <Container maxWidth="lg">
      <HeroContainer>
        <StyledTitle
          TypographyProps={{
            variant: 'h1',
            component: 'h1',
          }}
        >
          Real-time Translation
          <br />
          Made Simple
        </StyledTitle>

        <StyledSubtitle
          delay={0.2}
          TypographyProps={{
            variant: 'h5',
            color: 'text.secondary',
          }}
        >
          Break Language Barriers Instantly
        </StyledSubtitle>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <ButtonContainer direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="contained" size="large" color="primary" href="/create-room">
              Get Started
            </Button>
            <Button variant="outlined" size="large" color="primary" href="#features">
              Learn More
            </Button>
          </ButtonContainer>
        </motion.div>

        <DemoContainer>
          <TranslationDemo />
        </DemoContainer>
      </HeroContainer>
    </Container>
  );
};

// Translation demo component with enhanced animations
const TranslationDemo: FC = () => {
  const theme = useTheme();
  const [particles, setParticles] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const bubbles = [
    { text: 'Hello', lang: 'EN' },
    { text: 'Hola', lang: 'ES' },
    { text: '你好', lang: 'ZH' },
    { text: 'Bonjour', lang: 'FR' },
    { text: 'こんにちは', lang: 'JP' },
    { text: 'Ciao', lang: 'IT' },
    { text: 'Olá', lang: 'PT' },
    { text: 'Hallo', lang: 'DE' },
  ];

  useEffect(() => {
    // Create random particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      id: i,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <DemoWrapper>
      {/* Background particles */}
      {particles.map(particle => (
        <ParticleEffect
          key={particle.id}
          initial={{ x: `${particle.x}%`, y: `${particle.y}%`, opacity: 0 }}
          animate={{
            opacity: [0, 1, 0],
            y: [`${particle.y}%`, `${particle.y - 20}%`],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatType: 'reverse',
            delay: Math.random() * 2,
          }}
        />
      ))}

      {/* Translation bubbles */}
      {bubbles.map((bubble, index) => {
        const angle = (index / bubbles.length) * 2 * Math.PI;
        const radius = 120; // Reduced radius
        const centerX = 50;
        const centerY = 50;
        const x = centerX + (Math.cos(angle) * radius) / 3;
        const y = centerY + (Math.sin(angle) * radius) / 3; // Made y-axis scaling match x-axis

        return (
          <motion.div
            key={bubble.lang}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: [0, Math.random() * 5 - 2.5], // Reduced random movement
              y: [0, Math.random() * 5 - 2.5], // Reduced random movement
            }}
            transition={{
              duration: 3,
              delay: index * 0.2,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
          >
            <BubbleWrapper whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <AnimatedText TypographyProps={{ variant: 'h6' }}>{bubble.text}</AnimatedText>
              <AnimatedText
                TypographyProps={{
                  variant: 'caption',
                  color: 'text.secondary',
                }}
              >
                {bubble.lang}
              </AnimatedText>
            </BubbleWrapper>
          </motion.div>
        );
      })}

      {/* Connecting lines */}
      {bubbles.map((_, index) => {
        const nextIndex = (index + 1) % bubbles.length;
        const angle1 = (index / bubbles.length) * 2 * Math.PI;
        const angle2 = (nextIndex / bubbles.length) * 2 * Math.PI;
        const radius = 120; // Reduced radius to match bubbles
        const centerX = 50;
        const centerY = 50;
        const x1 = centerX + (Math.cos(angle1) * radius) / 3;
        const y1 = centerY + (Math.sin(angle1) * radius) / 3;
        const x2 = centerX + (Math.cos(angle2) * radius) / 3;
        const y2 = centerY + (Math.sin(angle2) * radius) / 3;

        const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const angle = Math.atan2(y2 - y1, x2 - x1);

        return (
          <ConnectingLine
            key={`line-${index}`}
            style={{
              left: `${x1}%`,
              top: `${y1}%`,
              width: `${length}%`,
              transform: `rotate(${angle}rad)`,
              zIndex: 1,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{
              duration: 2,
              delay: index * 0.1,
            }}
          />
        );
      })}
    </DemoWrapper>
  );
};

export default HeroSection;
