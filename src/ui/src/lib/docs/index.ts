export type {
  DocsNodeType,
  DocsNode,
  DocsDirNode,
  DocsFileNode,
  DocsIndexStats,
  DocsIndexResponse,
  DocsSearchResult,
  DocsSearchResponse,
  MarkdownHeading,
} from './types'

export {
  API_BASE,
  encodePathSegments,
  fetchDocsIndex,
  searchDocs,
  fetchDocContent,
  getDocAssetUrl,
} from './api'
