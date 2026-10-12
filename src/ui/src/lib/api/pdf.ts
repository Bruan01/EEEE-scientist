import { apiClient } from '@/lib/api/client'

export interface PdfParseStatus {
  status: 'processing' | 'ready' | 'failed'
  file_id: string
  phase?: string
  progress?: number
  updated_at?: string
  page_count?: number
  error?: string
}

export interface PdfInfoResponse {
  page_count?: number
  parse_status?: string
  line_cache_status?: string
}

export async function requestPdfParse(fileId: string, force?: boolean): Promise<PdfParseStatus> {
  const response = await apiClient.post(`/api/v1/pdf/parse/${fileId}`, null, {
    params: force ? { force: true } : undefined,
  })
  return response.data as PdfParseStatus
}

export async function getPdfInfo(fileId: string): Promise<PdfInfoResponse> {
  const response = await apiClient.get(`/api/v1/pdf/info/${fileId}`)
  return response.data as PdfInfoResponse
}

export async function getPdfMarkdownPreview(fileId: string, maxChars?: number): Promise<string> {
  const response = await apiClient.get(`/api/v1/pdf/markdown/${fileId}`, {
    params: maxChars ? { max_chars: maxChars } : undefined,
    responseType: 'text',
  })
  return response.data as string
}
