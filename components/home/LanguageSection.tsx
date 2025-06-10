import { Box, Container, Paper, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { statistics, supportedLanguages } from '../../constants/features';
import AnimatedText from '../shared/AnimatedText';
import { FC } from 'react';

const LanguageSection: FC = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        py: 8,
      }}
    >
      <Container maxWidth="lg">
        {/* Statistics */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            justifyContent: 'center',
            mb: 8,
          }}
        >
          {statistics.map((stat, index) => (
            <Box
              key={stat.label}
              sx={{
                flex: { xs: '1 1 100%', sm: '1 1 calc(33.333% - 32px)' },
                minWidth: { xs: '100%', sm: 'calc(33.333% - 32px)' },
                maxWidth: { xs: '100%', sm: 'calc(33.333% - 32px)' },
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <Box
                  sx={{
                    textAlign: 'center',
                  }}
                >
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
                </Box>
              </motion.div>
            </Box>
          ))}
        </Box>

        {/* Language Bubbles */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <AnimatedText
            TypographyProps={{
              variant: 'h4',
              component: 'h2',
              mb: 4,
            }}
          >
            Supported Languages
          </AnimatedText>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              justifyContent: 'center',
            }}
          >
            {supportedLanguages.map((lang, index) => (
              <motion.div
                key={lang.code}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Paper
                  elevation={2}
                  sx={{
                    p: 2,
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
                  }}
                >
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
                </Paper>
              </motion.div>
            ))}
          </Box>
        </Box>

        {/* Call to Action */}
        <Box sx={{ textAlign: 'center', mt: 8 }}>
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
        </Box>
      </Container>
    </Box>
  );
};

export default LanguageSection;
