"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface InfoTriangleIconProps {
  className?: string;
}

export function InfoTriangleIcon({ className }: InfoTriangleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4", className)}
      role="img"
      aria-hidden="true"
    >
      <path d="M12 4L21 20H3L12 4Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="10"
        fontFamily="sans-serif"
        fill="currentColor"
      >
        ?
      </text>
    </svg>
  );
}

export default InfoTriangleIcon;
