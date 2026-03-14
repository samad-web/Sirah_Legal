import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Upload, CheckCircle, AlertTriangle, FileText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { generateDocument, type Language } from '@/lib/generate'
import { saveDocument, incrementDocumentCount } from '@/lib/supabase'
import { exportToPdf } from '@/lib/pdf-export'
import { exportToDocx } from '@/lib/docx-export'
import { DocumentPreview } from '@/components/ui/DocumentPreview'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { INDIAN_STATES, formatDate } from '@/lib/utils'
import { DateConfirmModal } from '@/components/ui/DateConfirmModal'

const DOCUMENT_TYPES = [
  { id: 'sale-deed', label: 'Sale Deed(s)', multiple: true },
  { id: 'ec', label: 'Encumbrance Certificate (EC)' },
  { id: 'patta', label: 'Patta / Chitta / RTC' },
  { id: 'survey', label: 'Survey Sketch / FMB' },
  { id: 'prior-deeds', label: 'Prior Title Deeds', multiple: true },
  { id: 'other', label: 'Any Other' },
]

interface UploadedFile { id: string; file: File }
type UploadedFiles = Record<string, UploadedFile[]>

interface FormData {
  surveyNo: string
  extent: string
  extentUnit: 'sqft' | 'acres'
  village: string
  taluk: string
  district: string
  state: string
  purpose: string
  searchFrom: string
  preparedFor: string
  languages: Language[]
}

function buildTitlePrompt(form: FormData, uploadedFiles: UploadedFiles, date: string, language: Language): string {
  const fileList = Object.entries(uploadedFiles)
    .filter(([, files]) => files.length > 0)
    .map(([id, files]) => `- ${DOCUMENT_TYPES.find(d => d.id === id)?.label}: ${files.map(f => f.file.name).join(', ')}`)
    .join('\n')

  return `Generate a formal Property Title Research Report for the following property:

PROPERTY DETAILS:
- Survey / Khasra No.: ${form.surveyNo || '[NOT PROVIDED]'}
- Extent: ${form.extent} ${form.extentUnit}
- Village / Locality: ${form.village}
- Taluk / Tehsil: ${form.taluk}
- District: ${form.district}
- State: ${form.state}
- Purpose of Report: ${form.purpose}
- Search Period: From ${form.searchFrom} to ${new Date().getFullYear()}

DOCUMENTS AVAILABLE FOR REVIEW:
${fileList || 'No documents uploaded — generate based on details provided'}

REPORT DETAILS:
- Prepared For: ${form.preparedFor}
- Prepared By: Advocate [NAME]
- Date: ${date}

LANGUAGE: ${language === 'en' ? 'English' : language === 'ta' ? 'Tamil' : 'Hindi'}

Generate the complete title research report with all required sections:
1. Title Block
2. Chain of Title Table (infer reasonable chain based on context)
3. Encumbrances & Charges
4. Statutory Compliance
5. Gap Analysis (flag any title gaps with ⚠ GAP IN TITLE)
6. Opinion on Title (CLEAR AND MARKETABLE / CONDITIONALLY CLEAR / DEFECTIVE)
7. Documents Reviewed
8. Disclaimer`
}

export default function TitleReportPage() {
  const { profile, user } = useAuth()
  const [form, setForm] = useState<FormData>({
    surveyNo: '',
    extent: '',
    extentUnit: 'sqft',
    village: '',
    taluk: '',
    district: '',
    state: profile?.default_state || '',
    purpose: '',
    searchFrom: String(new Date().getFullYear() - 30),
    preparedFor: '',
    languages: [(profile?.default_language as Language) || 'en'],
  })
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({})
  const [documents, setDocuments] = useState<Record<string, string>>({})
  const [activeDocLang, setActiveDocLang] = useState<Language>('en')
  const [isGenerating, setIsGenerating] = useState(false)
  const [documentTitle, setDocumentTitle] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [showDateModal, setShowDateModal] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleFileUpload = (docId: string, files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files).map(f => ({ id: Math.random().toString(36).slice(2), file: f }))
    setUploadedFiles(prev => ({
      ...prev,
      [docId]: [...(prev[docId] || []), ...newFiles],
    }))
  }

  const removeFile = (docId: string, fileId: string) => {
    setUploadedFiles(prev => ({
      ...prev,
      [docId]: (prev[docId] || []).filter(f => f.id !== fileId),
    }))
  }

  const toggleLanguage = (lang: Language) => {
    setForm(prev => {
      const has = prev.languages.includes(lang)
      if (has && prev.languages.length === 1) return prev
      return { ...prev, languages: has ? prev.languages.filter(l => l !== lang) : [...prev.languages, lang] }
    })
  }

  const handleGenerateClick = () => setShowDateModal(true)

  const handleGenerate = async (date: string) => {
    setShowDateModal(false)
    const baseTitle = `Title Report — ${form.village}, ${form.district}, ${form.state}`
    setIsGenerating(true)
    setDocuments({})
    setGenerateError('')
    setDocumentTitle(baseTitle)

    const langLabels: Record<Language, string> = { en: 'EN', ta: 'TA', hi: 'HI' }
    const multiLang = form.languages.length > 1

    for (const lang of form.languages) {
      setActiveDocLang(lang)
      const title = multiLang ? `${baseTitle} [${langLabels[lang]}]` : baseTitle
      try {
        const result = await generateDocument(
          {
            module: 'title-report',
            language: lang,
            payload: { prompt: buildTitlePrompt(form, uploadedFiles, date, lang) },
          },
          (chunk) => setDocuments(prev => ({ ...prev, [lang]: chunk }))
        )
        if (result.document) {
          setDocuments(prev => ({ ...prev, [lang]: result.document as string }))
          if (user) {
            saveDocument({
              user_id: user.id, title, type: 'title-report', language: lang,
              content: result.document, analysis: null, status: 'draft',
            })
              .then(() => {
                incrementDocumentCount(user.id)
                window.dispatchEvent(new CustomEvent('lexdraft:document-saved'))
              })
              .catch(err => console.error('[LexDraft] Failed to save title report to DB:', err))
          }
        }
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : `Generation failed for ${lang}. Check console for details.`)
        console.error(err)
        break
      }
    }
    setIsGenerating(false)
  }

  const canGenerate = form.village && form.district && form.state && form.preparedFor

  return (
    <div className="flex h-full">
      {/* Form (left 3-pane area) */}
      <div className="w-[45%] border-r border-[rgba(201,168,76,0.15)] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(201,168,76,0.15)] bg-[#0a0a0a]">
          <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>
            MODULE 03
          </p>
          <h1 className="text-[26px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
            Title Research Report
          </h1>
        </div>

        <div className="px-6 py-6 space-y-6 flex-1">
          {/* Property Details */}
          <section>
            <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-4" style={{ fontFamily: 'DM Mono, monospace' }}>
              PROPERTY DETAILS
            </p>
            <div className="space-y-4">
              <FormField label="Survey / Khasra No.">
                <Input value={form.surveyNo} onChange={e => setField('surveyNo', e.target.value)} placeholder="e.g. S.No. 123/4A" />
              </FormField>

              <div className="flex gap-3">
                <div className="flex-1">
                  <FormField label="Extent">
                    <Input type="number" value={form.extent} onChange={e => setField('extent', e.target.value)} placeholder="e.g. 2400" />
                  </FormField>
                </div>
                <div className="w-28">
                  <FormField label="Unit">
                    <Select value={form.extentUnit} onChange={e => setField('extentUnit', e.target.value as 'sqft' | 'acres')}
                      options={[{ value: 'sqft', label: 'Sq. Ft.' }, { value: 'acres', label: 'Acres' }]} />
                  </FormField>
                </div>
              </div>

              <FormField label="Village / Locality" required>
                <Input value={form.village} onChange={e => setField('village', e.target.value)} placeholder="Village or locality name" />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Taluk / Tehsil">
                  <Input value={form.taluk} onChange={e => setField('taluk', e.target.value)} />
                </FormField>
                <FormField label="District" required>
                  <Input value={form.district} onChange={e => setField('district', e.target.value)} />
                </FormField>
              </div>

              <FormField label="State" required>
                <Select value={form.state} onChange={e => setField('state', e.target.value)} placeholder="Select state..."
                  options={INDIAN_STATES.map(s => ({ value: s, label: s }))} />
              </FormField>

              <FormField label="Purpose">
                <Select value={form.purpose} onChange={e => setField('purpose', e.target.value)} placeholder="Purpose of report..."
                  options={[
                    { value: 'purchase', label: 'Purchase' },
                    { value: 'mortgage', label: 'Mortgage' },
                    { value: 'court', label: 'Court Submission' },
                    { value: 'due-diligence', label: 'Due Diligence' },
                  ]} />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Search Period From">
                  <Input type="number" value={form.searchFrom} onChange={e => setField('searchFrom', e.target.value)} />
                </FormField>
                <FormField label="To">
                  <Input value={String(new Date().getFullYear())} disabled className="opacity-50" />
                </FormField>
              </div>
            </div>
          </section>

          <div className="gold-line-solid" />

          {/* Document Uploads */}
          <section>
            <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-4" style={{ fontFamily: 'DM Mono, monospace' }}>
              DOCUMENT UPLOADS <span className="text-[rgba(250,247,240,0.3)] normal-case">(optional)</span>
            </p>
            <div className="space-y-2">
              {DOCUMENT_TYPES.map((docType) => {
                const files = uploadedFiles[docType.id] || []
                return (
                  <div key={docType.id} className="p-3 bg-[#161616] border border-[rgba(201,168,76,0.15)] flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[12px] text-[rgba(250,247,240,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                        {docType.label}
                      </p>
                      {files.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {files.map(f => (
                            <div key={f.id} className="flex items-center gap-2">
                              <CheckCircle size={11} className="text-green-400" />
                              <span className="text-[10px] text-[rgba(250,247,240,0.5)] truncate" style={{ fontFamily: 'DM Mono, monospace' }}>
                                {f.file.name}
                              </span>
                              <button onClick={() => removeFile(docType.id, f.id)} className="text-[rgba(250,247,240,0.3)] hover:text-[#f87171] ml-auto text-[10px]">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileRefs.current[docType.id]?.click()}
                      className="flex items-center gap-1.5 px-2 py-1 border border-[rgba(201,168,76,0.3)] text-[10px] text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0] hover:border-[rgba(201,168,76,0.6)] transition-all shrink-0"
                      style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                      <Upload size={11} />
                      UPLOAD
                    </button>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      multiple={docType.multiple}
                      className="hidden"
                      ref={el => { fileRefs.current[docType.id] = el }}
                      onChange={e => handleFileUpload(docType.id, e.target.files)}
                    />
                  </div>
                )
              })}
            </div>
          </section>

          <div className="gold-line-solid" />

          {/* Report Config */}
          <section>
            <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-4" style={{ fontFamily: 'DM Mono, monospace' }}>
              REPORT CONFIGURATION
            </p>
            <div className="space-y-4">
              <FormField label="Prepared For" required>
                <Input value={form.preparedFor} onChange={e => setField('preparedFor', e.target.value)} placeholder="Client / bank name" />
              </FormField>
              <FormField label="Prepared By">
                <Input value={profile?.full_name || 'Advocate'} disabled className="opacity-60" />
              </FormField>
              <FormField label="Report Date">
                <Input value={formatDate(new Date())} disabled className="opacity-60" />
              </FormField>
              <FormField label="Language">
                <div className="flex gap-0">
                  {[{ v: 'en', l: 'English' }, { v: 'ta', l: 'Tamil' }, { v: 'hi', l: 'Hindi' }].map(({ v, l }) => (
                    <button key={v} onClick={() => toggleLanguage(v as Language)}
                      className={`flex-1 py-2 text-[12px] border transition-all ${form.languages.includes(v as Language) ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.5)] text-[#F5EDD6]' : 'bg-[#161616] border-[rgba(201,168,76,0.2)] text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0]'}`}
                      style={{ fontFamily: 'DM Mono, monospace' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </FormField>
            </div>
          </section>
        </div>

        {/* Generate button */}
        {generateError && (
          <div className="px-6 py-3 bg-[rgba(248,113,113,0.08)] border-t border-[rgba(248,113,113,0.3)]">
            <p className="text-[11px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>ERROR: {generateError}</p>
          </div>
        )}
        <div className="px-6 py-4 border-t border-[rgba(201,168,76,0.15)] bg-[#0a0a0a]">
          <Button
            variant="primary"
            size="lg"
            loading={isGenerating}
            disabled={!canGenerate}
            onClick={handleGenerateClick}
            icon={<MapPin size={15} />}
            className="w-full justify-center text-[16px]"
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
          >
            {isGenerating ? 'Generating Report...' : 'Generate Title Report'}
          </Button>
        </div>
      </div>

      {showDateModal && (
        <DateConfirmModal
          onConfirm={handleGenerate}
          onCancel={() => setShowDateModal(false)}
        />
      )}

      {/* Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {Object.keys(documents).length > 1 && (
          <div className="flex border-b border-[rgba(201,168,76,0.15)] bg-[#0a0a0a]">
            {(Object.keys(documents) as Language[]).map(lang => (
              <button
                key={lang}
                onClick={() => setActiveDocLang(lang)}
                className={`px-4 py-2 text-[11px] tracking-widest border-r border-[rgba(201,168,76,0.15)] transition-all ${activeDocLang === lang
                    ? 'bg-[#1B3A2D] text-[#F5EDD6]'
                    : 'text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0]'
                  }`}
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                {lang === 'en' ? 'ENGLISH' : lang === 'ta' ? 'TAMIL' : 'HINDI'}
              </button>
            ))}
          </div>
        )}
        <DocumentPreview
          content={documents[activeDocLang] ?? ''}
          isGenerating={isGenerating}
          title={documentTitle || 'Title Research Report'}
          onExportPdf={() => exportToPdf(documents[activeDocLang] ?? '', documentTitle, profile, activeDocLang)}
          onExportDocx={() => exportToDocx(documents[activeDocLang] ?? '', documentTitle, profile, activeDocLang)}
          className="flex-1"
        />
      </div>
    </div>
  )
}
