import type { TabContext } from "@/lib/types/tab";

export type NotebookDocKind = "notebook" | "markdown";

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);
const MARKDOWN_MIME_TYPES = new Set(["text/markdown", "text/x-markdown"]);

function getExtension(name?: string): string | null {
  if (!name) return null;
  const lastDot = name.lastIndexOf(".");
  if (lastDot < 0) return null;
  return name.slice(lastDot).toLowerCase();
}

export function isMarkdownFileName(name?: string, mimeType?: string): boolean {
  if (mimeType && MARKDOWN_MIME_TYPES.has(mimeType)) return true;
  const ext = getExtension(name);
  return ext ? MARKDOWN_EXTENSIONS.has(ext) : false;
}

export function inferNotebookDocKind(context: TabContext): NotebookDocKind {
  const override = context.customData?.docKind;
  if (override === "markdown" || override === "notebook") return override;

  if (context.type === "notebook") return "notebook";

  const customData = context.customData as
    | { mimeType?: unknown; fileMeta?: { mimeType?: unknown } }
    | undefined;
  const mimeType =
    typeof context.mimeType === "string"
      ? context.mimeType
      : typeof customData?.mimeType === "string"
        ? customData.mimeType
        : typeof customData?.fileMeta?.mimeType === "string"
          ? customData.fileMeta.mimeType
          : undefined;
  if (isMarkdownFileName(context.resourceName, mimeType)) return "markdown";

  return "notebook";
}
