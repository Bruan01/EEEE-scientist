export type FileActionKey = 'summarize' | 'keyPoints' | 'questions' | 'evidence'

export type FileActionTarget = {
  fileId: string
  fileName: string
  filePath?: string | null
  mimeType?: string | null
  isPdf?: boolean
}

const resolveIsPdf = (target: FileActionTarget) => {
  if (typeof target.isPdf === 'boolean') return target.isPdf
  const name = target.fileName.toLowerCase()
  return target.mimeType === 'application/pdf' || name.endsWith('.pdf')
}

export const buildFileActionPrompt = (
  action: FileActionKey,
  target: FileActionTarget,
  claim?: string
) => {
  const isPdf = resolveIsPdf(target)
  const filePath = target.filePath || '/'
  const fileType = target.mimeType || 'unknown'

  const pdfHint = isPdf
    ? 'Use pdf_read_lines and/or pdf_search with file_id to inspect the PDF.'
    : 'Use file_read_lines (and file_grep if needed) with file_id to inspect the file.'

  const anchorHint = isPdf
    ? 'Cite evidence with anchors like [p3:l12].'
    : 'Cite evidence with anchors like [l42].'

  const header = [
    'You are working with a workspace file.',
    `File name: ${target.fileName}`,
    `File id: ${target.fileId}`,
    `File path: ${filePath || '/'}`,
    `File type: ${fileType}`,
    '',
    'Instructions:',
    '- Do not ask the user to paste file content.',
    `- ${pdfHint}`,
    '- Make at least one tool call before answering.',
    '- Keep tool calls scoped (offset/limit) and repeat if needed.',
  ].join('\n')

  if (action === 'summarize') {
    return `${header}\n\nTask: Summarize the file in 5-8 bullet points.`
  }

  if (action === 'keyPoints') {
    return `${header}\n\nTask: Extract the key points (5-10 bullets) with short explanations.`
  }

  if (action === 'questions') {
    return `${header}\n\nTask: Generate 6-10 study or review questions based on the file.`
  }

  const claimText = claim?.trim()
  const claimLine = claimText ? `Claim: "${claimText}"` : 'Claim: (missing)'
  return `${header}\n\nTask: Find evidence for the claim below. ${anchorHint}\n${claimLine}`
}
