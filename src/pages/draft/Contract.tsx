import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PenLine, ChevronLeft, ChevronRight } from 'lucide-react'
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
import { INDIAN_STATES } from '@/lib/utils'
import { DateConfirmModal } from '@/components/ui/DateConfirmModal'

type ContractType = 'nda' | 'employment' | 'vendor' | 'consultancy' | 'freelance'
type EntityType = 'individual' | 'pvt-ltd' | 'llp' | 'partnership'
type DisputeResolution = 'arbitration' | 'litigation' | 'mediation'

interface PartyDetails {
  name: string
  address: string
  entityType: EntityType
  representedBy: string
}

interface FormData {
  contractType: ContractType | ''
  partyA: PartyDetails
  partyB: PartyDetails
  // NDA fields
  ndaPurpose: string
  ndaDuration: string
  ndaDefinition: string
  ndaExclusions: string
  ndaReturnMaterials: boolean
  ndaNonCompete: boolean
  ndaNonCompeteDuration: string
  // Employment fields
  designation: string
  department: string
  ctc: string
  probationPeriod: string
  noticePeriod: string
  nonSolicitation: boolean
  // General
  governingState: string
  disputeResolution: DisputeResolution
  arbitrationSeat: string
  languages: Language[]
}

const CONTRACT_TYPES = [
  { value: 'nda', label: 'Non-Disclosure Agreement (NDA)', desc: 'Mutual or one-way confidentiality agreement' },
  { value: 'employment', label: 'Employment Agreement', desc: 'Full-time employment contract' },
  { value: 'vendor', label: 'Vendor / Service Agreement', desc: 'B2B service delivery contract' },
  { value: 'consultancy', label: 'Consultancy Agreement', desc: 'Independent consultant engagement' },
  { value: 'freelance', label: 'Freelance Agreement', desc: 'Project-based freelance contract' },
]

const ENTITY_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'pvt-ltd', label: 'Private Limited' },
  { value: 'llp', label: 'LLP' },
  { value: 'partnership', label: 'Partnership' },
]

const STEPS = ['CONTRACT TYPE', 'PARTY DETAILS', 'CONTRACT TERMS', 'JURISDICTION']

const emptyParty = (): PartyDetails => ({
  name: '', address: '', entityType: 'individual', representedBy: '',
})

function buildContractPrompt(form: FormData, date: string, language: Language): string {
  let termsBlock = ''

  if (form.contractType === 'nda') {
    termsBlock = `
NDA TERMS:
- Purpose of Disclosure: ${form.ndaPurpose}
- Duration: ${form.ndaDuration} months
- Confidential Information Definition: ${form.ndaDefinition}
- Exclusions: ${form.ndaExclusions}
- Return of Materials Clause: ${form.ndaReturnMaterials ? 'Yes' : 'No'}
- Non-Compete Clause: ${form.ndaNonCompete ? `Yes — Duration: ${form.ndaNonCompeteDuration} months` : 'No'}`
  } else if (form.contractType === 'employment') {
    termsBlock = `
EMPLOYMENT TERMS:
- Designation: ${form.designation}
- Department: ${form.department}
- CTC (Annual): ₹${form.ctc}
- Probation Period: ${form.probationPeriod} months
- Notice Period: ${form.noticePeriod} days
- Non-Solicitation: ${form.nonSolicitation ? 'Yes' : 'No'}`
  }

  return `Draft a ${form.contractType?.toUpperCase()} under Indian law.

DATE OF AGREEMENT: ${date}

PARTY A:
- Name: ${form.partyA.name}
- Address: ${form.partyA.address}
- Entity Type: ${form.partyA.entityType}
- Represented by: ${form.partyA.representedBy}

PARTY B:
- Name: ${form.partyB.name}
- Address: ${form.partyB.address}
- Entity Type: ${form.partyB.entityType}
- Represented by: ${form.partyB.representedBy}

${termsBlock}

JURISDICTION:
- Governing Law: ${form.governingState}
- Dispute Resolution: ${form.disputeResolution}
${form.disputeResolution === 'arbitration' ? `- Arbitration Seat: ${form.arbitrationSeat}` : ''}

OUTPUT LANGUAGE: ${language === 'en' ? 'English' : language === 'ta' ? 'Tamil' : 'Hindi'}

Draft the complete contract with numbered clauses (1., 1.1, 1.2 etc.), all standard protective clauses under Indian law, and a signature block for both parties.`
}

export default function DraftContractPage() {
  const { profile, user } = useAuth()
  const [step, setStep] = useState(0)
  const [mobilePanel, setMobilePanel] = useState<'form' | 'preview'>('form')
  const [form, setForm] = useState<FormData>({
    contractType: '',
    partyA: emptyParty(),
    partyB: emptyParty(),
    ndaPurpose: '',
    ndaDuration: '12',
    ndaDefinition: '',
    ndaExclusions: '',
    ndaReturnMaterials: true,
    ndaNonCompete: false,
    ndaNonCompeteDuration: '12',
    designation: '',
    department: '',
    ctc: '',
    probationPeriod: '6',
    noticePeriod: '30',
    nonSolicitation: false,
    governingState: profile?.default_state || '',
    disputeResolution: 'arbitration',
    arbitrationSeat: profile?.default_state || '',
    languages: [(profile?.default_language as Language) || 'en'],
  })
  const [documents, setDocuments] = useState<Record<string, string>>({})
  const [activeDocLang, setActiveDocLang] = useState<Language>('en')
  const [isGenerating, setIsGenerating] = useState(false)
  const [documentTitle, setDocumentTitle] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [showDateModal, setShowDateModal] = useState(false)

  const setPartyA = (updates: Partial<PartyDetails>) =>
    setForm(prev => ({ ...prev, partyA: { ...prev.partyA, ...updates } }))
  const setPartyB = (updates: Partial<PartyDetails>) =>
    setForm(prev => ({ ...prev, partyB: { ...prev.partyB, ...updates } }))

  type SimpleStringKey = 'ndaPurpose' | 'ndaDuration' | 'ndaDefinition' | 'ndaExclusions' | 'ndaNonCompeteDuration' |
    'designation' | 'department' | 'ctc' | 'probationPeriod' | 'noticePeriod' |
    'governingState' | 'arbitrationSeat'

  const setField = (key: SimpleStringKey, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

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
    const baseTitle = `${CONTRACT_TYPES.find(t => t.value === form.contractType)?.label} — ${form.partyA.name} & ${form.partyB.name}`
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
          { module: 'contract', language: lang, payload: { prompt: buildContractPrompt(form, date, lang) } },
          (chunk) => setDocuments(prev => ({ ...prev, [lang]: chunk }))
        )
        if (result.document) {
          setDocuments(prev => ({ ...prev, [lang]: result.document }))
          if (user) {
            saveDocument({
              user_id: user.id, title, type: 'contract', language: lang,
              content: result.document, analysis: null, status: 'draft',
            })
              .then(() => {
                incrementDocumentCount(user.id)
                window.dispatchEvent(new CustomEvent('lexdraft:document-saved'))
              })
              .catch(err => console.error('[LexDraft] Failed to save contract to DB:', err))
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
    if (step === 0) return !!form.contractType
    if (step === 1) return !!(form.partyA.name && form.partyB.name)
    if (step === 2) {
      if (form.contractType === 'nda') return !!(form.ndaPurpose && form.ndaDuration)
      if (form.contractType === 'employment') return !!(form.designation && form.ctc)
      return true
    }
    return !!form.governingState
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
      {/* Form */}
      <div className={`${mobilePanel === 'form' ? 'flex' : 'hidden'} md:flex w-full md:w-[45%] flex-col border-r border-[rgba(201,168,76,0.15)] overflow-y-auto`}>
        <div className="px-6 py-4 border-b border-[rgba(201,168,76,0.15)] bg-[#0a0a0a]">
          <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>
            MODULE 02A
          </p>
          <h1 className="text-[26px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
            Contract Drafting
          </h1>
        </div>

        <div className="px-6 py-3 border-b border-[rgba(201,168,76,0.08)] overflow-x-auto">
          <ProgressSteps steps={STEPS} current={step} onStepClick={(i) => i < step && setStep(i)} />
        </div>

        <div className="flex-1 px-6 py-6">
          <AnimatePresence mode="wait">
            {/* Step 0 — Contract Type */}
            {step === 0 && (
              <motion.div key="s0" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-3">
                {CONTRACT_TYPES.map(t => (
                  <SelectionCard
                    key={t.value}
                    selected={form.contractType === t.value}
                    onClick={() => setForm(prev => ({ ...prev, contractType: t.value as ContractType }))}
                    title={t.label}
                    description={t.desc}
                  />
                ))}
              </motion.div>
            )}

            {/* Step 1 — Party Details */}
            {step === 1 && (
              <motion.div key="s1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                {(['A', 'B'] as const).map((party) => {
                  const data = party === 'A' ? form.partyA : form.partyB
                  const setter = party === 'A' ? setPartyA : setPartyB
                  return (
                    <div key={party} className="space-y-3 p-4 bg-[#161616] border border-[rgba(201,168,76,0.15)]">
                      <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                        PARTY {party}
                      </p>
                      <FormField label="Name" required>
                        <Input value={data.name} onChange={e => setter({ name: e.target.value })} placeholder="Full legal name" />
                      </FormField>
                      <FormField label="Address">
                        <Textarea value={data.address} onChange={e => setter({ address: e.target.value })} rows={2} placeholder="Registered address" />
                      </FormField>
                      <FormField label="Entity Type">
                        <Select value={data.entityType} onChange={e => setter({ entityType: e.target.value as EntityType })}
                          options={ENTITY_TYPES} />
                      </FormField>
                      <FormField label="Represented By" hint="Authorized signatory">
                        <Input value={data.representedBy} onChange={e => setter({ representedBy: e.target.value })} placeholder="Name and designation" />
                      </FormField>
                    </div>
                  )
                })}
              </motion.div>
            )}

            {/* Step 2 — Contract Terms */}
            {step === 2 && (
              <motion.div key="s2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                {form.contractType === 'nda' && (
                  <>
                    <FormField label="Purpose of Disclosure" required>
                      <Textarea value={form.ndaPurpose} onChange={e => setField('ndaPurpose', e.target.value)} rows={3} placeholder="Describe the purpose..." />
                    </FormField>
                    <FormField label="Duration (months)">
                      <Input type="number" value={form.ndaDuration} onChange={e => setField('ndaDuration', e.target.value)} />
                    </FormField>
                    <FormField label="Confidential Information Definition">
                      <Textarea value={form.ndaDefinition} onChange={e => setField('ndaDefinition', e.target.value)} rows={3} placeholder="What constitutes confidential information..." />
                    </FormField>
                    <FormField label="Exclusions from Confidentiality">
                      <Textarea value={form.ndaExclusions} onChange={e => setField('ndaExclusions', e.target.value)} rows={2} placeholder="Publicly known information, etc." />
                    </FormField>
                    {[
                      { key: 'ndaReturnMaterials', label: 'Include Return of Materials Clause' },
                      { key: 'ndaNonCompete', label: 'Include Non-Compete Clause' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-[#161616] border border-[rgba(201,168,76,0.15)]">
                        <span className="text-[12px] text-[rgba(250,247,240,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>{label}</span>
                        <button
                          onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key as 'ndaReturnMaterials' | 'ndaNonCompete'] }))}
                          className={`w-10 h-5 relative transition-colors ${form[key as 'ndaReturnMaterials' | 'ndaNonCompete'] ? 'bg-[#1B3A2D]' : 'bg-[#2a2a2a]'} border border-[rgba(201,168,76,0.3)]`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-[#C9A84C] transition-all ${form[key as 'ndaReturnMaterials' | 'ndaNonCompete'] ? 'left-5' : 'left-0.5'}`} />
                        </button>
                      </div>
                    ))}
                    {form.ndaNonCompete && (
                      <FormField label="Non-Compete Duration (months)">
                        <Input type="number" value={form.ndaNonCompeteDuration} onChange={e => setField('ndaNonCompeteDuration', e.target.value)} />
                      </FormField>
                    )}
                  </>
                )}

                {form.contractType === 'employment' && (
                  <>
                    <FormField label="Designation" required><Input value={form.designation} onChange={e => setField('designation', e.target.value)} placeholder="e.g. Software Engineer" /></FormField>
                    <FormField label="Department"><Input value={form.department} onChange={e => setField('department', e.target.value)} placeholder="e.g. Engineering" /></FormField>
                    <FormField label="CTC (Annual in ₹)" required hint="Gross annual compensation"><Input type="number" value={form.ctc} onChange={e => setField('ctc', e.target.value)} placeholder="e.g. 1200000" /></FormField>
                    <FormField label="Probation Period (months)"><Input type="number" value={form.probationPeriod} onChange={e => setField('probationPeriod', e.target.value)} /></FormField>
                    <FormField label="Notice Period (days)"><Input type="number" value={form.noticePeriod} onChange={e => setField('noticePeriod', e.target.value)} /></FormField>
                    <div className="flex items-center justify-between p-3 bg-[#161616] border border-[rgba(201,168,76,0.15)]">
                      <span className="text-[12px] text-[rgba(250,247,240,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>Include Non-Solicitation Clause</span>
                      <button
                        onClick={() => setForm(prev => ({ ...prev, nonSolicitation: !prev.nonSolicitation }))}
                        className={`w-10 h-5 relative transition-colors ${form.nonSolicitation ? 'bg-[#1B3A2D]' : 'bg-[#2a2a2a]'} border border-[rgba(201,168,76,0.3)]`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-[#C9A84C] transition-all ${form.nonSolicitation ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </>
                )}

                {['vendor', 'consultancy', 'freelance'].includes(form.contractType as string) && (
                  <div className="p-6 border border-[rgba(201,168,76,0.15)] text-center">
                    <p className="text-[14px] text-[rgba(250,247,240,0.5)]" style={{ fontFamily: 'Lora, serif' }}>
                      The AI will generate standard terms for a {CONTRACT_TYPES.find(t => t.value === form.contractType)?.label}. Proceed to jurisdiction settings.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3 — Jurisdiction */}
            {step === 3 && (
              <motion.div key="s3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                <FormField label="Governing Law (State)" required>
                  <Select value={form.governingState} onChange={e => setField('governingState', e.target.value)} placeholder="Select state..." options={INDIAN_STATES.map(s => ({ value: s, label: s }))} />
                </FormField>

                <FormField label="Dispute Resolution">
                  <div className="space-y-2">
                    {[
                      { v: 'arbitration', l: 'Arbitration', d: 'Arbitration & Conciliation Act, 1996' },
                      { v: 'litigation', l: 'Litigation', d: 'Courts of governing state' },
                      { v: 'mediation', l: 'Mediation First', d: 'Mediation, then arbitration' },
                    ].map(({ v, l, d }) => (
                      <SelectionCard key={v} selected={form.disputeResolution === v}
                        onClick={() => setForm(prev => ({ ...prev, disputeResolution: v as DisputeResolution }))}
                        title={l} description={d} />
                    ))}
                  </div>
                </FormField>

                {form.disputeResolution === 'arbitration' && (
                  <FormField label="Arbitration Seat">
                    <Select value={form.arbitrationSeat} onChange={e => setField('arbitrationSeat', e.target.value)} placeholder="Select seat..." options={INDIAN_STATES.map(s => ({ value: s, label: s }))} />
                  </FormField>
                )}

                <FormField label="Output Language">
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {generateError && (
          <div className="px-6 py-3 bg-[rgba(248,113,113,0.08)] border-t border-[rgba(248,113,113,0.3)]">
            <p className="text-[11px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>ERROR: {generateError}</p>
          </div>
        )}
        <div className="px-6 py-4 border-t border-[rgba(201,168,76,0.15)] bg-[#0a0a0a] flex items-center justify-between gap-4">
          {step > 0 ? (
            <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} />} onClick={() => setStep(s => s - 1)}>BACK</Button>
          ) : <div />}
          {step < 3 ? (
            <Button variant="primary" size="md" disabled={!canProceed()} onClick={() => setStep(s => s + 1)} className="ml-auto">
              NEXT <ChevronRight size={14} />
            </Button>
          ) : (
            <Button variant="primary" size="lg" loading={isGenerating} disabled={!canProceed()} onClick={handleGenerateClick}
              icon={<PenLine size={15} />} className="ml-auto text-[15px]"
              style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
              {isGenerating ? 'Drafting...' : 'Draft Contract'}
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

      {/* Preview */}
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
          title={documentTitle || 'Contract'}
          onExportPdf={() => exportToPdf(documents[activeDocLang] ?? '', documentTitle, profile, activeDocLang)}
          onExportDocx={() => exportToDocx(documents[activeDocLang] ?? '', documentTitle, profile, activeDocLang)}
          className="flex-1"
        />
      </div>
      </div>{/* end flex-1 row */}
    </div>
  )
}
