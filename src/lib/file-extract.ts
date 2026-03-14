/**
 * Client-side text extraction from PDF and DOCX files.
 *
 * PDF  → pdfjs-dist (Mozilla PDF.js)
 * DOCX → mammoth
 */

import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Use CDN worker — the most reliable approach for Vite / bundled environments.
// Must match the installed pdfjs-dist version exactly.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

// ─── Validation ───────────────────────────────────────────────────────────────

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc (we'll try mammoth, which may or may not work)
]

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc']

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export interface FileValidation {
  valid: boolean
  error?: string
}

export function validateFile(file: File): FileValidation {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Unsupported file type "${ext}". Please upload a PDF or DOCX file.` }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 10 MB.` }
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' }
  }

  return { valid: true }
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const doc = await withTimeout(loadingTask.promise, 30_000, 'PDF loading')
  const pages: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // TextItem has `str`; MarkedContent does not — filter safely
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ')
    pages.push(pageText)
  }

  return pages.join('\n\n')
}

// ─── DOCX extraction ─────────────────────────────────────────────────────────

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const result = await withTimeout(
    mammoth.extractRawText({ arrayBuffer: buffer }),
    15_000,
    'DOCX parsing',
  )
  return result.value
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Extract plain text from a PDF or DOCX file.
 * Throws on unsupported formats, parse errors, or timeout.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
  const buffer = await file.arrayBuffer()

  let text: string

  if (ext === '.pdf' || file.type === 'application/pdf') {
    text = await extractPdfText(buffer)
  } else if (ext === '.docx' || ext === '.doc') {
    text = await extractDocxText(buffer)
  } else {
    throw new Error(`Unsupported file type: ${ext}`)
  }

  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error(
      'Could not extract any text from the uploaded file. ' +
      'The file may be image-based (scanned). Please upload a text-based document.',
    )
  }

  return trimmed
}
