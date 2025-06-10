import { Box, Container, Paper, useTheme, styled } from '@mui/material';
import { motion } from 'framer-motion';
import { statistics, supportedLanguages } from '@/constants/features';
import AnimatedText from '@/components/shared/AnimatedText';
import { FC } from 'react';

const StyledSection = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(8),
}));

const StatisticsGrid = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 32,
  justifyContent: 'center',
  marginBottom: 64,
});

const StatWrapper = styled(Box)(({ theme }) => ({
  flex: '1 1 100%',
  minWidth: '100%',
  maxWidth: '100%',
  [theme.breakpoints.up('sm')]: {
    flex: '1 1 calc(33.333% - 32px)',
    minWidth: 'calc(33.333% - 32px)',
    maxWidth: 'calc(33.333% - 32px)',
  },
}));

const StatContent = styled(Box)({
  textAlign: 'center',
});

const LanguagesContainer = styled(Box)({
  textAlign: 'center',
  marginBottom: 48,
});

const LanguageGrid = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  justifyContent: 'center',
});

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: '50%',
  width: 80,
  height: 80,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'transform 0.2s, box-shadow 0.2s',
  '&:hover': {
    transform: 'scale(1.1)',
    boxShadow: theme.shadows[4],
  },
}));

const CallToAction = styled(Box)({
  textAlign: 'center',
  marginTop: 64,
});

const LanguageSection: FC = () => {
  return (
    <StyledSection>
      <Container maxWidth="lg">
        {/* Statistics */}
        <StatisticsGrid>
          {statistics.map((stat, index) => (
            <StatWrapper key={stat.label}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <StatContent>
                  <AnimatedText
                    TypographyProps={{
                      variant: 'h3',
                      color: 'primary',
                      gutterBottom: true,
                    }}
                  >
                    {stat.value}
                  </AnimatedText>
                  <AnimatedText
                    TypographyProps={{
                      variant: 'h6',
                      color: 'text.secondary',
                    }}
                  >
                    {stat.label}
                  </AnimatedText>
                </StatContent>
              </motion.div>
            </StatWrapper>
          ))}
        </StatisticsGrid>

        {/* Language Bubbles */}
        <LanguagesContainer>
          <AnimatedText
            TypographyProps={{
              variant: 'h4',
              component: 'h2',
              mb: 4,
            }}
          >
            Supported Languages
          </AnimatedText>
          <LanguageGrid>
            {supportedLanguages.map((lang, index) => (
              <motion.div
                key={lang.code}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <StyledPaper elevation={2}>
                  <AnimatedText
                    TypographyProps={{
                      variant: 'h6',
                      color: 'primary',
                    }}
                  >
                    {lang.code}
                  </AnimatedText>
                  <AnimatedText
                    TypographyProps={{
                      variant: 'caption',
                      color: 'text.secondary',
                    }}
                  >
                    {lang.name}
                  </AnimatedText>
                </StyledPaper>
              </motion.div>
            ))}
          </LanguageGrid>
        </LanguagesContainer>

        {/* Call to Action */}
        <CallToAction>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <AnimatedText
              TypographyProps={{
                variant: 'h4',
                component: 'h2',
                mb: 2,
              }}
            >
              Start Translating Now
            </AnimatedText>
            <AnimatedText
              TypographyProps={{
                variant: 'body1',
                color: 'text.secondary',
                mb: 4,
              }}
            >
              Join thousands of users breaking language barriers
            </AnimatedText>
          </motion.div>
        </CallToAction>
      </Container>
    </StyledSection>
  );
};

export default LanguageSection;
