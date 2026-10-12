/**
 * ArXiv API Client
 */
import { apiClient } from "./client";
import { buildDemoArxivList } from "@/demo/arxiv";
import { isDemoProjectId } from "@/demo/projects";
import { supportsArxiv } from "@/lib/runtime/quest-runtime";
import type {
  ArxivListResponse,
  ArxivImportResponse,
  ArxivBatchImportResponse,
} from "@/lib/types/arxiv";

const ARXIV_BASE = "/api/v1/arxiv";

export async function importArxiv(
  projectId: string,
  arxivId: string,
  tags?: string[]
): Promise<ArxivImportResponse> {
  if (isDemoProjectId(projectId)) {
    return {
      status: "demo",
      file_id: "",
      arxiv_id: arxivId,
    };
  }
  if (!supportsArxiv()) {
    return {
      status: "disabled",
      file_id: "",
      arxiv_id: arxivId,
    };
  }
  const payload: { project_id: string; arxiv_id: string; tags?: string[] } = {
    project_id: projectId,
    arxiv_id: arxivId,
  };
  if (tags) {
    payload.tags = tags;
  }
  const response = await apiClient.post<ArxivImportResponse>(`${ARXIV_BASE}/import`, payload);
  return response.data;
}

export async function batchImportArxiv(
  projectId: string,
  arxivIds: string[],
  tags?: string[]
): Promise<ArxivBatchImportResponse> {
  if (isDemoProjectId(projectId)) {
    return {
      status: "demo",
      tasks: arxivIds.map((arxiv_id) => ({ arxiv_id, status: "demo" })),
    };
  }
  if (!supportsArxiv()) {
    return {
      status: "disabled",
      tasks: arxivIds.map((arxiv_id) => ({ arxiv_id, status: "disabled" })),
    };
  }
  const payload: { project_id: string; arxiv_ids: string[]; tags?: string[] } = {
    project_id: projectId,
    arxiv_ids: arxivIds,
  };
  if (tags) {
    payload.tags = tags;
  }
  const response = await apiClient.post<ArxivBatchImportResponse>(
    `${ARXIV_BASE}/batch-import`,
    payload
  );
  return response.data;
}

export async function listArxiv(projectId: string): Promise<ArxivListResponse> {
  if (isDemoProjectId(projectId)) {
    return buildDemoArxivList(projectId);
  }
  if (!supportsArxiv()) {
    return { items: [] };
  }
  const response = await apiClient.get<ArxivListResponse>(`${ARXIV_BASE}/list`, {
    params: { project_id: projectId },
  });
  return response.data;
}
