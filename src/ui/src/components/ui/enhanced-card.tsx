'use client';

import { forwardRef, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardProps } from './card';
import { cn } from '@/lib/utils';

interface EnhancedCardProps extends CardProps {
  enableSpotlight?: boolean;
  spotlightColor?: string;
  spotlightSize?: number;
}

export const EnhancedCard = forwardRef<HTMLDivElement, EnhancedCardProps>(
  (
    {
      children,
      enableSpotlight = true,
      spotlightColor = 'rgba(37, 99, 235, 0.15)',
      spotlightSize = 300,
      className,
      ...props
    },
    ref
  ) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      },
      []
    );

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);

    if (!enableSpotlight) {
      return (
        <Card ref={ref} className={className} {...props}>
          {children}
        </Card>
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Spotlight overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-soft-xl overflow-hidden z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              left: mousePosition.x - spotlightSize / 2,
              top: mousePosition.y - spotlightSize / 2,
              width: spotlightSize,
              height: spotlightSize,
              background: `radial-gradient(circle, ${spotlightColor} 0%, transparent 70%)`,
            }}
          />
        </motion.div>

        <Card
          ref={ref}
          className={cn('relative', className)}
          {...props}
        >
          {children}
        </Card>
      </div>
    );
  }
);

EnhancedCard.displayName = 'EnhancedCard';

export type { EnhancedCardProps };
