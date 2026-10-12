export interface ArxivItemResponse {
  file_id: string;
  document_id?: string | null;
  path?: string | null;
  arxiv_id: string;
  metadata_status?: string | null;
  title: string;
  authors: string[];
  abstract: string;
  overview?: string;
  overview_markdown?: string;
  summary_source?: string | null;
  overview_source?: string | null;
  metadata_source?: string | null;
  categories: string[];
  tags: string[];
  published_at: string;
  primary_class?: string | null;
  bibtex?: string | null;
  abs_url?: string | null;
  pdf_url?: string | null;
  display_name: string;
  created_at: string;
  updated_at?: string;
  status: string;
  error?: string | null;
  version?: number;
}

export interface ArxivPaper {
  fileId: string;
  documentId?: string | null;
  path?: string | null;
  arxivId: string;
  metadataStatus?: string | null;
  title: string;
  authors: string[];
  abstract: string;
  overview?: string;
  overviewMarkdown?: string;
  summarySource?: string | null;
  overviewSource?: string | null;
  metadataSource?: string | null;
  categories: string[];
  tags: string[];
  publishedAt: string;
  primaryClass?: string | null;
  bibtex?: string | null;
  absUrl?: string | null;
  pdfUrl?: string | null;
  displayName: string;
  createdAt: string;
  updatedAt?: string;
  status: string;
  error?: string | null;
  version?: number;
}

export interface ArxivListResponse {
  items: ArxivItemResponse[];
}

export interface ArxivImportResponse {
  status: string;
  metadata_status?: string;
  metadata_pending?: boolean;
  title?: string;
  message?: string;
  abs_url?: string;
  file_id: string;
  document_id?: string;
  arxiv_id: string;
}

export interface ArxivBatchImportTask {
  arxiv_id: string;
  status: string;
  file_id?: string;
  error?: string;
}

export interface ArxivBatchImportResponse {
  status: string;
  tasks: ArxivBatchImportTask[];
}
