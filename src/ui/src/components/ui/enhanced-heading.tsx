'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface EnhancedHeadingProps {
  children: string;
  effect?: 'gradient' | 'shiny' | 'blur' | 'none';
  className?: string;
  gradientColors?: [string, string];
  as?: HeadingTag;
  animationDelay?: number;
}

// Gradient Text Effect
function GradientHeading({
  children,
  className,
  gradientColors = ['#2563EB', '#2F3437'],
  as: Component = 'h2',
}: EnhancedHeadingProps) {
  return (
    <Component
      className={cn('font-bold', className)}
      style={{
        background: `linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {children}
    </Component>
  );
}

// Shiny Text Effect
function ShinyHeading({
  children,
  className,
  as: Component = 'h2',
}: EnhancedHeadingProps) {
  return (
    <Component
      className={cn(
        'font-bold relative inline-block',
        className
      )}
    >
      <span className="relative">
        {children}
        <motion.span
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
          }}
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
            ease: 'easeInOut',
          }}
        >
          {children}
        </motion.span>
      </span>
    </Component>
  );
}

// Blur Text Effect (letters appear one by one with blur)
function BlurHeading({
  children,
  className,
  as: Component = 'h2',
  animationDelay = 50,
}: EnhancedHeadingProps) {
  const [isVisible, setIsVisible] = useState(false);
  const letters = children.split('');

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: animationDelay / 1000,
      },
    },
  };

  const letterVariants = {
    hidden: {
      opacity: 0,
      filter: 'blur(10px)',
      y: 10,
    },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0, 0, 0.2, 1] as const, // easeOut as cubic-bezier
      },
    },
  };

  return (
    <Component className={cn('font-bold', className)}>
      <AnimatePresence>
        <motion.span
          variants={containerVariants}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          className="inline-flex flex-wrap"
        >
          {letters.map((letter, index) => (
            <motion.span
              key={`${letter}-${index}`}
              variants={letterVariants}
              className={letter === ' ' ? 'w-[0.25em]' : ''}
            >
              {letter === ' ' ? '\u00A0' : letter}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </Component>
  );
}

// Plain Heading (no effect)
function PlainHeading({
  children,
  className,
  as: Component = 'h2',
}: EnhancedHeadingProps) {
  return (
    <Component className={cn('font-bold', className)}>
      {children}
    </Component>
  );
}

export function EnhancedHeading({
  children,
  effect = 'none',
  className,
  gradientColors = ['#2563EB', '#2F3437'],
  as = 'h2',
  animationDelay = 50,
}: EnhancedHeadingProps) {
  const baseClassName = cn(
    as === 'h1' && 'text-4xl md:text-5xl',
    as === 'h2' && 'text-3xl md:text-4xl',
    as === 'h3' && 'text-2xl md:text-3xl',
    as === 'h4' && 'text-xl md:text-2xl',
    as === 'h5' && 'text-lg md:text-xl',
    as === 'h6' && 'text-base md:text-lg',
    className
  );

  switch (effect) {
    case 'gradient':
      return (
        <GradientHeading
          as={as}
          className={baseClassName}
          gradientColors={gradientColors}
        >
          {children}
        </GradientHeading>
      );
    case 'shiny':
      return (
        <ShinyHeading as={as} className={baseClassName}>
          {children}
        </ShinyHeading>
      );
    case 'blur':
      return (
        <BlurHeading
          as={as}
          className={baseClassName}
          animationDelay={animationDelay}
        >
          {children}
        </BlurHeading>
      );
    default:
      return (
        <PlainHeading as={as} className={baseClassName}>
          {children}
        </PlainHeading>
      );
  }
}

export type { EnhancedHeadingProps };
