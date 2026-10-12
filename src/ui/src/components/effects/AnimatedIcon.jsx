'use client';

import { motion } from 'framer-motion';
import './AnimatedIcon.css';

const AnimatedIcon = ({
  children,
  size = 24,
  color = '#0ea5e9',
  hoverColor = '#7c3aed',
  glowIntensity = 0.6,
  className = ''
}) => {
  return (
    <motion.div
      className={`animated-icon ${className}`}
      style={{
        '--icon-color': color,
        '--icon-hover-color': hoverColor,
        '--glow-intensity': glowIntensity,
        fontSize: `${size}px`
      }}
      whileHover={{
        scale: 1.15,
        rotate: [0, -10, 10, -5, 0],
        transition: {
          rotate: {
            duration: 0.5,
            ease: 'easeInOut'
          },
          scale: {
            duration: 0.2
          }
        }
      }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="icon-wrapper">
        {children}
      </div>
      <div className="icon-glow" />
    </motion.div>
  );
};

export default AnimatedIcon;
