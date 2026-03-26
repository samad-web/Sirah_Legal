import { Router } from 'express'
import type { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { requireAuth, requireLawyer } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import { enforceQuota } from '../middleware/quota.js'
import { supabase } from '../lib/supabase.js'
import { SYSTEM_PROMPTS, SECTION_REGEN_PROMPT } from '../lib/prompts.js'

const OPENAI_BASE = 'https://api.openai.com/v1'
const OPENAI_MODEL = 'gpt-4o-mini'
const OPENAI_TIMEOUT_MS = 90_000

// Sanitise user input before embedding in prompts to mitigate prompt injection.
// Strips common injection delimiters while preserving normal legal text.
function sanitizePromptInput(input: string): string {
  return input
    .replace(/```/g, '')             // Remove markdown code fences
    .replace(/<\/?[a-z][^>]*>/gi, '') // Strip HTML tags
    .slice(0, 100_000)               // Hard length cap
}

// System prompts imported from server/lib/prompts.ts

// ─── Zod schema ───────────────────────────────────────────────────────────────

const generateSchema = z.object({
  module: z.enum(['notice', 'contract', 'title-report', 'contract-review']),
  language: z.enum(['en', 'ta', 'hi']),
  payload: z.record(z.string(), z.unknown()),
})

// ─── Rate limiter (per user, keyed on JWT userId) ─────────────────────────────

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyGenerator: (req) => (req as AuthRequest).userId ?? 'unknown',
  message: { error: 'Too many generation requests. You can generate up to 10 documents per 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const generateRouter = Router()

// requireAuth → enforceQuota → generateLimiter (order matters: auth first so userId is available)
generateRouter.use(requireAuth)
generateRouter.use(enforceQuota)
generateRouter.use(generateLimiter)

generateRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  // Validate request body
  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') })
    return
  }

  const { module, language, payload } = parsed.data
  const systemPrompt = SYSTEM_PROMPTS[module]

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    console.error('[generate] OPENAI_API_KEY is not configured')
    res.status(503).json({ error: 'Document generation service is currently unavailable' })
    return
  }

  const langSuffix =
    language !== 'en'
      ? `\n\nIMPORTANT: Draft the entire document in ${language === 'ta' ? 'Tamil' : 'Hindi'} language.`
      : ''

  let userContent: string
  if (module === 'contract-review') {
    const contractText = sanitizePromptInput((payload.contractText as string) ?? '')
    const allowedRoles = ['client', 'vendor', 'employer', 'employee', 'landlord', 'tenant'] as const
    const rawRole = ((payload.reviewingAs as string) ?? 'client').toLowerCase()
    const reviewingAs = allowedRoles.includes(rawRole as typeof allowedRoles[number]) ? rawRole : 'client'
    if (!contractText.trim()) {
      res.status(400).json({ error: 'No contract text provided. Please upload a valid document.' })
      return
    }
    userContent = `Review the following contract from the perspective of the "${reviewingAs}".\n\nCONTRACT TEXT:\n${contractText}`
  } else {
    userContent = sanitizePromptInput((payload.prompt as string) ?? '')
    if (!userContent.trim()) {
      res.status(400).json({ error: 'No prompt provided.' })
      return
    }
  }

  const messages = [
    { role: 'system', content: systemPrompt + langSuffix },
    { role: 'user', content: userContent },
  ]

  const openaiHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${openaiKey}`,
  }

  // ── contract-review: non-streaming JSON response ──────────────────────────
  if (module === 'contract-review') {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

    try {
      const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: openaiHeaders,
        signal: controller.signal,
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
        console.error(`[generate] OpenAI contract-review error ${response.status}:`, errBody)
        res.status(502).json({ error: 'AI service returned an error. Please try again.' })
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
      if ((err as Error).name === 'AbortError') {
        res.status(504).json({ error: 'Request timed out. Please try again.' })
      } else {
        console.error('[generate] contract-review error:', err)
        res.status(500).json({ error: 'An unexpected error occurred during analysis' })
      }
    } finally {
      clearTimeout(timeout)
    }
    return
  }

  // ── All other modules: SSE streaming ─────────────────────────────────────
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

  try {
    const openaiRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: openaiHeaders,
      signal: controller.signal,
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
      console.error(`[generate] OpenAI streaming error ${openaiRes.status}:`, errBody)
      res.status(502).json({ error: 'AI service returned an error. Please try again.' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    if (!openaiRes.body) {
      res.status(502).json({ error: 'OpenAI returned an empty stream body' })
      return
    }
    const reader = openaiRes.body.getReader()
    const decoder = new TextDecoder()

    try {
      let finished = false
      while (!finished) {
        const { done, value } = await reader.read()
        if (done) {
          res.write('data: [DONE]\n\n')
          break
        }

        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
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
            if (chunk) res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
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
    clearTimeout(timeout)
    if ((err as Error).name === 'AbortError') {
      if (!res.headersSent) {
        res.status(504).json({ error: 'OpenAI request timed out after 90 seconds.' })
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Generation timed out.' })}\n\n`)
        res.end()
      }
    } else if (!res.headersSent) {
      console.error('[generate] streaming error:', err)
      res.status(500).json({ error: 'An unexpected error occurred during generation' })
    }
    return
  }

  clearTimeout(timeout)
})

// ─── POST /api/generate/section ──────────────────────────────────────────────
// Regenerates a highlighted section of an existing document with AI

const sectionSchema = z.object({
  document_id: z.string().min(1),
  selected_text: z.string().min(1).max(5000),
  instruction: z.string().min(1).max(500),
})

generateRouter.post('/section', requireLawyer, async (req: Request, res: Response): Promise<void> => {
  const parsed = sectionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') })
    return
  }

  const { document_id, selected_text, instruction } = parsed.data
  const lawyerId = (req as AuthRequest).userId

  // Ownership check
  const { data: doc } = await supabase
    .from('documents')
    .select('id, type')
    .eq('id', document_id)
    .eq('user_id', lawyerId)
    .maybeSingle()

  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    res.status(500).json({ error: 'OpenAI API key not configured' })
    return
  }

  const systemPrompt = SECTION_REGEN_PROMPT

  const userPrompt = `ORIGINAL SECTION:\n${sanitizePromptInput(selected_text)}\n\nINSTRUCTION:\n${sanitizePromptInput(instruction)}\n\nRewrite the section above following the instruction. Output only the rewritten text.`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

  try {
    const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    })

    if (!response.ok || !response.body) {
      clearTimeout(timeout)
      res.write(`data: ${JSON.stringify({ error: 'Generation failed' })}\n\n`)
      res.end()
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') break

        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
          const text = parsed.choices?.[0]?.delta?.content ?? ''
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`)
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    clearTimeout(timeout)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Section regeneration failed' })
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Generation failed' })}\n\n`)
      res.end()
    }
  }

  clearTimeout(timeout)
})
