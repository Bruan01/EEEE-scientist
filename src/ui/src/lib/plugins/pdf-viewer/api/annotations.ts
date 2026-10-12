/**
 * Annotations API Client
 *
 * API client for PDF annotation CRUD operations.
 *
 * @module plugins/pdf-viewer/api/annotations
 */

import { apiClient } from "@/lib/api/client";
import type {
  Annotation,
  CreateAnnotationRequest,
  UpdateAnnotationRequest,
  AnnotationListResponse,
} from "../types";

type RawAnnotation = any;

function toAnnotation(raw: RawAnnotation): Annotation {
  const position = raw.position
    ? {
        ...raw.position,
        boundingRect: {
          ...raw.position.boundingRect,
          width: raw.position.boundingRect?.width ?? 100,
          height: raw.position.boundingRect?.height ?? 100,
        },
        rects: Array.isArray(raw.position.rects)
          ? raw.position.rects.map((r: any) => ({
              ...r,
              width: r?.width ?? 100,
              height: r?.height ?? 100,
            }))
          : [],
      }
    : undefined;
  const content = raw.content;
  return {
    id: String(raw.id),
    position,
    content,
    comment: String(raw.comment ?? ""),
    kind: (raw.kind === "question" || raw.kind === "task" ? raw.kind : "note"),
    color: String(raw.color ?? "#F1E9D0"),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    createdBy: String(raw.created_by ?? raw.createdBy ?? ""),
    author: raw.author
      ? {
          id: String(raw.author.id),
          handle: String(raw.author.handle ?? "user"),
          color: String(raw.author.color ?? "#F1E9D0"),
        }
      : null,
    createdAt: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? new Date().toISOString()),
    fileId: String(raw.file_id ?? raw.fileId ?? ""),
    projectId: String(raw.project_id ?? raw.projectId ?? ""),
  };
}

function toCreatePayload(data: CreateAnnotationRequest) {
  return {
    file_id: data.fileId,
    position: data.position,
    content: data.content,
    comment: data.comment ?? "",
    kind: data.kind ?? "note",
    // backwards-compatible; server enforces author color
    color: data.color,
    tags: data.tags ?? [],
  };
}

function toUpdatePayload(data: UpdateAnnotationRequest) {
  return {
    comment: data.comment,
    kind: data.kind,
    position: data.position,
    content: data.content,
    // ignored by server
    color: data.color,
    tags: data.tags,
  };
}

/**
 * Annotations API endpoints
 */
const ENDPOINTS = {
  list: (fileId: string) => `/api/v1/annotations/file/${fileId}`,
  create: () => `/api/v1/annotations/`,
  get: (id: string) => `/api/v1/annotations/${id}`,
  update: (id: string) => `/api/v1/annotations/${id}`,
  delete: (id: string) => `/api/v1/annotations/${id}`,
  search: (projectId: string) => `/api/v1/annotations/project/${projectId}`,
} as const;

/**
 * Annotations API client
 */
export const annotationsApi = {
  /**
   * List annotations for a file
   *
   * @param fileId - File ID
   * @returns List of annotations
   */
  async listAnnotations(fileId: string): Promise<Annotation[]> {
    const response = await apiClient.get<AnnotationListResponse | Annotation[]>(
      ENDPOINTS.list(fileId)
    );

    // Handle both response formats
    if (Array.isArray(response.data)) {
      return response.data.map(toAnnotation);
    }
    return (response.data.items || []).map(toAnnotation);
  },

  /**
   * Create a new annotation
   *
   * @param data - Annotation data
   * @returns Created annotation
   */
  async createAnnotation(data: CreateAnnotationRequest): Promise<Annotation> {
    const response = await apiClient.post<RawAnnotation>(
      ENDPOINTS.create(),
      toCreatePayload(data)
    );
    return toAnnotation(response.data);
  },

  /**
   * Get a single annotation by ID
   *
   * @param id - Annotation ID
   * @returns Annotation data
   */
  async getAnnotation(id: string): Promise<Annotation> {
    const response = await apiClient.get<RawAnnotation>(ENDPOINTS.get(id));
    return toAnnotation(response.data);
  },

  /**
   * Update an annotation
   *
   * @param id - Annotation ID
   * @param data - Update data
   * @returns Updated annotation
   */
  async updateAnnotation(
    id: string,
    data: UpdateAnnotationRequest
  ): Promise<Annotation> {
    const response = await apiClient.patch<RawAnnotation>(
      ENDPOINTS.update(id),
      toUpdatePayload(data)
    );
    return toAnnotation(response.data);
  },

  /**
   * Delete an annotation
   *
   * @param id - Annotation ID
   */
  async deleteAnnotation(id: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.delete(id));
  },

  /**
   * Search annotations in a project
   *
   * @param projectId - Project ID
   * @param query - Search query
   * @param options - Search options
   * @returns Matching annotations
   */
  async searchAnnotations(
    projectId: string,
    query?: string,
    options?: {
      color?: string;
      tag?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<Annotation[]> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (options?.color) params.set("color", options.color);
    if (options?.tag) params.set("tag", options.tag);
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));

    const url = `${ENDPOINTS.search(projectId)}${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await apiClient.get<AnnotationListResponse | Annotation[]>(url);

    if (Array.isArray(response.data)) {
      return response.data.map(toAnnotation);
    }
    return (response.data.items || []).map(toAnnotation);
  },
};

/**
 * Export convenience functions
 */
export const listAnnotations = annotationsApi.listAnnotations;
export const createAnnotation = annotationsApi.createAnnotation;
export const getAnnotation = annotationsApi.getAnnotation;
export const updateAnnotation = annotationsApi.updateAnnotation;
export const deleteAnnotation = annotationsApi.deleteAnnotation;
export const searchAnnotations = annotationsApi.searchAnnotations;

export default annotationsApi;
