import type { AutoSaveStatus } from "../types";
import { ProjectSyncClient } from "./project-sync";
import { Doc, applyUpdate, encodeStateVector, mergeUpdates } from "yjs";

const REMOTE_ORIGIN = "ds-remote";

export type NovelYjsProviderOptions = {
  projectId: string;
  notebookId: string;
  readonly?: boolean;
  onStatus?: (status: AutoSaveStatus) => void;
  onReset?: (payload: { timestamp: number; reason?: string; actorUserId?: string | null }) => void;
};

export async function createNovelYjsProvider(options: NovelYjsProviderOptions): Promise<{
  ydoc: Doc;
  dispose: () => void;
}> {
  const { projectId, notebookId, readonly = false, onStatus, onReset } = options;
  const sync = new ProjectSyncClient(projectId, {
    authMode: "user",
    docKind: "notebook",
  });

  const ydoc = new Doc();
  let disposed = false;
  let flushTimer: number | null = null;
  let idleTimer: number | null = null;
  let pending: Uint8Array[] = [];

  const setStatus = (status: AutoSaveStatus) => {
    if (!onStatus) return;
    onStatus(status);
    if (status === "saved") {
      if (idleTimer != null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => onStatus("idle"), 1500);
    }
  };

  const scheduleFlush = () => {
    if (flushTimer != null) window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(() => void flush(), 250);
  };

  const flush = async () => {
    if (disposed || readonly || pending.length === 0) return;
    const updates = pending;
    pending = [];
    try {
      setStatus("saving");
      const merged = updates.length === 1 ? updates[0] : mergeUpdates(updates);
      await sync.pushDocUpdate(notebookId, merged);
      setStatus("saved");
    } catch (error) {
      console.error("[NovelYjsProvider] Failed to push update:", error);
      setStatus("error");
    }
  };

  await sync.connect();

  const diff = await sync.loadDoc(notebookId, encodeStateVector(ydoc));
  if (diff?.missing) {
    applyUpdate(ydoc, diff.missing, REMOTE_ORIGIN);
  }

  const offRemote = sync.onDocUpdate((msg) => {
    if (msg.docId !== notebookId) return;
    applyUpdate(ydoc, msg.update, REMOTE_ORIGIN);
  });

  const offReset = sync.onDocReset((msg) => {
    if (msg.docId !== notebookId) return;
    onReset?.({ timestamp: msg.timestamp, reason: msg.reason, actorUserId: msg.actorUserId ?? null });
  });

  const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return;
    if (readonly) return;
    pending.push(update);
    scheduleFlush();
  };

  ydoc.on("update", onLocalUpdate);

  const dispose = () => {
    disposed = true;
    if (flushTimer != null) window.clearTimeout(flushTimer);
    if (idleTimer != null) window.clearTimeout(idleTimer);
    ydoc.off("update", onLocalUpdate);
    offRemote?.();
    offReset?.();
    sync.disconnect();
  };

  return { ydoc, dispose };
}
