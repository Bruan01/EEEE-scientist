'use client';

import { useState, useEffect } from 'react';
import './DecryptedText.css';

const DecryptedText = ({ text, speed = 50, className = '' }) => {
  const [displayText, setDisplayText] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(true);

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';

  useEffect(() => {
    let currentIndex = 0;
    let interval;

    const decrypt = () => {
      if (currentIndex <= text.length) {
        const decrypted = text.slice(0, currentIndex);
        const random = Array.from({ length: text.length - currentIndex }, () =>
          characters.charAt(Math.floor(Math.random() * characters.length))
        ).join('');

        setDisplayText(decrypted + random);
        currentIndex++;
      } else {
        setIsDecrypting(false);
        clearInterval(interval);
      }
    };

    interval = setInterval(decrypt, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <div className={`decrypted-text ${className}`}>
      <span className={isDecrypting ? 'decrypting' : 'decrypted'}>
        {displayText}
      </span>
    </div>
  );
};

export default DecryptedText;
