import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Strip markdown-style emphasis / formatting markers from AI output
 * while preserving the actual text content. Works across all scripts
 * (Latin, Devanagari, Tamil, etc.).
 *
 *  - ***bold italic*** / **bold** / *italic*  → inner text
 *  - ___bold italic___ / __bold__ / _italic_  → inner text
 *  - Stray leading/trailing asterisks or underscores on a word
 */
export function sanitizeMarkdown(raw: string): string {
  let s = raw

  // Bold-italic: ***text*** / ___text___
  s = s.replace(/\*{3}(.+?)\*{3}/g, '$1')
  s = s.replace(/_{3}(.+?)_{3}/g, '$1')

  // Bold: **text** / __text__
  s = s.replace(/\*{2}(.+?)\*{2}/g, '$1')
  s = s.replace(/_{2}(.+?)_{2}/g, '$1')

  // Italic: *text* / _text_  (only when surrounding non-space chars)
  s = s.replace(/\*([^\s*][^*]*[^\s*])\*/g, '$1')
  s = s.replace(/\b_([^\s_][^_]*[^\s_])_\b/g, '$1')

  // Catch leftover lone asterisks at word boundaries (e.g. "*word" or "word*")
  s = s.replace(/(^|\s)\*(?=\S)/gm, '$1')
  s = s.replace(/(?<=\S)\*($|\s)/gm, '$1')

  return s
}

export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

export const RELEVANT_ACTS: Record<string, string[]> = {
  'money-recovery': [
    'Negotiable Instruments Act, 1881',
    'Code of Civil Procedure, 1908',
    'Limitation Act, 1963',
    'SARFAESI Act, 2002',
  ],
  'property-dispute': [
    'Transfer of Property Act, 1882',
    'Registration Act, 1908',
    'Specific Relief Act, 1963',
    'Code of Civil Procedure, 1908',
  ],
  'service-deficiency': [
    'Consumer Protection Act, 2019',
    'Information Technology Act, 2000',
  ],
  'employment-matter': [
    'Industrial Disputes Act, 1947',
    'Payment of Wages Act, 1936',
    'Shops and Establishments Act',
    'Minimum Wages Act, 1948',
  ],
  'demand-letter': [
    'Code of Civil Procedure, 1908',
    'Limitation Act, 1963',
  ],
  'rejoinder': [
    'Code of Civil Procedure, 1908',
  ],
}
