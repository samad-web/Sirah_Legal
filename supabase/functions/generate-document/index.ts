import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const OPENAI_MODEL = 'gpt-4o-mini'
const OPENAI_BASE = 'https://api.openai.com/v1'

const SYSTEM_PROMPTS: Record<string, string> = {
  notice: `You are an expert Indian legal drafting assistant with deep knowledge of Indian civil law, CPC (Code of Civil Procedure), and Indian Contract Act. You draft formal legal notices for Indian advocates.
  
When drafting a legal notice:
1. Open with sender details, then "LEGAL NOTICE" heading, then addressee block
2. Use precise legal language per Indian legal conventions
3. Reference applicable statutes with section numbers (e.g., "Section 138 of the Negotiable Instruments Act, 1881")
4. Include a clear demand with a specific compliance deadline (typically 15-30 days)
5. End with advocate signature block, enrollment no., state bar council
6. Use Hindi transliterations for common terms where appropriate (e.g., "Noticee", "Noticor")
7. Output clean, formatted plain text suitable for letter printing`,

  contract: `You are an expert Indian contract drafting specialist with deep knowledge of Indian Contract Act 1872, Sale of Goods Act, Transfer of Property Act, and relevant sector legislation.

Drafting standards:
1. Start with document title in caps, then parties block, then recitals (WHEREAS clauses)
2. Number all clauses — main clauses in Arabic numerals, sub-clauses in letters
3. Define critical terms in a DEFINITIONS section (Clause 1)
4. Include standard boilerplate: Entire Agreement, Severability, Waiver, Force Majeure, Governing Law (specify Indian state), Dispute Resolution
5. Arbitration clause must reference Arbitration and Conciliation Act, 1996
6. Employment contracts must comply with Shops and Establishments Act of the relevant state
7. NDAs must include reasonable definition of Confidential Information and carve-outs
8. Output clean, formatted plain text with proper indentation for sub-clauses`,

  'contract-review': `You are a senior Indian advocate specialising in contract risk assessment. You analyse contracts and identify risk from the specified party's perspective.

Return ONLY valid JSON in this exact format:
{
  "riskScore": <number 0-100, higher = more risk>,
  "summary": "<2-3 sentence executive summary>",
  "riskClauses": [
    {
      "number": "<clause number>",
      "title": "<clause title>",
      "originalText": "<relevant clause text, max 150 words>",
      "issue": "<what is wrong and why it is risky>",
      "recommendation": "<specific actionable recommendation>",
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

Risk scoring: high = 61-100 overall, medium = 31-60, low = 0-30.
Focus on: limitation of liability, IP ownership, termination without cause, non-compete scope, penalty clauses, jurisdiction, indemnification caps.
Evaluate from the perspective of the reviewing party. Flag clauses that are one-sided, missing Indian law protections, or legally risky.`,

  'title-report': `You are an expert Indian conveyancing advocate and title search specialist with knowledge of Transfer of Property Act 1882, Registration Act 1908, and state-specific land records systems.

Title report structure:
1. TITLE SEARCH REPORT — heading with property details
2. A. Property Description (schedule, area, boundaries)
3. B. Chain of Title (chronological ownership transfers, deed references)
4. C. Encumbrances & Charges (mortgages, liens, court attachments)
5. D. Revenue Records (Patta/Chitta status, EC status, survey records)
6. E. Pending Litigation (any lis pendens)
7. F. Observations & Concerns (numbered list)
8. G. Opinion on Title (CLEAR / MARKETABLE / GOOD / DOUBTFUL / NOT MARKETABLE)
9. H. Recommendations (numbered steps before purchase)

Use formal conveyancing language. Cite specific statutes. Flag any missing document in the search.`,
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { module, language, payload } = await req.json()

    const systemPrompt = SYSTEM_PROMPTS[module]
    if (!systemPrompt) {
      return new Response(JSON.stringify({ error: `Unknown module: ${module}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const langSuffix = language !== 'en'
      ? `\n\nIMPORTANT: Draft the entire document in ${language === 'ta' ? 'Tamil' : 'Hindi'} language.`
      : ''

    // Build user message — contract-review uses contractText+reviewingAs, others use prompt
    let userContent: string
    if (module === 'contract-review') {
      const contractText = (payload.contractText as string) || ''
      const reviewingAs  = (payload.reviewingAs  as string) || 'client'
      if (!contractText.trim()) {
        return new Response(JSON.stringify({ error: 'No contract text provided. Please upload a valid document.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      userContent = `Review the following contract from the perspective of the "${reviewingAs}".\n\nCONTRACT TEXT:\n${contractText}`
    } else {
      userContent = (payload.prompt as string) || ''
    }

    const messages = [
      { role: 'system', content: systemPrompt + langSuffix },
      { role: 'user', content: userContent },
    ]

    const openaiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    }

    // For contract-review, we need a full JSON response — no streaming
    if (module === 'contract-review') {
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
        throw new Error(`OpenAI API error ${response.status}: ${errBody}`)
      }

      const data = await response.json()
      const text: string = data.choices?.[0]?.message?.content || ''
      if (!text) throw new Error(`OpenAI returned empty response: ${JSON.stringify(data)}`)
      let analysis
      try {
        analysis = JSON.parse(text)
      } catch {
        const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[1])
        } else {
          throw new Error('Could not parse analysis JSON from OpenAI response')
        }
      }
      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // All other modules — stream via SSE using OpenAI's streaming API
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

    // Surface OpenAI errors before starting the stream
    if (!openaiRes.ok) {
      const errBody = await openaiRes.text()
      throw new Error(`OpenAI API error ${openaiRes.status}: ${errBody}`)
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        const reader = openaiRes.body!.getReader()
        const decoder = new TextDecoder()

        try {
          let finished = false
          while (!finished) {
            const { done, value } = await reader.read()
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              break
            }
            const text = decoder.decode(value, { stream: true })
            const lines = text.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (!data) continue
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  finished = true
                  break
                }
                try {
                  const parsed = JSON.parse(data)
                  // Surface OpenAI-level errors inside the stream
                  if (parsed.error) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: parsed.error.message || JSON.stringify(parsed.error) })}\n\n`))
                    finished = true
                    break
                  }
                  const chunkText: string = parsed.choices?.[0]?.delta?.content || ''
                  if (chunkText) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`))
                  }
                } catch {
                  // skip malformed lines
                }
              }
            }
          }
        } finally {
          controller.close()
          reader.releaseLock()
        }
      },
    })

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
