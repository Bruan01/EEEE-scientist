"use client";

/**
 * NotebookEditor Component
 *
 * @ds/plugin-notebook
 *
 * Novel-based editor integration with Yjs collaboration.
 * Features:
 * - Rich text editing with Novel/Tiptap
 * - Slash command menu for block insertion
 * - Bubble menu for text formatting
 * - Image upload and resizing
 * - Math/LaTeX support
 * - Real-time collaboration via Yjs
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PluginComponentProps } from "@/lib/types/tab";
import type { AutoSaveStatus } from "../types";
import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  EditorRoot,
  createImageUpload,
  handleCommandNavigation,
  handleImageDrop,
  handleImagePaste,
  ImageResizer,
  type EditorInstance,
  type JSONContent,
} from "novel";
import Collaboration from "@tiptap/extension-collaboration";
import { getFileContent, updateFileContent } from "@/lib/api/files";
import { uploadQuestDocumentAsset } from "@/lib/api/quest-files";
import {
  getQuestMarkdownContextFromFileId,
  rewriteQuestMarkdownForDisplay,
  rewriteQuestMarkdownForSave,
} from "@/lib/markdown/quest-assets";
import { inferNotebookDocKind } from "../lib/doc-kind";
import { createNovelYjsProvider } from "../lib/novel-yjs-provider";
import { defaultExtensions } from "../lib/novel-extensions";
import {
  buildSuggestionItems,
  createSlashCommand,
} from "../lib/novel-slash-command";
import { EditorBubbleMenu } from "../lib/novel-bubble-menu";
import { TableBubbleMenu, TableToolbar } from "../lib/novel-selectors";
import { getEditorMarkdown, setEditorMarkdown } from "../lib/markdown-utils";
import { EditorLoading } from "./EditorLoading";
import { NotebookToolbar } from "./NotebookToolbar";
import {
  isSupportedNotebookAsset,
  resolveNotebookAssetUrl,
  uploadNotebookAsset,
} from "../lib/novel-asset-upload";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import { useFileDiffOverlay } from "@/hooks/useFileDiffOverlay";
import FileDiffPanel from "@/components/ui/file-diff-panel";
// Tippy.js CSS for slash command popup
import "tippy.js/dist/tippy.css";
import "../NotebookEditor.css";

interface NotebookEditorProps extends PluginComponentProps {
  className?: string;
  onMarkdownChange?: (markdown: string) => void;
}

type FileReloadDetail = {
  fileId?: string;
  filePath?: string;
  projectId?: string;
  source?: string;
  force?: boolean;
};

const DEFAULT_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
const YJS_FIELD = "prosemirror";

function isEditorDocEmpty(editor: EditorInstance): boolean {
  const doc = editor.state.doc;
  if (doc.childCount !== 1) return false;
  const first = doc.firstChild;
  if (!first) return true;
  if (first.type.name !== "paragraph") return false;
  return first.content.size === 0 && doc.textContent.trim().length === 0;
}

export default function NotebookEditor({
  context,
  setDirty,
  setTitle,
  className,
  onMarkdownChange,
}: NotebookEditorProps) {
  const notebookId = context.resourceId;
  const notebookName = context.resourceName || "Untitled Notebook";
  const inlineMarkdown =
    typeof context.customData?.inlineMarkdown === "string"
      ? (context.customData.inlineMarkdown as string)
      : null;
  const isInline = inlineMarkdown !== null;
  const isReadonly = context.customData?.readonly === true || isInline;
  const fallbackProjectId = useFileTreeStore((state) => state.projectId);
  const projectId =
    typeof context.customData?.projectId === "string"
      ? (context.customData.projectId as string)
      : fallbackProjectId || undefined;
  const filePath = context.resourcePath ?? undefined;

  const docKind = inferNotebookDocKind(context);
  const isMarkdownDoc = docKind === "markdown";
  const markdownAssetContext = useMemo(
    () => (isMarkdownDoc ? getQuestMarkdownContextFromFileId(notebookId) : null),
    [isMarkdownDoc, notebookId]
  );

  const providerRef = useRef<Awaited<
    ReturnType<typeof createNovelYjsProvider>
  > | null>(null);
  const projectIdRef = useRef<string | undefined>(projectId);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markdownChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const baselineMarkdownRef = useRef<string | null>(null);
  const activeNotebookIdRef = useRef<string | null>(null);
  const currentNotebookIdRef = useRef<string | null>(null);
  const suppressMarkdownUpdateRef = useRef(false);

  const [editor, setEditor] = useState<EditorInstance | null>(null);
  const [ydoc, setYdoc] = useState<import("yjs").Doc | null>(null);
  const [initialMarkdown, setInitialMarkdown] = useState<string | null>(null);
  const baselineNotebookMarkdownRef = useRef<string | null>(null);
  const [loadedNotebookId, setLoadedNotebookId] = useState<string | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const [resetNonce, setResetNonce] = useState(0);
  const { diffEvent, clearDiff } = useFileDiffOverlay({
    fileId: notebookId ?? undefined,
    filePath,
    projectId,
  });
  const getCurrentMarkdown = useCallback(() => {
    if (editor) return getEditorMarkdown(editor);
    if (typeof initialMarkdown === "string") return initialMarkdown;
    if (typeof baselineNotebookMarkdownRef.current === "string") {
      return baselineNotebookMarkdownRef.current;
    }
    return "";
  }, [editor, initialMarkdown]);

  const toDisplayMarkdown = useCallback(
    (markdown: string) =>
      isMarkdownDoc
        ? rewriteQuestMarkdownForDisplay(markdown, markdownAssetContext)
        : markdown,
    [isMarkdownDoc, markdownAssetContext]
  );

  const toStoredMarkdown = useCallback(
    (markdown: string) =>
      isMarkdownDoc
        ? rewriteQuestMarkdownForSave(markdown, markdownAssetContext)
        : markdown,
    [isMarkdownDoc, markdownAssetContext]
  );

  const reloadMarkdownFromServer = useCallback(
    async (force?: boolean) => {
      if (!editor || !notebookId || !isMarkdownDoc) return;
      const currentMarkdown = getEditorMarkdown(editor);
      const baseline = baselineMarkdownRef.current ?? currentMarkdown;
      if (!force && currentMarkdown !== baseline) return;
      try {
        const latest = toDisplayMarkdown(await getFileContent(notebookId));
        suppressMarkdownUpdateRef.current = true;
        setEditorMarkdown(editor, latest);
        baselineMarkdownRef.current = latest;
      } catch (error) {
        console.warn("[NotebookEditor] Failed to refresh markdown", error);
      }
    },
    [editor, isMarkdownDoc, notebookId, toDisplayMarkdown]
  );

  const notebookIdValue = notebookId ?? null;
  if (currentNotebookIdRef.current !== notebookIdValue) {
    currentNotebookIdRef.current = notebookIdValue;
    activeNotebookIdRef.current = null;
  }

  useEffect(() => {
    if (!diffEvent?.diff) return;
    void reloadMarkdownFromServer(false);
  }, [diffEvent, reloadMarkdownFromServer]);

  useEffect(() => {
    if (!notebookId || isInline) return;
    const handleReload = (event: Event) => {
      const detail = (event as CustomEvent<FileReloadDetail>).detail;
      if (!detail) return;
      if (detail.fileId && detail.fileId !== notebookId) return;
      if (!detail.fileId && detail.filePath && filePath && detail.filePath !== filePath) {
        return;
      }
      if (!detail.fileId && !detail.filePath) return;
      void reloadMarkdownFromServer(Boolean(detail.force));
    };
    window.addEventListener("ds:file:reload", handleReload as EventListener);
    return () => window.removeEventListener("ds:file:reload", handleReload as EventListener);
  }, [filePath, isInline, notebookId, reloadMarkdownFromServer]);

  const imageUploadFn = useMemo(() => {
    return createImageUpload({
      onUpload: async (file) => {
        const currentProjectId = projectIdRef.current;
        if (!currentProjectId) {
          console.warn("[NotebookEditor] upload skipped: missing projectId", {
            fileName: file.name,
            fileType: file.type,
          });
          throw new Error("Missing project ID for upload.");
        }
        console.debug("[NotebookEditor] upload start", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        if (isMarkdownDoc && markdownAssetContext) {
          const uploaded = await uploadQuestDocumentAsset(
            currentProjectId,
            markdownAssetContext.baseDocumentId,
            file,
            "image"
          );
          return String(resolveNotebookAssetUrl(uploaded.asset_url));
        }
        return uploadNotebookAsset(currentProjectId, file, "image");
      },
      validateFn: (file) => {
        try {
          if (!projectIdRef.current) {
            console.warn("[NotebookEditor] validate failed: missing projectId", {
              fileName: file.name,
              fileType: file.type,
            });
            return false;
          }
          if (!isSupportedNotebookAsset(file, "image")) {
            console.warn("[NotebookEditor] validate failed: unsupported image", {
              fileName: file.name,
              fileType: file.type,
            });
            return false;
          }
          if (file.size > 10 * 1024 * 1024) {
            console.warn("[NotebookEditor] validate failed: size limit", {
              fileName: file.name,
              fileSize: file.size,
            });
            return false;
          }
          return true;
        } catch {
          console.warn("[NotebookEditor] validate failed: unexpected error", {
            fileName: file.name,
            fileType: file.type,
          });
          return false;
        }
      },
    });
  }, [isMarkdownDoc, markdownAssetContext]);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const handleVideoFiles = useCallback(
    async (files: File[]) => {
      const currentProjectId = projectIdRef.current;
      if (!editor || !currentProjectId) return;
      const videoFiles = files.filter((file) =>
        file.type.startsWith("video/")
      );
      if (videoFiles.length === 0) return;
      for (const file of videoFiles) {
        try {
          console.debug("[NotebookEditor] video upload start", {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          });
          const src = await uploadNotebookAsset(currentProjectId, file, "video");
          editor.chain().focus().insertContent({ type: "video", attrs: { src } }).run();
        } catch (err) {
          console.error("[NotebookEditor] Video upload failed:", err);
        }
      }
    },
    [editor]
  );

  useEffect(() => {
    setTitle(notebookName);
  }, [notebookName, setTitle]);

  useEffect(() => {
    setDirty(autoSaveStatus === "saving" || autoSaveStatus === "error");
  }, [autoSaveStatus, setDirty]);

  useEffect(() => {
    if (!editor || initialMarkdown === null) return;
    if (!notebookId) return;
    if (activeNotebookIdRef.current !== notebookId) return;
    if (!initialMarkdown.trim()) return;
    if (!isEditorDocEmpty(editor)) return;

    suppressMarkdownUpdateRef.current = true;
    setEditorMarkdown(editor, initialMarkdown);
    if (isMarkdownDoc) {
      baselineMarkdownRef.current = initialMarkdown;
    } else {
      baselineNotebookMarkdownRef.current = initialMarkdown;
    }
  }, [editor, initialMarkdown, isMarkdownDoc, notebookId]);

  useEffect(() => {
    if (!onMarkdownChange) return;
    if (!isMarkdownDoc) return;
    if (initialMarkdown === null) return;
    onMarkdownChange(initialMarkdown);
  }, [initialMarkdown, isMarkdownDoc, onMarkdownChange]);

  const handleImageUpload = useCallback(
    async (file: File, editorInstance: EditorInstance) => {
      const currentProjectId = projectIdRef.current;
      if (!currentProjectId) return;
      try {
        console.debug("[NotebookEditor] image upload start", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        const src =
          isMarkdownDoc && markdownAssetContext
            ? String(
                resolveNotebookAssetUrl(
                  (
                    await uploadQuestDocumentAsset(
                      currentProjectId,
                      markdownAssetContext.baseDocumentId,
                      file,
                      "image"
                    )
                  ).asset_url
                )
              )
            : await uploadNotebookAsset(currentProjectId, file, "image");
        editorInstance.chain().focus().setImage({ src }).run();
      } catch (err) {
        console.error("[NotebookEditor] Image upload failed:", err);
      }
    },
    [isMarkdownDoc, markdownAssetContext]
  );

  const suggestionItems = useMemo(
    () => buildSuggestionItems(handleImageUpload),
    [handleImageUpload]
  );

  const slashCommand = useMemo(
    () => createSlashCommand(suggestionItems),
    [suggestionItems]
  );

  const extensions = useMemo(() => {
    const list = [...defaultExtensions, slashCommand];
    if (ydoc) {
      // Cast to any to avoid tiptap version mismatch between novel and @tiptap/extension-collaboration
      list.unshift(
        Collaboration.configure({ document: ydoc, field: YJS_FIELD }) as any
      );
    }
    // Cast to any[] to avoid tiptap version mismatch between novel and frontend @tiptap/core
    return list as any[];
  }, [ydoc, slashCommand]);

  useEffect(() => {
    if (isInline) {
      setError(null);
      setIsInitializing(false);
      setAutoSaveStatus("idle");
      setInitialMarkdown(toDisplayMarkdown(inlineMarkdown ?? ""));
      setYdoc(null);
      setLoadedNotebookId(notebookIdValue);
      baselineMarkdownRef.current = toDisplayMarkdown(inlineMarkdown ?? "");
      baselineNotebookMarkdownRef.current = inlineMarkdown ?? "";
      suppressMarkdownUpdateRef.current = false;
      activeNotebookIdRef.current = notebookIdValue;
      return;
    }
    if (!notebookId) {
      setError("No notebook ID provided");
      setIsInitializing(false);
      return;
    }

    setError(null);
    setIsInitializing(true);
    setAutoSaveStatus("idle");
    setInitialMarkdown(null);
    setYdoc(null);
    setLoadedNotebookId(null);
    baselineMarkdownRef.current = null;
    baselineNotebookMarkdownRef.current = null;
    suppressMarkdownUpdateRef.current = false;
    activeNotebookIdRef.current = null;

    let canceled = false;

    const init = async () => {
      try {
        let markdown: string | null = null;
        try {
          markdown = await getFileContent(notebookId);
        } catch (err) {
          if (isMarkdownDoc) {
            throw err;
          }
          console.warn(
            "[NotebookEditor] Failed to load markdown for notebook:",
            err
          );
        }
        if (canceled) return;
        const displayMarkdown = toDisplayMarkdown(markdown ?? "");
        setInitialMarkdown(displayMarkdown);
        baselineNotebookMarkdownRef.current = markdown ?? "";

        if (isMarkdownDoc) {
          baselineMarkdownRef.current = displayMarkdown;
          activeNotebookIdRef.current = notebookId;
          setLoadedNotebookId(notebookId);
          setIsInitializing(false);
          return;
        }

        if (!projectId) {
          setError("No project ID provided");
          setIsInitializing(false);
          return;
        }

        const provider = await createNovelYjsProvider({
          projectId,
          notebookId,
          readonly: isReadonly,
          onStatus: setAutoSaveStatus,
          onReset: () => {
            setHistoryOpen(false);
            setCollaboratorsOpen(false);
            setResetNonce((v) => v + 1);
          },
        });
        if (canceled) {
          provider.dispose();
          return;
        }
        providerRef.current = provider;
        setYdoc(provider.ydoc);
        activeNotebookIdRef.current = notebookId;
        setLoadedNotebookId(notebookId);
        setIsInitializing(false);
      } catch (err) {
        if (canceled) return;
        console.error("[NotebookEditor] Initialization failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initialize editor"
        );
        setIsInitializing(false);
      }
    };

    init();

    return () => {
      canceled = true;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (markdownChangeTimeoutRef.current) {
        clearTimeout(markdownChangeTimeoutRef.current);
        markdownChangeTimeoutRef.current = null;
      }
      activeNotebookIdRef.current = null;
      providerRef.current?.dispose();
      providerRef.current = null;
      setEditor(null);
    };
  }, [inlineMarkdown, isInline, notebookId, notebookIdValue, projectId, isMarkdownDoc, isReadonly, resetNonce, toDisplayMarkdown]);

  const handleMarkdownUpdate = useCallback(
    (instance: EditorInstance) => {
      if (isReadonly || !isMarkdownDoc) return;
      if (!notebookId) return;
      if (activeNotebookIdRef.current !== notebookId) return;
      if (suppressMarkdownUpdateRef.current) {
        suppressMarkdownUpdateRef.current = false;
        return;
      }

      if (onMarkdownChange) {
        if (markdownChangeTimeoutRef.current) {
          clearTimeout(markdownChangeTimeoutRef.current);
        }
        const previewNotebookId = notebookId;
        markdownChangeTimeoutRef.current = setTimeout(() => {
          if (activeNotebookIdRef.current !== previewNotebookId) {
            return;
          }
          onMarkdownChange(getEditorMarkdown(instance));
        }, 120);
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setAutoSaveStatus("saving");
      const saveNotebookId = notebookId;
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          if (activeNotebookIdRef.current !== saveNotebookId) {
            return;
          }
          const markdown = getEditorMarkdown(instance);
          const storedMarkdown = toStoredMarkdown(markdown);
          if (baselineMarkdownRef.current === markdown) {
            setAutoSaveStatus("saved");
            setTimeout(() => setAutoSaveStatus("idle"), 1500);
            return;
          }
          await updateFileContent(saveNotebookId, storedMarkdown);
          baselineMarkdownRef.current = markdown;
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 1500);
        } catch (err) {
          console.error("[NotebookEditor] Markdown save failed:", err);
          setAutoSaveStatus("error");
        }
      }, 1500);
    },
    [isReadonly, isMarkdownDoc, notebookId, onMarkdownChange, toStoredMarkdown]
  );

  const handleNotebookMarkdownUpdate = useCallback(
    (instance: EditorInstance) => {
      if (isReadonly || isMarkdownDoc) return;
      if (!notebookId) return;
      if (activeNotebookIdRef.current !== notebookId) return;
      if (suppressMarkdownUpdateRef.current) {
        suppressMarkdownUpdateRef.current = false;
        return;
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setAutoSaveStatus("saving");
      const saveNotebookId = notebookId;
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          if (activeNotebookIdRef.current !== saveNotebookId) {
            return;
          }
          const markdown = getEditorMarkdown(instance);
          if (baselineNotebookMarkdownRef.current === markdown) {
            setAutoSaveStatus("saved");
            setTimeout(() => setAutoSaveStatus("idle"), 1500);
            return;
          }
          await updateFileContent(saveNotebookId, markdown);
          baselineNotebookMarkdownRef.current = markdown;
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 1500);
        } catch (err) {
          console.error("[NotebookEditor] Notebook markdown save failed:", err);
          setAutoSaveStatus("error");
        }
      }, 1500);
    },
    [isReadonly, isMarkdownDoc, notebookId]
  );

  const isFileTransfer = useCallback((dataTransfer: DataTransfer | null) => {
    if (!dataTransfer) return false;
    if (dataTransfer.files && dataTransfer.files.length > 0) return true;
    const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
    return items.some((item) => item.kind === "file");
  }, []);

  const getDroppedFiles = useCallback((dataTransfer: DataTransfer | null) => {
    if (!dataTransfer) return [];
    if (!isFileTransfer(dataTransfer)) return [];
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      return Array.from(dataTransfer.files);
    }
    const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    return files;
  }, [isFileTransfer]);

  const handleContainerDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (editor?.view.dragging) return;
      if (!isFileTransfer(event.dataTransfer)) return;
      const files = getDroppedFiles(event.dataTransfer);
      if (!files.length) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      console.debug("[NotebookEditor] dragover", {
        fileCount: files.length,
        fileTypes: files.map((file) => file.type || "unknown"),
        dataTypes: Array.from(event.dataTransfer.types ?? []),
        projectId: projectIdRef.current,
      });
    },
    [editor, getDroppedFiles, isFileTransfer]
  );

  const handleContainerDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (editor?.view.dragging) return;
      if (!isFileTransfer(event.dataTransfer)) return;
      const files = getDroppedFiles(event.dataTransfer);
      console.debug("[NotebookEditor] container drop", {
        fileCount: files.length,
        fileTypes: files.map((file) => file.type || "unknown"),
        dataTypes: Array.from(event.dataTransfer.types ?? []),
        hasUploadFn: Boolean(imageUploadFn),
        projectId: projectIdRef.current,
      });
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      if (!editor) {
        console.warn("[NotebookEditor] container drop ignored: editor missing");
        return;
      }
      const hasVideo = files.some((file) => file.type.startsWith("video/"));
      if (hasVideo) {
        handleVideoFiles(files);
      }
      if (imageUploadFn) {
        const handled = handleImageDrop(
          editor.view,
          event.nativeEvent,
          false,
          imageUploadFn
        );
        console.debug("[NotebookEditor] container drop handled", { handled });
      } else {
        console.warn("[NotebookEditor] container drop ignored: uploadFn missing");
      }
    },
    [editor, getDroppedFiles, handleVideoFiles, imageUploadFn, isFileTransfer]
  );

  if (error) {
    return (
      <div className="notebook-editor-error h-full flex items-center justify-center">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="text-destructive text-lg font-medium">
            Failed to load notebook
          </div>
          <p className="text-muted-foreground text-sm">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isNotebookReady =
    loadedNotebookId === notebookIdValue && !isInitializing;
  if (!isNotebookReady) {
    return <EditorLoading message="Initializing editor..." />;
  }

  if (!isMarkdownDoc && !ydoc) {
    return <EditorLoading message="Loading document..." />;
  }

  return (
    <div
      className={`notebook-editor flex flex-col flex-1 min-h-0 ${className || ""}`}
    >
      <NotebookToolbar
        notebookId={!isInline && notebookId ? notebookId : ""}
        autoSaveStatus={autoSaveStatus}
        getMarkdown={getCurrentMarkdown}
      />

      {/* Main content area with padding like PDF viewer */}
      <div className="flex-1 min-h-0 overflow-hidden flex justify-center px-4 py-4 bg-muted/10">
        {/* Centered notebook container with max-width (1.25x of original) */}
        <div className="relative h-full w-[min(62.5vw,100%)] max-w-[70rem]">
          {/* Rounded container with border and shadow */}
          <div
            className="notebook-editor-container relative h-full overflow-hidden rounded-2xl border border-border bg-background shadow-soft-card"
            data-notebook-id={notebookId}
            onDragOver={handleContainerDragOver}
            onDrop={handleContainerDrop}
          >
            {diffEvent?.diff ? (
              <FileDiffPanel
                diff={diffEvent.diff}
                changeType={diffEvent.changeType}
                title="AI change"
                subtitle={notebookName}
                onClose={clearDiff}
                className="absolute right-4 top-4 z-20 w-[min(420px,46vw)]"
              />
            ) : null}
        <EditorRoot>
          <EditorContent
            extensions={extensions}
            className="notebook-doc-editor relative h-full w-full overflow-y-auto"
            editorProps={{
              handleDOMEvents: {
                keydown: (_view, event) => handleCommandNavigation(event),
              },
              handlePaste: (view, event) => {
                const files = Array.from(event.clipboardData?.files ?? []);
                const hasVideo = files.some((file) =>
                  file.type.startsWith("video/")
                );
                if (hasVideo) {
                  event.preventDefault();
                  handleVideoFiles(files);
                  if (imageUploadFn) {
                    handleImagePaste(view, event, imageUploadFn);
                  }
                  return true;
                }
                if (imageUploadFn) {
                  return handleImagePaste(view, event, imageUploadFn);
                }
                return false;
              },
              handleDrop: (view, event, _slice, moved) => {
                const isFileDrop = isFileTransfer(event.dataTransfer);
                if (!isFileDrop) {
                  return false;
                }
                if (moved) {
                  console.debug("[NotebookEditor] drop ignored: internal move", {
                    moved,
                    projectId: projectIdRef.current,
                  });
                  return false;
                }
                const files = Array.from(event.dataTransfer?.files ?? []);
                console.debug("[NotebookEditor] drop", {
                  moved,
                  fileCount: files.length,
                  fileTypes: files.map((file) => file.type || "unknown"),
                  dataTypes: Array.from(event.dataTransfer?.types ?? []),
                  hasUploadFn: Boolean(imageUploadFn),
                  projectId: projectIdRef.current,
                });
                const hasVideo = files.some((file) =>
                  file.type.startsWith("video/")
                );
                if (hasVideo) {
                  event.preventDefault();
                  handleVideoFiles(files);
                  if (imageUploadFn) {
                    const handled = handleImageDrop(view, event, moved, imageUploadFn);
                    console.debug("[NotebookEditor] drop handled (video+image)", { handled });
                  }
                  return true;
                }
                if (imageUploadFn) {
                  const handled = handleImageDrop(view, event, moved, imageUploadFn);
                  console.debug("[NotebookEditor] drop handled (image)", { handled });
                  return handled;
                }
                console.warn("[NotebookEditor] drop ignored: uploadFn missing");
                return false;
              },
              attributes: {
                class:
                  "prose prose-lg dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full",
              },
            }}
            onCreate={({ editor: instance }) => {
              setEditor(instance);
              if (isMarkdownDoc && initialMarkdown !== null) {
                suppressMarkdownUpdateRef.current = true;
                setEditorMarkdown(instance, initialMarkdown);
                baselineMarkdownRef.current = initialMarkdown;
              }
              if (!isMarkdownDoc && ydoc) {
                const fragment = ydoc.getXmlFragment(YJS_FIELD);
                if (fragment.length === 0 && initialMarkdown !== null) {
                  suppressMarkdownUpdateRef.current = true;
                  setEditorMarkdown(instance, initialMarkdown);
                  baselineNotebookMarkdownRef.current = initialMarkdown;
                } else if (fragment.length === 0 && !isReadonly) {
                  instance.commands.setContent(DEFAULT_DOC);
                }
              }
              if (isReadonly) {
                instance.setEditable(false);
              }
            }}
            onUpdate={({ editor: instance }) => {
              handleMarkdownUpdate(instance);
              handleNotebookMarkdownUpdate(instance);
            }}
            slotAfter={<ImageResizer />}
          >
            {/* Slash Command Menu */}
            <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 text-foreground shadow-md transition-all">
              <EditorCommandEmpty className="px-2 text-muted-foreground">
                No results
              </EditorCommandEmpty>
              <EditorCommandList>
                {suggestionItems.map((item) => (
                  <EditorCommandItem
                    value={item.title}
                    onCommand={(val) => item.command?.(val)}
                    className="flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-selected:bg-accent"
                    key={item.title}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-muted bg-background text-foreground">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </EditorCommandItem>
                ))}
              </EditorCommandList>
            </EditorCommand>

            <TableToolbar />
            <TableBubbleMenu />

            {/* Bubble Menu for text selection */}
            <EditorBubbleMenu />
          </EditorContent>
        </EditorRoot>
          </div>
        </div>
      </div>
    </div>
  );
}

export { NotebookEditor };
