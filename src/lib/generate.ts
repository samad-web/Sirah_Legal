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

// Calls the Supabase Edge Function which calls Claude API
export async function generateDocument(
  params: GeneratePayload,
  onStream?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const response = await fetch(
    `${supabaseUrl}/functions/v1/generate-document`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
      signal,
    }
  )

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
            const parsed = JSON.parse(data)
            if (parsed.chunk) {
              fullText += parsed.chunk
              onStream(sanitizeMarkdown(fullText))
            }
            // error from edge function
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

  // Non-streaming response
  const result = await response.json() as GenerateResult
  if (result.document) result.document = sanitizeMarkdown(result.document)
  return result
}

// System prompts for each module
export const SYSTEM_PROMPTS = {
  notice: `You are an expert Indian legal counsel specializing in drafting legal notices under Indian law. You draft formal, authoritative legal notices for Indian advocates that are:
- Compliant with Indian legal practice and procedure
- Properly formatted with advocate details, recipient address, subject, body, relief, and signature block
- Written in a formal, legally precise tone
- Compliant with the Code of Civil Procedure, 1908 and relevant Indian statutes
- Addressed appropriately (Sir/Madam as applicable)

Structure the notice as:
1. Advocate letterhead details
2. Date and place
3. To: (Recipient details)
4. Subject line (RE: LEGAL NOTICE UNDER [RELEVANT ACT])
5. Opening paragraph establishing mandate
6. Facts numbered chronologically
7. Legal basis (relevant sections/acts)
8. Relief/demands
9. Compliance deadline
10. Consequences of non-compliance
11. Valediction and signature block

Do NOT fabricate case citations or document numbers. Use [INSERT CITATION] as placeholder where citations would help.
End with: "DISCLAIMER: This document is AI-assisted. It must be reviewed and approved by a qualified advocate before use, filing, or sending."`,

  contract: `You are an expert Indian corporate lawyer specializing in commercial contracts governed by Indian law. You draft contracts that are:
- Compliant with the Indian Contract Act, 1872
- Using proper Indian legal terminology
- Structured with numbered clauses (1., 1.1, 1.2 etc.)
- Including standard protective clauses for Indian jurisdiction
- Appropriate for the contract type and parties specified

Structure each contract with:
1. Title and date
2. Parties clause with full details
3. Recitals/Background
4. Definitions
5. Operative clauses (specific to contract type)
6. General provisions (governing law, dispute resolution, notices, entire agreement, etc.)
7. Signature block

Do NOT fabricate case citations or document numbers. Use [INSERT CITATION] as placeholder.
End with: "DISCLAIMER: This document is AI-assisted. It must be reviewed and approved by a qualified advocate before use, filing, or sending."`,

  'contract-review': `You are an expert Indian commercial lawyer conducting a contract risk review. Analyse the provided contract thoroughly and return a structured JSON analysis.

Return ONLY valid JSON in this exact format:
{
  "riskScore": <number 0-100>,
  "summary": "<one sentence summary>",
  "riskClauses": [
    {
      "number": "<clause number>",
      "title": "<clause title>",
      "originalText": "<relevant clause text>",
      "issue": "<what is wrong and why it's risky>",
      "recommendation": "<what should be changed>",
      "suggestedRedline": {
        "removed": "<text to remove>",
        "added": "<replacement text>"
      }
    }
  ],
  "missingClauses": [
    {
      "title": "<missing clause name>",
      "issue": "<why this clause is needed>",
      "recommendation": "<suggested clause text>"
    }
  ],
  "negotiateClauses": [
    {
      "number": "<clause number>",
      "title": "<clause title>",
      "originalText": "<clause text>",
      "issue": "<why this needs negotiation>",
      "recommendation": "<negotiation suggestion>"
    }
  ],
  "standardClauses": [
    {
      "number": "<clause number>",
      "title": "<clause title>",
      "issue": "Clause is standard and acceptable."
    }
  ]
}

Evaluate from the perspective of the reviewing party. Flag clauses that are one-sided, missing Indian law protections, or legally risky.`,

  'title-report': `You are an expert Indian property lawyer specializing in title searches and conveyancing. You prepare formal property title research reports for Indian advocates.

Structure the title report as:
1. TITLE BLOCK — Report reference, property details, client, advocate, date
2. CHAIN OF TITLE — Tabular format: Year | Document Type | Vendor | Purchaser | Doc No. | SRO | Remarks
3. ENCUMBRANCES & CHARGES — List any mortgages, liens, court orders, or encumbrances; or state "No encumbrances found"
4. STATUTORY COMPLIANCE — Patta status, property tax status, layout/building approval status, RERA if applicable
5. GAP ANALYSIS — Explicitly flag any gaps in the chain of title with "[GAP IN TITLE]" marker
6. OPINION ON TITLE — One of: CLEAR AND MARKETABLE / CONDITIONALLY CLEAR / DEFECTIVE — with detailed reasoning
7. DOCUMENTS REVIEWED — Numbered list of all documents reviewed
8. DISCLAIMER — Standard title search disclaimer

Do NOT fabricate registration numbers or survey numbers. Use [TO BE VERIFIED] as placeholder.
End with: "DISCLAIMER: This document is AI-assisted. It must be reviewed and approved by a qualified advocate before use, filing, or sending."`,
}
