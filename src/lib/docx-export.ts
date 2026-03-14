import {
  Document, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Packer, BorderStyle,
  LevelFormat, convertInchesToTwip, PageNumber, Footer, PageOrientation,
} from 'docx'
import type { Profile } from './supabase'
import type { Language } from './generate'
import { formatDate } from './utils'

// ─── Indian Court Document Formatting Standards ───────────────────────────────
// Font      : Times New Roman throughout
// Body      : 12pt (24 half-pts), justified, 1.5 line spacing (360 twips)
// Margins   : Left 1.5" (2160) · Right 1" (1440) · Top 1.25" (1800) · Bottom 1" (1440)
// Spacing   : 8pt (160 twips) after body ¶, 12pt (240) before headings
// Indent    : Clause 0.5" (720), sub-clause 0.75" (1080)
// Page size : A4
// ─────────────────────────────────────────────────────────────────────────────

let FONT = 'Times New Roman'
function getDocFont(language: Language = 'en', customFamily?: string | null): string {
  if (language === 'hi' || language === 'ta') return 'Nirmala UI'
  return customFamily || 'Times New Roman'
}
let BODY_PT = 24   // half-points → 12pt
let FONT_COLOR = '000000'
const HEADING1_PT = 28   // 14pt
const HEADING2_PT = 24   // 12pt bold
const SMALL_PT = 18   // 9pt
const LINE_SPACING = 360  // twips — 1.5x (240 = single)
const PARA_AFTER = 160  // twips after body para (~8pt)
const HEADING_AFTER = 120
const HEADING_BEFORE = 240

// ─── Line classifier (mirrors PDF classifier) ─────────────────────────────────
type LineType = 'h1' | 'h2' | 'h3' | 'clause' | 'subClause' | 'bullet' | 'valediction' | 'disclaimer' | 'blank' | 'paragraph'

function classifyLine(raw: string): { type: LineType; text: string } {
  const line = raw.trim()
  if (!line) return { type: 'blank', text: '' }

  if (/^#\s+/.test(line)) return { type: 'h1', text: line.replace(/^#+\s*/, '') }
  if (/^#{2,3}\s+/.test(line)) return { type: 'h2', text: line.replace(/^#+\s*/, '') }
  if (/^(disclaimer|note)\s*:/i.test(line)) return { type: 'disclaimer', text: line }
  if (/^[A-Z][A-Z\s\/\-&,().]{4,}:?$/.test(line)) return { type: 'h2', text: line }
  if (/^\d+\.\s/.test(line)) return { type: 'clause', text: line }
  if (/^\d+\.\d+/.test(line)) return { type: 'subClause', text: line }
  if (/^(\([a-z]+\)|[a-z]+\.)\s/i.test(line)) return { type: 'subClause', text: line }
  if (/^[-•*]\s/.test(line)) return { type: 'bullet', text: line }
  if (/^(yours (faithfully|truly|sincerely)|sd\/-?|signature|advocate for|counsel for|place\s*:|date\s*:)/i.test(line))
    return { type: 'valediction', text: line }

  return { type: 'paragraph', text: line }
}

// ─── Paragraph builders ───────────────────────────────────────────────────────
function bodyPara(text: string, extra?: any): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: BODY_PT, font: FONT, color: FONT_COLOR })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE_SPACING, after: PARA_AFTER },
    ...(extra || {}),
  })
}

function buildContentParagraph(line: { type: LineType; text: string }, i: number): Paragraph {
  switch (line.type) {
    case 'h1':
      return new Paragraph({
        children: [new TextRun({ text: line.text, bold: true, size: HEADING1_PT, font: FONT, underline: {} })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { line: LINE_SPACING, before: HEADING_BEFORE, after: HEADING_AFTER },
      })

    case 'h2':
      return new Paragraph({
        children: [new TextRun({ text: line.text, bold: true, size: HEADING2_PT, font: FONT })],
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
        spacing: { line: LINE_SPACING, before: HEADING_BEFORE, after: HEADING_AFTER },
      })

    case 'h3':
      return new Paragraph({
        children: [new TextRun({ text: line.text, bold: true, size: BODY_PT, font: FONT })],
        heading: HeadingLevel.HEADING_3,
        alignment: AlignmentType.LEFT,
        spacing: { line: LINE_SPACING, before: HEADING_BEFORE, after: HEADING_AFTER },
      })

    case 'clause':
      return new Paragraph({
        children: [new TextRun({ text: line.text, size: BODY_PT, font: FONT })],
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: convertInchesToTwip(0.5) },
        spacing: { line: LINE_SPACING, after: PARA_AFTER },
      })

    case 'subClause':
      return new Paragraph({
        children: [new TextRun({ text: line.text, size: BODY_PT, font: FONT })],
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: convertInchesToTwip(0.75) },
        spacing: { line: LINE_SPACING, after: PARA_AFTER },
      })

    case 'bullet':
      return new Paragraph({
        children: [new TextRun({ text: line.text, size: BODY_PT, font: FONT })],
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
        spacing: { line: LINE_SPACING, after: PARA_AFTER },
      })

    case 'valediction':
      return new Paragraph({
        children: [new TextRun({ text: line.text, size: BODY_PT, font: FONT })],
        alignment: AlignmentType.RIGHT,
        spacing: { line: LINE_SPACING, after: PARA_AFTER },
      })

    case 'disclaimer':
      return new Paragraph({
        children: [new TextRun({ text: line.text, size: SMALL_PT, italics: true, font: FONT, color: '555555' })],
        alignment: AlignmentType.LEFT,
        border: { top: { color: '888888', size: 4, style: BorderStyle.SINGLE } },
        spacing: { line: 240, before: 360, after: 0 },
      })

    default: // paragraph
      return bodyPara(line.text)
  }
}

// ─── Main export function ────────────────────────────────────────────────────
export async function getDocxBlob(
  content: string,
  title: string,
  profile: Profile | null,
  language: Language = 'en'
): Promise<Blob> {
  FONT = getDocFont(language, profile?.font_family)
  BODY_PT = (profile?.font_size || 12) * 2
  FONT_COLOR = (profile?.font_color || '#000000').replace('#', '')
  const classified = content.split('\n').map(classifyLine).filter(l => l.type !== 'blank')

  const advocateInfo = [
    profile?.bar_council_no ? `Enrollment No: ${profile.bar_council_no}` : '',
    profile?.firm_name || '',
  ].filter(Boolean).join(' · ')

  // ── Letterhead paragraphs ──────────────────────────────────────────────────
  const headerName = new Paragraph({
    children: [new TextRun({ text: profile?.full_name || 'Advocate', bold: true, size: HEADING1_PT, font: FONT })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  })

  const headerMeta = advocateInfo ? new Paragraph({
    children: [new TextRun({ text: advocateInfo, size: SMALL_PT, font: FONT })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  }) : null

  const dateParagh = new Paragraph({
    children: [new TextRun({ text: `Date: ${formatDate(new Date())}`, size: SMALL_PT, font: FONT })],
    alignment: AlignmentType.RIGHT,
    spacing: { after: 160 },
  })

  const divider = new Paragraph({
    border: { bottom: { color: '000000', size: 6, style: BorderStyle.SINGLE } },
    spacing: { after: 200 },
    children: [],
  })

  // ── Page footer with centred page numbers ─────────────────────────────────
  const pageFooter = new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: '— ', size: SMALL_PT, font: FONT }),
          new TextRun({ children: [PageNumber.CURRENT], size: SMALL_PT, font: FONT }),
          new TextRun({ text: ' of ', size: SMALL_PT, font: FONT }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: SMALL_PT, font: FONT }),
          new TextRun({ text: ' —', size: SMALL_PT, font: FONT }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  })

  const contentParagraphs = classified.map(buildContentParagraph)

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'decimal-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } },
                run: { size: BODY_PT, font: FONT },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT, width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) }, // A4
            margin: {
              top: convertInchesToTwip(1.25), // 1800
              bottom: convertInchesToTwip(1),    // 1440
              left: convertInchesToTwip(1.5),  // 2160 — HC standard
              right: convertInchesToTwip(1),    // 1440
            },
          },
        },
        footers: { default: pageFooter },
        children: [
          headerName,
          ...(headerMeta ? [headerMeta] : []),
          dateParagh,
          divider,
          ...contentParagraphs,
        ],
      },
    ],
  })

  return await Packer.toBlob(doc)
}

export async function exportToDocx(
  content: string,
  title: string,
  profile: Profile | null,
  language: Language = 'en'
): Promise<void> {
  const blob = await getDocxBlob(content, title, profile, language)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_')}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
