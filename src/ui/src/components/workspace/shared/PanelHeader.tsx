"use client";

import { cn } from "@/lib/utils";
import { Minus, Maximize2, X, GripHorizontal } from "lucide-react";

interface PanelHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  className?: string;
  showControls?: boolean;
  tone?: "dark" | "light";
}

export function PanelHeader({
  title,
  icon,
  onMinimize,
  onMaximize,
  onClose,
  className,
  showControls = true,
  tone = "dark",
}: PanelHeaderProps) {
  const isLight = tone === "light";
  return (
    <div
      className={cn(
        "h-10 px-3 flex items-center justify-between",
        isLight ? "bg-white border-b border-gray-200" : "bg-white/5 border-b border-white/5",
        "cursor-move select-none",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <GripHorizontal className={cn("h-4 w-4", isLight ? "text-slate-400" : "text-white/30")} />
        {icon && <span className={cn(isLight ? "text-slate-500" : "text-white/60")}>{icon}</span>}
        <span className={cn("text-sm font-medium", isLight ? "text-slate-700" : "text-white/80")}>
          {title}
        </span>
      </div>

      {showControls && (
        <div className="flex items-center gap-1">
          {onMinimize && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
              className={cn(
                "p-1 rounded transition-colors",
                isLight
                  ? "text-slate-400 hover:text-slate-700 hover:bg-gray-100"
                  : "hover:bg-white/10 text-white/40 hover:text-white/80"
              )}
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
          {onMaximize && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMaximize();
              }}
              className={cn(
                "p-1 rounded transition-colors",
                isLight
                  ? "text-slate-400 hover:text-slate-700 hover:bg-gray-100"
                  : "hover:bg-white/10 text-white/40 hover:text-white/80"
              )}
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className={cn(
                "p-1 rounded transition-colors",
                isLight
                  ? "text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                  : "hover:bg-red-500/20 text-white/40 hover:text-red-400"
              )}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
