'use client';

import { forwardRef, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, ButtonProps } from './button';
import { cn } from '@/lib/utils';

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface RippleButtonProps extends ButtonProps {
  rippleColor?: string;
  rippleDuration?: number;
}

export const RippleButton = forwardRef<HTMLButtonElement, RippleButtonProps>(
  (
    {
      children,
      rippleColor = 'currentColor',
      rippleDuration = 600,
      onClick,
      className,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        const button = buttonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate ripple size based on button dimensions
        const size = Math.max(rect.width, rect.height) * 2;

        const ripple: Ripple = {
          id: Date.now(),
          x,
          y,
          size,
        };

        setRipples(prev => [...prev, ripple]);

        // Clean up ripple after animation
        setTimeout(() => {
          setRipples(prev => prev.filter(r => r.id !== ripple.id));
        }, rippleDuration);

        onClick?.(e);
      },
      [onClick, rippleDuration]
    );

    // Combine refs
    const setRefs = useCallback(
      (node: HTMLButtonElement | null) => {
        buttonRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    return (
      <Button
        ref={setRefs}
        onClick={handleClick}
        className={cn('relative overflow-hidden', className)}
        {...props}
      >
        {children}

        {/* Ripple container */}
        <AnimatePresence>
          {ripples.map(ripple => (
            <motion.span
              key={ripple.id}
              className="absolute pointer-events-none"
              style={{
                left: ripple.x - ripple.size / 2,
                top: ripple.y - ripple.size / 2,
                width: ripple.size,
                height: ripple.size,
                borderRadius: '50%',
                backgroundColor: rippleColor,
              }}
              initial={{
                scale: 0,
                opacity: 0.35,
              }}
              animate={{
                scale: 1,
                opacity: 0,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration: rippleDuration / 1000,
                ease: 'easeOut',
              }}
            />
          ))}
        </AnimatePresence>
      </Button>
    );
  }
);

RippleButton.displayName = 'RippleButton';

export type { RippleButtonProps };
