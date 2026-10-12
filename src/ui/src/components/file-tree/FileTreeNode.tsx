"use client";

import * as React from "react";
import type { NodeRendererProps } from "react-arborist";
import {
  ArrowRightLeft,
  ChevronRight,
  Eye,
  GripVertical,
  Loader2,
  PenLine,
  Type as TypeIcon,
} from "lucide-react";
import type { FileNode } from "@/lib/types/file";
import { FileIcon } from "./FileIcon";
import { RenameInput } from "./RenameInput";
import { useFileTreeStore, useHighlightedFile } from "@/lib/stores/file-tree";
import { useArxivStore } from "@/lib/stores/arxiv-store";
import { useFileTreeDragContext } from "./FileTreeDragContext";
import { cn } from "@/lib/utils";

/**
 * FileTreeNode - Renders a single node in the file tree
 *
 * Features:
 * - Folder expand/collapse with chevron
 * - File type icons
 * - Inline renaming
 * - Selection and focus states
 * - Drag handle for reordering
 */
export function FileTreeNode({
  node,
  style,
  dragHandle,
}: NodeRendererProps<FileNode>) {
  const isFolder = node.data.type === "folder";
  const isLoading = node.data.isLoading;
  const highlightedFileId = useHighlightedFile();
  const isHighlighted = highlightedFileId === node.data.id;
  const isLatexFolder = isFolder && node.data.folderKind === "latex";
  const isReading = useFileTreeStore(
    React.useCallback(
      (state) => state.readingFileIds.has(node.data.id),
      [node.data.id]
    )
  );
  const isWriting = useFileTreeStore(
    React.useCallback(
      (state) => state.writingFileIds.has(node.data.id),
      [node.data.id]
    )
  );
  const isMoved = useFileTreeStore(
    React.useCallback(
      (state) => state.movedFileIds.has(node.data.id),
      [node.data.id]
    )
  );
  const isRenamed = useFileTreeStore(
    React.useCallback(
      (state) => state.renamedFileIds.has(node.data.id),
      [node.data.id]
    )
  );
  const clearWriteEffect = useFileTreeStore((state) => state.clearWriteEffect);
  const clearMoveEffect = useFileTreeStore((state) => state.clearMoveEffect);
  const clearRenameEffect = useFileTreeStore((state) => state.clearRenameEffect);
  const expand = useFileTreeStore((state) => state.expand);
  const collapse = useFileTreeStore((state) => state.collapse);
  const clearArxivSelection = useArxivStore((state) => state.setSelectedPaperKey);
  const showEye = isReading || isWriting;
  const eyeClass = isWriting ? "is-writing" : "is-reading";
  const {
    readOnly,
    armedId,
    setArmedId,
    externalDragActive = false,
    externalDropTargetId = null,
  } = useFileTreeDragContext();
  const isDragging = node.isDragging;
  const isDragArmed = armedId === node.data.id;
  const isExternalDropTarget =
    externalDragActive && externalDropTargetId === node.data.id;
  const uiMeta = node.data.uiMeta ?? null;
  const onboardingId =
    uiMeta?.emphasis === "diff"
      ? "quest-scope-diff-file"
      : node.data.path === "brief.md"
        ? "quest-explorer-open-file"
        : undefined;

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, input, textarea")) return;

      if (isWriting) clearWriteEffect(node.data.id);
      if (isMoved) clearMoveEffect(node.data.id);
      if (isRenamed) clearRenameEffect(node.data.id);
      clearArxivSelection(null);

      if (e.ctrlKey || e.metaKey) {
        node.selectMulti();
      } else if (e.shiftKey) {
        node.selectContiguous();
      } else {
        node.select();
      }
    },
    [
      clearArxivSelection,
      clearMoveEffect,
      clearRenameEffect,
      clearWriteEffect,
      isMoved,
      isRenamed,
      isWriting,
      node,
    ]
  );

  const handleArmDrag = React.useCallback(
    (e: React.PointerEvent) => {
      if (readOnly || !setArmedId || e.button !== 0) return;
      e.stopPropagation();
      setArmedId(node.data.id);
    },
    [node.data.id, readOnly, setArmedId]
  );

  const dragRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      if (!dragHandle) return;
      if (readOnly) {
        dragHandle(null);
        return;
      }
      dragHandle(element);
    },
    [dragHandle, readOnly]
  );

  const autoOpenTimerRef = React.useRef<number | null>(null);
  const handleToggleFolder = React.useCallback(() => {
    if (!isFolder) return;
    if (node.isOpen) {
      collapse(node.data.id);
    } else {
      expand(node.data.id);
    }
    node.toggle();
  }, [collapse, expand, isFolder, node]);

  React.useEffect(() => {
    if (!isFolder) return;
    if (node.willReceiveDrop && !node.isOpen) {
      if (autoOpenTimerRef.current != null) {
        window.clearTimeout(autoOpenTimerRef.current);
      }
      autoOpenTimerRef.current = window.setTimeout(() => {
        if (node.willReceiveDrop && !node.isOpen) {
          expand(node.data.id);
          node.open();
        }
      }, 500);
      return () => {
        if (autoOpenTimerRef.current != null) {
          window.clearTimeout(autoOpenTimerRef.current);
          autoOpenTimerRef.current = null;
        }
      };
    }

    if (autoOpenTimerRef.current != null) {
      window.clearTimeout(autoOpenTimerRef.current);
      autoOpenTimerRef.current = null;
    }
    return undefined;
  }, [expand, isFolder, node, node.isOpen, node.willReceiveDrop]);

  return (
    <div
      ref={dragRef}
      style={style}
      data-node-id={node.data.id}
      data-onboarding-id={onboardingId}
      className={cn(
        "file-tree-node",
        isLatexFolder && "is-latex-folder",
        node.isSelected && "is-selected",
        isDragArmed && "is-drag-armed",
        node.willReceiveDrop && "will-receive-drop",
        isExternalDropTarget && "is-external-drop-target",
        node.state.isFocused && "is-focused",
        isHighlighted && "is-highlighted",
        uiMeta?.emphasis === "diff" && "is-diff",
        uiMeta?.emphasis === "scope-root" && "is-scope-root",
        isReading && "is-reading",
        isWriting && "is-writing",
        isMoved && "is-moved",
        isRenamed && "is-renamed",
        isDragging && "is-dragging"
      )}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        if (isWriting) clearWriteEffect(node.data.id);
        if (isMoved) clearMoveEffect(node.data.id);
        if (isRenamed) clearRenameEffect(node.data.id);
        clearArxivSelection(null);
      }}
      onPointerUp={() => {
        if (!node.isDragging) {
          setArmedId?.(null);
        }
      }}
      onPointerCancel={() => {
        if (!node.isDragging) {
          setArmedId?.(null);
        }
      }}
      onDoubleClick={() => {
        if (isFolder) {
          handleToggleFolder();
        } else {
          // Double-click on file handled by FileTree component
          // via onRowClick or custom event
        }
      }}
    >
      {!readOnly ? (
        <span
          className="file-tree-drag-handle"
          aria-hidden="true"
          onPointerDown={handleArmDrag}
        >
          <GripVertical className="h-3 w-3" />
        </span>
      ) : (
        <span className="file-tree-drag-handle-spacer" aria-hidden="true" />
      )}
      {/* Expand/collapse arrow for folders */}
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        {isFolder ? (
          isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin file-tree-icon-muted" />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFolder();
              }}
              className="p-0.5 rounded transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 file-tree-icon-muted transition-transform duration-150",
                  node.isOpen && "rotate-90"
                )}
              />
            </button>
          )
        ) : null}
      </div>

      {/* File/folder icon */}
      <FileIcon
        type={node.data.type}
        folderKind={node.data.folderKind}
        mimeType={node.data.mimeType}
        name={node.data.name}
        isOpen={node.isOpen}
        className={cn(
          node.data.type === "folder"
            ? "file-tree-folder-icon"
            : "file-tree-icon-muted"
        )}
      />

      {/* File/folder name or rename input */}
      {node.isEditing ? (
        <RenameInput node={node} />
      ) : (
        <span className="file-tree-name flex-1 min-w-0 truncate text-xs">
          {node.data.name}
        </span>
      )}

      {uiMeta?.badge ? (
        <span className="file-tree-node-badge ml-2 shrink-0">
          {uiMeta.badge}
        </span>
      ) : null}

      {(showEye || isWriting || isMoved || isRenamed) && (
        <div className="file-tree-effect-icons ml-2 flex items-center gap-1">
          {showEye && (
            <Eye
              className={cn("file-tree-effect-icon", eyeClass)}
              aria-label={isWriting ? "Recently written (viewed)" : "Recently read"}
            />
          )}
          {isWriting && (
            <PenLine
              className="file-tree-effect-icon is-writing"
              aria-label="Recently written"
            />
          )}
          {isMoved && (
            <ArrowRightLeft
              className="file-tree-effect-icon is-moving"
              aria-label="Recently moved"
            />
          )}
          {isRenamed && (
            <TypeIcon
              className="file-tree-effect-icon is-renaming"
              aria-label="Recently renamed"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default FileTreeNode;
