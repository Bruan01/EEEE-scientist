'use client'

import { forwardRef } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import Shimmer from '@/components/effects/Shimmer'
import { cn } from '@/lib/utils'

export const ShimmerButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Shimmer className="rounded-lg">
        <Button ref={ref} className={cn('relative z-10', className)} {...props}>
          {children}
        </Button>
      </Shimmer>
    )
  }
)

ShimmerButton.displayName = 'ShimmerButton'
