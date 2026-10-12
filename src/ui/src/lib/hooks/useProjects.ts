'use client';

/**
 * Projects React Query Hooks
 *
 * TanStack React Query hooks for project data management.
 * Provides CRUD operations and recent projects localStorage management.
 *
 * @module hooks/useProjects
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  type Project,
  type ProjectMember,
  type CreateProjectRequest,
  type UpdateProjectRequest,
} from '@/lib/api/projects';
import { addRecentProject, removeRecentProject } from '@/lib/recent-projects';
import { useAgentRegistryStore } from '@/lib/stores/agent-registry';

// ============================================================================
// Query Keys
// ============================================================================

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  members: (projectId: string) => [...projectKeys.detail(projectId), 'members'] as const,
};

interface UseProjectsOptions {
  enabled?: boolean;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch all projects for the current user
 */
export function useProjects(options?: UseProjectsOptions) {
  const setAgentsForProject = useAgentRegistryStore((state) => state.setAgentsForProject);
  const query = useQuery<Project[]>({
    queryKey: projectKeys.lists(),
    queryFn: async () => {
      const response = await listProjects();
      // Backend returns 'items' not 'projects'
      return response.items || [];
    },
    enabled: options?.enabled ?? true,
  });

  useEffect(() => {
    if (!query.data) return;
    query.data.forEach((project) => {
      setAgentsForProject(project.id, project.agents ?? []);
    });
  }, [query.data, setAgentsForProject]);

  return query;
}

/**
 * Hook to fetch a single project by ID
 */
export function useProject(projectId?: string, options?: { enabled?: boolean }) {
  const setAgentsForProject = useAgentRegistryStore((state) => state.setAgentsForProject);
  const query = useQuery<Project>({
    queryKey: projectKeys.detail(projectId ?? "unknown"),
    queryFn: async () => {
      if (!projectId) {
        throw new Error("Missing projectId");
      }
      return getProject(projectId);
    },
    enabled: options?.enabled ?? Boolean(projectId),
  });

  useEffect(() => {
    if (!query.data) return;
    setAgentsForProject(query.data.id, query.data.agents ?? []);
  }, [query.data, setAgentsForProject]);

  return query;
}

/**
 * Extended CreateProjectRequest with settings support
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
  is_public?: boolean;
  settings?: {
    template?: 'blank' | 'literature' | 'experiment' | 'dataset' | 'ml' | 'notes';
    accentColor?: string;
    [key: string]: unknown;
  };
}

/**
 * Hook to create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const request: CreateProjectRequest = {
        name: input.name,
        description: input.description,
        is_public: input.is_public,
        settings: input.settings,
      };
      return createProject(request);
    },
    onSuccess: (newProject) => {
      // Invalidate and refetch projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      // Add to recent projects
      addRecentProject({
        id: newProject.id,
        name: newProject.name,
        accentColor: (newProject.settings as Record<string, unknown>)?.accentColor as string | undefined,
      });
    },
  });
}

/**
 * Extended UpdateProjectRequest with settings support
 */
export interface UpdateProjectInput {
  name?: string;
  description?: string;
  is_public?: boolean;
  settings?: {
    template?: 'blank' | 'literature' | 'experiment' | 'dataset' | 'ml' | 'notes';
    accentColor?: string;
    [key: string]: unknown;
  };
}

/**
 * Hook to update an existing project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: UpdateProjectInput;
    }) => {
      const request: UpdateProjectRequest = {
        name: data.name,
        description: data.description,
        is_public: data.is_public,
        settings: data.settings,
      };
      return updateProject(projectId, request);
    },
    onSuccess: (updatedProject) => {
      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      // Update specific project cache
      queryClient.setQueryData(
        projectKeys.detail(updatedProject.id),
        updatedProject
      );
    },
  });
}

/**
 * Hook to delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      await deleteProject(projectId);
      return projectId;
    },
    onSuccess: (deletedProjectId) => {
      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      // Remove from cache
      queryClient.removeQueries({
        queryKey: projectKeys.detail(deletedProjectId),
      });
      // Remove from recent projects
      removeRecentProject(deletedProjectId);
    },
  });
}

// ============================================================================
// Project Members Hooks
// ============================================================================

/**
 * Hook to list project members
 */
export function useProjectMembers(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: async () => {
      const members = await listProjectMembers(projectId);
      return { items: members };
    },
    enabled: options?.enabled ?? !!projectId,
  });
}

/**
 * Hook to add a project member
 */
export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { user_id: string; role: ProjectMember['role'] }) => {
      return addProjectMember(projectId, data.user_id, data.role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
    },
  });
}

/**
 * Hook to update a project member's role
 */
export function useUpdateProjectMemberRole(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: { role: ProjectMember['role'] };
    }) => {
      return updateProjectMemberRole(projectId, userId, data.role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
    },
  });
}

/**
 * Hook to remove a project member
 */
export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      await removeProjectMember(projectId, userId);
      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
    },
  });
}

// ============================================================================
// Re-export types
// ============================================================================

export type { Project, ProjectListResponse } from '@/lib/api/projects';
