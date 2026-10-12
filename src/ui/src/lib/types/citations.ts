export type CitationPayload = {
  id?: string | number
  index?: number
  source?: string
  file_id?: string
  file_path?: string
  file_name?: string
  page?: number
  line_start?: number
  line_end?: number
  line?: number
  range?: string
  quote?: string
  bbox?: Record<string, unknown>
}

export type NormalizedCitation = {
  key: string
  index?: number
  source?: string
  fileId?: string
  filePath?: string
  fileName?: string
  page?: number
  lineStart?: number
  lineEnd?: number
  range?: string
  quote?: string
  bbox?: Record<string, unknown>
  label?: string
}
