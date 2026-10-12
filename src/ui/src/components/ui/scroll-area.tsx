"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Orientation of the scroll area */
  orientation?: "vertical" | "horizontal" | "both";
}

/**
 * ScrollArea - Custom scrollable container with styled scrollbars
 */
const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, orientation = "vertical", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative",
          orientation === "vertical" && "overflow-y-auto overflow-x-hidden",
          orientation === "horizontal" && "overflow-x-auto overflow-y-hidden",
          orientation === "both" && "overflow-auto",
          // Custom scrollbar styles
          "scrollbar-thin scrollbar-thumb-soft-border scrollbar-track-transparent",
          "hover:scrollbar-thumb-soft-text-muted",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
