import { Box, Card, Container, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { features } from '../../constants/features';
import AnimatedText from '../shared/AnimatedText';
import { FC } from 'react';

const FeatureSection: FC = () => {
  const theme = useTheme();

  return (
    <Box
      id="features"
      sx={{
        py: 8,
        bgcolor: theme.palette.background.paper,
      }}
    >
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

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            justifyContent: 'center',
          }}
        >
          {features.map((feature, index) => (
            <Box
              key={feature.title}
              sx={{
                flex: '1 1 calc(50% - 32px)',
                minWidth: { xs: '100%', md: 'calc(50% - 32px)' },
                maxWidth: { xs: '100%', md: 'calc(50% - 32px)' },
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <Card
                  sx={{
                    p: 4,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[8],
                    },
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: theme.palette.primary.main,
                      borderRadius: 2,
                      p: 1,
                      mb: 2,
                    }}
                  >
                    <feature.icon
                      sx={{
                        fontSize: 40,
                        color: '#fff',
                      }}
                    />
                  </Box>

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
                </Card>
              </motion.div>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default FeatureSection;
