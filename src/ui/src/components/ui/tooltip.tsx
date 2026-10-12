"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

interface TooltipProviderProps {
  children: React.ReactNode;
  /** Delay before showing tooltip (ms) - passed to child Tooltips */
  delayDuration?: number;
  /** Skip delay duration */
  skipDelayDuration?: number;
}

/**
 * TooltipProvider - Context provider for tooltips
 */
const TooltipProvider: React.FC<TooltipProviderProps> = ({
  children,
  // These props are accepted for compatibility but not used in this simple implementation
  delayDuration: _delayDuration,
  skipDelayDuration: _skipDelayDuration,
}) => {
  return <>{children}</>;
};

interface TooltipProps {
  children: React.ReactNode;
  /** Delay before showing tooltip (ms) */
  delayDuration?: number;
}

/**
 * Tooltip - Container for tooltip trigger and content
 */
const Tooltip: React.FC<TooltipProps> = ({
  children,
  delayDuration = 200,
}) => {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  const handleOpen = React.useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, delayDuration);
  }, [delayDuration]);

  const handleClose = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setOpen(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <TooltipContext.Provider
      value={{
        open,
        setOpen: (value) => {
          if (value) {
            handleOpen();
          } else {
            handleClose();
          }
        },
      }}
    >
      {children}
    </TooltipContext.Provider>
  );
};

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

/**
 * TooltipTrigger - Element that triggers the tooltip
 */
const TooltipTrigger = React.forwardRef<HTMLDivElement, TooltipTriggerProps>(
  ({ className, children, asChild, ...props }, ref) => {
    const context = React.useContext(TooltipContext);

    return (
      <div
        ref={ref}
        className={cn("inline-flex", className)}
        onMouseEnter={() => context?.setOpen(true)}
        onMouseLeave={() => context?.setOpen(false)}
        onFocus={() => context?.setOpen(true)}
        onBlur={() => context?.setOpen(false)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipTrigger.displayName = "TooltipTrigger";

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}

/**
 * TooltipContent - The tooltip content
 */
const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = "top", sideOffset = 4, children, ...props }, ref) => {
    const context = React.useContext(TooltipContext);

    if (!context?.open) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-[10002] overflow-hidden rounded-soft-sm px-3 py-1.5",
          "bg-soft-bg-elevated text-soft-text-primary text-sm",
          "shadow-soft-sm border border-soft-border",
          "animate-in fade-in-0 zoom-in-95",
          // Position based on side
          side === "top" && "bottom-full mb-2",
          side === "bottom" && "top-full mt-2",
          side === "left" && "right-full mr-2",
          side === "right" && "left-full ml-2",
          className
        )}
        style={{
          marginTop: side === "bottom" ? sideOffset : undefined,
          marginBottom: side === "top" ? sideOffset : undefined,
          marginLeft: side === "right" ? sideOffset : undefined,
          marginRight: side === "left" ? sideOffset : undefined,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
