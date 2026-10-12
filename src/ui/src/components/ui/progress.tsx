import * as React from 'react'
import { cn } from '@/lib/utils'

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number
  max?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value = 0, max = 100, className, ...props }, ref) => {
    const clamped = Math.min(Math.max(value, 0), max)
    const percent = max > 0 ? (clamped / max) * 100 : 0

    return (
      <div
        ref={ref}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-[#E9E1D8]',
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full rounded-full bg-[#9B8FB8] transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </div>
    )
  }
)

Progress.displayName = 'Progress'

export { Progress }
