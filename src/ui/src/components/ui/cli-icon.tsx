import { cn } from '@/lib/utils'

type CliIconProps = {
  size?: number
  strokeWidth?: number
  className?: string
}

export function CliIcon({ size = 18, strokeWidth = 1.7, className }: CliIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-current', className)}
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M7.5 9.5l3 3-3 3" />
      <line x1="12.5" y1="15.5" x2="17" y2="15.5" />
    </svg>
  )
}

export default CliIcon
