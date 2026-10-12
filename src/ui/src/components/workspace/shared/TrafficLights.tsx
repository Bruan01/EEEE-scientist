"use client";

import { useI18n } from "@/lib/i18n/useI18n";
import { cn } from "@/lib/utils";

interface TrafficLightsProps {
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

export function TrafficLights({
  className,
  onClose,
  onMinimize,
  onMaximize,
}: TrafficLightsProps) {
  const { t } = useI18n("workspace");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        onClick={onClose}
        className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80
                   transition-colors shadow-sm flex items-center justify-center
                   group"
        title={t("window_close")}
      >
        <span className="opacity-0 group-hover:opacity-100 text-[8px] text-black/60 font-bold">
          x
        </span>
      </button>
      <button
        onClick={onMinimize}
        className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:bg-[#FFBD2E]/80
                   transition-colors shadow-sm flex items-center justify-center
                   group"
        title={t("window_minimize")}
      >
        <span className="opacity-0 group-hover:opacity-100 text-[8px] text-black/60 font-bold">
          -
        </span>
      </button>
      <button
        onClick={onMaximize}
        className="w-3 h-3 rounded-full bg-[#28C840] hover:bg-[#28C840]/80
                   transition-colors shadow-sm flex items-center justify-center
                   group"
        title={t("window_maximize")}
      >
        <span className="opacity-0 group-hover:opacity-100 text-[7px] text-black/60 font-bold">
          +
        </span>
      </button>
    </div>
  );
}
