import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium backdrop-blur-sm',
  {
    variants: {
      variant: {
        default: 'border-white/20 dark:border-white/10 bg-white/30 dark:bg-white/5 text-foreground',
        secondary: 'border-border/60 bg-muted/40 text-muted-foreground',
        success: 'border-success/30 bg-success/15 text-success-foreground',
        warning: 'border-warning/30 bg-warning/15 text-warning-foreground',
        destructive: 'border-destructive/30 bg-destructive/15 text-destructive',
        error: 'border-destructive/30 bg-destructive/15 text-destructive',
        primary: 'border-primary/30 bg-primary/15 text-primary',
        outline: 'border-border bg-transparent text-foreground',
        info: 'border-info/30 bg-info/15 text-info-foreground',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0.5',
        md: 'text-xs px-2 py-0.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'primary'

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}
