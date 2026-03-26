import { describe, it, expect } from 'vitest'
import { sanitizeMarkdown, formatDate, capitalizeWords, cn } from '../utils'

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

        it('should return empty string as-is', () => {
            expect(sanitizeMarkdown('')).toBe('')
        })

        it('should not strip asterisks in multiplication (no space)', () => {
            // Asterisks inside words shouldn't be stripped if not matching pattern
            expect(sanitizeMarkdown('5*3')).toBe('5*3')
        })

        it('should handle multiple bold sections in one line', () => {
            expect(sanitizeMarkdown('**Section 1** and **Section 2**')).toBe('Section 1 and Section 2')
        })

        it('should preserve Hindi text while stripping markers', () => {
            expect(sanitizeMarkdown('**हिंदी**')).toBe('हिंदी')
        })
    })

    describe('formatDate', () => {
        it('should format date strings to DD MMM YYYY', () => {
            const formatted = formatDate('2026-03-10')
            expect(formatted).toMatch(/10\sMar\s2026/)
        })

        it('should format Date objects', () => {
            const formatted = formatDate(new Date('2025-01-15'))
            expect(formatted).toMatch(/15\sJan\s2025/)
        })

        it('should handle ISO datetime strings', () => {
            const formatted = formatDate('2026-07-22T14:30:00Z')
            expect(formatted).toMatch(/22\sJul\s2026/)
        })
    })

    describe('capitalizeWords', () => {
        it('should capitalize first letter of each word', () => {
            expect(capitalizeWords('hello world')).toBe('Hello World')
        })

        it('should handle single word', () => {
            expect(capitalizeWords('test')).toBe('Test')
        })

        it('should handle empty string', () => {
            expect(capitalizeWords('')).toBe('')
        })

        it('should handle already capitalized text', () => {
            expect(capitalizeWords('Hello World')).toBe('Hello World')
        })
    })

    describe('cn', () => {
        it('should merge class names', () => {
            expect(cn('text-red-500', 'bg-blue-200')).toBe('text-red-500 bg-blue-200')
        })

        it('should handle conditional classes', () => {
            const isActive = true
            expect(cn('base', isActive && 'active')).toBe('base active')
        })

        it('should handle false/null/undefined values', () => {
            expect(cn('base', false, null, undefined, 'end')).toBe('base end')
        })

        it('should merge conflicting Tailwind classes', () => {
            // twMerge should keep only the last conflicting class
            expect(cn('px-4', 'px-6')).toBe('px-6')
        })
    })
})
