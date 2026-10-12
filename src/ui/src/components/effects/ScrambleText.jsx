'use client';

/**
 * ScrambleText Component - 字符乱序重组效果
 * 科技感强烈的文字动画
 */
import { useEffect, useState } from 'react';
import './ScrambleText.css';

const ScrambleText = ({
  text,
  speed = 50,
  scrambleSpeed = 30,
  className = '',
  trigger = 'mount', // 'mount', 'hover', 'continuous'
  as = 'span'
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isScrambling, setIsScrambling] = useState(false);

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

  const scramble = () => {
    if (isScrambling) return;
    setIsScrambling(true);

    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (index < iteration) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('')
      );

      iteration += 1 / 3;

      if (iteration >= text.length) {
        clearInterval(interval);
        setDisplayText(text);
        setIsScrambling(false);
      }
    }, scrambleSpeed);
  };

  useEffect(() => {
    if (trigger === 'mount') {
      const timer = setTimeout(() => scramble(), 500);
      return () => clearTimeout(timer);
    } else if (trigger === 'continuous') {
      const interval = setInterval(() => scramble(), speed * text.length + 2000);
      return () => clearInterval(interval);
    }
  }, []);

  const Component = as;

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      scramble();
    }
  };

  return (
    <Component
      className={`scramble-text ${className}`}
      onMouseEnter={handleMouseEnter}
    >
      {displayText}
    </Component>
  );
};

export default ScrambleText;
