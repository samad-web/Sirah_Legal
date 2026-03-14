import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const OPENAI_BASE = 'https://api.openai.com/v1'
const OPENAI_MODEL = 'gpt-4o-mini'

const SYSTEM_PROMPTS: Record<string, string> = {
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

export const generateRouter = Router()

generateRouter.use(requireAuth)

generateRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { module, language, payload } = req.body as {
    module: string
    language: string
    payload: Record<string, unknown>
  }

  const systemPrompt = SYSTEM_PROMPTS[module]
  if (!systemPrompt) {
    res.status(400).json({ error: `Unknown module: ${module}` })
    return
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' })
    return
  }

  const langSuffix =
    language !== 'en'
      ? `\n\nIMPORTANT: Draft the entire document in ${language === 'ta' ? 'Tamil' : 'Hindi'} language.`
      : ''

  let userContent: string
  if (module === 'contract-review') {
    const contractText = (payload.contractText as string) ?? ''
    const reviewingAs = (payload.reviewingAs as string) ?? 'client'
    if (!contractText.trim()) {
      res.status(400).json({ error: 'No contract text provided. Please upload a valid document.' })
      return
    }
    userContent = `Review the following contract from the perspective of the "${reviewingAs}".\n\nCONTRACT TEXT:\n${contractText}`
  } else {
    userContent = (payload.prompt as string) ?? ''
  }

  const messages = [
    { role: 'system', content: systemPrompt + langSuffix },
    { role: 'user', content: userContent },
  ]

  const openaiHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${openaiKey}`,
  }

  // contract-review: non-streaming JSON response
  if (module === 'contract-review') {
    try {
      const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: openaiHeaders,
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages,
          max_tokens: 8192,
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        const errBody = await response.text()
        res.status(502).json({ error: `OpenAI error ${response.status}: ${errBody}` })
        return
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] }
      const text = data.choices?.[0]?.message?.content ?? ''
      if (!text) {
        res.status(500).json({ error: 'OpenAI returned an empty response' })
        return
      }

      let analysis: unknown
      try {
        analysis = JSON.parse(text)
      } catch {
        const match = text.match(/```json\n?([\s\S]*?)\n?```/) ?? text.match(/(\{[\s\S]*\})/)
        if (match) {
          analysis = JSON.parse(match[1])
        } else {
          res.status(500).json({ error: 'Could not parse analysis JSON from OpenAI response' })
          return
        }
      }

      res.json({ analysis })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
    return
  }

  // All other modules: SSE streaming
  try {
    const openaiRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: openaiHeaders,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_tokens: 8192,
        temperature: 0.4,
        stream: true,
      }),
    })

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text()
      res.status(502).json({ error: `OpenAI error ${openaiRes.status}: ${errBody}` })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const reader = openaiRes.body!.getReader()
    const decoder = new TextDecoder()

    try {
      let finished = false
      while (!finished) {
        const { done, value } = await reader.read()
        if (done) {
          res.write('data: [DONE]\n\n')
          break
        }

        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data) continue

          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n')
            finished = true
            break
          }

          try {
            const parsed = JSON.parse(data) as {
              error?: { message?: string }
              choices?: { delta?: { content?: string } }[]
            }
            if (parsed.error) {
              res.write(`data: ${JSON.stringify({ error: parsed.error.message ?? 'OpenAI stream error' })}\n\n`)
              finished = true
              break
            }
            const chunk = parsed.choices?.[0]?.delta?.content ?? ''
            if (chunk) {
              res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock()
      res.end()
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: String(err) })
    }
  }
})
