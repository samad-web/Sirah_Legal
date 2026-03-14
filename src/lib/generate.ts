import { supabase } from './supabase'
import { sanitizeMarkdown } from './utils'

export type GenerateModule = 'notice' | 'contract' | 'contract-review' | 'title-report'
export type Language = 'en' | 'ta' | 'hi'

export interface GeneratePayload {
  module: GenerateModule
  language: Language
  payload: Record<string, unknown>
}

export interface GenerateResult {
  document?: string
  analysis?: ContractAnalysis
}

export interface ContractAnalysis {
  riskScore: number
  summary: string
  riskClauses: AnalysisClause[]
  missingClauses: AnalysisClause[]
  negotiateClauses: AnalysisClause[]
  standardClauses: AnalysisClause[]
}

export interface AnalysisClause {
  number?: string
  title: string
  originalText?: string
  issue: string
  recommendation?: string
  suggestedRedline?: {
    removed: string
    added: string
  }
}

// Calls the Node.js backend which calls the OpenAI API
export async function generateDocument(
  params: GeneratePayload,
  onStream?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
    signal,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Generation failed: ${error}`)
  }

  // Handle SSE streaming
  if (onStream && response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let finished = false

    while (!finished) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') { finished = true; break }
          try {
            const parsed = JSON.parse(data) as { chunk?: string; error?: string }
            if (parsed.chunk) {
              fullText += parsed.chunk
              onStream(sanitizeMarkdown(fullText))
            }
            if (parsed.error) throw new Error(parsed.error)
          } catch (e) {
            if (e instanceof SyntaxError) continue // non-JSON line, skip
            throw e
          }
        }
      }
    }

    return { document: sanitizeMarkdown(fullText) }
  }

  // Non-streaming response (contract-review)
  const result = await response.json() as GenerateResult
  if (result.document) result.document = sanitizeMarkdown(result.document)
  return result
}
