"use client";

import * as React from "react";
import { FilePlus, FolderPlus, Clipboard, Braces, RefreshCw } from "lucide-react";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import { PngIcon } from "@/components/ui/png-icon";

function withPngFallback(
  name: string,
  Fallback: React.ComponentType<{ className?: string }>
): React.ComponentType<{ className?: string }> {
  return function PngWrapped({ className }: { className?: string }) {
    return (
      <PngIcon
        name={name}
        size={16}
        className={className}
        fallback={<Fallback className={className} />}
      />
    );
  };
}

const ClipboardIcon = withPngFallback("Clipboard", Clipboard);
const BracesIcon = withPngFallback("Braces", Braces);
const RefreshCwIcon = withPngFallback("RefreshCw", RefreshCw);

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center w-full px-3 py-1.5 text-sm text-left
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-soft-bg-elevated"}
        text-soft-text-primary
      `}
    >
      <Icon className="h-4 w-4 mr-3" />
      <span className="flex-1">{label}</span>
    </button>
  );
}

function Separator() {
  return <div className="h-px bg-soft-border my-1" />;
}

export interface FileTreeBlankContextMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onNewLatexProject: () => void;
  onPaste: () => void;
  onRefresh: () => void;
  readOnly?: boolean;
}

export function FileTreeBlankContextMenu({
  position,
  onClose,
  onNewFile,
  onNewFolder,
  onNewLatexProject,
  onPaste,
  onRefresh,
  readOnly = false,
}: FileTreeBlankContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const clipboard = useFileTreeStore((state) => state.clipboard);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const [adjustedPosition, setAdjustedPosition] = React.useState(position);

  React.useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 8;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[10002] min-w-[180px] bg-soft-bg-base border border-soft-border rounded-soft-sm shadow-soft-md py-1"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {!readOnly && (
        <>
          <MenuItem
            icon={FilePlus}
            label="New File"
            onClick={() => {
              onNewFile();
              onClose();
            }}
          />
          <MenuItem
            icon={BracesIcon}
            label="New LaTeX project"
            onClick={() => {
              onNewLatexProject();
              onClose();
            }}
          />
          <MenuItem
            icon={FolderPlus}
            label="New Folder"
            onClick={() => {
              onNewFolder();
              onClose();
            }}
          />
          <Separator />
        </>
      )}

      {!readOnly && (
        <>
          <MenuItem
            icon={ClipboardIcon}
            label="Paste"
            onClick={() => {
              onPaste();
              onClose();
            }}
            disabled={!clipboard}
          />
          <Separator />
        </>
      )}

      <MenuItem
        icon={RefreshCwIcon}
        label="Refresh"
        onClick={() => {
          onRefresh();
          onClose();
        }}
      />
    </div>
  );
}

export default FileTreeBlankContextMenu;
