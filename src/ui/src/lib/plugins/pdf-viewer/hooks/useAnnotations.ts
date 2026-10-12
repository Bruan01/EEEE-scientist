/**
 * useAnnotations Hook
 *
 * TanStack Query-based hook for managing PDF annotation data
 * with optimistic updates for responsive UI.
 *
 * @module plugins/pdf-viewer/hooks/useAnnotations
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { annotationsApi } from "../api/annotations";
import type {
  Annotation,
  CreateAnnotationRequest,
  UpdateAnnotationRequest,
} from "../types";

/**
 * Query key factory for annotations
 */
export const annotationKeys = {
  all: ["annotations"] as const,
  lists: () => [...annotationKeys.all, "list"] as const,
  list: (fileId: string) => [...annotationKeys.lists(), fileId] as const,
  details: () => [...annotationKeys.all, "detail"] as const,
  detail: (id: string) => [...annotationKeys.details(), id] as const,
};

/**
 * Hook for managing annotations for a specific file
 *
 * @param fileId - File ID to load annotations for
 * @returns Annotation data and mutation functions
 */
export function useAnnotations(fileId: string) {
  const queryClient = useQueryClient();
  const queryKey = annotationKeys.list(fileId);

  // ============================================================
  // Query: Fetch annotations list
  // ============================================================

  const {
    data: annotations = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: () => annotationsApi.listAnnotations(fileId),
    staleTime: 30 * 1000, // 30 seconds cache
    enabled: !!fileId,
  });

  // ============================================================
  // Mutation: Create annotation
  // ============================================================

  const createMutation = useMutation({
    mutationFn: (data: CreateAnnotationRequest) =>
      annotationsApi.createAnnotation(data),

    onSuccess: (created) => {
      queryClient.setQueryData<Annotation[]>(queryKey, (old = []) => [
        created,
        ...old.filter((a) => a.id !== created.id),
      ]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  // ============================================================
  // Mutation: Update annotation
  // ============================================================

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateAnnotationRequest }) =>
      annotationsApi.updateAnnotation(id, updates),

    // Optimistic update
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousAnnotations = queryClient.getQueryData<Annotation[]>(queryKey);

      queryClient.setQueryData<Annotation[]>(queryKey, (old = []) =>
        old.map((annotation) =>
          annotation.id === id
            ? {
                ...annotation,
                ...updates,
                updatedAt: new Date().toISOString(),
              }
            : annotation
        )
      );

      return { previousAnnotations };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousAnnotations) {
        queryClient.setQueryData(queryKey, context.previousAnnotations);
      }
    },

    onSuccess: (updated) => {
      queryClient.setQueryData<Annotation[]>(queryKey, (old = []) =>
        old.map((a) => (a.id === updated.id ? updated : a))
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // ============================================================
  // Mutation: Delete annotation
  // ============================================================

  const deleteMutation = useMutation({
    mutationFn: (id: string) => annotationsApi.deleteAnnotation(id),

    // Optimistic update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });

      const previousAnnotations = queryClient.getQueryData<Annotation[]>(queryKey);

      queryClient.setQueryData<Annotation[]>(queryKey, (old = []) =>
        old.filter((annotation) => annotation.id !== id)
      );

      return { previousAnnotations };
    },

    onError: (_err, _id, context) => {
      if (context?.previousAnnotations) {
        queryClient.setQueryData(queryKey, context.previousAnnotations);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // ============================================================
  // Helper Functions
  // ============================================================

  /**
   * Create a new annotation
   */
  const createAnnotation = async (data: CreateAnnotationRequest): Promise<Annotation> => {
    return createMutation.mutateAsync(data);
  };

  /**
   * Update an existing annotation
   */
  const updateAnnotation = async (
    id: string,
    updates: UpdateAnnotationRequest
  ): Promise<Annotation> => {
    return updateMutation.mutateAsync({ id, updates });
  };

  /**
   * Delete an annotation
   */
  const deleteAnnotation = async (id: string): Promise<void> => {
    return deleteMutation.mutateAsync(id);
  };

  /**
   * Refresh the annotations list
   */
  const refreshAnnotations = () => {
    return refetch();
  };

  /**
   * Get annotation by ID from the cache
   */
  const getAnnotationById = (id: string): Annotation | undefined => {
    return annotations.find((a) => a.id === id);
  };

  /**
   * Get annotations for a specific page
   */
  const getAnnotationsByPage = (pageNumber: number): Annotation[] => {
    return annotations.filter((a) => a.position.pageNumber === pageNumber);
  };

  /**
   * Get annotations filtered by tag
   */
  const getAnnotationsByTag = (tag: string): Annotation[] => {
    return annotations.filter((a) => a.tags.includes(tag));
  };

  /**
   * Get annotations filtered by color
   */
  const getAnnotationsByColor = (color: string): Annotation[] => {
    return annotations.filter((a) => a.color === color);
  };

  /**
   * Get all unique tags from annotations
   */
  const getAllTags = (): string[] => {
    const tags = new Set<string>();
    annotations.forEach((a) => a.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  };

  // ============================================================
  // Return Value
  // ============================================================

  return {
    // Data
    annotations,
    isLoading,
    isFetching,
    error,

    // CRUD operations
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,

    // Refresh
    refreshAnnotations,

    // Query helpers
    getAnnotationById,
    getAnnotationsByPage,
    getAnnotationsByTag,
    getAnnotationsByColor,
    getAllTags,

    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    createError: createMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
  };
}

/**
 * Hook for a single annotation
 *
 * @param id - Annotation ID
 * @returns Annotation data and mutation functions
 */
export function useAnnotation(id: string) {
  const queryClient = useQueryClient();
  const queryKey = annotationKeys.detail(id);

  const { data: annotation, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => annotationsApi.getAnnotation(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: UpdateAnnotationRequest) =>
      annotationsApi.updateAnnotation(id, updates),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      // Also invalidate the list query
      queryClient.invalidateQueries({ queryKey: annotationKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => annotationsApi.deleteAnnotation(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: annotationKeys.lists() });
    },
  });

  return {
    annotation,
    isLoading,
    error,
    updateAnnotation: updateMutation.mutateAsync,
    deleteAnnotation: deleteMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export default useAnnotations;
