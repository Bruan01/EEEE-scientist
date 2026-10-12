'use client';

import { forwardRef, useCallback, useId } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AnimatedCheckbox = forwardRef<HTMLButtonElement, AnimatedCheckboxProps>(
  (
    {
      checked,
      onChange,
      label,
      disabled = false,
      className,
      id,
      size = 'md',
    },
    ref
  ) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;

    const handleClick = useCallback(() => {
      if (!disabled) {
        onChange(!checked);
      }
    }, [checked, onChange, disabled]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onChange(!checked);
        }
      },
      [checked, onChange, disabled]
    );

    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
    };

    const iconSizes = {
      sm: 'w-2.5 h-2.5',
      md: 'w-3 h-3',
      lg: 'w-4 h-4',
    };

    return (
      <div className={cn('inline-flex items-center gap-2', className)}>
        <motion.button
          ref={ref}
          id={checkboxId}
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={disabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            'relative flex items-center justify-center',
            'rounded-md border-2 cursor-pointer',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'focus-visible:ring-[var(--soft-accent)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            sizeClasses[size]
          )}
          animate={{
            backgroundColor: checked ? 'var(--soft-accent)' : 'transparent',
            borderColor: checked ? 'var(--soft-accent)' : 'var(--soft-border)',
            scale: 1,
          }}
          whileTap={{ scale: 0.9 }}
          transition={{
            backgroundColor: { duration: 0.15 },
            borderColor: { duration: 0.15 },
            scale: { type: 'spring', stiffness: 500, damping: 30 },
          }}
        >
          {/* Checkmark with spring animation */}
          <motion.div
            initial={false}
            animate={{
              scale: checked ? 1 : 0,
              opacity: checked ? 1 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
              mass: 0.5,
            }}
          >
            <Check className={cn('text-white', iconSizes[size])} strokeWidth={3} />
          </motion.div>

          {/* Ripple effect on check */}
          <motion.span
            className="absolute inset-0 rounded-md bg-[var(--soft-accent)]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: checked ? [0, 1.5] : 0,
              opacity: checked ? [0.3, 0] : 0,
            }}
            transition={{
              duration: 0.4,
              ease: 'easeOut',
            }}
          />
        </motion.button>

        {label && (
          <label
            htmlFor={checkboxId}
            className={cn(
              'text-[var(--soft-text-primary)] cursor-pointer select-none',
              size === 'sm' && 'text-sm',
              size === 'md' && 'text-base',
              size === 'lg' && 'text-lg',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={handleClick}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

AnimatedCheckbox.displayName = 'AnimatedCheckbox';

export type { AnimatedCheckboxProps };
