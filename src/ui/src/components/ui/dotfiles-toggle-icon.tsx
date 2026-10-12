'use client'

import * as React from 'react'

export function DotfilesToggleIcon({
  hidden = false,
  size = 16,
  className,
}: {
  hidden?: boolean
  size?: number
  className?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="10" cy="15" r="1.5" fill="currentColor" stroke="none" />
      {hidden ? <line x1="4" y1="20" x2="20" y2="4" /> : null}
    </svg>
  )
}

export default DotfilesToggleIcon
