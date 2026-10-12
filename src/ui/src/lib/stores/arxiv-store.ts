"use client";

import { create } from "zustand";
import * as arxivApi from "@/lib/api/arxiv";
import { buildQuestFileIdFromDocument } from "@/lib/api/quest-files";
import type {
  ArxivItemResponse,
  ArxivBatchImportResponse,
  ArxivImportResponse,
  ArxivPaper,
} from "@/lib/types/arxiv";

export interface ArxivBatchProgress {
  completed: number;
  total: number;
  currentArxivId?: string;
}

interface ArxivStoreState {
  items: ArxivPaper[];
  isLoading: boolean;
  error: string | null;
  projectId: string | null;
  importingIds: Set<string>;
  errors: Record<string, string>;
  processingSince: Record<string, number>;
  batchProgress: ArxivBatchProgress | null;
  selectedPaperKey: string | null;
  pendingOpenArxivId: string | null;
}

interface ArxivStoreActions {
  load: (projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
  importArxiv: (arxivId: string) => Promise<{ ok: boolean; arxivId: string; status?: string; title?: string; message?: string; metadataPending?: boolean; absUrl?: string }>;
  batchImport: (arxivIds: string[]) => Promise<void>;
  markImported: (arxivId: string) => void;
  markFailed: (arxivId: string, error: string) => void;
  removeArxiv: (arxivId: string, fileId?: string | null) => void;
  setBatchProgress: (progress: ArxivBatchProgress | null) => void;
  setSelectedPaperKey: (key: string | null) => void;
  setPendingOpenArxivId: (arxivId: string | null) => void;
}

function toPaper(projectId: string, item: ArxivItemResponse): ArxivPaper {
  const documentId = typeof item.document_id === "string" && item.document_id.trim() ? item.document_id.trim() : null;
  const path = typeof item.path === "string" && item.path.trim() ? item.path.trim() : null;
  const fileId =
    documentId && path ? buildQuestFileIdFromDocument(projectId, documentId, path) : String(item.file_id || "");
  return {
    fileId,
    documentId,
    path,
    arxivId: item.arxiv_id,
    metadataStatus: item.metadata_status ?? null,
    title: item.title,
    authors: item.authors ?? [],
    abstract: item.abstract ?? "",
    overview: item.overview ?? "",
    overviewMarkdown: item.overview_markdown ?? "",
    summarySource: item.summary_source ?? null,
    overviewSource: item.overview_source ?? null,
    metadataSource: item.metadata_source ?? null,
    categories: item.categories ?? [],
    tags: item.tags ?? [],
    publishedAt: item.published_at ?? "",
    primaryClass: item.primary_class ?? null,
    bibtex: item.bibtex ?? null,
    absUrl: item.abs_url ?? null,
    pdfUrl: item.pdf_url ?? null,
    displayName: item.display_name ?? item.arxiv_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    status: item.status ?? "ready",
    error: item.error ?? null,
    version: item.version,
  };
}

function parseErrorCode(error: unknown): string {
  const err = error as { response?: { data?: { detail?: string; message?: string } } };
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    (error instanceof Error ? error.message : "import_failed")
  );
}

const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

export const useArxivStore = create<ArxivStoreState & ArxivStoreActions>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,
  projectId: null,
  importingIds: new Set(),
  errors: {},
  processingSince: {},
  batchProgress: null,
  selectedPaperKey: null,
  pendingOpenArxivId: null,

  load: async (projectId: string) => {
    set({
      projectId,
      isLoading: true,
      error: null,
      items: [],
      importingIds: new Set(),
      errors: {},
      processingSince: {},
      batchProgress: null,
      selectedPaperKey: null,
      pendingOpenArxivId: null,
    });
    try {
      const response = await arxivApi.listArxiv(projectId);
      console.log("[ArxivStore] Loaded items from API:", response.items);
      const papers = response.items.map((item) => toPaper(projectId, item));
      console.log("[ArxivStore] Converted papers:", papers);
      const now = Date.now();
      const processingSince: Record<string, number> = {};
      papers.forEach((paper) => {
        if (paper.status === "processing") {
          processingSince[paper.arxivId] = now;
        }
      });
      set({ items: papers, isLoading: false, processingSince });
    } catch (error) {
      console.error("[ArxivStore] Failed to load:", error);
      set({ error: parseErrorCode(error), isLoading: false });
    }
  },

  refresh: async () => {
    const projectId = get().projectId;
    if (!projectId) return;
    set({ isLoading: true, error: null });
    try {
      const response = await arxivApi.listArxiv(projectId);
      const now = Date.now();
      const papers = response.items.map((item) => toPaper(projectId, item));
      set((state) => {
        const nextImporting = new Set(state.importingIds);
        const nextErrors = { ...state.errors };
        const nextProcessing = { ...state.processingSince };
        const paperIds = new Set<string>();

        papers.forEach((paper) => {
          paperIds.add(paper.arxivId);
          if (paper.status === "processing") {
            if (!nextProcessing[paper.arxivId]) {
              nextProcessing[paper.arxivId] = now;
            }
          } else {
            delete nextProcessing[paper.arxivId];
          }
        });

        Object.keys(nextProcessing).forEach((id) => {
          if (!paperIds.has(id) && !nextImporting.has(id)) {
            delete nextProcessing[id];
          }
        });

        const expiredIds = Object.entries(nextProcessing)
          .filter(([, ts]) => now - ts > PROCESSING_TIMEOUT_MS)
          .map(([id]) => id);

        if (expiredIds.length) {
          expiredIds.forEach((id) => {
            nextErrors[id] = "timeout";
            nextImporting.delete(id);
            delete nextProcessing[id];
          });
        }

        const expiredSet = new Set(expiredIds);
        const nextItems = papers.map((paper) =>
          expiredSet.has(paper.arxivId) ? { ...paper, status: "failed" } : paper
        );

        return {
          items: nextItems,
          isLoading: false,
          errors: nextErrors,
          importingIds: nextImporting,
          processingSince: nextProcessing,
        };
      });
    } catch (error) {
      set({ error: parseErrorCode(error), isLoading: false });
    }
  },

  importArxiv: async (arxivId: string) => {
    const projectId = get().projectId;
    if (!projectId) {
      set({ error: "missing_project" });
      return { ok: false, arxivId, message: "missing_project" };
    }

    set((state) => {
      const next = new Set(state.importingIds);
      next.add(arxivId);
      const nextErrors = { ...state.errors };
      delete nextErrors[arxivId];
      const nextProcessing = { ...state.processingSince };
      if (!nextProcessing[arxivId]) {
        nextProcessing[arxivId] = Date.now();
      }
      return {
        importingIds: next,
        errors: nextErrors,
        processingSince: nextProcessing,
        pendingOpenArxivId: arxivId,
      };
    });

    try {
      const response: ArxivImportResponse = await arxivApi.importArxiv(projectId, arxivId);
      set((state) => {
        const next = new Set(state.importingIds);
        next.delete(arxivId);
        if (response.arxiv_id) {
          next.add(response.arxiv_id);
        }
        const nextProcessing = { ...state.processingSince };
        delete nextProcessing[arxivId];
        if (response.arxiv_id && !nextProcessing[response.arxiv_id]) {
          nextProcessing[response.arxiv_id] = Date.now();
        }
        return {
          importingIds: next,
          processingSince: nextProcessing,
          pendingOpenArxivId: response.arxiv_id || arxivId,
        };
      });
      await get().refresh();
      return {
        ok: true,
        arxivId: response.arxiv_id || arxivId,
        status: response.status,
        title: response.title,
        message: response.message,
        metadataPending: Boolean(response.metadata_pending),
        absUrl: response.abs_url,
      };
    } catch (error) {
      const code = parseErrorCode(error);
      set((state) => {
        const next = new Set(state.importingIds);
        next.delete(arxivId);
        const nextProcessing = { ...state.processingSince };
        delete nextProcessing[arxivId];
        return {
          importingIds: next,
          errors: { ...state.errors, [arxivId]: code },
          processingSince: nextProcessing,
          pendingOpenArxivId: state.pendingOpenArxivId === arxivId ? null : state.pendingOpenArxivId,
        };
      });
      return { ok: false, arxivId, message: code };
    }
  },

  batchImport: async (arxivIds: string[]) => {
    const projectId = get().projectId;
    if (!projectId) {
      set({ error: "missing_project" });
      return;
    }

    if (!arxivIds.length) {
      return;
    }

    set((state) => {
      const next = new Set(state.importingIds);
      arxivIds.forEach((id) => next.add(id));
      const nextProcessing = { ...state.processingSince };
      const now = Date.now();
      arxivIds.forEach((id) => {
        if (!nextProcessing[id]) {
          nextProcessing[id] = now;
        }
      });
      return { importingIds: next, processingSince: nextProcessing };
    });

    try {
      const response: ArxivBatchImportResponse = await arxivApi.batchImportArxiv(
        projectId,
        arxivIds
      );

      set((state) => {
        const next = new Set(state.importingIds);
        arxivIds.forEach((id) => next.delete(id));
        const nextErrors = { ...state.errors };
        const nextProcessing = { ...state.processingSince };

        response.tasks.forEach((task) => {
          if (task.status === "queued") {
            next.add(task.arxiv_id);
          } else if (task.status === "failed") {
            nextErrors[task.arxiv_id] = task.error || "import_failed";
            delete nextProcessing[task.arxiv_id];
          }
        });

        return { importingIds: next, errors: nextErrors, processingSince: nextProcessing };
      });

      await get().refresh();
    } catch (error) {
      const code = parseErrorCode(error);
      set((state) => {
        const next = new Set(state.importingIds);
        arxivIds.forEach((id) => next.delete(id));
        const nextProcessing = { ...state.processingSince };
        arxivIds.forEach((id) => {
          delete nextProcessing[id];
        });
        return {
          importingIds: next,
          errors: { ...state.errors, batch: code },
          processingSince: nextProcessing,
        };
      });
    }
  },

  markImported: (arxivId: string) => {
    set((state) => {
      const next = new Set(state.importingIds);
      next.delete(arxivId);
      const nextErrors = { ...state.errors };
      delete nextErrors[arxivId];
      const nextProcessing = { ...state.processingSince };
      delete nextProcessing[arxivId];
      return { importingIds: next, errors: nextErrors, processingSince: nextProcessing };
    });
  },

  markFailed: (arxivId: string, error: string) => {
    set((state) => {
      const next = new Set(state.importingIds);
      next.delete(arxivId);
      const nextProcessing = { ...state.processingSince };
      delete nextProcessing[arxivId];
      return {
        importingIds: next,
        errors: { ...state.errors, [arxivId]: error },
        processingSince: nextProcessing,
        pendingOpenArxivId: state.pendingOpenArxivId === arxivId ? null : state.pendingOpenArxivId,
      };
    });
  },

  removeArxiv: (arxivId: string, fileId?: string | null) => {
    set((state) => {
      const nextImporting = new Set(state.importingIds);
      if (arxivId) {
        nextImporting.delete(arxivId);
      }
      const nextErrors = { ...state.errors };
      if (arxivId) {
        delete nextErrors[arxivId];
      }
      const nextProcessing = { ...state.processingSince };
      if (arxivId) {
        delete nextProcessing[arxivId];
      }

      const nextItems = state.items.filter((item) => {
        if (fileId && item.fileId === fileId) return false;
        if (arxivId && item.arxivId === arxivId) return false;
        return true;
      });

      const selected = state.selectedPaperKey;
      const shouldClear =
        (arxivId && selected === arxivId) || (fileId && selected === fileId);

      return {
        items: nextItems,
        importingIds: nextImporting,
        errors: nextErrors,
        processingSince: nextProcessing,
        selectedPaperKey: shouldClear ? null : selected,
        pendingOpenArxivId:
          arxivId && state.pendingOpenArxivId === arxivId ? null : state.pendingOpenArxivId,
      };
    });
  },

  setBatchProgress: (progress) => {
    set({ batchProgress: progress });
  },
  setSelectedPaperKey: (key) => {
    set({ selectedPaperKey: key });
  },
  setPendingOpenArxivId: (arxivId) => {
    set({ pendingOpenArxivId: arxivId });
  },
}));
