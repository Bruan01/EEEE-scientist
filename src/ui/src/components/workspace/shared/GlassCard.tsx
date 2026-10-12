"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "subtle";
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "bg-gray-900/80 border-white/10",
      elevated: "bg-gray-900/90 border-white/15 shadow-2xl",
      subtle: "bg-gray-900/60 border-white/5",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "backdrop-blur-xl rounded-2xl border overflow-hidden",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
