'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

export function SpinningIcon({ className, size = 38 }: { className?: string; size?: number }) {
  const maskId = useId()
  const clipId = useId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 38 38"
      fill="none"
      className={cn('ai-manus-spin', className)}
    >
      <mask id={maskId} fill="white">
        <path d="M38 19C38 29.4934 29.4934 38 19 38C8.50659 38 0 29.4934 0 19C0 8.50659 8.50659 0 19 0C29.4934 0 38 8.50659 38 19Z" />
      </mask>
      <g clipPath={`url(#${clipId})`} mask={`url(#${maskId})`}>
        <g transform="matrix(0 0.019 -0.019 0 19 19)">
          <foreignObject x="-1105.26" y="-1105.26" width="2210.53" height="2210.53">
            <div
              style={{
                background:
                  'conic-gradient(from 90deg, #C7AD7A 0deg, #D6C2A1 75deg, #B18C55 150deg, #9A7B4B 225deg, #C1A26A 300deg, rgba(201, 179, 122, 0) 360deg)',
                height: '100%',
                width: '100%',
                opacity: 1,
              }}
            />
          </foreignObject>
        </g>
      </g>
      <path
        d="M36 19C36 28.3888 28.3888 36 19 36V40C30.598 40 40 30.598 40 19H36ZM19 36C9.61116 36 2 28.3888 2 19H-2C-2 30.598 7.40202 40 19 40V36ZM2 19C2 9.61116 9.61116 2 19 2V-2C7.40202 -2 -2 7.40202 -2 19H2ZM19 2C28.3888 2 36 9.61116 36 19H40C40 7.40202 30.598 -2 19 -2V2Z"
        mask={`url(#${maskId})`}
      />
      <defs>
        <clipPath id={clipId}>
          <path
            d="M36 19C36 28.3888 28.3888 36 19 36V40C30.598 40 40 30.598 40 19H36ZM19 36C9.61116 36 2 28.3888 2 19H-2C-2 30.598 7.40202 40 19 40V36ZM2 19C2 9.61116 9.61116 2 19 2V-2C7.40202 -2 -2 7.40202 -2 19H2ZM19 2C28.3888 2 36 9.61116 36 19H40C40 7.40202 30.598 -2 19 -2V2Z"
            mask={`url(#${maskId})`}
          />
        </clipPath>
      </defs>
    </svg>
  )
}

export default SpinningIcon
