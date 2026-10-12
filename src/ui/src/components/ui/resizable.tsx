"use client";

import { GripVertical } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

/**
 * ResizablePanelGroup - Container for resizable panels
 */
const ResizablePanelGroup = ({
  className,
  orientation = "horizontal",
  ...props
}: Omit<GroupProps, "orientation"> & { direction?: "horizontal" | "vertical"; orientation?: "horizontal" | "vertical" }) => (
  <Group
    orientation={orientation}
    className={cn(
      "flex h-full w-full",
      orientation === "vertical" && "flex-col",
      className
    )}
    {...props}
  />
);

/**
 * ResizablePanel - Individual resizable panel
 */
const ResizablePanel = Panel;

/**
 * ResizableHandle - Drag handle between panels with visual feedback
 */
const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: SeparatorProps & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-soft-border",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-soft-accent focus-visible:ring-offset-1",
      // Hover effect with transition
      "hover:bg-soft-accent/50 hover:w-1 transition-all duration-150 cursor-col-resize",
      // Active state styling
      "data-[resize-handle-active]:bg-soft-accent data-[resize-handle-active]:w-1 data-[resize-handle-active]:shadow-lg data-[resize-handle-active]:shadow-soft-accent/30",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div
        className={cn(
          "z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-soft-border bg-soft-bg-elevated",
          "transition-all duration-150",
          "group-data-[resize-handle-active]:scale-110 group-data-[resize-handle-active]:border-soft-accent group-data-[resize-handle-active]:bg-soft-accent/10"
        )}
      >
        <GripVertical
          className={cn(
            "h-2.5 w-2.5 text-soft-text-tertiary transition-colors",
            "group-data-[resize-handle-active]:text-soft-accent"
          )}
        />
      </div>
    )}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
