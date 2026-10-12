'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'space-y-4',
        month_caption: 'relative flex items-center justify-center pt-1',
        caption_label: 'text-sm font-semibold text-foreground',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute left-1 h-8 w-8 rounded-full bg-background p-0 shadow-none'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute right-1 h-8 w-8 rounded-full bg-background p-0 shadow-none'
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-[0.75rem] font-medium text-muted-foreground',
        weeks: 'mt-2 flex flex-col gap-1',
        week: 'flex w-full',
        day: 'h-9 w-9 p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 rounded-full p-0 font-normal aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground'
        ),
        selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        today: 'border border-primary/40',
        outside: 'text-muted-foreground opacity-45',
        disabled: 'text-muted-foreground opacity-40',
        hidden: 'invisible',
        range_middle: 'bg-primary/10 text-primary',
        range_start: 'bg-primary text-primary-foreground',
        range_end: 'bg-primary text-primary-foreground',
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation = 'right' }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('h-4 w-4', chevronClassName)} />
          ) : (
            <ChevronRight className={cn('h-4 w-4', chevronClassName)} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
