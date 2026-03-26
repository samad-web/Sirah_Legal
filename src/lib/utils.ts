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

  // Strip code fences (```...```) and inline backticks
  s = s.replace(/```[\s\S]*?```/g, '')
  s = s.replace(/`([^`]*)`/g, '$1')
  s = s.replace(/`/g, '')

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

  // Strip markdown heading markers (## Heading → Heading)
  s = s.replace(/^#{1,6}\s+/gm, '')

  return s.trim()
}

/** Convert plain text with \n\n paragraph breaks into HTML paragraphs for TipTap */
export function textToHtml(text: string): string {
  if (!text) return ''
  return text
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('')
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
    'Negotiable Instruments Act, 1881 (Section 138)',
    'Indian Contract Act, 1872 (Sections 73-74)',
    'Code of Civil Procedure, 1908',
    'Limitation Act, 1963 (Article 55 — 3 years)',
    'SARFAESI Act, 2002',
    'Insolvency and Bankruptcy Code, 2016',
    'Bharatiya Nyaya Sanhita, 2023 (Cheating / Criminal Breach of Trust)',
  ],
  'property-dispute': [
    'Transfer of Property Act, 1882',
    'Registration Act, 1908',
    'Specific Relief Act, 1963',
    'Code of Civil Procedure, 1908',
    'Limitation Act, 1963 (Article 65 — 12 years)',
    'Land Acquisition Act, 1894 / RFCTLARR Act, 2013',
    'Real Estate (Regulation and Development) Act, 2016',
    'Indian Succession Act, 1925',
    'Hindu Succession Act, 1956',
    'Bharatiya Nyaya Sanhita, 2023 (Fraud / Forgery)',
  ],
  'service-deficiency': [
    'Consumer Protection Act, 2019',
    'Information Technology Act, 2000',
    'Motor Vehicles Act, 1988',
    'Real Estate (Regulation and Development) Act, 2016',
    'Indian Contract Act, 1872',
    'Bharatiya Nyaya Sanhita, 2023 (Cheating)',
  ],
  'employment-matter': [
    'Industrial Disputes Act, 1947',
    'Minimum Wages Act, 1948',
    'Code on Wages, 2019',
    'Industrial Relations Code, 2020',
    'Social Security Code, 2020',
    'Payment of Wages Act, 1936',
    'Shops and Establishments Act (State-specific)',
    'Protection of Women from Domestic Violence Act, 2005',
    'Bharatiya Nyaya Sanhita, 2023 (Criminal Intimidation)',
  ],
  'demand-letter': [
    'Indian Contract Act, 1872',
    'Code of Civil Procedure, 1908',
    'Limitation Act, 1963',
    'Specific Relief Act, 1963',
    'Negotiable Instruments Act, 1881',
    'Bharatiya Nyaya Sanhita, 2023',
  ],
  'rejoinder': [
    'Code of Civil Procedure, 1908',
    'Limitation Act, 1963',
    'Bharatiya Sakshya Adhiniyam, 2023 (Evidence)',
    'Indian Contract Act, 1872',
  ],
}
