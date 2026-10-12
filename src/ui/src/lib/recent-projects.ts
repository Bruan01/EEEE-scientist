'use client'

export const RECENT_PROJECTS_KEY = 'deepscientist:recent_projects'
export const MAX_RECENT_PROJECTS = 6

export interface RecentProject {
  id: string
  name: string
  lastOpenedAt: number
  accentColor?: string
}

export function getRecentProjects(): RecentProject[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY)
    const data = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(data)) return []
    return data
      .map((item) => item as Partial<RecentProject>)
      .filter((item): item is RecentProject =>
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.lastOpenedAt === 'number'
      )
  } catch {
    return []
  }
}

export function setRecentProjects(projects: RecentProject[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects.slice(0, MAX_RECENT_PROJECTS)))
  } catch {
    // ignore storage errors
  }
}

export function addRecentProject(project: { id: string; name: string; accentColor?: string }): void {
  if (typeof window === 'undefined') return
  const previous = getRecentProjects().filter((p) => p.id !== project.id)
  const next: RecentProject[] = [
    {
      id: project.id,
      name: project.name,
      lastOpenedAt: Date.now(),
      accentColor: project.accentColor,
    },
    ...previous,
  ]
  setRecentProjects(next)
}

export function removeRecentProject(projectId: string): void {
  setRecentProjects(getRecentProjects().filter((p) => p.id !== projectId))
}

export function clearRecentProjects(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(RECENT_PROJECTS_KEY)
  } catch {
    // ignore storage errors
  }
}

