"use client";

import * as React from "react";
import { ClipboardCopy, Download, ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArxivContextMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  onDownloadPdf: () => void;
  onCopyBibtex: () => void;
  onOpenArxiv: () => void;
  onDelete: () => void;
  canDownloadPdf?: boolean;
  canCopyBibtex?: boolean;
  canOpenArxiv?: boolean;
  canDelete?: boolean;
  readOnly?: boolean;
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  destructive = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-soft-bg-elevated",
        destructive ? "text-red-500 hover:text-red-600" : "text-soft-text-primary"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-soft-border" />;
}

export function ArxivContextMenu({
  position,
  onClose,
  onDownloadPdf,
  onCopyBibtex,
  onOpenArxiv,
  onDelete,
  canDownloadPdf = false,
  canCopyBibtex = true,
  canOpenArxiv = true,
  canDelete = false,
  readOnly = false,
}: ArxivContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  React.useEffect(() => {
    if (!menuRef.current) return;
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
  }, [position]);

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[10002] min-w-[200px] rounded-soft-sm border border-soft-border bg-soft-bg-base py-1",
        "shadow-soft-md"
      )}
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
      role="menu"
      aria-label="ArXiv context menu"
    >
      <MenuItem
        icon={Download}
        label="Download PDF"
        onClick={onDownloadPdf}
        disabled={!canDownloadPdf}
      />
      <MenuItem
        icon={ClipboardCopy}
        label="Copy BibTeX"
        onClick={onCopyBibtex}
        disabled={!canCopyBibtex}
      />
      <MenuItem
        icon={ExternalLink}
        label="Open arXiv"
        onClick={onOpenArxiv}
        disabled={!canOpenArxiv}
      />
      {!readOnly && (
        <>
          <Separator />
          <MenuItem
            icon={Trash2}
            label="Delete"
            onClick={onDelete}
            disabled={!canDelete}
            destructive
          />
        </>
      )}
    </div>
  );
}

export default ArxivContextMenu;
