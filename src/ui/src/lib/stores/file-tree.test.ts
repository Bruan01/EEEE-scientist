import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FileAPIResponse, FileTreeResponse } from "@/lib/types/file";
import { transformToFileNode } from "@/lib/types/file";
import { useFileTreeStore } from "./file-tree";
import * as fileApi from "@/lib/api/files";

vi.mock("@/lib/api/files", () => ({
  getFileTree: vi.fn(),
  uploadFileAuto: vi.fn(),
}));

vi.mock("@/lib/api/latex", () => ({}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function resetFileTreeStore() {
  useFileTreeStore.setState({
    nodes: [],
    expandedIds: new Set(),
    selectedIds: new Set(),
    focusedId: null,
    renamingId: null,
    isLoading: false,
    error: null,
    projectId: null,
    clipboard: null,
    uploadTasks: [],
    transferTasks: [],
    highlightedFileId: null,
    readingFileIds: new Set(),
    writingFileIds: new Set(),
    movedFileIds: new Set(),
    renamedFileIds: new Set(),
  });
}

function makeFolderResponse(
  overrides: Partial<FileAPIResponse> = {}
): FileAPIResponse {
  return {
    id: "quest-dir::046::literature",
    name: "literature",
    type: "folder",
    parent_id: null,
    path: "literature",
    created_at: "2026-04-06T00:00:00Z",
    updated_at: "2026-04-06T00:00:00Z",
    ...overrides,
  };
}

function makeFileResponse(
  overrides: Partial<FileAPIResponse> = {}
): FileAPIResponse {
  return {
    id: "quest-file::046::path%3A%3Aliterature%2Fnew.txt::literature%2Fnew.txt",
    name: "new.txt",
    type: "file",
    parent_id: "quest-dir::046::literature",
    path: "literature/new.txt",
    size: 11,
    mime_type: "text/plain",
    created_at: "2026-04-06T00:00:00Z",
    updated_at: "2026-04-06T00:00:00Z",
    ...overrides,
  };
}

describe("file-tree store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFileTreeStore();
  });

  it("ignores stale load results that finish after a newer refresh", async () => {
    const older = deferred<FileTreeResponse>();
    const newer = deferred<FileTreeResponse>();
    const getFileTreeMock = vi.mocked(fileApi.getFileTree);

    getFileTreeMock
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);

    const firstLoad = useFileTreeStore.getState().loadFiles("046");
    const secondLoad = useFileTreeStore.getState().loadFiles("046", {
      force: true,
    });

    newer.resolve({
      files: [makeFileResponse({ name: "fresh.txt", path: "fresh.txt", parent_id: null })],
      total: 1,
    });
    await secondLoad;

    expect(useFileTreeStore.getState().nodes.map((node) => node.name)).toEqual([
      "fresh.txt",
    ]);
    expect(useFileTreeStore.getState().isLoading).toBe(false);

    older.resolve({
      files: [makeFileResponse({ name: "stale.txt", path: "stale.txt", parent_id: null })],
      total: 1,
    });
    await firstLoad;

    expect(useFileTreeStore.getState().nodes.map((node) => node.name)).toEqual([
      "fresh.txt",
    ]);
    expect(useFileTreeStore.getState().error).toBeNull();
  });

  it("inserts uploaded files immediately and expands the target folder before refresh finishes", async () => {
    const folder = makeFolderResponse();
    const uploaded = makeFileResponse();
    const refreshResult = deferred<FileTreeResponse>();
    const uploadFileAutoMock = vi.mocked(fileApi.uploadFileAuto);
    const getFileTreeMock = vi.mocked(fileApi.getFileTree);

    uploadFileAutoMock.mockResolvedValue(uploaded);
    getFileTreeMock.mockImplementation(() => refreshResult.promise);

    useFileTreeStore.setState({
      projectId: "046",
      nodes: [transformToFileNode(folder)],
    });

    const uploadPromise = useFileTreeStore
      .getState()
      .upload(folder.id, [new File(["hello world"], "new.txt", { type: "text/plain" })]);

    await vi.waitFor(() => {
      expect(
        useFileTreeStore.getState().findNodeByPath("literature/new.txt")?.id
      ).toBe(uploaded.id);
    });

    expect(useFileTreeStore.getState().expandedIds.has(folder.id)).toBe(true);

    refreshResult.resolve({
      files: [folder, uploaded],
      total: 2,
    });
    await uploadPromise;

    expect(
      useFileTreeStore.getState().findNodeByPath("literature/new.txt")?.id
    ).toBe(uploaded.id);
    expect(fileApi.getFileTree).toHaveBeenCalledTimes(1);
  });
});
