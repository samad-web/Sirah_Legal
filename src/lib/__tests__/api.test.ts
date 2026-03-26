import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUserDocuments, deleteDocument, saveDocument, getCases, getProfile } from '../api'
import { supabase } from '../supabase'

vi.mock('../supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            refreshSession: vi.fn(),
        },
    },
}))

global.fetch = vi.fn()

const mockSession = { access_token: 'test-token' }

function mockFetchResponse(data: unknown, status = 200) {
    ;(global.fetch as any).mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
    })
}

describe('API client', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        ;(supabase.auth.getSession as any).mockResolvedValue({
            data: { session: mockSession },
            error: null,
        })
    })

    describe('getUserDocuments', () => {
        it('should fetch documents with pagination params', async () => {
            const mockData = { data: [], total: 0, page: 1, limit: 20 }
            mockFetchResponse(mockData)

            const result = await getUserDocuments('user-123', { page: 1, limit: 10 })

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/documents?page=1&limit=10'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-token',
                    }),
                })
            )
            expect(result).toEqual(mockData)
        })

        it('should include search param when provided', async () => {
            mockFetchResponse({ data: [], total: 0, page: 1, limit: 20 })

            await getUserDocuments('user-123', { search: 'contract' })

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('search=contract'),
                expect.any(Object)
            )
        })

        it('should throw when not authenticated', async () => {
            ;(supabase.auth.getSession as any).mockResolvedValue({
                data: { session: null },
                error: null,
            })

            await expect(getUserDocuments('user-123')).rejects.toThrow('Not authenticated')
        })
    })

    describe('saveDocument', () => {
        it('should POST with document body', async () => {
            const doc = {
                user_id: 'user-123',
                title: 'Test Notice',
                content: 'Notice content here',
                type: 'notice' as const,
                status: 'draft' as const,
                language: 'en' as const,
            }
            const mockDoc = { ...doc, id: 'doc-1', created_at: '2026-01-01', updated_at: '2026-01-01' }
            mockFetchResponse(mockDoc)

            const result = await saveDocument(doc)

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/documents',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(doc),
                })
            )
            expect(result.id).toBe('doc-1')
        })
    })

    describe('deleteDocument', () => {
        it('should DELETE with document ID', async () => {
            mockFetchResponse({ success: true })

            await deleteDocument('doc-123')

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/documents/doc-123',
                expect.objectContaining({ method: 'DELETE' })
            )
        })

        it('should throw on API error', async () => {
            mockFetchResponse('Not found', 404)

            await expect(deleteDocument('bad-id')).rejects.toThrow()
        })
    })

    describe('getCases', () => {
        it('should fetch all cases', async () => {
            const mockCases = [{ id: 'case-1', title: 'Test Case' }]
            mockFetchResponse(mockCases)

            const result = await getCases()

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/cases',
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
                })
            )
            expect(result).toEqual(mockCases)
        })
    })

    describe('getProfile', () => {
        it('should return profile on success', async () => {
            const mockProfile = { id: 'user-1', full_name: 'Test User', role: 'advocate' }
            mockFetchResponse(mockProfile)

            const result = await getProfile()

            expect(result).toEqual(mockProfile)
        })

        it('should return null on error', async () => {
            mockFetchResponse('Unauthorized', 401)
            ;(supabase.auth.refreshSession as any).mockResolvedValue({
                data: { session: null },
            })

            const result = await getProfile()

            expect(result).toBeNull()
        })
    })

    describe('token refresh on 401', () => {
        it('should retry with fresh token on 401', async () => {
            const freshToken = 'fresh-token'
            const mockData = { data: [], total: 0, page: 1, limit: 20 }

            // First call returns 401
            ;(global.fetch as any)
                .mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') })
                // Second call (retry) succeeds
                .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(mockData), text: () => Promise.resolve('') })

            ;(supabase.auth.refreshSession as any).mockResolvedValue({
                data: { session: { access_token: freshToken } },
            })

            const result = await getUserDocuments('user-123')

            // Should have been called twice — original + retry
            expect(global.fetch).toHaveBeenCalledTimes(2)
            expect(result).toEqual(mockData)
        })
    })
})
