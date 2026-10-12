'use client';

import { forwardRef, useState, useCallback, useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  glowColor?: string;
}

export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      glowColor = 'rgba(59, 130, 246, 0.3)',
      id,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const generatedId = useId();
    const inputId = id || generatedId;

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        onFocus?.(e);
      },
      [onFocus]
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        onBlur?.(e);
      },
      [onBlur]
    );

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--soft-text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {/* Animated glow ring */}
          <motion.div
            className="absolute inset-0 rounded-soft-md pointer-events-none"
            initial={false}
            animate={{
              boxShadow: isFocused
                ? `0 0 0 3px ${glowColor}, 0 0 20px ${glowColor}`
                : `0 0 0 0px ${glowColor}, 0 0 0px ${glowColor}`,
            }}
            transition={{
              duration: 0.2,
              ease: 'easeOut',
            }}
          />

          {/* Animated border glow */}
          <motion.div
            className="absolute inset-0 rounded-soft-md pointer-events-none overflow-hidden"
            initial={false}
            animate={{
              opacity: isFocused ? 1 : 0,
            }}
            transition={{
              duration: 0.3,
            }}
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${glowColor} 50%, transparent 100%)`,
              }}
              animate={{
                x: isFocused ? ['-100%', '100%'] : '-100%',
              }}
              transition={{
                duration: 1.5,
                repeat: isFocused ? Infinity : 0,
                ease: 'linear',
              }}
            />
          </motion.div>

          <input
            ref={ref}
            id={inputId}
            className={cn(
              // Base Soft UI styles
              'relative w-full h-12 px-4 rounded-soft-md',
              'bg-[var(--soft-bg-base)] text-[var(--soft-text-primary)]',
              'placeholder:text-[var(--soft-text-tertiary)]',
              'border-none',
              // Soft UI inset shadow
              'shadow-soft-inset',
              // Focus state (handled by animation)
              'focus:outline-none',
              // Transition
              'transition-colors duration-200',
              // Disabled state
              'disabled:opacity-50 disabled:cursor-not-allowed',
              // Error state
              error && 'shadow-soft-inset-error',
              className
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 text-sm text-[var(--soft-danger)]"
          >
            {error}
          </motion.p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-[var(--soft-text-tertiary)]">{hint}</p>
        )}
      </div>
    );
  }
);

AnimatedInput.displayName = 'AnimatedInput';

export type { AnimatedInputProps };
