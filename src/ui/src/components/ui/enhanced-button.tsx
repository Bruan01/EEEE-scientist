'use client';

import { forwardRef, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, ButtonProps } from './button';
import { cn } from '@/lib/utils';

interface Spark {
  id: number;
  x: number;
  y: number;
  angle: number;
}

interface EnhancedButtonProps extends ButtonProps {
  enableSpark?: boolean;
  enableMagnet?: boolean;
  sparkColor?: string;
  sparkCount?: number;
}

export const EnhancedButton = forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (
    {
      children,
      enableSpark = true,
      enableMagnet = false,
      sparkColor = 'var(--primary)',
      sparkCount = 8,
      onClick,
      className,
      ...props
    },
    ref
  ) => {
    const [sparks, setSparks] = useState<Spark[]>([]);
    const [magnetOffset, setMagnetOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle click spark effect
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (enableSpark) {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const newSparks: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
            id: Date.now() + i,
            x,
            y,
            angle: (360 / sparkCount) * i + Math.random() * 30 - 15,
          }));

          setSparks(prev => [...prev, ...newSparks]);

          // Clean up sparks after animation
          setTimeout(() => {
            setSparks(prev => prev.filter(s => !newSparks.find(ns => ns.id === s.id)));
          }, 600);
        }

        onClick?.(e);
      },
      [enableSpark, sparkCount, onClick]
    );

    // Handle magnet effect
    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!enableMagnet || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distX = e.clientX - centerX;
        const distY = e.clientY - centerY;

        const magnetStrength = 0.08;
        setMagnetOffset({
          x: distX * magnetStrength,
          y: distY * magnetStrength,
        });
      },
      [enableMagnet]
    );

    const handleMouseLeave = useCallback(() => {
      if (enableMagnet) {
        setMagnetOffset({ x: 0, y: 0 });
      }
    }, [enableMagnet]);

    return (
      <div
        ref={containerRef}
        className="relative inline-block"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          animate={{
            x: magnetOffset.x,
            y: magnetOffset.y,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Button
            ref={ref}
            onClick={handleClick}
            className={cn('relative overflow-visible', className)}
            {...props}
          >
            {children}
          </Button>
        </motion.div>

        {/* Spark effects */}
        <AnimatePresence>
          {sparks.map(spark => (
            <motion.span
              key={spark.id}
              className="absolute pointer-events-none"
              style={{
                left: spark.x,
                top: spark.y,
                width: 6,
                height: 6,
                marginLeft: -3,
                marginTop: -3,
                borderRadius: '50%',
                backgroundColor: sparkColor,
              }}
              initial={{
                scale: 0,
                opacity: 1,
                x: 0,
                y: 0,
              }}
              animate={{
                scale: [0, 1, 0.5],
                opacity: [1, 1, 0],
                x: Math.cos((spark.angle * Math.PI) / 180) * 40,
                y: Math.sin((spark.angle * Math.PI) / 180) * 40,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }
);

EnhancedButton.displayName = 'EnhancedButton';

export type { EnhancedButtonProps };
