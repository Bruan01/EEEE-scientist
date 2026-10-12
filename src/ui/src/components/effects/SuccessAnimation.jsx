'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './SuccessAnimation.css';

const SuccessAnimation = ({
  show = false,
  size = 120,
  onComplete,
  title = 'Success!',
  subtitle = '',
  duration = 2500
}) => {
  const [phase, setPhase] = useState('idle'); // idle -> circle -> check -> complete

  useEffect(() => {
    if (show) {
      setPhase('circle');

      // Circle animation duration
      const circleTimer = setTimeout(() => {
        setPhase('check');
      }, 600);

      // Check animation duration
      const checkTimer = setTimeout(() => {
        setPhase('complete');
      }, 1400);

      // Callback after all animations
      const completeTimer = setTimeout(() => {
        onComplete?.();
      }, duration);

      return () => {
        clearTimeout(circleTimer);
        clearTimeout(checkTimer);
        clearTimeout(completeTimer);
      };
    } else {
      setPhase('idle');
    }
  }, [show, duration, onComplete]);

  // SVG dimensions
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="success-animation-wrapper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="success-animation-container">
            <div
              className="success-visual"
              style={{
                width: size,
                height: size,
                '--success-size': `${size}px`,
              }}
            >
              {/* Background glow effect */}
              <div
                className={`success-glow ${phase !== 'idle' ? 'active' : ''}`}
                style={{ width: size * 1.5, height: size * 1.5 }}
              />

              {/* Particle burst effect */}
              <div className={`success-particles ${phase === 'check' ? 'active' : ''}`}>
                {[...Array(12)].map((_, i) => (
                  <span
                    key={i}
                    className="particle"
                    style={{
                      '--angle': `${i * 30}deg`,
                      '--delay': `${i * 0.02}s`,
                    }}
                  />
                ))}
              </div>

              {/* Main SVG */}
              <svg
                className="success-svg"
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
              >
                {/* Background circle (light) */}
                <circle
                  className="success-circle-bg"
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="rgba(34, 197, 94, 0.1)"
                  strokeWidth={strokeWidth}
                />

                {/* Animated circle */}
                <circle
                  className={`success-circle ${phase !== 'idle' ? 'animate' : ''}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="url(#successGradient)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: phase === 'idle' ? circumference : 0,
                  }}
                />

                {/* Gradient definition */}
                <defs>
                  <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="50%" stopColor="#16a34a" />
                    <stop offset="100%" stopColor="#15803d" />
                  </linearGradient>

                  <filter id="successGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Checkmark */}
                <g
                  className={`success-checkmark ${phase === 'check' || phase === 'complete' ? 'animate' : ''}`}
                  filter="url(#successGlow)"
                >
                  <polyline
                    className="checkmark-line"
                    points={`${center * 0.55},${center} ${center * 0.85},${center * 1.25} ${center * 1.45},${center * 0.7}`}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={strokeWidth + 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </svg>

              {/* Success fill circle */}
              <div
                className={`success-fill ${phase === 'complete' ? 'active' : ''}`}
                style={{ width: size - 16, height: size - 16 }}
              />
            </div>

            {/* Text content */}
            <motion.div
              className="success-text-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: phase === 'complete' ? 1 : 0,
                y: phase === 'complete' ? 0 : 20
              }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {title && <h2 className="success-title">{title}</h2>}
              {subtitle && <p className="success-subtitle">{subtitle}</p>}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuccessAnimation;
