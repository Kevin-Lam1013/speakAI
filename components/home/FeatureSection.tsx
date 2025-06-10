import { Box, Card, Container, useTheme, styled } from '@mui/material';
import { motion } from 'framer-motion';
import { features } from '@/constants/features';
import AnimatedText from '@/components/shared/AnimatedText';
import { FC } from 'react';

const StyledSection = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(8),
  backgroundColor: theme.palette.background.paper,
}));

const FeatureGrid = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 32,
  justifyContent: 'center',
});

const FeatureWrapper = styled(Box)(({ theme }) => ({
  flex: '1 1 calc(50% - 32px)',
  minWidth: '100%',
  maxWidth: '100%',
  [theme.breakpoints.up('md')]: {
    minWidth: 'calc(50% - 32px)',
    maxWidth: 'calc(50% - 32px)',
  },
}));

const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(4),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  transition: 'transform 0.2s, box-shadow 0.2s',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
  },
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  borderRadius: theme.spacing(2),
  padding: theme.spacing(1),
  marginBottom: theme.spacing(2),
}));

const FeatureIcon = styled('div')(({ theme }) => ({
  '& .MuiSvgIcon-root': {
    fontSize: 40,
    color: '#fff',
  },
}));

const FeatureSection: FC = () => {
  return (
    <StyledSection id="features">
      <Container maxWidth="lg">
        <AnimatedText
          TypographyProps={{
            variant: 'h2',
            component: 'h2',
            textAlign: 'center',
            mb: 6,
          }}
        >
          Why Choose SpeakAI?
        </AnimatedText>

        <FeatureGrid>
          {features.map((feature, index) => (
            <FeatureWrapper key={feature.title}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <StyledCard>
                  <IconWrapper>
                    <FeatureIcon>
                      <feature.icon />
                    </FeatureIcon>
                  </IconWrapper>

                  <AnimatedText
                    delay={index * 0.2}
                    TypographyProps={{
                      variant: 'h5',
                      component: 'h3',
                      gutterBottom: true,
                    }}
                  >
                    {feature.title}
                  </AnimatedText>

                  <AnimatedText
                    delay={index * 0.2 + 0.1}
                    TypographyProps={{
                      color: 'text.secondary',
                      flex: 1,
                    }}
                  >
                    {feature.description}
                  </AnimatedText>
                </StyledCard>
              </motion.div>
            </FeatureWrapper>
          ))}
        </FeatureGrid>
      </Container>
    </StyledSection>
  );
};

export default FeatureSection;
