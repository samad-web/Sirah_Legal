import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateDocument } from '../generate'
import { supabase } from '../supabase'

// Mock Supabase
vi.mock('../supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
        },
        functions: {
            invoke: vi.fn(),
        },
    },
}))

// Mock fetch for Edge Function calls
global.fetch = vi.fn()

describe('generateDocument', () => {
    beforeEach(() => {
        vi.resetAllMocks()
            // Default session mock
            ; (supabase.auth.getSession as any).mockResolvedValue({
                data: { session: { access_token: 'mock-token' } },
                error: null,
            })
    })

    it('should throw error if not authenticated', async () => {
        ; (supabase.auth.getSession as any).mockResolvedValue({
            data: { session: null },
            error: null,
        })

        await expect(generateDocument({
            module: 'notice',
            language: 'en',
            payload: { prompt: 'test' }
        })).rejects.toThrow('Not authenticated')
    })

    it('should call the Edge Function with correct parameters', async () => {
        const mockResponse = {
            ok: true,
            json: () => Promise.resolve({ document: 'Generated Content' }),
        }
            ; (global.fetch as any).mockResolvedValue(mockResponse)

        const result = await generateDocument({
            module: 'notice',
            language: 'ta',
            payload: { prompt: 'Draft a notice' }
        })

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/functions/v1/generate-document'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    module: 'notice',
                    language: 'ta',
                    payload: { prompt: 'Draft a notice' }
                })
            })
        )
        expect(result.document).toBe('Generated Content')
    })

    it('should handle API errors gracefully', async () => {
        const mockResponse = {
            ok: false,
            text: () => Promise.resolve('API Error Message'),
        }
            ; (global.fetch as any).mockResolvedValue(mockResponse)

        await expect(generateDocument({
            module: 'notice',
            language: 'en',
            payload: { prompt: 'test' }
        })).rejects.toThrow('Generation failed: API Error Message')
    })
})
