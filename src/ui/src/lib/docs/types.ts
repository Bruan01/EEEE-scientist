export type DocsNodeType = 'dir' | 'file'

export type DocsNode = DocsDirNode | DocsFileNode

export interface DocsDirNode {
  type: 'dir'
  name: string
  path: string
  children?: DocsNode[]
}

export interface DocsFileNode {
  type: 'file'
  name: string
  path: string
  title?: string | null
  file_path: string
}

export interface DocsIndexStats {
  built_at: string
  doc_count: number
  dir_count: number
}

export interface DocsIndexResponse {
  root: DocsDirNode
  stats: DocsIndexStats
}

export interface DocsSearchResult {
  path: string
  title: string
  file_path: string
  snippet?: string | null
}

export interface DocsSearchResponse {
  results: DocsSearchResult[]
  total: number
}

export interface MarkdownHeading {
  id: string
  text: string
  level: number
}
