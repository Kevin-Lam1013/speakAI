import { Box, Button, Container, Stack, useTheme, styled } from '@mui/material';
import { motion } from 'framer-motion';
import AnimatedText from '@/components/shared/AnimatedText';
import { FC } from 'react';

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
}));

// Translation demo styled components
const DemoWrapper = styled(Box)({
  position: 'relative',
  height: '200px',
  width: '100%',
});

const BubbleWrapper = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  boxShadow: theme.shadows[2],
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
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

// Translation demo component with floating bubbles
const TranslationDemo: FC = () => {
  const bubbles = [
    { text: 'Hello', lang: 'EN' },
    { text: 'Hola', lang: 'ES' },
    { text: '你好', lang: 'ZH' },
  ];

  return (
    <DemoWrapper>
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
          <BubbleWrapper>
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
      ))}
    </DemoWrapper>
  );
};

export default HeroSection;
