"use client";

import * as React from "react";
import type { NodeApi } from "react-arborist";
import type { FileNode } from "@/lib/types/file";

/**
 * RenameInput props
 */
export interface RenameInputProps {
  /** The node being renamed */
  node: NodeApi<FileNode>;

  /** Callback when rename is submitted */
  onSubmit?: (name: string) => void;

  /** Callback when rename is cancelled */
  onCancel?: () => void;
}

/**
 * RenameInput - Inline input for renaming files/folders
 *
 * Features:
 * - Auto-selects filename (excluding extension for files)
 * - Enter to confirm, Escape to cancel
 * - Click outside to cancel
 */
export function RenameInput({ node, onSubmit, onCancel }: RenameInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [value, setValue] = React.useState(node.data.name);

  // Focus and select on mount
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();

      // For files, select only the name part (not extension)
      if (node.data.type === "file" || node.data.type === "notebook") {
        const lastDot = value.lastIndexOf(".");
        if (lastDot > 0) {
          inputRef.current.setSelectionRange(0, lastDot);
        } else {
          inputRef.current.select();
        }
      } else {
        inputRef.current.select();
      }
    }
  }, [node.data.type, value]);

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed && trimmed !== node.data.name) {
        if (onSubmit) {
          onSubmit(trimmed);
        } else {
          node.submit(trimmed);
        }
      } else {
        if (onCancel) {
          onCancel();
        } else {
          node.reset();
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (onCancel) {
        onCancel();
      } else {
        node.reset();
      }
    }
  };

  // Handle blur (click outside)
  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== node.data.name) {
      if (onSubmit) {
        onSubmit(trimmed);
      } else {
        node.submit(trimmed);
      }
    } else {
      if (onCancel) {
        onCancel();
      } else {
        node.reset();
      }
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="flex-1 min-w-0 px-1 py-0.5 text-sm bg-soft-bg-elevated border border-soft-border rounded focus:outline-none focus:ring-1 focus:ring-soft-primary"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export default RenameInput;
