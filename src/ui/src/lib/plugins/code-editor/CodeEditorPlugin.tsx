"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Save, Loader2, Braces, RefreshCw } from "lucide-react";
import type { PluginComponentProps } from "@/lib/types/plugin";
import { cn } from "@/lib/utils";
import { useFileContentStore, useFileContentLoading } from "@/lib/stores/file-content";
import { acquireFileSocket } from "@/lib/realtime/file-socket";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import { configureMonacoLoader } from "@/lib/monaco";
import { isCliFileId } from "@/lib/api/cli-file-id";
import { useFileDiffOverlay } from "@/hooks/useFileDiffOverlay";
import FileDiffPanel from "@/components/ui/file-diff-panel";
import { consumeFileJumpEffects } from "@/lib/ai/file-jump-queue";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
configureMonacoLoader();

type FileMeta = {
  updatedAt?: string;
  sizeBytes?: number;
  mimeType?: string;
};

function getLanguageFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".py") || lower.endsWith(".pyw") || lower.endsWith(".pyi")) return "python";
  if (lower.endsWith(".json") || lower.endsWith(".jsonc") || lower.endsWith(".json5")) return "json";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".mts")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs")) return "javascript";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".sass")) return "css";
  return "plaintext";
}

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  React.useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.classList.contains("dark"));
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function useDebouncedEffect(effect: () => void, deps: unknown[], delayMs: number) {
  React.useEffect(() => {
    const id = window.setTimeout(effect, delayMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delayMs]);
}

export default function CodeEditorPlugin({ context, tabId, setDirty, setTitle }: PluginComponentProps) {
  const projectId = (context.customData?.projectId as string | undefined) ?? undefined;
  const fileMeta = (context.customData?.fileMeta as FileMeta | undefined) ?? undefined;
  const fileId = context.resourceId;
  const isCliFile = isCliFileId(fileId);
  const filePath = context.resourcePath ?? undefined;

  const fileName = context.resourceName || context.resourcePath || "Untitled";
  const language = React.useMemo(() => getLanguageFromName(fileName), [fileName]);
  const isDark = useIsDarkMode();

  const ensureLoaded = useFileContentStore((s) => s.ensureLoaded);
  const reloadFile = useFileContentStore((s) => s.reload);
  const saveHttp = useFileContentStore((s) => s.save);
  const setContent = useFileContentStore((s) => s.setContent);
  const applyServerSnapshot = useFileContentStore((s) => s.applyServerSnapshot);
  const key = projectId && fileId ? useFileContentStore.getState().getKey(projectId, fileId) : null;
  const entry = useFileContentStore((s) => (key ? s.entries[key] : undefined));
  const loading = useFileContentLoading(projectId, fileId ?? undefined);
  const updateFileMeta = useFileTreeStore((s) => s.updateFileMeta);
  const { diffEvent, clearDiff } = useFileDiffOverlay({
    fileId,
    filePath,
    projectId,
  });

  const editorRef = React.useRef<any>(null);
  const socketRef = React.useRef<ReturnType<typeof acquireFileSocket> | null>(null);
  const joinedRef = React.useRef(false);
  const [socketConnected, setSocketConnected] = React.useState(false);

  React.useEffect(() => {
    setTitle(fileName);
  }, [fileName, setTitle]);

  React.useEffect(() => {
    if (!projectId || !fileId) return;
    ensureLoaded({
      projectId,
      fileId,
      updatedAt: fileMeta?.updatedAt,
      mimeType: context.mimeType ?? fileMeta?.mimeType,
      sizeBytes: fileMeta?.sizeBytes,
    }).catch((e) => {
      console.error("[CodeEditorPlugin] Failed to load file:", e);
    });
  }, [projectId, fileId, ensureLoaded, fileMeta?.updatedAt, fileMeta?.mimeType, fileMeta?.sizeBytes, context.mimeType]);

  // Realtime socket: join file room and apply remote updates
  React.useEffect(() => {
    if (!projectId || !fileId || isCliFile) return;

    const { socket, release } = acquireFileSocket();
    socketRef.current = { socket, release };

    const joinIfReady = async () => {
      if (joinedRef.current) return;
      if (!socket.connected) return;
      try {
        joinedRef.current = true;
        await socket.emitWithAck("file:join", { projectId, fileId, clientVersion: "1.0.0" });
        setSocketConnected(true);
      } catch (e) {
        console.warn("[CodeEditorPlugin] file:join failed:", e);
      }
    };

    const onConnect = () => {
      setSocketConnected(true);
      void joinIfReady();
    };
    const onDisconnect = () => {
      setSocketConnected(false);
      joinedRef.current = false;
    };

    const onRemoteUpdate = (payload: any) => {
      if (payload?.fileId !== fileId) return;
      const curKey = useFileContentStore.getState().getKey(projectId, fileId);
      const curEntry = useFileContentStore.getState().entries[curKey];
      if (curEntry?.isDirty) return;
      applyServerSnapshot({
        projectId,
        fileId,
        content: String(payload?.content ?? ""),
        updatedAt: String(payload?.updatedAt ?? ""),
        sizeBytes: typeof payload?.size === "number" ? payload.size : undefined,
        mimeType: curEntry?.mimeType,
      });
      updateFileMeta(fileId, {
        updatedAt: String(payload?.updatedAt ?? ""),
        size: typeof payload?.size === "number" ? payload.size : undefined,
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("file:content-updated", onRemoteUpdate);

    if (socket.connected) {
      void joinIfReady();
    }

    return () => {
      try {
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("file:content-updated", onRemoteUpdate);
        if (joinedRef.current) {
          void socket.emit("file:leave", { projectId, fileId });
        }
      } finally {
        joinedRef.current = false;
        setSocketConnected(false);
        socketRef.current = null;
        release();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fileId, isCliFile]);

  // Keep tab dirty state in sync
  React.useEffect(() => {
    setDirty(!!entry?.isDirty);
  }, [entry?.isDirty, setDirty]);

  const saveRealtime = React.useCallback(async () => {
    if (!projectId || !fileId || !entry) return;

    // Optimistically mark saving so UI feels Overleaf-like.
    try {
      const k = useFileContentStore.getState().getKey(projectId, fileId);
      useFileContentStore.setState((s) => {
        const cur = s.entries[k];
        if (!cur) return s;
        return {
          entries: {
            ...s.entries,
            [k]: { ...cur, saveState: "saving", saveError: undefined },
          },
        };
      });
    } catch {
      // ignore
    }

    const socket = socketRef.current?.socket;
    if (!isCliFile && socket && socket.connected && joinedRef.current) {
      try {
        const resp = await socket.emitWithAck<{ accepted: true; updatedAt: string; size?: number; checksum?: string }>(
          "file:update-content",
          { projectId, fileId, content: entry.content }
        );
        if ("error" in resp) {
          throw new Error(resp.error.message);
        }
        applyServerSnapshot({
          projectId,
          fileId,
          content: entry.content,
          updatedAt: resp.data.updatedAt,
          sizeBytes: typeof resp.data.size === "number" ? resp.data.size : entry.sizeBytes,
          mimeType: entry.mimeType,
        });
        if (!isCliFile) {
          updateFileMeta(fileId, {
            updatedAt: resp.data.updatedAt,
            size: typeof resp.data.size === "number" ? resp.data.size : undefined,
            mimeType: entry.mimeType,
          });
        }
        return;
      } catch (e) {
        console.warn("[CodeEditorPlugin] realtime save failed, fallback to HTTP:", e);
      }
    }

    const saved = await saveHttp({ projectId, fileId });
    if (!isCliFile && saved.updatedAt) {
      updateFileMeta(fileId, { updatedAt: saved.updatedAt, size: saved.sizeBytes, mimeType: saved.mimeType });
    }
  }, [applyServerSnapshot, entry, fileId, isCliFile, projectId, saveHttp, updateFileMeta]);

  // Autosave (debounced)
  useDebouncedEffect(
    () => {
      if (!projectId || !fileId || !entry?.isDirty) return;
      if (entry.saveState === "saving") return;
      void saveRealtime();
    },
    [projectId, fileId, entry?.content, entry?.isDirty],
    650
  );

  // Keyboard shortcut: Ctrl/Cmd+S
  React.useEffect(() => {
    if (!projectId || !fileId) return;
    const handler = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (!isSave) return;
      e.preventDefault();
      void saveRealtime();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [projectId, fileId, saveRealtime]);

  const statusLabel = React.useMemo(() => {
    if (!entry) return "";
    if (entry.saveState === "saving") return "Saving…";
    if (entry.saveState === "error") return entry.saveError || "Save failed";
    if (entry.isDirty) return "Unsaved";
    return "Saved";
  }, [entry]);

  const canSave = !!projectId && !!fileId && !!entry && !loading;
  const canFormatJson = language === "json";

  const runFormat = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      await editor.getAction("editor.action.formatDocument").run();
    } catch (e) {
      console.warn("[CodeEditorPlugin] Format failed:", e);
    }
  };

  const handleReload = React.useCallback(async () => {
    if (!projectId || !fileId) return;
    if (entry?.isDirty) {
      const confirmed = window.confirm("Discard unsaved changes and reload from server?");
      if (!confirmed) return;
    }
    const node = useFileTreeStore.getState().findNode(fileId);
    const updatedAt = node?.updatedAt ?? fileMeta?.updatedAt;
    const sizeBytes = node?.size ?? fileMeta?.sizeBytes;
    const mimeType = node?.mimeType ?? context.mimeType ?? fileMeta?.mimeType;
    try {
      await reloadFile({
        projectId,
        fileId,
        updatedAt,
        sizeBytes,
        mimeType,
        ignoreDirty: true,
      });
    } catch (e) {
      console.warn("[CodeEditorPlugin] Reload failed:", e);
    }
  }, [
    projectId,
    fileId,
    entry?.isDirty,
    fileMeta?.updatedAt,
    fileMeta?.sizeBytes,
    fileMeta?.mimeType,
    context.mimeType,
    reloadFile,
  ]);

  React.useEffect(() => {
    if (!diffEvent?.diff) return;
    if (!projectId || !fileId) return;
    if (diffEvent.changeType === "delete") return;
    if (entry?.isDirty) return;
    void reloadFile({
      projectId,
      fileId,
      mimeType: context.mimeType ?? fileMeta?.mimeType,
      sizeBytes: fileMeta?.sizeBytes,
      updatedAt: fileMeta?.updatedAt,
      ignoreDirty: true,
    });
  }, [
    diffEvent,
    entry?.isDirty,
    projectId,
    fileId,
    context.mimeType,
    fileMeta?.mimeType,
    fileMeta?.sizeBytes,
    fileMeta?.updatedAt,
    reloadFile,
  ]);

  if (!projectId || !fileId) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        No file selected.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-white/60 backdrop-blur dark:bg-black/30">
        <div className="min-w-0 flex items-center gap-2">
          <div className="truncate text-sm font-medium">{fileName}</div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-black/[0.06] dark:bg-white/[0.08] text-muted-foreground uppercase">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs",
              entry?.saveState === "error" ? "text-red-600" : "text-muted-foreground"
            )}
            title={entry?.saveError}
          >
            {statusLabel}
            {!isCliFile && !socketConnected ? " (offline)" : ""}
          </span>

          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md",
              "border border-black/10 bg-white hover:bg-black/[0.03]",
              "dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
              !canSave && "opacity-60 pointer-events-none"
            )}
            onClick={() => void saveRealtime()}
            title="Save (Ctrl/Cmd+S)"
          >
            {entry?.saveState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>

          {canFormatJson ? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md",
                "border border-black/10 bg-white hover:bg-black/[0.03]",
                "dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
              )}
              onClick={runFormat}
              title="Format JSON"
            >
              <Braces className="h-3.5 w-3.5" />
              Format
            </button>
          ) : null}

          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md",
              "border border-black/10 bg-white hover:bg-black/[0.03]",
              "dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
            )}
            onClick={() => void handleReload()}
            title="Reload from cache/server"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative flex-1 min-h-0">
        {diffEvent?.diff ? (
          <FileDiffPanel
            diff={diffEvent.diff}
            changeType={diffEvent.changeType}
            title="AI change"
            subtitle={fileName}
            onClose={clearDiff}
            className="absolute right-4 top-4 z-10 w-[min(420px,46vw)]"
          />
        ) : null}
        {loading && !entry ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <MonacoEditor
            height="100%"
            language={language}
            theme={isDark ? "vs-dark" : "vs"}
            value={entry?.content ?? ""}
            beforeMount={(monaco) => {
              try {
                monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                  validate: true,
                  allowComments: true,
                  trailingCommas: "ignore",
                });
              } catch {
                // ignore
              }
            }}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            onChange={(val) => {
              setContent({ projectId, fileId, content: val ?? "" });
            }}
            options={{
              automaticLayout: true,
              minimap: { enabled: false },
              fontFamily: '"Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 13,
              wordWrap: "off",
              scrollBeyondLastLine: false,
              renderWhitespace: "selection",
              tabSize: 2,
              insertSpaces: true,
            }}
          />
        )}
      </div>
    </div>
  );
}
