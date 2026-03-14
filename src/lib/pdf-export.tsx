import { pdf, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { Profile } from './supabase'
import type { Language } from './generate'
import { formatDate } from './utils'

// ─── Unicode font registration for Indian scripts ──────────────────────────────
Font.register({
  family: 'NotoSerifDevanagari',
  src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-devanagari@5.0.3/files/noto-serif-devanagari-devanagari-400-normal.woff',
})
Font.register({
  family: 'NotoSerifTamil',
  src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-tamil@5.0.3/files/noto-serif-tamil-tamil-400-normal.woff',
})

const DEFAULT_FONTS: Record<string, string> = {
  'Times New Roman': 'Times-Roman',
  'Helvetica': 'Helvetica',
  'Georgia': 'Times-Roman', // Fallback for standard PDF fonts
  'Courier New': 'Courier',
}

function getLangFonts(language: Language = 'en', customFamily?: string | null) {
  if (language === 'hi') return { base: 'NotoSerifDevanagari', bold: 'NotoSerifDevanagari', italic: 'NotoSerifDevanagari' }
  if (language === 'ta') return { base: 'NotoSerifTamil', bold: 'NotoSerifTamil', italic: 'NotoSerifTamil' }

  const family = (customFamily && DEFAULT_FONTS[customFamily]) || 'Times-Roman'
  const bold = family === 'Times-Roman' ? 'Times-Bold' : family === 'Helvetica' ? 'Helvetica-Bold' : family === 'Courier' ? 'Courier-Bold' : family
  const italic = family === 'Times-Roman' ? 'Times-Italic' : family === 'Helvetica' ? 'Helvetica-Oblique' : family === 'Courier' ? 'Courier-Oblique' : family

  return { base: family, bold, italic }
}

// ─── Indian Court Document Formatting Standards ───────────────────────────────
// Font  : Times-Roman (built-in PDF standard font, equivalent to Times New Roman)
// Body  : 12pt, justified, 1.5 line spacing
// Margin: Left 1.5" (108pt) · Right 1" (72pt) · Top 1.25" (90pt) · Bottom 1" (72pt)
// Gutter: Extra left margin mirrors typical HC filing requirements
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BODY_SIZE = 12

const BODY_SIZE = 12
const HEADING1_SIZE = 14   // Document title / case caption
const HEADING2_SIZE = 12   // Section headings (ALL CAPS)
const SMALL_SIZE = 9    // Header meta / disclaimer

function makeStyles(f: { base: string; bold: string; italic: string }, customSize?: number | null, customColor?: string | null) {
  const bodySize = customSize || DEFAULT_BODY_SIZE
  const bodyColor = customColor || '#000000'
  return StyleSheet.create({
    page: {
      paddingTop: 90,       // 1.25"
      paddingBottom: 72,    // 1"
      paddingLeft: 108,     // 1.5" — standard HC left margin
      paddingRight: 72,     // 1"
      backgroundColor: '#FFFFFF',
      fontSize: bodySize,
      fontFamily: f.base,
      color: bodyColor,
    },

    // ── Advocate letterhead ────────────────────────────────────────────────────
    headerName: {
      fontSize: HEADING1_SIZE,
      fontFamily: f.bold,
      textAlign: 'center',
      marginBottom: 3,
    },
    headerMeta: {
      fontSize: SMALL_SIZE,
      fontFamily: f.base,
      textAlign: 'center',
      color: '#333333',
      marginBottom: 3,
    },
    headerDate: {
      fontSize: SMALL_SIZE,
      fontFamily: f.base,
      textAlign: 'right',
      color: '#333333',
      marginBottom: 6,
    },
    divider: {
      borderBottomWidth: 1,
      borderBottomColor: '#000000',
      marginBottom: 14,
      marginTop: 2,
    },

    // ── Heading hierarchy ──────────────────────────────────────────────────────
    h1: {
      fontSize: HEADING1_SIZE,
      fontFamily: f.bold,
      textAlign: 'center',
      marginTop: 14,
      marginBottom: 8,
      textDecoration: 'underline',
    },
    h2: {
      fontSize: HEADING2_SIZE,
      fontFamily: f.bold,
      textAlign: 'left',
      marginTop: 14,
      marginBottom: 6,
    },
    h3: {
      fontSize: BODY_SIZE,
      fontFamily: f.bold,
      textAlign: 'left',
      marginTop: 10,
      marginBottom: 4,
    },

    // ── Body paragraph ─────────────────────────────────────────────────────────
    paragraph: {
      fontSize: BODY_SIZE,
      fontFamily: f.base,
      textAlign: 'justify',
      lineHeight: 1.5,
      marginBottom: 8,
    },

    // ── Numbered clause (1. / 1.1) — 0.5" first-level indent ─────────────────
    clause: {
      fontSize: BODY_SIZE,
      fontFamily: f.base,
      textAlign: 'justify',
      lineHeight: 1.5,
      paddingLeft: 36,
      marginBottom: 6,
    },

    // ── Sub-clause (a) / (i) — 0.75" indent ──────────────────────────────────
    subClause: {
      fontSize: BODY_SIZE,
      fontFamily: f.base,
      textAlign: 'justify',
      lineHeight: 1.5,
      paddingLeft: 54,
      marginBottom: 4,
    },

    // ── Bullet / dash items ───────────────────────────────────────────────────
    bullet: {
      fontSize: BODY_SIZE,
      fontFamily: f.base,
      textAlign: 'justify',
      lineHeight: 1.5,
      paddingLeft: 36,
      marginBottom: 4,
    },

    // ── Signature / valediction block — right-aligned ─────────────────────────
    valediction: {
      fontSize: BODY_SIZE,
      fontFamily: f.base,
      textAlign: 'right',
      lineHeight: 1.5,
      marginTop: 6,
      marginBottom: 4,
    },

    // ── Disclaimer / footer note ───────────────────────────────────────────────
    disclaimer: {
      fontSize: SMALL_SIZE,
      fontFamily: f.italic,
      color: '#555555',
      marginTop: 20,
      borderTopWidth: 0.5,
      borderTopColor: '#888888',
      paddingTop: 6,
    },

    // ── Page number footer ────────────────────────────────────────────────────
    pageNumber: {
      position: 'absolute',
      fontSize: SMALL_SIZE,
      fontFamily: f.base,
      bottom: 36,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: '#555555',
    },
  })
}

// ─── Line classifier ──────────────────────────────────────────────────────────
type LineType = 'h1' | 'h2' | 'h3' | 'clause' | 'subClause' | 'bullet' | 'valediction' | 'disclaimer' | 'blank' | 'paragraph'

function classifyLine(raw: string): { type: LineType; text: string } {
  const line = raw.trim()
  if (!line) return { type: 'blank', text: '' }

  // Markdown H1
  if (/^#\s+/.test(line)) return { type: 'h1', text: line.replace(/^#+\s*/, '') }
  // Markdown H2/H3
  if (/^#{2,3}\s+/.test(line)) return { type: 'h2', text: line.replace(/^#+\s*/, '') }

  // Disclaimer
  if (/^(disclaimer|note)\s*:/i.test(line)) return { type: 'disclaimer', text: line }

  // ALL-CAPS section headings (e.g. "FACTS OF THE MATTER", "RELIEF SOUGHT:")
  if (/^[A-Z][A-Z\s\/\-&,().]{4,}:?$/.test(line)) return { type: 'h2', text: line }

  // Numbered clause: "1.", "2.", "3."
  if (/^\d+\.\s/.test(line)) return { type: 'clause', text: line }
  // Sub-clause: "1.1", "1.2.3"
  if (/^\d+\.\d+/.test(line)) return { type: 'subClause', text: line }
  // Lettered sub-clause: "(a)", "(i)", "a.", "i."
  if (/^(\([a-z]+\)|[a-z]+\.)\s/i.test(line)) return { type: 'subClause', text: line }

  // Bullet / dash
  if (/^[-•*]\s/.test(line)) return { type: 'bullet', text: line }

  // Valediction / signature lines
  if (/^(yours (faithfully|truly|sincerely)|sd\/-?|signature|advocate for|counsel for|place\s*:|date\s*:)/i.test(line))
    return { type: 'valediction', text: line }

  return { type: 'paragraph', text: line }
}

// ─── PDF Component ────────────────────────────────────────────────────────────
function LegalDocumentPDF({
  content,
  title,
  profile,
  language = 'en',
}: {
  content: string
  title: string
  profile: Profile | null
  language?: Language
}) {
  const styles = makeStyles(
    getLangFonts(language, profile?.font_family),
    profile?.font_size,
    profile?.font_color
  )
  const rawLines = content.split('\n')
  const classified = rawLines.map(classifyLine).filter(l => l.type !== 'blank')

  const advocateInfo = [
    profile?.bar_council_no ? `Enrollment No: ${profile.bar_council_no}` : '',
    profile?.firm_name || '',
    profile?.office_address || '',
  ].filter(Boolean).join('  ·  ')

  return (
    <Document title={title} author={profile?.full_name || 'LexDraft'} creator="LexDraft — Sirah Legal">
      <Page size="A4" style={styles.page} wrap>
        {/* ── Letterhead ─────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerName, { textAlign: 'left' }]}>{profile?.full_name || 'Advocate'}</Text>
            {advocateInfo ? <Text style={[styles.headerMeta, { textAlign: 'left' }]}>{advocateInfo}</Text> : null}
          </View>
          {profile?.logo_url && (
            <img src={profile.logo_url} style={{ width: 60, height: 60, objectFit: 'contain' }} />
          )}
        </View>
        <Text style={styles.headerDate}>Date: {formatDate(new Date())}</Text>
        <View style={styles.divider} />

        {/* ── Body ───────────────────────────────────────────── */}
        {classified.map((line, i) => {
          switch (line.type) {
            case 'h1': return <Text key={i} style={styles.h1} wrap={false}>{line.text}</Text>
            case 'h2': return <Text key={i} style={styles.h2} wrap={false}>{line.text}</Text>
            case 'h3': return <Text key={i} style={styles.h3} wrap={false}>{line.text}</Text>
            case 'clause': return <Text key={i} style={styles.clause}              >{line.text}</Text>
            case 'subClause': return <Text key={i} style={styles.subClause}           >{line.text}</Text>
            case 'bullet': return <Text key={i} style={styles.bullet}              >{line.text}</Text>
            case 'valediction': return <Text key={i} style={styles.valediction}         >{line.text}</Text>
            case 'disclaimer': return <Text key={i} style={styles.disclaimer}          >{line.text}</Text>
            default: return <Text key={i} style={styles.paragraph}           >{line.text}</Text>
          }
        })}

        {/* ── Page number ────────────────────────────────────── */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `— ${pageNumber} of ${totalPages} —`}
          fixed
        />
      </Page>
    </Document>
  )
}

export async function getPdfBlob(
  content: string,
  title: string,
  profile: Profile | null,
  language: Language = 'en'
): Promise<Blob> {
  return await pdf(
    <LegalDocumentPDF content={content} title={title} profile={profile} language={language} />
  ).toBlob()
}

export async function exportToPdf(
  content: string,
  title: string,
  profile: Profile | null,
  language: Language = 'en'
): Promise<void> {
  const blob = await getPdfBlob(content, title, profile, language)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_')}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
