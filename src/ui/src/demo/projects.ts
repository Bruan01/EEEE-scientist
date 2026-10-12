export type DemoProjectConfig = {
  projectId: string
  scenarioId: string
  title: string
}

const DEMO_PROJECTS: Record<string, DemoProjectConfig> = {
  'demo-memory': {
    projectId: 'demo-memory',
    scenarioId: 'quickstart',
    title: 'Memory',
  },
}

export function resolveDemoProject(projectId: string | null | undefined): DemoProjectConfig | null {
  const normalized = String(projectId || '').trim()
  if (!normalized) return null
  return DEMO_PROJECTS[normalized] ?? null
}

export function isDemoProjectId(projectId: string | null | undefined) {
  return Boolean(resolveDemoProject(projectId))
}
