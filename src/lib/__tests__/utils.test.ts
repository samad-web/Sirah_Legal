import { describe, it, expect } from 'vitest'
import { sanitizeMarkdown, formatDate } from '../utils'

describe('utils', () => {
    describe('sanitizeMarkdown', () => {
        it('should strip bold markers', () => {
            expect(sanitizeMarkdown('**bold**')).toBe('bold')
            expect(sanitizeMarkdown('__bold__')).toBe('bold')
        })

        it('should strip italic markers', () => {
            expect(sanitizeMarkdown('*italic*')).toBe('italic')
            expect(sanitizeMarkdown('_italic_')).toBe('italic')
        })

        it('should strip bold-italic markers', () => {
            expect(sanitizeMarkdown('***bold-italic***')).toBe('bold-italic')
            expect(sanitizeMarkdown('___bold-italic___')).toBe('bold-italic')
        })

        it('should preserve Tamil characters while stripping markers', () => {
            expect(sanitizeMarkdown('**தமிழ்**')).toBe('தமிழ்')
            expect(sanitizeMarkdown('*தமிழ்*')).toBe('தமிழ்')
        })

        it('should handle nested or combined markers', () => {
            expect(sanitizeMarkdown('**bold** and *italic*')).toBe('bold and italic')
        })
    })

    describe('formatDate', () => {
        it('should format date strings to DD MMM YYYY', () => {
            const date = '2026-03-10'
            // The exact output might depend on locale, but we expect something like "10 Mar 2026"
            // Since we use 'en-IN' in the implementation
            const formatted = formatDate(date)
            expect(formatted).toMatch(/10\sMar\s2026/)
        })
    })
})
