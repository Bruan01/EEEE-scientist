"use client";

import * as React from "react";
import type { DragPreviewProps } from "react-arborist";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import { FileIcon } from "./FileIcon";
import { cn } from "@/lib/utils";

const layerStyles: React.CSSProperties = {
  position: "fixed",
  pointerEvents: "none",
  zIndex: 1200,
  left: 0,
  top: 0,
  width: "100%",
  height: "100%",
};

const getOffsetStyle = (
  offset: DragPreviewProps["offset"],
  mouse: DragPreviewProps["mouse"]
) => {
  const point = mouse ?? offset;
  if (!point) return { display: "none" };
  const { x, y } = point;
  return { transform: `translate(${x + 12}px, ${y + 12}px)` };
};

export function FileTreeDragPreview({
  offset,
  mouse,
  id,
  dragIds,
  isDragging,
}: DragPreviewProps) {
  const node = id ? useFileTreeStore.getState().findNode(id) : null;

  if (!isDragging || !node) return null;

  const multi = dragIds.length > 1;

  return (
    <div style={layerStyles} aria-hidden>
      <div
        className={cn("file-tree-drag-preview", multi && "is-multi")}
        style={getOffsetStyle(offset, mouse)}
      >
        <FileIcon
          type={node.type}
          folderKind={node.folderKind}
          mimeType={node.mimeType}
          name={node.name}
          className="file-tree-drag-icon"
        />
        <span className="file-tree-drag-label">{node.name}</span>
        {multi && (
          <span className="file-tree-drag-count">{dragIds.length}</span>
        )}
      </div>
    </div>
  );
}

export default FileTreeDragPreview;
