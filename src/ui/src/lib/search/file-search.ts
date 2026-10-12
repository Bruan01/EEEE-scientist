"use client";

import type { FileNode } from "@/lib/types/file";

export type FileSearchResult = {
  node: FileNode;
  score: number;
};

export function flattenFileNodes(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  const walk = (items: FileNode[]) => {
    for (const item of items) {
      out.push(item);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(nodes);
  return out;
}

export function rankFileNode(node: FileNode, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = (node.name || "").toLowerCase();
  const path = (node.path || "").toLowerCase();

  const nameIdx = name.indexOf(q);
  const pathIdx = path.indexOf(q);

  if (nameIdx === -1 && pathIdx === -1) return 0;

  let score = 1;
  if (nameIdx === 0) score += 4;
  if (nameIdx > 0) score += 2;
  if (pathIdx === 0) score += 1;
  if (node.type === "file" || node.type === "notebook") score += 1;
  return score;
}

export function searchFileNodes(
  nodes: FileNode[],
  query: string,
  options: { limit?: number; includeFolders?: boolean } = {}
): FileSearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const { limit = 50, includeFolders = false } = options;
  const candidates = flattenFileNodes(nodes).filter((node) =>
    includeFolders ? true : node.type !== "folder"
  );
  const scored = candidates
    .map((node) => ({ node, score: rankFileNode(node, q) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name)
    );

  return scored.slice(0, Math.max(1, limit));
}
