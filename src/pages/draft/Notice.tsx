import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Feather, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { generateDocument, type Language } from '@/lib/generate'
import { saveDocument, incrementDocumentCount } from '@/lib/api'
import { exportToPdf } from '@/lib/pdf-export'
import { exportToDocx } from '@/lib/docx-export'
import { DocumentPreview } from '@/components/ui/DocumentPreview'
import {
  FormField, Input, Textarea, Select,
  ProgressSteps, SelectionCard,
} from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { INDIAN_STATES, RELEVANT_ACTS } from '@/lib/utils'
import { DateConfirmModal } from '@/components/ui/DateConfirmModal'

type NoticeType =
  | 'money-recovery'
  | 'property-dispute'
  | 'service-deficiency'
  | 'employment-matter'
  | 'demand-letter'
  | 'rejoinder'

interface FormData {
  noticeType: NoticeType | ''
  senderName: string
  senderAddress: string
  advocateName: string
  barCouncilNo: string
  recipientName: string
  recipientAddress: string
  facts: string
  relief: string
  deadline: string
  state: string
  relevantAct: string
  languages: Language[]
  tone: 'professional' | 'firm' | 'urgent'
}

const NOTICE_TYPES = [
  { value: 'money-recovery', label: 'Legal Notice — Money Recovery' },
  { value: 'property-dispute', label: 'Legal Notice — Property Dispute' },
  { value: 'service-deficiency', label: 'Legal Notice — Service Deficiency' },
  { value: 'employment-matter', label: 'Legal Notice — Employment Matter' },
  { value: 'demand-letter', label: 'Demand Letter' },
  { value: 'rejoinder', label: 'Rejoinder / Reply to Notice' },
]

const STEPS = ['DOCUMENT TYPE', 'PARTY DETAILS', 'MATTER DETAILS', 'PREFERENCES']

function buildNoticePrompt(form: FormData, date: string, language: Language): string {
  return `Draft a ${form.noticeType?.replace('-', ' ')} legal notice with the following details:

DATE OF NOTICE: ${date}

SENDER / ADVOCATE DETAILS:
- Client Name: ${form.senderName}
- Client Address: ${form.senderAddress}
- Advocate Name: ${form.advocateName}
- Bar Council Enrollment No: ${form.barCouncilNo}

RECIPIENT:
- Name: ${form.recipientName}
- Address: ${form.recipientAddress}

FACTS OF THE MATTER:
${form.facts}

RELIEF SOUGHT:
${form.relief}

COMPLIANCE DEADLINE: ${form.deadline} days from receipt of notice
GOVERNING STATE: ${form.state}
RELEVANT ACT: ${form.relevantAct}

LANGUAGE: ${language === 'en' ? 'English' : language === 'ta' ? 'Tamil' : 'Hindi'}
TONE: ${form.tone}

Draft a complete, formal legal notice. Include all standard sections: advocate header, date, recipient address, subject line, facts numbered, legal basis, relief demanded, deadline, consequences, valediction, and advocate signature block.`
}

export default function DraftNoticePage() {
  const { profile, user } = useAuth()
  const [step, setStep] = useState(0)
  const [mobilePanel, setMobilePanel] = useState<'form' | 'preview'>('form')
  const [form, setForm] = useState<FormData>({
    noticeType: '',
    senderName: '',
    senderAddress: '',
    advocateName: profile?.full_name || '',
    barCouncilNo: profile?.bar_council_no || '',
    recipientName: '',
    recipientAddress: '',
    facts: '',
    relief: '',
    deadline: '30',
    state: profile?.default_state || '',
    relevantAct: '',
    languages: [(profile?.default_language as Language) || 'en'],
    tone: 'professional',
  })
  const [documents, setDocuments] = useState<Record<string, string>>({})
  const [activeDocLang, setActiveDocLang] = useState<Language>('en')
  const [isGenerating, setIsGenerating] = useState(false)
  const [documentTitle, setDocumentTitle] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [showDateModal, setShowDateModal] = useState(false)

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    // Auto-fill relevant act when notice type changes
    if (key === 'noticeType' && value) {
      const acts = RELEVANT_ACTS[value as string]
      if (acts?.length) setForm(prev => ({ ...prev, [key]: value, relevantAct: acts[0] }))
    }
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
    if (!form.noticeType) return
    const baseTitle = `${NOTICE_TYPES.find(t => t.value === form.noticeType)?.label} — ${form.recipientName}`
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
            module: 'notice',
            language: lang,
            payload: { prompt: buildNoticePrompt(form, date, lang) },
          },
          (chunk) => setDocuments(prev => ({ ...prev, [lang]: chunk } as Record<string, string>))
        )
        if (result.document) {
          setDocuments(prev => ({ ...prev, [lang]: result.document } as Record<string, string>))
          if (user) {
            saveDocument({
              user_id: user.id,
              title,
              type: 'notice',
              language: lang,
              content: result.document,
              analysis: null,
              status: 'draft',
            })
              .then(() => {
                incrementDocumentCount(user.id)
                window.dispatchEvent(new CustomEvent('lexdraft:document-saved'))
              })
              .catch(err => console.error('[LexDraft] Failed to save notice to DB:', err))
          }
        }
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : `Generation failed for ${lang}`)
        console.error(err)
        break
      }
    }
    setIsGenerating(false)
  }

  const canProceed = (): boolean => {
    if (step === 0) return !!form.noticeType
    if (step === 1) return !!(form.senderName && form.advocateName && form.recipientName)
    if (step === 2) return !!(form.facts && form.relief)
    return true
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mobile panel tabs */}
      <div className="flex md:hidden border-b border-[rgba(201,168,76,0.15)] bg-[#0a0a0a] shrink-0">
        {(['form', 'preview'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setMobilePanel(p)}
            className={`flex-1 py-2.5 text-[11px] tracking-widest transition-colors ${mobilePanel === p ? 'bg-[#1B3A2D] text-[#F5EDD6]' : 'text-[rgba(250,247,240,0.4)]'}`}
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
      {/* Form panel */}
      <div className={`${mobilePanel === 'form' ? 'flex' : 'hidden'} md:flex w-full md:w-[45%] flex-col border-r border-[rgba(201,168,76,0.15)] overflow-y-auto`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(201,168,76,0.15)] bg-[#0a0a0a]">
          <p
            className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-1"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            MODULE 01
          </p>
          <h1
            className="text-[26px] text-[#FAF7F0]"
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}
          >
            Legal Notice & Rejoinder
          </h1>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-[rgba(201,168,76,0.08)] overflow-x-auto">
          <ProgressSteps steps={STEPS} current={step} onStepClick={(i) => i < step && setStep(i)} />
        </div>

        {/* Form steps */}
        <div className="flex-1 px-6 py-6">
          <AnimatePresence mode="wait">
            {/* Step 0 — Document Type */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <p className="text-[13px] text-[rgba(250,247,240,0.5)] mb-5" style={{ fontFamily: 'Lora, serif' }}>
                  Select the type of document you need to draft.
                </p>
                {NOTICE_TYPES.map((type) => (
                  <SelectionCard
                    key={type.value}
                    selected={form.noticeType === type.value}
                    onClick={() => setField('noticeType', type.value as NoticeType)}
                    title={type.label}
                  />
                ))}
              </motion.div>
            )}

            {/* Step 1 — Party Details */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <p className="text-[12px] text-[rgba(201,168,76,0.7)] mb-4 tracking-widest" style={{ fontFamily: 'DM Mono, monospace' }}>
                  SENDER DETAILS
                </p>
                {[
                  { key: 'senderName', label: 'Sender Full Name', required: true },
                  { key: 'advocateName', label: "Sender's Advocate Name", required: true },
                  { key: 'barCouncilNo', label: 'Bar Council Enrollment No.', required: true },
                ].map((field) => (
                  <motion.div
                    key={field.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * Object.keys(form).indexOf(field.key) }}
                  >
                    <FormField label={field.label} required={field.required}>
                      <Input
                        value={form[field.key as keyof FormData] as string}
                        onChange={(e) => setField(field.key as keyof FormData, e.target.value)}
                        placeholder={field.label}
                      />
                    </FormField>
                  </motion.div>
                ))}
                <FormField label="Sender Address" required>
                  <Textarea
                    value={form.senderAddress}
                    onChange={(e) => setField('senderAddress', e.target.value)}
                    placeholder="Full address..."
                    rows={3}
                  />
                </FormField>

                <div className="gold-line-solid my-5" />

                <p className="text-[12px] text-[rgba(201,168,76,0.7)] mb-4 tracking-widest" style={{ fontFamily: 'DM Mono, monospace' }}>
                  RECIPIENT DETAILS
                </p>
                <FormField label="Recipient Full Name" required>
                  <Input
                    value={form.recipientName}
                    onChange={(e) => setField('recipientName', e.target.value)}
                    placeholder="Full name of the notice recipient"
                  />
                </FormField>
                <FormField label="Recipient Address" required>
                  <Textarea
                    value={form.recipientAddress}
                    onChange={(e) => setField('recipientAddress', e.target.value)}
                    placeholder="Full address..."
                    rows={3}
                  />
                </FormField>
              </motion.div>
            )}

            {/* Step 2 — Matter Details */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <FormField label="Facts of the Matter" required hint="Describe the facts chronologically.">
                  <Textarea
                    value={form.facts}
                    onChange={(e) => setField('facts', e.target.value)}
                    placeholder="State the complete facts chronologically..."
                    rows={8}
                    showCounter
                    maxWords={500}
                    className="leading-relaxed"
                  />
                </FormField>

                <FormField label="Relief / Demand Sought" required hint="What action do you demand from the recipient?">
                  <Textarea
                    value={form.relief}
                    onChange={(e) => setField('relief', e.target.value)}
                    placeholder="Payment of ₹___ / Vacate the premises / etc."
                    rows={4}
                  />
                </FormField>

                <FormField label="Compliance Deadline">
                  <Select
                    value={form.deadline}
                    onChange={(e) => setField('deadline', e.target.value)}
                    options={[
                      { value: '15', label: '15 days from receipt' },
                      { value: '30', label: '30 days from receipt' },
                      { value: '60', label: '60 days from receipt' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                </FormField>

                <FormField label="Governing State">
                  <Select
                    value={form.state}
                    onChange={(e) => setField('state', e.target.value)}
                    placeholder="Select state..."
                    options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
                  />
                </FormField>

                <FormField label="Relevant Act">
                  <Input
                    value={form.relevantAct}
                    onChange={(e) => setField('relevantAct', e.target.value)}
                    placeholder="e.g. Negotiable Instruments Act, 1881"
                  />
                </FormField>
              </motion.div>
            )}

            {/* Step 3 — Preferences */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <FormField label="Output Language">
                  <div className="flex gap-0">
                    {[
                      { value: 'en', label: 'English' },
                      { value: 'ta', label: 'Tamil' },
                      { value: 'hi', label: 'Hindi' },
                    ].map((ln) => (
                      <button
                        key={ln.value}
                        onClick={() => toggleLanguage(ln.value as Language)}
                        className={`flex-1 py-2 text-[12px] border transition-all ${
                          form.languages.includes(ln.value as Language)
                            ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.5)] text-[#F5EDD6]'
                            : 'bg-[#161616] border-[rgba(201,168,76,0.2)] text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0]'
                        }`}
                        style={{ fontFamily: 'DM Mono, monospace' }}
                      >
                        {ln.label}
                      </button>
                    ))}
                  </div>
                </FormField>

                <FormField label="Tone">
                  <div className="space-y-2">
                    {[
                      { value: 'professional', label: 'Professional', desc: 'Formal, measured — standard legal tone' },
                      { value: 'firm', label: 'Firm', desc: 'Assertive, decisive — elevated pressure' },
                      { value: 'urgent', label: 'Urgent', desc: 'High stakes — immediate compliance demanded' },
                    ].map((t) => (
                      <SelectionCard
                        key={t.value}
                        selected={form.tone === t.value}
                        onClick={() => setField('tone', t.value as 'professional' | 'firm' | 'urgent')}
                        title={t.label}
                        description={t.desc}
                      />
                    ))}
                  </div>
                </FormField>

                {/* Summary */}
                <div className="bg-[#161616] border border-[rgba(201,168,76,0.15)] p-4 space-y-2">
                  <p className="text-[10px] tracking-widest text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    SUMMARY
                  </p>
                  {[
                    ['Type', NOTICE_TYPES.find(t => t.value === form.noticeType)?.label],
                    ['Sender', form.senderName],
                    ['Recipient', form.recipientName],
                    ['Deadline', `${form.deadline} days`],
                  ].map(([k, v]) => v && (
                    <div key={k} className="flex gap-3">
                      <span className="text-[10px] text-[rgba(250,247,240,0.35)] w-20 shrink-0" style={{ fontFamily: 'DM Mono, monospace' }}>{k}</span>
                      <span className="text-[12px] text-[rgba(250,247,240,0.7)] truncate" style={{ fontFamily: 'Lora, serif' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav + Generate */}
        {generateError && (
          <div className="px-6 py-3 bg-[rgba(248,113,113,0.08)] border-t border-[rgba(248,113,113,0.3)]">
            <p className="text-[11px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>ERROR: {generateError}</p>
          </div>
        )}
        <div className="px-6 py-4 border-t border-[rgba(201,168,76,0.15)] bg-[#0a0a0a] flex items-center justify-between gap-4">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronLeft size={14} />}
              onClick={() => setStep(s => s - 1)}
            >
              BACK
            </Button>
          ) : <div />}

          {step < 3 ? (
            <Button
              variant="primary"
              size="md"
              disabled={!canProceed()}
              onClick={() => setStep(s => s + 1)}
              className="ml-auto"
            >
              NEXT <ChevronRight size={14} />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              loading={isGenerating}
              disabled={!canProceed()}
              onClick={handleGenerateClick}
              icon={<Feather size={15} />}
              className="ml-auto text-[15px]"
              style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
            >
              {isGenerating ? 'Generating...' : 'Generate Notice'}
            </Button>
          )}
        </div>
      </div>

      {showDateModal && (
        <DateConfirmModal
          onConfirm={handleGenerate}
          onCancel={() => setShowDateModal(false)}
        />
      )}

      {/* Preview panel */}
      <div className={`${mobilePanel === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 flex-col overflow-hidden`}>
        {Object.keys(documents).length > 1 && (
          <div className="flex border-b border-[rgba(201,168,76,0.15)] bg-[#0a0a0a]">
            {(Object.keys(documents) as Language[]).map(lang => (
              <button
                key={lang}
                onClick={() => setActiveDocLang(lang)}
                className={`px-4 py-2 text-[11px] tracking-widest border-r border-[rgba(201,168,76,0.15)] transition-all ${
                  activeDocLang === lang
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
          title={documentTitle || 'Legal Notice'}
          onExportPdf={() => exportToPdf(documents[activeDocLang] ?? '', documentTitle, profile, activeDocLang)}
          onExportDocx={() => exportToDocx(documents[activeDocLang] ?? '', documentTitle, profile, activeDocLang)}
          className="flex-1"
        />
      </div>
      </div>{/* end flex-1 row */}
    </div>
  )
}
