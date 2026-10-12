'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import './Magnetic.css';

const Magnetic = ({ children, strength = 0.3, className = '' }) => {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = left + width / 2;
    const middleY = top + height / 2;
    const x = (clientX - middleX) * strength;
    const y = (clientY - middleY) * strength;

    setPosition({ x, y });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  const { x, y } = position;

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x, y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
      className={`magnetic-wrapper ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default Magnetic;
