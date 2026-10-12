"use client";

import { useState, useCallback } from "react";
import { Rnd } from "react-rnd";
import { motion } from "framer-motion";
import { GlassCard } from "../shared/GlassCard";
import { PanelHeader } from "../shared/PanelHeader";
import { SnapGuides } from "./SnapGuides";
import {
  useFloatingPanelsStore,
  type SnapGuide,
} from "@/lib/stores/floating-panels";
import { cn } from "@/lib/utils";

interface FloatingPanelProps {
  id: "files" | "content" | "chat";
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  headerTone?: "dark" | "light";
}

export function FloatingPanel({
  id,
  title,
  icon,
  children,
  minWidth = 200,
  minHeight = 200,
  className,
  headerTone,
}: FloatingPanelProps) {
  const { panels, updatePanel, bringToFront, togglePanel, getSnapPosition } =
    useFloatingPanelsStore();
  const panel = panels[id];
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    bringToFront(id);
  }, [bringToFront, id]);

  const handleDrag = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      const { guides: newGuides } = getSnapPosition(
        id,
        d.x,
        d.y,
        panel.width,
        panel.height
      );
      setGuides(newGuides);
    },
    [getSnapPosition, id, panel.width, panel.height]
  );

  const handleDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      const { x, y } = getSnapPosition(id, d.x, d.y, panel.width, panel.height);
      updatePanel(id, { x, y });
      setGuides([]);
      setIsDragging(false);
    },
    [getSnapPosition, id, panel.width, panel.height, updatePanel]
  );

  const handleResizeStop = useCallback(
    (
      _e: unknown,
      _dir: unknown,
      ref: HTMLElement,
      _delta: unknown,
      position: { x: number; y: number }
    ) => {
      updatePanel(id, {
        width: parseInt(ref.style.width),
        height: parseInt(ref.style.height),
        x: position.x,
        y: position.y,
      });
    },
    [id, updatePanel]
  );

  if (!panel.isVisible) return null;

  return (
    <>
      <SnapGuides guides={guides} />
      <Rnd
        position={{ x: panel.x, y: panel.y }}
        size={{ width: panel.width, height: panel.height }}
        minWidth={minWidth}
        minHeight={minHeight}
        bounds="window"
        dragHandleClassName="panel-drag-handle"
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        onMouseDown={() => bringToFront(id)}
        style={{ zIndex: panel.zIndex }}
        enableResizing={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true,
        }}
        resizeHandleStyles={{
          top: { cursor: "n-resize" },
          right: { cursor: "e-resize" },
          bottom: { cursor: "s-resize" },
          left: { cursor: "w-resize" },
          topRight: { cursor: "ne-resize" },
          bottomRight: { cursor: "se-resize" },
          bottomLeft: { cursor: "sw-resize" },
          topLeft: { cursor: "nw-resize" },
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="h-full"
        >
          <GlassCard
            variant={isDragging ? "elevated" : "default"}
            className={cn("h-full flex flex-col", className)}
          >
            <PanelHeader
              title={title}
              icon={icon}
              onMinimize={() => updatePanel(id, { isMinimized: true })}
              onClose={() => togglePanel(id)}
              className="panel-drag-handle"
              tone={headerTone}
            />
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          </GlassCard>
        </motion.div>
      </Rnd>
    </>
  );
}
