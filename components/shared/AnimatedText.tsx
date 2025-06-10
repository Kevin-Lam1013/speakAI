import { motion } from 'framer-motion';
import { Typography, TypographyProps } from '@mui/material';
import { FC, PropsWithChildren } from 'react';

interface AnimatedTextProps extends PropsWithChildren {
  delay?: number;
  duration?: number;
  TypographyProps?: TypographyProps;
}

const AnimatedText: FC<AnimatedTextProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  TypographyProps,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay }}
    >
      <Typography {...TypographyProps}>{children}</Typography>
    </motion.div>
  );
};

export default AnimatedText;
