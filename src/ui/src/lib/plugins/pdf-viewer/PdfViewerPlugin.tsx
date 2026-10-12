/**
 * PDF Viewer Plugin Component
 *
 * @ds/plugin-pdf-viewer
 *
 * Main plugin component for viewing PDF documents.
 * Built on top of PDF.js `PDFViewer` via `react-pdf-highlighter` for:
 * - Crisp text rendering + selection
 * - Text and area highlights (annotations)
 * - Scroll-to-highlight
 *
 * @module plugins/pdf-viewer/PdfViewerPlugin
 */

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PluginComponentProps } from "@/lib/types/plugin";
import { cn } from "@/lib/utils";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AlertTriangle, CheckSquare, HelpCircle, Sparkles, StickyNote } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { acquireFileSocket } from "@/lib/realtime/file-socket";
import { createFileObjectUrl, getFile } from "@/lib/api/files";
import { isCliFileId } from "@/lib/api/cli-file-id";
import { getQuestNodeProjectId, isQuestNodeId } from "@/lib/api/quest-files";
import { listProjectMembers } from "@/lib/api/projects";
import { consumePdfEffects, isPdfEffectHandled, markPdfEffectHandled } from "@/lib/ai/pdf-effect-queue";
import { useAuthStore } from "@/lib/stores/auth";
import { useTabsStore } from "@/lib/stores/tabs";
import { useArxivStore } from "@/lib/stores/arxiv-store";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import { useI18n } from "@/lib/i18n/useI18n";
import { BUILTIN_PLUGINS } from "@/lib/types/plugin";
import { toFilesResourcePath } from "@/lib/utils/resource-paths";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { MarkdownPreview } from "@/components/docs/MarkdownPreview";
import { ArxivInfoModal } from "@/components/arxiv/ArxivInfoModal";
import { useWorkspaceSurfaceStore } from "@/lib/stores/workspace-surface";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toolbar } from "./components/Toolbar";
import { useViewerState } from "./hooks/useViewerState";
import { annotationKeys, useAnnotations } from "./hooks/useAnnotations";
import { apiClient } from "@/lib/api/client";
import type { ArxivPaper } from "@/lib/types/arxiv";
import { copyToClipboard } from "@/lib/clipboard";
import { generateBibTeX } from "@/lib/utils/bibtex";
import { PDF_CMAP_PACKED, PDF_CMAP_URL, PDF_WORKER_SRC } from "./lib/pdf-utils";
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfLoader,
  Tip,
} from "./react-pdf-highlighter";
import type {
  Content,
  IHighlight,
  NewHighlight,
  ScaledPosition,
} from "./react-pdf-highlighter";
import "./react-pdf-highlighter/style/index.css";

type AnnotationKind = "note" | "question" | "task";
type ReviewObjectType = "issue" | "suggestion" | "verification";
type DsHighlight = IHighlight & {
  color?: string;
  author?: { id: string; handle: string; color: string } | null;
  tags?: string[];
  previewSummary?: string | null;
  __dsGhost?: boolean;
  __dsGhostOpacity?: number;
  __dsGhostMode?: "guide" | "annotate";
};

type ReadOnlyAnnotationPayload = Record<string, unknown>;

type RectLike = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber?: number;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeReviewObjectTypeToken(value: string | null): ReviewObjectType | null {
  if (!value) return null;
  const token = value.trim().toLowerCase();
  if (!token) return null;
  if (token === "evidence") return "suggestion";
  if (token === "issue" || token === "suggestion" || token === "verification") return token;
  if (token === "needs_verification" || token === "needs verification" || token === "verify" || token === "uncertain") {
    return "verification";
  }
  return null;
}

function parseRectLike(raw: unknown, fallbackPageNumber?: number): RectLike | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const x1 = asNumber(row.x1);
  const y1 = asNumber(row.y1);
  const x2 = asNumber(row.x2);
  const y2 = asNumber(row.y2);
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

  const widthRaw = asNumber(row.width);
  const heightRaw = asNumber(row.height);
  const width = widthRaw && widthRaw > 0 ? widthRaw : 100;
  const height = heightRaw && heightRaw > 0 ? heightRaw : 100;
  const pageNumberRaw = asNumber(row.pageNumber);
  const pageNumber =
    pageNumberRaw && pageNumberRaw > 0 ? Math.trunc(pageNumberRaw) : fallbackPageNumber;

  return {
    x1: Math.min(x1, x2),
    y1: Math.min(y1, y2),
    x2: Math.max(x1, x2),
    y2: Math.max(y1, y2),
    width,
    height,
    ...(pageNumber ? { pageNumber } : {}),
  };
}

function mapReadOnlyAnnotationToHighlight(
  row: ReadOnlyAnnotationPayload,
): DsHighlight | null {
  const id =
    asNonEmptyString(row.annotation_id) ||
    asNonEmptyString(row.annotationId) ||
    asNonEmptyString(row.id);
  if (!id) return null;

  const pageNumberRaw =
    asNumber(row.page_number) ||
    asNumber(row.pageNumber) ||
    asNumber((row.position as Record<string, unknown> | undefined)?.pageNumber);
  const pageNumber = pageNumberRaw && pageNumberRaw > 0 ? Math.trunc(pageNumberRaw) : null;
  if (!pageNumber) return null;

  const rawRects = Array.isArray(row.rects) ? row.rects : [];
  const rects = rawRects
    .map((item) => parseRectLike(item, pageNumber))
    .filter((item): item is RectLike => Boolean(item));
  const boundingRect =
    parseRectLike(row.bounding_rect, pageNumber) ||
    parseRectLike(row.boundingRect, pageNumber) ||
    parseRectLike((row.position as Record<string, unknown> | undefined)?.boundingRect, pageNumber) ||
    null;

  const fallbackBoundingRect = rects.length
    ? rects.reduce<RectLike>(
        (acc, rect) => ({
          x1: Math.min(acc.x1, rect.x1),
          y1: Math.min(acc.y1, rect.y1),
          x2: Math.max(acc.x2, rect.x2),
          y2: Math.max(acc.y2, rect.y2),
          width: acc.width || rect.width || 100,
          height: acc.height || rect.height || 100,
          pageNumber,
        }),
        { ...rects[0], pageNumber },
      )
    : null;
  const resolvedBoundingRect = boundingRect || fallbackBoundingRect;
  if (!resolvedBoundingRect) return null;

  const color = asNonEmptyString(row.color) || "#F1E9D0";
  const objectType = normalizeReviewObjectTypeToken(asNonEmptyString(row.object_type));
  const severity = asNonEmptyString(row.severity);
  const reviewItemId = asNonEmptyString(row.review_item_id);
  const displayText =
    asNonEmptyString(row.display_text) ||
    asNonEmptyString(row.content_text) ||
    asNonEmptyString((row.content as Record<string, unknown> | undefined)?.text) ||
    "";
  const commentText =
    asNonEmptyString(row.comment) ||
    asNonEmptyString((row.comment_data as Record<string, unknown> | undefined)?.text) ||
    displayText;
  const previewSummary =
    asNonEmptyString(row.summary) ||
    asNonEmptyString((row.content as Record<string, unknown> | undefined)?.summary) ||
    asNonEmptyString((row.comment_data as Record<string, unknown> | undefined)?.summary) ||
    null;

  const incomingTags = Array.isArray(row.tags)
    ? row.tags.map((tag) => asNonEmptyString(tag)).filter((tag): tag is string => Boolean(tag))
    : [];
  const mergedTagSet = new Set(incomingTags.map((tag) => tag.toLowerCase()));
  mergedTagSet.add("review_annotation");
  if (objectType && (objectType === "issue" || objectType === "suggestion" || objectType === "verification")) {
    mergedTagSet.add(`review_object:${objectType}`);
  }
  if (severity) {
    mergedTagSet.add(`severity:${severity.toLowerCase()}`);
  }
  if (reviewItemId) {
    mergedTagSet.add(`review_item:${reviewItemId}`);
  }

  return {
    id,
    position: {
      pageNumber,
      rects: rects.length ? rects : [resolvedBoundingRect],
      boundingRect: resolvedBoundingRect,
    } as ScaledPosition,
    content: { text: displayText },
    comment: { text: commentText, emoji: "note" },
    color,
    tags: Array.from(mergedTagSet),
    previewSummary,
    author: null,
  };
}

function normalizeKind(value?: string): AnnotationKind {
  if (value === "question" || value === "task") return value;
  return "note";
}

const KIND_META: Record<
  AnnotationKind,
  { label: string; dotClass: string; iconClass: string; Icon: typeof StickyNote }
> = {
  note: {
    label: "Note",
    dotClass: "bg-amber-400",
    iconClass: "text-amber-600",
    Icon: StickyNote,
  },
  question: {
    label: "Q",
    dotClass: "bg-indigo-400",
    iconClass: "text-indigo-600",
    Icon: HelpCircle,
  },
  task: {
    label: "Task",
    dotClass: "bg-emerald-400",
    iconClass: "text-emerald-600",
    Icon: CheckSquare,
  },
};

const REVIEW_OBJECT_META: Record<
  ReviewObjectType,
  { label: string; dotClass: string; iconClass: string; Icon: typeof StickyNote }
> = {
  issue: {
    label: "Issue",
    dotClass: "bg-rose-500",
    iconClass: "text-rose-600",
    Icon: AlertTriangle,
  },
  suggestion: {
    label: "Suggestion",
    dotClass: "bg-emerald-500",
    iconClass: "text-emerald-600",
    Icon: Sparkles,
  },
  verification: {
    label: "Needs Verification",
    dotClass: "bg-amber-500",
    iconClass: "text-amber-600",
    Icon: HelpCircle,
  },
};

function extractReviewObjectType(tags?: string[]): ReviewObjectType | null {
  let hasReviewAnnotationTag = false;
  for (const tag of tags || []) {
    const normalized = String(tag || "").trim().toLowerCase();
    if (normalized === "review_annotation") {
      hasReviewAnnotationTag = true;
      continue;
    }
    if (normalized === "review_object:issue") return "issue";
    if (normalized === "review_object:suggestion") return "suggestion";
    if (normalized === "review_object:verification" || normalized === "review_object:needs_verification") {
      return "verification";
    }
    if (normalized === "review_object:evidence") return "suggestion";
  }
  if (!hasReviewAnnotationTag) return null;

  // Backward compatibility for older review data that only persisted ds_kind tags.
  for (const tag of tags || []) {
    const normalized = String(tag || "").trim().toLowerCase();
    if (normalized === "ds_kind:question") return "issue";
    if (normalized === "ds_kind:note" || normalized === "ds_kind:task") return "suggestion";
  }
  return null;
}

function extractAnnotationKindFromTags(tags?: string[]): AnnotationKind | null {
  for (const tag of tags || []) {
    const normalized = String(tag || "").trim().toLowerCase();
    if (normalized === "ds_kind:question") return "question";
    if (normalized === "ds_kind:task") return "task";
    if (normalized === "ds_kind:note") return "note";
  }
  return null;
}

function extractReviewItemId(tags?: string[]): string | null {
  for (const tag of tags || []) {
    const token = String(tag || "").trim();
    if (!token) continue;
    if (!token.toLowerCase().startsWith("review_item:")) continue;
    const value = token.slice("review_item:".length).trim();
    if (value) return value;
  }
  return null;
}

function resolveHighlightMeta(highlight: {
  comment?: { emoji?: string } | null;
  tags?: string[];
}) {
  const kind = normalizeKind(highlight.comment?.emoji || extractAnnotationKindFromTags(highlight.tags) || undefined);
  const reviewObjectType = extractReviewObjectType(highlight.tags);
  if (reviewObjectType) {
    return {
      kind,
      reviewObjectType,
      ...REVIEW_OBJECT_META[reviewObjectType],
    };
  }

  return {
    kind,
    reviewObjectType: null as ReviewObjectType | null,
    ...KIND_META[kind],
  };
}

function getAnnotationKindLabel(
  kind: AnnotationKind,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (kind === "question") return t("type_question");
  if (kind === "task") return t("type_task");
  return t("type_note");
}

function getReviewObjectTypeLabel(
  value: ReviewObjectType,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (value === "issue") return t("review_type_issue");
  if (value === "verification") return t("review_type_verification");
  return t("review_type_suggestion");
}

function getHighlightMetaLabel(
  meta: ReturnType<typeof resolveHighlightMeta>,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (meta.reviewObjectType) {
    return getReviewObjectTypeLabel(meta.reviewObjectType, t);
  }
  return getAnnotationKindLabel(meta.kind, t);
}

function overlayHintTheme(meta: {
  reviewObjectType?: ReviewObjectType | null;
  kind?: AnnotationKind;
}): {
  borderColor: string;
  textColor: string;
  backgroundColor: string;
} {
  void meta;
  return {
    borderColor: "rgba(140, 118, 72, 0.95)",
    textColor: "rgba(15, 15, 15, 0.96)",
    backgroundColor: "rgba(255, 255, 255, 0.98)",
  };
}

function compactWords(text: string, maxWords: number): string {
  const normalized = String(text || "")
    // Normalize mathematical alphanumeric Unicode forms (e.g. 𝐴, 𝑥) to
    // common display characters to reduce tofu rendering in narrow font stacks.
    .normalize("NFKC")
    .replace(/\uFFFD/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  if (maxWords <= 0) return "";
  const words = normalized.split(" ");
  if (words.length <= maxWords) return normalized;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

const MARKDOWN_CODE_BLOCK_TOKEN = "__DS_ANNOTATION_MD_CODE_BLOCK__";
const MARKDOWN_INLINE_CODE_TOKEN = "__DS_ANNOTATION_MD_INLINE_CODE__";
const FENCED_CODE_REGEX = /(^|\n)(```|~~~)[\s\S]*?\n\2[^\n]*($|\n)/g;
const INLINE_CODE_REGEX = /`[^`\n]*`/g;
const BLOCK_MATH_BRACKET_REGEX = /\\\[([\s\S]+?)\\\]/g;
const INLINE_MATH_PAREN_REGEX = /\\\((.+?)\\\)/g;

function protectSegments(input: string, regex: RegExp, token: string) {
  const segments: string[] = [];
  const text = input.replace(regex, (match) => {
    const index = segments.length;
    segments.push(match);
    return `${token}${index}__`;
  });
  return { text, segments };
}

function restoreSegments(input: string, segments: string[], token: string) {
  let text = input;
  segments.forEach((segment, index) => {
    text = text.replace(`${token}${index}__`, segment);
  });
  return text;
}

function normalizeAnnotationCommentMarkdown(markdown: string): string {
  if (!markdown) return markdown;

  const { text: withoutFenced, segments: fencedBlocks } = protectSegments(
    markdown,
    FENCED_CODE_REGEX,
    MARKDOWN_CODE_BLOCK_TOKEN,
  );
  const { text: withoutInline, segments: inlineBlocks } = protectSegments(
    withoutFenced,
    INLINE_CODE_REGEX,
    MARKDOWN_INLINE_CODE_TOKEN,
  );

  let transformed = withoutInline;
  transformed = transformed.replace(BLOCK_MATH_BRACKET_REGEX, (_match, latex) => {
    const value = String(latex || "").trim();
    return value ? `$$\n${value}\n$$` : "";
  });
  transformed = transformed.replace(INLINE_MATH_PAREN_REGEX, (_match, latex) => {
    const value = String(latex || "").trim();
    return value ? `$${value}$` : "";
  });

  const restoredInline = restoreSegments(
    transformed,
    inlineBlocks,
    MARKDOWN_INLINE_CODE_TOKEN,
  );
  return restoreSegments(restoredInline, fencedBlocks, MARKDOWN_CODE_BLOCK_TOKEN);
}

const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdx"];

function isMarkdownFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function normalizeExcerptText(value: string): string {
  return String(value || "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function locateMarkdownExcerpt(markdown: string, selectedText: string): string | null {
  const normalizedMarkdown = normalizeExcerptText(markdown);
  const normalizedSelection = normalizeExcerptText(selectedText);
  if (!normalizedMarkdown || !normalizedSelection || normalizedSelection.length < 12) {
    return null;
  }

  const exactIndex = normalizedMarkdown.indexOf(normalizedSelection);
  if (exactIndex >= 0) {
    const start = Math.max(0, exactIndex - 160);
    const end = Math.min(normalizedMarkdown.length, exactIndex + normalizedSelection.length + 160);
    return normalizedMarkdown.slice(start, end).trim();
  }

  const words = normalizedSelection.split(" ").filter(Boolean).slice(0, 8);
  if (words.length < 3) return null;
  const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*?");
  const match = normalizedMarkdown.match(new RegExp(pattern, "i"));
  if (!match || typeof match.index !== "number") return null;
  const start = Math.max(0, match.index - 160);
  const end = Math.min(normalizedMarkdown.length, match.index + match[0].length + 160);
  return normalizedMarkdown.slice(start, end).trim();
}

function PdfSpinner() {
  const { t } = useI18n("pdf_viewer");

  return (
    <div className="flex h-full items-center justify-center bg-muted/20">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-8 w-8 rounded-full border-2 border-primary/60 border-t-transparent animate-spin" />
        <span className="text-sm">{t("loading_pdf")}</span>
      </div>
    </div>
  );
}

function AnnotationSidebarItem({
  highlight,
  selected,
  followed,
  flash,
  onSelect,
  onDelete,
  onUpdateKind,
  onUpdateComment,
  readOnly,
  registerItemRef,
}: {
  highlight: DsHighlight;
  selected: boolean;
  followed?: boolean;
  flash?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdateKind: (kind: AnnotationKind) => void;
  onUpdateComment: (comment: string) => void;
  readOnly?: boolean;
  registerItemRef?: (id: string, node: HTMLDivElement | null) => void;
}) {
  const { t } = useI18n("pdf_viewer");
  const meta = resolveHighlightMeta(highlight);
  const kind = meta.kind;
  const metaLabel = getHighlightMetaLabel(meta, t);
  const reviewItemId = extractReviewItemId(highlight.tags);
  const displayIdRaw = reviewItemId || String(highlight.id || "").slice(0, 8);
  const displayId = displayIdRaw.length > 10 ? `${displayIdRaw.slice(0, 10)}…` : displayIdRaw;
  const authorColor = highlight.author?.color || highlight.color || "#F1E9D0";
  const authorHandle = highlight.author?.handle || "user";
  const isAI = highlight.tags?.some((tag) => tag.toLowerCase() === "ai");
  const rawContentPreview = highlight.content?.text
    ? String(highlight.content.text).trim()
    : highlight.content?.image
      ? t("area_highlight")
      : "";
  const compactContentPreview = highlight.content?.text
    ? compactWords(rawContentPreview, 20)
    : rawContentPreview;

  const itemRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(highlight.comment?.text || "");

  useEffect(() => {
    if (!isEditing) setDraft(highlight.comment?.text || "");
  }, [highlight.comment?.text, isEditing]);

  useEffect(() => {
    if (!flash) return;
    itemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flash]);

  useEffect(() => {
    if (!selected) return;
    itemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <div
      ref={(node) => {
        itemRef.current = node;
        registerItemRef?.(highlight.id, node);
      }}
      className={cn(
        "group relative p-3 rounded-lg border transition-all cursor-pointer",
        selected
          ? "border-primary bg-primary/5"
          : followed
            ? "border-border bg-muted/30 hover:bg-muted/45"
            : "border-border/60 hover:bg-muted/40",
        flash ? "ring-2 ring-primary/30 bg-primary/10 shadow-soft-card" : null,
      )}
      onClick={onSelect}
    >
      {/* Kind dot (top-left) */}
      <span
        className={cn("absolute left-2 top-2 h-2 w-2 rounded-full", meta.dotClass)}
        aria-hidden
      />

      {/* Author dot (top-right) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute right-2 top-2 h-5 w-5 rounded-md border border-border bg-background/70 backdrop-blur flex items-center justify-center shadow-soft-sm"
            onClick={(e) => e.stopPropagation()}
            title={authorHandle}
          >
            <span
              className="h-2.5 w-2.5 rounded-full border border-border"
              style={{ backgroundColor: authorColor }}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("author")}</DropdownMenuLabel>
          <DropdownMenuItem disabled>{authorHandle}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-start gap-3">
        {readOnly ? (
          <div
            className={cn(
              "mt-0.5 h-8 w-8 rounded-lg border border-border bg-background",
              "flex items-center justify-center flex-shrink-0 shadow-soft-sm",
            )}
            title={t("type_label")}
          >
            <meta.Icon
              className={cn(
                "h-4 w-4",
                meta.iconClass,
              )}
            />
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "mt-0.5 h-8 w-8 rounded-lg border border-border bg-background",
                  "flex items-center justify-center flex-shrink-0 shadow-soft-sm",
                )}
                title={t("change_type")}
                onClick={(e) => e.stopPropagation()}
              >
                <meta.Icon
                  className={cn(
                    "h-4 w-4",
                    meta.iconClass,
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{t("type_label")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={kind}
                onValueChange={(v) => onUpdateKind(normalizeKind(v))}
              >
                <DropdownMenuRadioItem value="note">{t("type_note")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="question">{t("type_question")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="task">{t("type_task")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-foreground/90">{metaLabel}</span>
            {isAI ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[9px] uppercase tracking-wide text-foreground/70">
                <Sparkles className="h-3 w-3" />
                AI
              </span>
            ) : null}
            {typeof highlight.position?.pageNumber === "number" ? (
              <span className="text-[9px] text-muted-foreground/70">
                {t("page", { page: highlight.position.pageNumber })}
              </span>
            ) : null}
            {displayId ? (
              <span
                className="text-[9px] text-muted-foreground/60"
                title={`ID ${displayIdRaw}`}
              >
                ID {displayId}
              </span>
            ) : null}
          </div>

          {!isEditing ? (
            <div className="mt-1 rounded-md border border-border/60 bg-background/70 px-2.5 py-2">
              {highlight.comment?.text?.trim() ? (
                <MarkdownPreview
                  content={normalizeAnnotationCommentMarkdown(highlight.comment.text)}
                  rewriteDocsImages={false}
                  rewriteDocsLinks={false}
                  className={cn(
                    "review-annotation-markdown text-[11px] leading-5 text-foreground/85 break-words",
                    "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5",
                    "[&_pre]:my-1 [&_pre]:max-w-full [&_pre]:overflow-x-auto",
                    "[&_pre]:whitespace-pre-wrap [&_code]:break-words",
                    "[&_.katex]:[word-break:normal] [&_.katex]:[overflow-wrap:normal]",
                    "[&_.katex]:whitespace-nowrap [&_.katex-display]:whitespace-normal",
                    "[&_.katex-display]:my-1 [&_.katex-display]:overflow-x-auto",
                    "[&_.katex-display]:overflow-y-hidden"
                  )}
                />
              ) : (
                <p className="review-annotation-text-fallback text-[11px] text-foreground/80 whitespace-pre-wrap break-words">{t("no_comment_yet")}</p>
              )}
            </div>
          ) : (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 min-h-[84px] text-[11px] leading-5"
              placeholder={t("add_comment_placeholder")}
            />
          )}

          <div className="mt-2 flex items-start justify-between gap-2">
            <p
              className="review-annotation-text-fallback text-[9px] text-muted-foreground/60 whitespace-pre-wrap break-words"
              title={rawContentPreview || undefined}
            >
              {compactContentPreview}
            </p>

            {readOnly ? (
              <div className="text-[9px] text-muted-foreground">{t("read_only")}</div>
            ) : (
              <div className="flex items-center gap-1">
                {!isEditing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(false);
                        setDraft(highlight.comment?.text || "");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateComment(draft.trim());
                        setIsEditing(false);
                      }}
                    >
                      Save
                    </Button>
                  </>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  {t("delete")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightsSidebar({
  highlights,
  selectedId,
  currentPage,
  flashId,
  onSelect,
  onDelete,
  onUpdateKind,
  onUpdateComment,
  showOverlayHints,
  readOnly,
}: {
  highlights: Array<DsHighlight>;
  selectedId: string | null;
  currentPage: number;
  flashId?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateKind: (id: string, kind: AnnotationKind) => void;
  onUpdateComment: (id: string, comment: string) => void;
  showOverlayHints: boolean;
  readOnly?: boolean;
}) {
  const { t } = useI18n("pdf_viewer");
  type SidebarFilter = "all" | ReviewObjectType | AnnotationKind;

  const [objectFilter, setObjectFilter] = useState<SidebarFilter>("all");
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const previousSelectedIdRef = useRef<string | null>(selectedId);
  const suppressFollowScrollOnceRef = useRef(false);

  const sortHighlightsByPageOrder = useCallback((left: DsHighlight, right: DsHighlight) => {
    const leftPage = Number(left.position?.pageNumber || 0);
    const rightPage = Number(right.position?.pageNumber || 0);

    const normalizedLeftPage = Number.isFinite(leftPage) && leftPage > 0 ? leftPage : Number.MAX_SAFE_INTEGER;
    const normalizedRightPage = Number.isFinite(rightPage) && rightPage > 0 ? rightPage : Number.MAX_SAFE_INTEGER;

    if (normalizedLeftPage !== normalizedRightPage) {
      return normalizedLeftPage - normalizedRightPage;
    }

    const leftTop = Number(
      left.position?.boundingRect?.y1 ??
        left.position?.rects?.[0]?.y1 ??
        Number.MAX_SAFE_INTEGER
    );
    const rightTop = Number(
      right.position?.boundingRect?.y1 ??
        right.position?.rects?.[0]?.y1 ??
        Number.MAX_SAFE_INTEGER
    );
    const normalizedLeftTop = Number.isFinite(leftTop) ? leftTop : Number.MAX_SAFE_INTEGER;
    const normalizedRightTop = Number.isFinite(rightTop) ? rightTop : Number.MAX_SAFE_INTEGER;

    if (normalizedLeftTop !== normalizedRightTop) {
      return normalizedLeftTop - normalizedRightTop;
    }

    const leftX = Number(
      left.position?.boundingRect?.x1 ??
        left.position?.rects?.[0]?.x1 ??
        Number.MAX_SAFE_INTEGER
    );
    const rightX = Number(
      right.position?.boundingRect?.x1 ??
        right.position?.rects?.[0]?.x1 ??
        Number.MAX_SAFE_INTEGER
    );
    const normalizedLeftX = Number.isFinite(leftX) ? leftX : Number.MAX_SAFE_INTEGER;
    const normalizedRightX = Number.isFinite(rightX) ? rightX : Number.MAX_SAFE_INTEGER;

    if (normalizedLeftX !== normalizedRightX) {
      return normalizedLeftX - normalizedRightX;
    }

    return left.id.localeCompare(right.id);
  }, []);

  const counts = useMemo(() => {
    const base = {
      all: highlights.length,
      issue: 0,
      suggestion: 0,
      verification: 0,
      note: 0,
      question: 0,
      task: 0,
    };
    for (const highlight of highlights) {
      const objectType = extractReviewObjectType(highlight.tags);
      if (objectType) {
        base[objectType] += 1;
        continue;
      }
      const kind = normalizeKind(
        highlight.comment?.emoji || extractAnnotationKindFromTags(highlight.tags) || undefined
      );
      base[kind] += 1;
    }
    return base;
  }, [highlights]);

  const filterItems = useMemo(() => {
    const rows: Array<{ key: SidebarFilter; label: string; count: number }> = [
      { key: "all", label: t("filter_all"), count: counts.all },
    ];

    const reviewFilterRows: Array<{ key: SidebarFilter; label: string; count: number }> = [
      { key: "issue", label: t("review_type_issue"), count: counts.issue },
      { key: "suggestion", label: t("review_type_suggestion"), count: counts.suggestion },
      { key: "verification", label: t("review_type_verification"), count: counts.verification },
    ];
    const kindFilterRows: Array<{ key: SidebarFilter; label: string; count: number }> = [
      { key: "note", label: t("type_note"), count: counts.note },
      { key: "question", label: t("type_question"), count: counts.question },
      { key: "task", label: t("type_task"), count: counts.task },
    ];

    const hasReviewRows = reviewFilterRows.some((row) => row.count > 0);
    const hasKindRows = kindFilterRows.some((row) => row.count > 0);

    if (hasReviewRows) {
      rows.push(...reviewFilterRows.filter((row) => row.count > 0));
    }
    if (hasKindRows) {
      rows.push(...kindFilterRows.filter((row) => row.count > 0));
    }

    return rows;
  }, [counts, t]);

  useEffect(() => {
    if (objectFilter === "all") return;
    if (filterItems.some((item) => item.key === objectFilter)) return;
    setObjectFilter("all");
  }, [filterItems, objectFilter]);

  useEffect(() => {
    if (previousSelectedIdRef.current && !selectedId) {
      // When toggling back from "single-annotation focus" to "show all",
      // keep sidebar position stable instead of auto-follow scrolling.
      suppressFollowScrollOnceRef.current = true;
    }
    previousSelectedIdRef.current = selectedId;
  }, [selectedId]);

  const filteredHighlights = useMemo(() => {
    const base = highlights.filter((highlight) => {
      if (objectFilter === "all") return true;
      const reviewObjectType = extractReviewObjectType(highlight.tags);
      if (
        objectFilter === "issue" ||
        objectFilter === "suggestion" ||
        objectFilter === "verification"
      ) {
        return reviewObjectType === objectFilter;
      }
      if (reviewObjectType) return false;
      const kind = normalizeKind(
        highlight.comment?.emoji || extractAnnotationKindFromTags(highlight.tags) || undefined
      );
      return kind === objectFilter;
    });
    return [...base].sort(sortHighlightsByPageOrder);
  }, [highlights, objectFilter, sortHighlightsByPageOrder]);

  const followTargetId = useMemo(() => {
    if (selectedId) return null;
    if (filteredHighlights.length === 0) return null;
    const rows = filteredHighlights
      .map((item) => ({
        id: item.id,
        page: Number(item.position?.pageNumber || 0),
      }))
      .filter((item) => Number.isFinite(item.page) && item.page > 0);
    if (rows.length === 0) return null;

    const exact = rows.find((item) => item.page === currentPage);
    if (exact) return exact.id;

    let best = rows[0];
    let bestDistance = Math.abs(rows[0].page - currentPage);
    for (let index = 1; index < rows.length; index += 1) {
      const candidate = rows[index];
      const distance = Math.abs(candidate.page - currentPage);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
        continue;
      }
      if (distance === bestDistance && candidate.page < best.page) {
        best = candidate;
      }
    }
    return best.id;
  }, [currentPage, filteredHighlights, selectedId]);

  useEffect(() => {
    if (!followTargetId) return;
    if (suppressFollowScrollOnceRef.current) {
      suppressFollowScrollOnceRef.current = false;
      return;
    }
    const node = itemRefs.current.get(followTargetId);
    if (!node) return;
    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [followTargetId]);

  const registerItemRef = useCallback((id: string, node: HTMLDivElement | null) => {
    if (!id) return;
    if (!node) {
      itemRefs.current.delete(id);
      return;
    }
    itemRefs.current.set(id, node);
  }, []);

  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="text-4xl mb-2 opacity-30">📝</div>
        <p className="text-xs text-muted-foreground">{t("no_annotations")}</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">
          {readOnly ? t("read_only_annotation_desc") : t("select_text_to_highlight")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-xs">
            {t("annotations")} ({filteredHighlights.length}/{highlights.length})
          </h3>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide",
              showOverlayHints
                ? "border-black/10 bg-white text-foreground/70"
                : "border-border bg-background text-muted-foreground"
            )}
            title={t("all_markers_shown")}
          >
            {t("markers_on")}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {filterItems.map((item) => {
            const active = objectFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setObjectFilter(item.key)}
                className={cn(
                  "inline-flex min-w-0 flex-1 items-center justify-center rounded-md border px-2 py-1 text-[10px] transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                )}
                title={t("filter_annotations_title", { label: item.label })}
              >
                {item.label} ({item.count})
              </button>
            );
          })}
        </div>
      </div>

      {filteredHighlights.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">
          No annotations for current filter.
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-2 space-y-2">
          {filteredHighlights.map((h) => (
            <AnnotationSidebarItem
              key={h.id}
              highlight={h}
              selected={selectedId === h.id}
              followed={Boolean(followTargetId && followTargetId === h.id)}
              flash={Boolean(flashId && flashId === h.id)}
              onSelect={() => onSelect(h.id)}
              onDelete={() => onDelete(h.id)}
              onUpdateKind={(k) => onUpdateKind(h.id, k)}
              onUpdateComment={(c) => onUpdateComment(h.id, c)}
              readOnly={readOnly}
              registerItemRef={registerItemRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PdfHighlighterSurface({
  pdfDocument,
  scale,
  highlights,
  selectedId,
  onSelect,
  onAdd,
  onUpdate,
  onScrollRef,
  onPageChange,
  pdfHighlighterRef,
  authorColor,
  authorHandle,
  showOverlayHints,
  tipPlacementMode,
  readOnly,
  onAskCopilot,
}: {
  pdfDocument: PDFDocumentProxy;
  scale: number;
  highlights: Array<DsHighlight>;
  selectedId: string | null;
  onSelect: (id: string, options?: { allowToggleClose?: boolean; skipAutoScroll?: boolean }) => void;
  onAdd: (highlight: NewHighlight) => void;
  onUpdate: (
    highlightId: string,
    position: Partial<ScaledPosition>,
    content: Partial<Content>,
  ) => void;
  onScrollRef: (scrollTo: (highlight: IHighlight) => void) => void;
  onPageChange: (pageNumber: number) => void;
  pdfHighlighterRef: React.RefObject<PdfHighlighter<IHighlight> | null>;
  authorColor: string;
  authorHandle: string;
  showOverlayHints: boolean;
  tipPlacementMode?: "auto" | "overlay" | "right";
  readOnly?: boolean;
  onAskCopilot?: (content: Content, position: ScaledPosition) => void;
}) {
  const { t } = useI18n("pdf_viewer");
  const { setTotalPages } = useViewerState();
  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null);
  const pdfScaleValue = scale === 1 ? "page-width" : `page-width:${scale}`;
  const activeFocusHighlightId = hoveredHighlightId || selectedId || null;

  useEffect(() => {
    setTotalPages(pdfDocument.numPages);
  }, [pdfDocument.numPages, setTotalPages]);

  return (
    <PdfHighlighter
      ref={pdfHighlighterRef as unknown as React.Ref<PdfHighlighter<IHighlight>>}
      pdfDocument={pdfDocument}
      pdfScaleValue={pdfScaleValue}
      tipPlacementMode={tipPlacementMode}
      onPageChange={onPageChange}
      enableAreaSelection={(event) => (readOnly ? false : event.altKey)}
      onScrollChange={() => {
        // Keep selected highlight stable (no-op for now).
      }}
      scrollRef={onScrollRef}
      highlights={highlights}
      onSelectionFinished={(
        position,
        content,
        hideTipAndSelection,
        transformSelection,
      ) =>
        readOnly ? null : (
          <Tip
            onOpen={transformSelection}
            onCancel={hideTipAndSelection}
            onConfirm={(comment) => {
              onAdd({ content, position, comment });
              hideTipAndSelection();
            }}
            onAskCopilot={() => {
              onAskCopilot?.(content, position);
              hideTipAndSelection();
            }}
            authorColor={authorColor}
            authorHandle={authorHandle}
            showAuthorHandle={false}
          />
        )}
      highlightTransform={(
        highlight,
        _index,
        _setTip,
        _hideTip,
        viewportToScaled,
        screenshot,
        isScrolledTo,
        pageMetrics,
      ) => {
        const isGhost = Boolean((highlight as unknown as { __dsGhost?: true }).__dsGhost);
        const ghostOpacity = (highlight as unknown as { __dsGhostOpacity?: number }).__dsGhostOpacity ?? 1;
        const ghostMode = (highlight as unknown as { __dsGhostMode?: string }).__dsGhostMode;
        const isTextHighlight = !highlight.content?.image;
        const highlightMeta = resolveHighlightMeta({
          comment: highlight.comment,
          tags: (highlight as unknown as DsHighlight).tags,
        });
        const safeMetaLabel = String(getHighlightMetaLabel(highlightMeta, t) || t("annotation_label"));
        const reviewItemId = extractReviewItemId((highlight as unknown as DsHighlight).tags);
        const previewSummary = asNonEmptyString(
          (highlight as unknown as DsHighlight).previewSummary
        );
        const firstLine = reviewItemId
          ? `#${reviewItemId} · ${safeMetaLabel}`
          : `P${highlight.position.pageNumber} · ${safeMetaLabel}`;
        const secondLine = previewSummary || compactWords(highlight.comment?.text || "", 8);
        const compactHintText = reviewItemId
          ? secondLine
            ? `${firstLine}\n${secondLine}`
            : firstLine
          : secondLine
            ? `${firstLine}\n${secondLine}`
            : firstLine;
        const compactHintTitle = `${safeMetaLabel} · ${t("page", {
          page: highlight.position.pageNumber,
        })} · ${t("open_details_hint")}`;
        const highlightTheme = overlayHintTheme(highlightMeta);
        const isFocused = activeFocusHighlightId === highlight.id;
        const hideThisHighlight = Boolean(activeFocusHighlightId && !isFocused);

        const component = isTextHighlight ? (
          <Highlight
            isScrolledTo={isScrolledTo || highlight.id === selectedId}
            position={highlight.position}
            comment={highlight.comment}
            color={(highlight as unknown as DsHighlight).color}
            hidden={hideThisHighlight}
            emphasized={isFocused}
            onHoverStart={isGhost ? undefined : () => setHoveredHighlightId(highlight.id)}
            onHoverEnd={
              isGhost
                ? undefined
                : () =>
                    setHoveredHighlightId((current) =>
                      current === highlight.id ? null : current
                    )
            }
            onClick={
              isGhost
                ? undefined
                : () =>
                    onSelect(highlight.id, {
                      allowToggleClose: false,
                      skipAutoScroll: true,
                    })
            }
            showOverlayHint={!isGhost && showOverlayHints && !hideThisHighlight}
            overlayHintText={compactHintText}
            overlayHintTitle={compactHintTitle}
            overlayHintBorderColor={highlightTheme.borderColor}
            overlayHintTextColor={highlightTheme.textColor}
            overlayHintBackgroundColor={highlightTheme.backgroundColor}
            overlayHintTopPx={pageMetrics.overlayHintTopById?.[highlight.id]}
            overlayHintLeftPx={pageMetrics.overlayHintLeftPx}
            overlayHintWidthPx={pageMetrics.overlayHintWidthPx}
            overlayHintPageHeightPx={pageMetrics.height}
            onOverlayHintClick={
              isGhost
                ? undefined
                : () => {
                    onSelect(highlight.id, {
                      skipAutoScroll: true,
                    })
                  }
            }
          />
        ) : (
          <AreaHighlight
            isScrolledTo={isScrolledTo || highlight.id === selectedId}
            highlight={highlight}
            hidden={hideThisHighlight}
            emphasized={isFocused}
            onHoverStart={isGhost ? undefined : () => setHoveredHighlightId(highlight.id)}
            onHoverEnd={
              isGhost
                ? undefined
                : () =>
                    setHoveredHighlightId((current) =>
                      current === highlight.id ? null : current
                    )
            }
            onSelect={
              isGhost
                ? undefined
                : () =>
                    onSelect(highlight.id, {
                      allowToggleClose: false,
                      skipAutoScroll: true,
                    })
            }
            onChange={(boundingRect) => {
              if (readOnly) return;
              onUpdate(
                highlight.id,
                { boundingRect: viewportToScaled(boundingRect) },
                { image: screenshot(boundingRect) },
              );
            }}
          />
        );

        if (isGhost) {
          return (
            <div
              key={`ghost-${_index}`}
              className={cn(
                "pointer-events-none",
                ghostMode === "annotate" ? "ds-pdf-ghost-annotate" : "ds-pdf-ghost-guide"
              )}
              style={{ opacity: ghostOpacity, transition: "opacity 0.8s ease" }}
            >
              {component}
            </div>
          );
        }

        return component;
      }}
    />
  );
}

// ============================================================
// PdfViewerPlugin Component
// ============================================================

/**
 * PDF Viewer Plugin Component
 *
 * Main entry point for the PDF viewer plugin.
 * Receives context from the Tab system and renders the PDF viewer.
 *
 * @example
 * ```tsx
 * <PdfViewerPlugin
 *   context={{ type: 'file', resourceId: '123', resourceName: 'document.pdf' }}
 *   tabId="tab-1"
 *   setDirty={setDirty}
 *   setTitle={setTitle}
 * />
 * ```
 */
export default function PdfViewerPlugin({
  context,
  tabId,
  setDirty,
  setTitle,
}: PluginComponentProps) {
  const { t } = useI18n("pdf_viewer");
  // Get file info from context
  const rawFileId =
    context.resourceId ??
    (typeof context.customData?.fileId === "string" ? context.customData.fileId : null);
  const fileId = rawFileId ? String(rawFileId) : "";
  const isCliFile = isCliFileId(fileId);
  const reviewRouteId =
    typeof context.customData?.reviewRouteId === "string"
      ? context.customData.reviewRouteId.trim()
      : "";
  const rebuttalRouteId =
    typeof context.customData?.rebuttalRouteId === "string"
      ? context.customData.rebuttalRouteId.trim()
      : "";
  const isReviewWorkspace = reviewRouteId.length > 0;
  const isRebuttalWorkspace = rebuttalRouteId.length > 0;
  const isResizableAnnotationWorkspace = isReviewWorkspace || isRebuttalWorkspace;
  const annotationRouteId = isReviewWorkspace ? reviewRouteId : rebuttalRouteId;
  const isSharedAnnotationWorkspace = annotationRouteId.startsWith("shared-");
  const REVIEW_SIDEBAR_WIDTH_SCALE = isSharedAnnotationWorkspace ? 0.8 : 1;
  const REVIEW_SIDEBAR_WIDTH_STORAGE_KEY = isRebuttalWorkspace
    ? isSharedAnnotationWorkspace
      ? "ds:rebuttal:pdf:annotation-sidebar-width:shared:v1"
      : "ds:rebuttal:pdf:annotation-sidebar-width:v1"
    : isSharedAnnotationWorkspace
      ? "ds:review:pdf:annotation-sidebar-width:shared:v1"
      : "ds:review:pdf:annotation-sidebar-width:v4";
  const REVIEW_SIDEBAR_MIN_WIDTH = Math.round(336 * REVIEW_SIDEBAR_WIDTH_SCALE); // base: 280 * 1.2
  const REVIEW_SIDEBAR_MAX_WIDTH = Math.round(816 * REVIEW_SIDEBAR_WIDTH_SCALE); // base: 680 * 1.2
  const REVIEW_SIDEBAR_DEFAULT_WIDTH = Math.round(673 * REVIEW_SIDEBAR_WIDTH_SCALE); // base: 561 * 1.2
  const isReadOnlyMode = Boolean(
    typeof context.customData?.readOnlyMode === "boolean"
      ? context.customData.readOnlyMode
      : false
  );
  const readOnlyHighlights: Array<DsHighlight> = useMemo(() => {
    if (!isReadOnlyMode) return [];
    const raw = context.customData?.readOnlyAnnotations;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => mapReadOnlyAnnotationToHighlight(item as ReadOnlyAnnotationPayload))
      .filter((item): item is DsHighlight => Boolean(item));
  }, [context.customData?.readOnlyAnnotations, isReadOnlyMode]);
  const readOnlySidebarInitRef = useRef(false);
  const fileName = context.resourceName || "Untitled.pdf";
  const externalPdfUrl =
    typeof context.customData?.externalPdfUrl === "string"
      ? context.customData.externalPdfUrl.trim()
      : "";
  const hasExternalPdfUrl = externalPdfUrl.length > 0;

  const apiBaseUrl = (apiClient.defaults.baseURL || "").replace(/\/$/, "");
  const isQuestFile = isQuestNodeId(fileId);
  const questProjectIdFromFileId = useMemo(
    () => (fileId && isQuestFile ? getQuestNodeProjectId(fileId) : null),
    [fileId, isQuestFile]
  );
  const projectIdFromContext = useMemo(() => {
    const candidate =
      typeof context.customData?.projectId === "string"
        ? context.customData.projectId.trim()
        : "";
    return candidate || null;
  }, [context.customData]);
  const [cliPdfUrl, setCliPdfUrl] = useState<string | null>(null);
  const [cliPdfLoading, setCliPdfLoading] = useState(false);
  const [cliPdfError, setCliPdfError] = useState<string | null>(null);
  const [questPdfUrl, setQuestPdfUrl] = useState<string | null>(null);
  const [questPdfLoading, setQuestPdfLoading] = useState(false);
  const [questPdfError, setQuestPdfError] = useState<string | null>(null);

  // Build PDF URL
  const pdfUrl = hasExternalPdfUrl
    ? externalPdfUrl
    : isCliFile
      ? cliPdfUrl || ""
      : isQuestFile
        ? questPdfUrl || ""
      : fileId
        ? `${apiBaseUrl}/api/v1/files/${fileId}/content`
        : // Demo: Use a sample PDF for testing
          "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf";

  const token =
    typeof window !== "undefined" ? localStorage.getItem("ds_access_token") : null;
  const httpHeaders = token && (hasExternalPdfUrl || (!isCliFile && !isQuestFile && fileId))
    ? { Authorization: `Bearer ${token}` }
    : undefined;

  // Viewer state from Zustand store
  const {
    scale,
    setScale,
    currentPage,
    setCurrentPage,
    totalPages,
    sidebarVisible,
    toggleSidebar,
    selectedAnnotationId,
    selectAnnotation,
  } = useViewerState();

  const updateTabPlugin = useTabsStore((state) => state.updateTabPlugin);
  const findNode = useFileTreeStore((state) => state.findNode);
  const updateWorkspaceTabState = useWorkspaceSurfaceStore((state) => state.updateTabState);
  const addWorkspaceReference = useWorkspaceSurfaceStore((state) => state.addReference);
  const updateWorkspaceReference = useWorkspaceSurfaceStore((state) => state.updateReference);
  const openMarkdownViewFromHost =
    typeof context.customData?.onOpenMarkdownView === "function"
      ? (context.customData.onOpenMarkdownView as () => void)
      : null;
  const openReviewOpinionViewFromHost =
    typeof context.customData?.onOpenReviewOpinionView === "function"
      ? (context.customData.onOpenReviewOpinionView as () => void)
      : null;
  const reviewOpinionAvailableFromHost = Boolean(
    typeof context.customData?.reviewOpinionAvailable === "boolean"
      ? context.customData.reviewOpinionAvailable
      : false
  );
  const reviewOpinionModeFromHost =
    typeof context.customData?.reviewViewMode === "string"
      ? context.customData.reviewViewMode
      : "";
  const reviewOpinionActiveFromHost = reviewOpinionModeFromHost === "ai_review";
  const reviewOpinionLabelFromHost =
    typeof context.customData?.reviewOpinionLabel === "string"
      ? context.customData.reviewOpinionLabel
      : undefined;
  const reviewOpinionTitleFromHost =
    typeof context.customData?.reviewOpinionTitle === "string"
      ? context.customData.reviewOpinionTitle
      : undefined;
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const arxivItems = useArxivStore((s) => s.items);
  const arxivErrors = useArxivStore((s) => s.errors);
  const arxivFromContext = useMemo(() => {
    const customData = context.customData as { arxiv?: ArxivPaper } | undefined;
    return customData?.arxiv ?? null;
  }, [context.customData]);
  const isArxivPdf =
    Boolean(arxivFromContext) ||
    Boolean(fileId && arxivItems.some((item) => item.fileId === fileId));
  const annotationsFileId = isCliFile || !fileId || isReadOnlyMode ? "" : fileId;
  const { annotations, createAnnotation, updateAnnotation, deleteAnnotation } =
    useAnnotations(annotationsFileId);
  const currentUser = useAuthStore((s) => s.user);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [authorColor, setAuthorColor] = useState<string>("#F1E9D0");
  const [infoOpen, setInfoOpen] = useState(false);
  const markdownCacheRef = useRef<Record<string, string>>({});
  const markdownLoadPromiseRef = useRef<Record<string, Promise<string | null>>>({});
  const showOverlayHints = true;
  const [aiHighlights, setAiHighlights] = useState<DsHighlight[]>([]);
  const aiHighlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingAnnotationIdRef = useRef<string | null>(null);
  const [flashAnnotationId, setFlashAnnotationId] = useState<string | null>(null);
  const [reviewSidebarWidth, setReviewSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return REVIEW_SIDEBAR_DEFAULT_WIDTH;
    const raw = window.localStorage.getItem(REVIEW_SIDEBAR_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) return REVIEW_SIDEBAR_DEFAULT_WIDTH;
    return Math.max(REVIEW_SIDEBAR_MIN_WIDTH, Math.min(REVIEW_SIDEBAR_MAX_WIDTH, parsed));
  });
  const reviewSidebarWidthRef = useRef<number>(reviewSidebarWidth);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarVisibleRef = useRef(sidebarVisible);
  const toggleSidebarRef = useRef(toggleSidebar);

  const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {});
  const pdfHighlighterRef = useRef<PdfHighlighter<IHighlight> | null>(null);
  const socketRef = useRef<ReturnType<typeof acquireFileSocket> | null>(null);
  const joinedRef = useRef(false);
  const shouldRedirectToNotebook = isMarkdownFileName(fileName);

  useEffect(() => {
    reviewSidebarWidthRef.current = reviewSidebarWidth;
  }, [reviewSidebarWidth]);

  useEffect(() => {
    if (!isResizableAnnotationWorkspace || typeof window === "undefined") return;
    window.localStorage.setItem(REVIEW_SIDEBAR_WIDTH_STORAGE_KEY, String(reviewSidebarWidth));
  }, [REVIEW_SIDEBAR_WIDTH_STORAGE_KEY, isResizableAnnotationWorkspace, reviewSidebarWidth]);

  const clampReviewSidebarWidth = useCallback((rawWidth: number) => {
    const viewportMax =
      typeof window !== "undefined"
        ? Math.max(REVIEW_SIDEBAR_MIN_WIDTH, Math.min(REVIEW_SIDEBAR_MAX_WIDTH, Math.floor(window.innerWidth * 0.75)))
        : REVIEW_SIDEBAR_MAX_WIDTH;
    return Math.max(REVIEW_SIDEBAR_MIN_WIDTH, Math.min(viewportMax, rawWidth));
  }, [REVIEW_SIDEBAR_MAX_WIDTH, REVIEW_SIDEBAR_MIN_WIDTH]);

  const handleReviewSidebarResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizableAnnotationWorkspace) return;
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = reviewSidebarWidthRef.current;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        setReviewSidebarWidth(clampReviewSidebarWidth(startWidth + delta));
      };

      const handleMouseUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [clampReviewSidebarWidth, isResizableAnnotationWorkspace],
  );

  const arxivPaper = useMemo(() => {
    if (arxivFromContext) return arxivFromContext;
    if (!fileId) return null;
    return arxivItems.find((item) => item.fileId === fileId) || null;
  }, [arxivFromContext, arxivItems, fileId]);

  const arxivError = arxivPaper ? arxivErrors[arxivPaper.arxivId] : undefined;
  const supportsMarkdownView = Boolean(
    fileId &&
      !isCliFile &&
      (!isArxivPdf || arxivPaper?.overview?.trim() || arxivPaper?.abstract?.trim())
  );
  const markdownButtonLabel = isArxivPdf ? t("summary") : t("markdown");
  const markdownButtonTitle = isArxivPdf ? t("open_summary") : t("open_markdown");

  useEffect(() => {
    sidebarVisibleRef.current = sidebarVisible;
  }, [sidebarVisible]);

  useEffect(() => {
    toggleSidebarRef.current = toggleSidebar;
  }, [toggleSidebar]);

  const handleCopyBibtex = useCallback(async () => {
    if (!arxivPaper) return;
    const bibtex = generateBibTeX(arxivPaper);
    const success = await copyToClipboard(bibtex);
    addToast({
      type: success ? "success" : "error",
      title: success ? t("toast_bibtex_copied_title") : t("toast_copy_failed_title"),
      description: success ? arxivPaper.title || arxivPaper.arxivId : t("try_again"),
      duration: 1800,
    });
  }, [addToast, arxivPaper, t]);

  const handleOpenArxiv = useCallback(() => {
    if (!arxivPaper?.arxivId) return;
    window.open(`https://arxiv.org/abs/${arxivPaper.arxivId}`, "_blank", "noopener,noreferrer");
  }, [arxivPaper]);

  const resolveWorkspaceResourcePath = useCallback(() => {
    const pathHint = String(context.resourcePath || "").trim();
    if (pathHint.startsWith("/FILES")) return pathHint;
    if (fileId) {
      const node = findNode(fileId);
      if (node?.path) return toFilesResourcePath(node.path);
    }
    if (pathHint) return toFilesResourcePath(pathHint);
    return undefined;
  }, [context.resourcePath, fileId, findNode]);

  const loadPdfMarkdown = useCallback(async (): Promise<string | null> => {
    if (!fileId || isCliFile || isArxivPdf) return null;

    const cached = markdownCacheRef.current[fileId];
    if (cached) return cached;

    const inflight = markdownLoadPromiseRef.current[fileId];
    if (inflight) return inflight;

    const request = apiClient
      .get(`/api/v1/pdf/markdown/${fileId}`, {
        responseType: "text",
        transformResponse: [(value) => value],
      })
      .then((response) => {
        const markdown =
          typeof response.data === "string"
            ? response.data
            : String(response.data || "");
        if (markdown) {
          markdownCacheRef.current[fileId] = markdown;
          return markdown;
        }
        return null;
      })
      .finally(() => {
        delete markdownLoadPromiseRef.current[fileId];
      });

    markdownLoadPromiseRef.current[fileId] = request;
    return request;
  }, [fileId, isArxivPdf, isCliFile]);

  const enrichReferenceWithMarkdown = useCallback(
    async (referenceId: string, selectedText: string) => {
      if (!fileId || isCliFile || isArxivPdf) return;
      try {
        const markdown = await loadPdfMarkdown();
        const excerpt = locateMarkdownExcerpt(markdown || "", selectedText);
        updateWorkspaceReference(referenceId, {
          markdownExcerpt: excerpt || undefined,
          excerptStatus: excerpt ? "ready" : "error",
        });
      } catch {
        updateWorkspaceReference(referenceId, {
          excerptStatus: "error",
        });
      }
    },
    [fileId, isArxivPdf, isCliFile, loadPdfMarkdown, updateWorkspaceReference]
  );

  useEffect(() => {
    if (!fileId || isCliFile || isArxivPdf) return;
    void loadPdfMarkdown().catch(() => undefined);
  }, [fileId, isArxivPdf, isCliFile, loadPdfMarkdown]);

  const handleAskCopilotFromSelection = useCallback(
    (content: Content, position: ScaledPosition) => {
      const selectedText = String(content?.text || "").trim();
      if (!selectedText) return;

      const referenceId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `pdf-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const fallbackRect = position.boundingRect
        ? [
            {
              left: position.boundingRect.x1,
              top: position.boundingRect.y1,
              width: position.boundingRect.width,
              height: position.boundingRect.height,
              pageNumber: position.boundingRect.pageNumber,
            },
          ]
        : [];

      addWorkspaceReference({
        id: referenceId,
        kind: "pdf_text",
        tabId,
        fileId: fileId || undefined,
        resourceId: fileId || undefined,
        resourcePath: resolveWorkspaceResourcePath(),
        resourceName: fileName,
        pageNumber: position.pageNumber,
        selectedText,
        markdownExcerpt: undefined,
        excerptStatus: fileId && !isCliFile && !isArxivPdf ? "loading" : "idle",
        rects:
          position.rects?.map((rect) => ({
            left: rect.x1,
            top: rect.y1,
            width: rect.width,
            height: rect.height,
            pageNumber: rect.pageNumber,
          })) || fallbackRect,
        createdAt: new Date().toISOString(),
      });

      window.dispatchEvent(new CustomEvent("ds:copilot:focus", { detail: { focus: true } }));

      if (fileId && !isCliFile && !isArxivPdf) {
        void enrichReferenceWithMarkdown(referenceId, selectedText);
      }
    },
    [
      addWorkspaceReference,
      enrichReferenceWithMarkdown,
      fileId,
      fileName,
      isArxivPdf,
      isCliFile,
      resolveWorkspaceResourcePath,
      tabId,
    ]
  );

  useEffect(() => {
    if (!shouldRedirectToNotebook) return;
    updateTabPlugin(tabId, BUILTIN_PLUGINS.NOTEBOOK, {
      ...context,
      resourceId: fileId,
      resourceName: fileName,
      mimeType: context.mimeType ?? "text/markdown",
      customData: {
        ...(context.customData || {}),
        docKind: "markdown",
      },
    });
  }, [context, fileId, fileName, shouldRedirectToNotebook, tabId, updateTabPlugin]);

  // Set tab title
  useEffect(() => {
    setTitle(fileName);
  }, [fileName, setTitle]);

  useEffect(() => {
    setDirty(false);
  }, [setDirty]);

  useEffect(() => {
    updateWorkspaceTabState(tabId, {
      contentKind: "pdf",
      documentMode: "pdf",
      pageNumber: currentPage,
      isReadOnly: isReadOnlyMode,
    });
  }, [currentPage, isReadOnlyMode, tabId, updateWorkspaceTabState]);

  useEffect(() => {
    const resolvedProjectId = projectIdFromContext || questProjectIdFromFileId;
    if (resolvedProjectId) {
      setProjectId(resolvedProjectId);
      return;
    }
    if (!fileId || isCliFile) return;
    getFile(fileId)
      .then((f: any) => {
        if (f?.project_id) setProjectId(String(f.project_id));
      })
      .catch(() => {
        // noop
      });
  }, [fileId, hasExternalPdfUrl, isCliFile, projectIdFromContext, questProjectIdFromFileId]);

  useEffect(() => {
    if (!fileId || !isCliFile) {
      setCliPdfUrl(null);
      setCliPdfLoading(false);
      setCliPdfError(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setCliPdfLoading(true);
    setCliPdfError(null);

    const loadCliPdf = async () => {
      try {
        const { createFileObjectUrl } = await import("@/lib/api/files");
        objectUrl = await createFileObjectUrl(fileId);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setCliPdfUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setCliPdfError("Failed to load PDF from CLI server.");
        }
      } finally {
        if (!cancelled) {
          setCliPdfLoading(false);
        }
      }
    };

    loadCliPdf();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileId, isCliFile]);

  useEffect(() => {
    if (!fileId || !isQuestFile || isCliFile) {
      setQuestPdfUrl(null);
      setQuestPdfLoading(false);
      setQuestPdfError(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setQuestPdfLoading(true);
    setQuestPdfError(null);

    const loadQuestPdf = async () => {
      try {
        objectUrl = await createFileObjectUrl(fileId);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setQuestPdfUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setQuestPdfError("Failed to load PDF document.");
        }
      } finally {
        if (!cancelled) {
          setQuestPdfLoading(false);
        }
      }
    };

    void loadQuestPdf();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileId, isCliFile, isQuestFile]);

  useEffect(() => {
    if (!projectId) return;
    const userId = currentUser?.id;
    if (!userId) return;
    listProjectMembers(projectId)
      .then((members) => {
        const me = members.find((m) => m.user_id === userId);
        if (me?.annotation_color) setAuthorColor(String(me.annotation_color));
      })
      .catch(() => {
        // noop
      });
  }, [projectId, currentUser?.id]);

  // Realtime: join file room; refresh annotations on committed changes.
  useEffect(() => {
    if (!projectId || !fileId || isCliFile || isReadOnlyMode) return;

    const { socket, release } = acquireFileSocket();
    socketRef.current = { socket, release };

    const joinIfReady = async () => {
      if (joinedRef.current) return;
      if (!socket.connected) return;
      try {
        joinedRef.current = true;
        await socket.emitWithAck("file:join", { projectId, fileId, clientVersion: "1.0.0" });
      } catch {
        joinedRef.current = false;
      }
    };

    const onConnect = () => void joinIfReady();
    const onDisconnect = () => {
      joinedRef.current = false;
    };

    const onAnnotationEvent = (payload: any) => {
      if (payload?.fileId && String(payload.fileId) !== String(fileId)) return;
      queryClient.invalidateQueries({ queryKey: annotationKeys.list(fileId) });

      const incomingAnnotationId =
        typeof payload?.annotationId === "string" && payload.annotationId.trim()
          ? payload.annotationId.trim()
          : null;
      if (incomingAnnotationId) {
        pendingAnnotationIdRef.current = incomingAnnotationId;
        if (!sidebarVisibleRef.current) {
          toggleSidebarRef.current?.();
        }
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("annotation:created", onAnnotationEvent);
    socket.on("annotation:updated", onAnnotationEvent);
    socket.on("annotation:deleted", onAnnotationEvent);

    if (socket.connected) void joinIfReady();

    return () => {
      try {
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("annotation:created", onAnnotationEvent);
        socket.off("annotation:updated", onAnnotationEvent);
        socket.off("annotation:deleted", onAnnotationEvent);
        if (joinedRef.current) {
          void socket.emit("file:leave", { projectId, fileId });
        }
      } finally {
        joinedRef.current = false;
        socketRef.current = null;
        release();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fileId, isCliFile, isReadOnlyMode]);

  const highlights: Array<DsHighlight> = useMemo(() => {
    if (isReadOnlyMode) {
      return readOnlyHighlights;
    }
    return annotations.map((a) => ({
      id: a.id,
      position: a.position as unknown as ScaledPosition,
      content: a.content,
      comment: { text: a.comment || "", emoji: a.kind },
      color: a.color,
      author: a.author ?? null,
      tags: a.tags,
      previewSummary:
        typeof (a.content as Record<string, unknown> | undefined)?.summary === "string"
          ? String((a.content as Record<string, unknown>).summary || "").trim() || null
          : null,
    }));
  }, [annotations, isReadOnlyMode, readOnlyHighlights]);

  const mergedHighlights: Array<DsHighlight> = useMemo(
    () => [...highlights, ...aiHighlights],
    [highlights, aiHighlights]
  );

  useEffect(() => {
    const pendingId = pendingAnnotationIdRef.current;
    if (!pendingId) return;

    const highlight = highlights.find((h) => h.id === pendingId);
    if (!highlight) return;

    selectAnnotation(highlight.id);
    setCurrentPage(highlight.position.pageNumber);
    scrollViewerTo.current(highlight as IHighlight);
    pendingAnnotationIdRef.current = null;

    setFlashAnnotationId(highlight.id);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashAnnotationId(null), 2200);
  }, [highlights, selectAnnotation, setCurrentPage]);

  useEffect(() => {
    const highlighter = pdfHighlighterRef.current;
    return () => {
      highlighter?.setPinnedTipForHighlight(null);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isReadOnlyMode) {
      readOnlySidebarInitRef.current = false;
      return;
    }
    if (readOnlySidebarInitRef.current) return;
    if (highlights.length === 0) return;
    readOnlySidebarInitRef.current = true;
    if (!sidebarVisible) {
      toggleSidebar();
    }
  }, [highlights.length, isReadOnlyMode, sidebarVisible, toggleSidebar]);

  // Handle page navigation from toolbar
  const scrollToPage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      pdfHighlighterRef.current?.scrollToPage(page);
    },
    [setCurrentPage],
  );

  const addGhostHighlight = useCallback(
    (detail: {
      page: number;
      rects: Array<{ x1: number; y1: number; x2: number; y2: number; width?: number; height?: number; pageNumber?: number }>;
      boundingRect: { x1: number; y1: number; x2: number; y2: number; width?: number; height?: number; pageNumber?: number };
      color?: string;
      mode?: "guide" | "annotate";
      durationMs?: number;
      text?: string;
    }) => {
      const id = `ai-ghost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const rects = detail.rects.map((rect) => ({
        ...rect,
        width: rect.width ?? 100,
        height: rect.height ?? 100,
        pageNumber: rect.pageNumber ?? detail.page,
      }));
      const boundingRect = {
        ...detail.boundingRect,
        width: detail.boundingRect.width ?? 100,
        height: detail.boundingRect.height ?? 100,
        pageNumber: detail.boundingRect.pageNumber ?? detail.page,
      };
      const ghostHighlight: DsHighlight = {
        id,
        position: {
          boundingRect: boundingRect as ScaledPosition["boundingRect"],
          rects: rects as ScaledPosition["rects"],
          pageNumber: detail.page,
        },
        content: { text: detail.text || "" },
        comment: { text: "", emoji: "note" },
        color: detail.color || "#3F5A6B",
        __dsGhost: true,
        __dsGhostOpacity: 1,
        __dsGhostMode: detail.mode || "guide",
      };

      setAiHighlights((prev) => [...prev, ghostHighlight]);

      const duration = detail.durationMs ?? 3000;
      const fadeTimer = setTimeout(() => {
        setAiHighlights((prev) =>
          prev.map((h) => (h.id === id ? { ...h, __dsGhostOpacity: 0 } : h))
        );
      }, duration);

      const removeTimer = setTimeout(() => {
        setAiHighlights((prev) => prev.filter((h) => h.id !== id));
        aiHighlightTimers.current.delete(id);
        aiHighlightTimers.current.delete(`${id}:fade`);
      }, duration + 800);

      aiHighlightTimers.current.set(id, removeTimer);
      aiHighlightTimers.current.set(`${id}:fade`, fadeTimer);
    },
    []
  );

  useEffect(() => {
    const timers = aiHighlightTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const shouldSkipEffect = useCallback((detail?: { __dsEffectId?: unknown }) => {
    const effectId = typeof detail?.__dsEffectId === "string" ? detail.__dsEffectId : null;
    if (!effectId) return false;
    if (isPdfEffectHandled(effectId)) return true;
    markPdfEffectHandled(effectId);
    return false;
  }, []);

  const applyNavigate = useCallback(
    (detail: {
      fileId?: string;
      page?: number;
      rects?: Array<{ x1: number; y1: number; x2: number; y2: number; width?: number; height?: number; pageNumber?: number }>;
      boundingRect?: { x1: number; y1: number; x2: number; y2: number; width?: number; height?: number; pageNumber?: number };
      color?: string;
      mode?: "guide" | "annotate";
      durationMs?: number;
      text?: string;
      annotationId?: string;
      __dsEffectId?: string;
    }) => {
      if (!detail || detail.fileId !== fileId) return;
      if (shouldSkipEffect(detail)) return;

      queryClient.invalidateQueries({ queryKey: annotationKeys.list(fileId) });

      if (detail.page) {
        scrollToPage(detail.page);
      }

      if (detail.rects && detail.boundingRect) {
        addGhostHighlight({
          page: detail.page || 1,
          rects: detail.rects,
          boundingRect: detail.boundingRect,
          color: detail.color,
          mode: detail.mode || "guide",
          durationMs: detail.durationMs,
          text: detail.text,
        });
      }

      if (detail.annotationId) {
        pendingAnnotationIdRef.current = detail.annotationId;
      }
      if ((detail.annotationId || detail.__dsEffectId) && !sidebarVisible) {
        toggleSidebar();
      }
    },
    [addGhostHighlight, fileId, queryClient, scrollToPage, sidebarVisible, toggleSidebar, shouldSkipEffect]
  );

  const applyAnnotationCreated = useCallback(
    (detail: {
      fileId?: string;
      annotationId?: string;
      page?: number;
      color?: string;
      position?: {
        boundingRect: { x1: number; y1: number; x2: number; y2: number; width?: number; height?: number; pageNumber?: number };
        rects: Array<{ x1: number; y1: number; x2: number; y2: number; width?: number; height?: number; pageNumber?: number }>;
        pageNumber: number;
      };
      __dsEffectId?: string;
    }) => {
      if (!detail || detail.fileId !== fileId) return;
      if (shouldSkipEffect(detail)) return;

      // LLM/agent tools may create annotations via effects (without calling the REST create endpoint),
      // so we must refresh the annotations query explicitly here.
      queryClient.invalidateQueries({ queryKey: annotationKeys.list(fileId) });

      if (detail.page) {
        scrollToPage(detail.page);
      }

      if (detail.annotationId) {
        pendingAnnotationIdRef.current = detail.annotationId;
        if (!sidebarVisible) {
          toggleSidebar();
        }
      }
    },
    [fileId, queryClient, scrollToPage, sidebarVisible, toggleSidebar, shouldSkipEffect]
  );

  const processQueuedEffects = useCallback(() => {
    if (!fileId) return;
    const queued = consumePdfEffects(fileId);
    if (queued.length === 0) return;
    queued.forEach((effect) => {
      if (effect.name === "pdf:jump") {
        applyNavigate(effect.data as any);
      } else {
        applyAnnotationCreated(effect.data as any);
      }
    });
  }, [applyAnnotationCreated, applyNavigate, fileId]);

  useEffect(() => {
    if (!fileId) return;
    processQueuedEffects();
  }, [fileId, processQueuedEffects]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!fileId) return;

    const handleNavigate = (event: Event) => {
      const detail = (event as CustomEvent).detail as Parameters<typeof applyNavigate>[0];
      applyNavigate(detail);
    };

    const handleAnnotationCreated = (event: Event) => {
      const detail = (event as CustomEvent).detail as Parameters<typeof applyAnnotationCreated>[0];
      applyAnnotationCreated(detail);
    };

    const handleQueue = (event: Event) => {
      const detail = (event as CustomEvent).detail as { fileId?: string };
      if (!detail || detail.fileId !== fileId) return;
      processQueuedEffects();
    };

    window.addEventListener("pdf:navigate", handleNavigate as EventListener);
    window.addEventListener("pdf:annotation_created", handleAnnotationCreated as EventListener);
    window.addEventListener("ds:pdf:queue", handleQueue as EventListener);

    return () => {
      window.removeEventListener("pdf:navigate", handleNavigate as EventListener);
      window.removeEventListener("pdf:annotation_created", handleAnnotationCreated as EventListener);
      window.removeEventListener("ds:pdf:queue", handleQueue as EventListener);
    };
  }, [applyAnnotationCreated, applyNavigate, fileId, processQueuedEffects]);

  const addHighlight = useCallback(
    async (highlight: NewHighlight) => {
      if (isReadOnlyMode || isCliFile || !fileId) return;
      try {
        const kind = normalizeKind(highlight.comment?.emoji);
        const created = await createAnnotation({
          fileId,
          position: highlight.position as any,
          content: highlight.content as any,
          comment: highlight.comment?.text || "",
          kind,
          tags: [],
        });
        if (created?.id && !sidebarVisible) {
          toggleSidebar();
        }
      } catch (e) {
        console.warn("[PdfViewerPlugin] Failed to create annotation:", e);
      }
    },
    [createAnnotation, fileId, isCliFile, isReadOnlyMode, sidebarVisible, toggleSidebar],
  );

  const updateHighlight = useCallback(
    async (
      highlightId: string,
      position: Partial<ScaledPosition>,
      content: Partial<Content>,
    ) => {
      if (isReadOnlyMode || isCliFile || !fileId) return;
      try {
        const existing = annotations.find((a) => a.id === highlightId);
        if (!existing) return;

        const nextPosition: any = {
          ...existing.position,
          ...position,
          boundingRect: {
            ...(existing.position as any).boundingRect,
            ...(position as any).boundingRect,
          },
        };
        const nextContent: any = { ...existing.content, ...content };
        await updateAnnotation(highlightId, { position: nextPosition, content: nextContent });
      } catch (e) {
        console.warn("[PdfViewerPlugin] Failed to update annotation position/content:", e);
      }
    },
    [annotations, fileId, isCliFile, isReadOnlyMode, updateAnnotation],
  );

  const handleSelectHighlight = useCallback(
    (id: string, options?: { allowToggleClose?: boolean; skipAutoScroll?: boolean }) => {
      const highlight = highlights.find((h) => h.id === id);
      if (!highlight) return;
      const allowToggleClose = options?.allowToggleClose !== false;
      const skipAutoScroll = options?.skipAutoScroll === true;
      const isToggleClose = allowToggleClose && selectedAnnotationId === id;
      if (isToggleClose) {
        selectAnnotation(null);
        pdfHighlighterRef.current?.setPinnedTipForHighlight(null);
        return;
      }

      if (!sidebarVisible) {
        toggleSidebar();
      }
      selectAnnotation(id);
      pdfHighlighterRef.current?.setPinnedTipForHighlight(null);
      if (!skipAutoScroll) {
        setCurrentPage(highlight.position.pageNumber);
        scrollViewerTo.current(highlight);
      }
    },
    [
      highlights,
      selectedAnnotationId,
      sidebarVisible,
      selectAnnotation,
      setCurrentPage,
      toggleSidebar,
    ],
  );

  const handlePdfBackgroundPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest("[data-ds-highlight-target='true']") ||
        target.closest("[data-ds-overlay-hint='true']")
      ) {
        return;
      }
      if (!selectedAnnotationId) return;
      selectAnnotation(null);
      pdfHighlighterRef.current?.setPinnedTipForHighlight(null);
    },
    [selectedAnnotationId, selectAnnotation],
  );

  const handleDeleteHighlight = useCallback(
    async (id: string) => {
      if (isReadOnlyMode || isCliFile || !fileId) return;
      try {
        await deleteAnnotation(id);
        if (selectedAnnotationId === id) {
          selectAnnotation(null);
        }
      } catch (e) {
        console.warn("[PdfViewerPlugin] Failed to delete annotation:", e);
      }
    },
    [deleteAnnotation, fileId, isCliFile, isReadOnlyMode, selectedAnnotationId, selectAnnotation],
  );

  const handleUpdateKind = useCallback(
    async (id: string, kind: AnnotationKind) => {
      if (isReadOnlyMode || isCliFile || !fileId) return;
      try {
        await updateAnnotation(id, { kind });
      } catch (e) {
        console.warn("[PdfViewerPlugin] Failed to update annotation kind:", e);
      }
    },
    [fileId, isCliFile, isReadOnlyMode, updateAnnotation],
  );

  const handleUpdateComment = useCallback(
    async (id: string, comment: string) => {
      if (isReadOnlyMode || isCliFile || !fileId) return;
      try {
        await updateAnnotation(id, { comment });
      } catch (e) {
        console.warn("[PdfViewerPlugin] Failed to update annotation comment:", e);
      }
    },
    [fileId, isCliFile, isReadOnlyMode, updateAnnotation],
  );

  // Handle download
  const handleDownload = useCallback(() => {
    if (!fileId) {
      window.open(pdfUrl, "_blank");
      return;
    }

    (async () => {
      const { downloadFileById } = await import("@/lib/api/files");
      await downloadFileById(fileId, fileName);
    })();
  }, [fileId, fileName, pdfUrl]);

  const handleOpenMarkdown = useCallback(() => {
    if (openMarkdownViewFromHost) {
      openMarkdownViewFromHost();
      return;
    }
    if (!fileId || isCliFile) return;
    updateTabPlugin(tabId, BUILTIN_PLUGINS.PDF_MARKDOWN, {
      ...context,
      customData: {
        ...(context.customData || {}),
        pdfView: isArxivPdf ? "summary" : "markdown",
      },
    });
  }, [context, fileId, isArxivPdf, isCliFile, openMarkdownViewFromHost, tabId, updateTabPlugin]);

  if (shouldRedirectToNotebook) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20">
        <div className="text-sm text-muted-foreground">
          Switching to Markdown editor...
        </div>
      </div>
    );
  }

  if (isCliFile && (cliPdfLoading || cliPdfError) && !cliPdfUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        {cliPdfError ? (
          <div className="text-sm text-muted-foreground">{cliPdfError}</div>
        ) : (
          <PdfSpinner />
        )}
      </div>
    )
  }

  if (isQuestFile && (questPdfLoading || questPdfError) && !questPdfUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        {questPdfError ? (
          <div className="text-sm text-muted-foreground">{questPdfError}</div>
        ) : (
          <PdfSpinner />
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <Toolbar
        scale={scale}
        onScaleChange={setScale}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={scrollToPage}
        sidebarVisible={sidebarVisible}
        onSidebarToggle={toggleSidebar}
        onDownload={handleDownload}
        onInfo={arxivPaper ? () => setInfoOpen(true) : undefined}
        onMarkdownToggle={openMarkdownViewFromHost || supportsMarkdownView ? handleOpenMarkdown : undefined}
        markdownLabel={markdownButtonLabel}
        markdownTitle={markdownButtonTitle}
        reviewOpinionActive={reviewOpinionActiveFromHost}
        onReviewOpinionToggle={
          reviewOpinionAvailableFromHost && openReviewOpinionViewFromHost
            ? openReviewOpinionViewFromHost
            : undefined
        }
        reviewOpinionLabel={reviewOpinionLabelFromHost}
        reviewOpinionTitle={reviewOpinionTitleFromHost}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden bg-muted/10">
        {/* PDF Viewer (fill available width) */}
        <div className="flex-1 overflow-hidden flex">
          <div className="relative h-full w-full">
            <div
              className="relative h-full overflow-hidden border border-border bg-background shadow-soft-card"
              onPointerDown={handlePdfBackgroundPointerDown}
            >
              <PdfLoader
                url={pdfUrl}
                httpHeaders={httpHeaders}
                workerSrc={PDF_WORKER_SRC}
                cMapUrl={PDF_CMAP_URL}
                cMapPacked={PDF_CMAP_PACKED}
                beforeLoad={<PdfSpinner />}
              >
                {(pdfDocument) => (
                  <PdfHighlighterSurface
                    pdfDocument={pdfDocument}
                    scale={scale}
                    highlights={mergedHighlights}
                    selectedId={selectedAnnotationId}
                    onSelect={handleSelectHighlight}
                    onAdd={addHighlight}
                    onUpdate={updateHighlight}
                    onScrollRef={(scrollTo) => {
                      scrollViewerTo.current = scrollTo;
                    }}
                    onPageChange={(pageNumber) => setCurrentPage(pageNumber)}
                    pdfHighlighterRef={pdfHighlighterRef}
                    authorColor={authorColor}
                    authorHandle={
                      (currentUser?.email ? currentUser.email.split("@", 1)[0] : "") || "user"
                    }
                    showOverlayHints={showOverlayHints}
                    tipPlacementMode={isResizableAnnotationWorkspace ? "right" : "auto"}
                    readOnly={isReadOnlyMode}
                    onAskCopilot={handleAskCopilotFromSelection}
                  />
                )}
              </PdfLoader>
            </div>
          </div>
        </div>

        {/* Annotation Sidebar */}
        {sidebarVisible && (
          <div
            className={cn(
              "relative border-l bg-background/60 backdrop-blur flex-shrink-0",
              isResizableAnnotationWorkspace ? "" : "w-72",
            )}
            style={isResizableAnnotationWorkspace ? { width: reviewSidebarWidth } : undefined}
          >
            {isResizableAnnotationWorkspace ? (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t("resize_annotation_sidebar")}
                tabIndex={0}
                className="group absolute inset-y-0 left-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize touch-none"
                onPointerDown={handleReviewSidebarResizePointerDown}
              >
                <span className="pointer-events-none absolute top-1/2 left-1/2 h-16 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/20 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ) : null}
            <HighlightsSidebar
              highlights={highlights}
              selectedId={selectedAnnotationId}
              currentPage={currentPage}
              flashId={flashAnnotationId}
              onSelect={handleSelectHighlight}
              onDelete={handleDeleteHighlight}
              onUpdateKind={handleUpdateKind}
              onUpdateComment={handleUpdateComment}
              showOverlayHints={showOverlayHints}
              readOnly={isReadOnlyMode}
            />
          </div>
        )}
      </div>

      <ArxivInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        paper={arxivPaper}
        errorCode={arxivError}
        onCopyBibtex={arxivPaper ? handleCopyBibtex : undefined}
        onOpenArxiv={arxivPaper ? handleOpenArxiv : undefined}
      />
    </div>
  );
}

// Export lifecycle hooks (optional)
export function onPdfViewerActivate() {
  console.debug("[PdfViewerPlugin] Activated");
}

export function onPdfViewerDeactivate() {
  console.debug("[PdfViewerPlugin] Deactivated");
}
