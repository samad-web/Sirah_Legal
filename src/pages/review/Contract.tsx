import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileSearch, AlertTriangle, AlertCircle,
  CheckCircle, ChevronDown, ChevronUp, FileText, X
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { generateDocument, type ContractAnalysis, type AnalysisClause } from '@/lib/generate'
import { validateFile, extractTextFromFile } from '@/lib/file-extract'
import { saveDocument, incrementDocumentCount } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { SelectionCard, FormField } from '@/components/ui/FormFields'
import { cn } from '@/lib/utils'
import type { Language } from '@/lib/generate'

type ReviewRole = 'vendor' | 'employee' | 'client' | 'company'

function RiskScoreGauge({ score }: { score: number }) {
  const color = score <= 30 ? '#4ade80' : score <= 60 ? '#fb923c' : '#f87171'
  const pct = score / 100

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(250,247,240,0.06)" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r="42" fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="square"
            strokeDasharray={`${2 * Math.PI * 42}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - pct) }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-[28px] font-bold"
            style={{ color, fontFamily: 'DM Mono, monospace' }}
          >
            {score}
          </motion.span>
          <span className="text-[9px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
            RISK
          </span>
        </div>
      </div>
      <div
        className="text-[12px] px-3 py-1 border"
        style={{
          color,
          borderColor: color,
          fontFamily: 'DM Mono, monospace',
          background: `${color}10`,
        }}
      >
        {score <= 30 ? 'LOW RISK' : score <= 60 ? 'MODERATE RISK' : 'HIGH RISK'}
      </div>
    </div>
  )
}

function ClauseCard({ clause, type }: { clause: AnalysisClause; type: 'risk' | 'missing' | 'negotiate' | 'standard' }) {
  const [expanded, setExpanded] = useState(false)
  const [showRedline, setShowRedline] = useState(false)

  const borderClass = {
    risk: 'clause-risk',
    missing: 'clause-missing',
    negotiate: 'clause-negotiate',
    standard: 'clause-standard',
  }[type]

  const bgClass = {
    risk: 'bg-[rgba(248,113,113,0.04)]',
    missing: 'bg-[rgba(251,191,36,0.04)]',
    negotiate: 'bg-[rgba(251,191,36,0.04)]',
    standard: 'bg-[rgba(74,222,128,0.04)]',
  }[type]

  return (
    <div className={cn('p-4 border border-[rgba(201,168,76,0.1)] pl-5', borderClass, bgClass)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {clause.number && (
              <span className="text-[10px] text-[rgba(250,247,240,0.35)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                §{clause.number}
              </span>
            )}
            <span className="text-[14px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
              {clause.title}
            </span>
          </div>
          <p className="text-[12px] text-[rgba(250,247,240,0.6)] leading-relaxed" style={{ fontFamily: 'Lora, serif' }}>
            {clause.issue}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[rgba(250,247,240,0.3)] hover:text-[#FAF7F0] transition-colors shrink-0"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {clause.originalText && (
                <div className="p-3 bg-[rgba(0,0,0,0.3)] border border-[rgba(250,247,240,0.06)]">
                  <p className="text-[10px] text-[rgba(250,247,240,0.3)] mb-1.5 tracking-widest" style={{ fontFamily: 'DM Mono, monospace' }}>
                    ORIGINAL TEXT
                  </p>
                  <p className="text-[12px] text-[rgba(250,247,240,0.6)] leading-relaxed" style={{ fontFamily: 'Lora, serif' }}>
                    {clause.originalText}
                  </p>
                </div>
              )}

              {clause.recommendation && (
                <div className="p-3 bg-[rgba(27,58,45,0.3)] border border-[rgba(74,222,128,0.15)]">
                  <p className="text-[10px] text-[rgba(74,222,128,0.6)] mb-1.5 tracking-widest" style={{ fontFamily: 'DM Mono, monospace' }}>
                    RECOMMENDATION
                  </p>
                  <p className="text-[12px] text-[rgba(250,247,240,0.7)] leading-relaxed" style={{ fontFamily: 'Lora, serif' }}>
                    {clause.recommendation}
                  </p>
                </div>
              )}

              {clause.suggestedRedline && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRedline(!showRedline)}
                    className="text-[10px] mb-2"
                  >
                    {showRedline ? 'HIDE' : 'SHOW'} SUGGESTED REDLINE
                  </Button>
                  {showRedline && (
                    <div className="p-3 bg-[rgba(0,0,0,0.3)] border border-[rgba(250,247,240,0.08)] space-y-2">
                      <p className="text-[12px] diff-removed p-1 block" style={{ fontFamily: 'Lora, serif' }}>
                        {clause.suggestedRedline.removed}
                      </p>
                      <p className="text-[12px] diff-added p-1 block" style={{ fontFamily: 'Lora, serif' }}>
                        {clause.suggestedRedline.added}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const REVIEW_ROLES: { value: ReviewRole; label: string; desc: string }[] = [
  { value: 'vendor', label: 'Vendor', desc: 'Reviewing as the service provider' },
  { value: 'employee', label: 'Employee', desc: 'Reviewing as the person being employed' },
  { value: 'client', label: 'Client', desc: 'Reviewing as the party receiving services' },
  { value: 'company', label: 'Company', desc: 'Reviewing as the engaging organization' },
]

const TABS = [
  { id: 'risk', label: 'RISK CLAUSES', icon: <AlertTriangle size={12} /> },
  { id: 'missing', label: 'MISSING CLAUSES', icon: <AlertCircle size={12} /> },
  { id: 'negotiate', label: 'NEGOTIATE', icon: <FileText size={12} /> },
  { id: 'standard', label: 'STANDARD', icon: <CheckCircle size={12} /> },
]

export default function ReviewContractPage() {
  const { user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [role, setRole] = useState<ReviewRole | ''>('')
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null)
  const [activeTab, setActiveTab] = useState<string>('risk')
  const [error, setError] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [language, setLanguage] = useState<Language>('en')
  const inputRef = useRef<HTMLInputElement>(null)

  const acceptFile = async (f: File) => {
    const v = validateFile(f)
    if (!v.valid) {
      setError(v.error!)
      return
    }
    setFile(f)
    setError('')
    setExtractedText('')
    setExtracting(true)

    try {
      const text = await extractTextFromFile(f)
      setExtractedText(text)
    } catch (err) {
      console.error('[LexDraft] Text extraction failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to extract text from file')
    } finally {
      setExtracting(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) acceptFile(dropped)
  }

  const handleAnalyze = async () => {
    if (!file || !role) return
    if (extracting) {
      setError('Text extraction is still in progress. Please wait a moment.')
      return
    }
    if (!extractedText) {
      setError('No text could be extracted. Please re-upload the file.')
      return
    }
    setAnalyzing(true)
    setError('')

    // 120 second timeout — Supabase edge functions cap at 60-150s
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)

    try {
      const result = await generateDocument(
        {
          module: 'contract-review',
          language: language,
          payload: {
            contractText: extractedText,
            reviewingAs: role,
            fileName: file.name,
          },
        },
        undefined, // no streaming
        controller.signal,
      )

      if (result.analysis) {
        setAnalysis(result.analysis)
        // Save independently
        if (user) {
          saveDocument({
            user_id: user.id,
            title: `Contract Review — ${file.name}`,
            type: 'contract-review',
            language: language,
            content: extractedText,
            analysis: result.analysis as unknown as Record<string, unknown>,
            status: 'draft',
          })
            .then(() => {
              incrementDocumentCount(user.id)
              window.dispatchEvent(new CustomEvent('lexdraft:document-saved'))
            })
            .catch(err => console.error('[LexDraft] Failed to save contract review to DB:', err))
        }
      } else {
        setError('Analysis completed but returned no results. Please try again.')
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setError('Analysis timed out. The contract may be too long. Please try a shorter document.')
      } else {
        console.error('[LexDraft] Contract analysis failed:', err)
        setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
      }
    } finally {
      clearTimeout(timeout)
      setAnalyzing(false)
    }
  }

  const tabClauses: Record<string, AnalysisClause[]> = {
    risk: analysis?.riskClauses || [],
    missing: analysis?.missingClauses || [],
    negotiate: analysis?.negotiateClauses || [],
    standard: analysis?.standardClauses || [],
  }

  return (
    <div className="p-8 max-w-[1200px]">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>
          MODULE 02B
        </p>
        <h1 className="text-[32px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
          Contract Review & Risk Analysis
        </h1>
      </div>

      {!analysis && (
        <>
          {/* Upload zone */}
          <div
            className={cn('upload-zone p-12 flex flex-col items-center justify-center text-center mb-6 cursor-pointer', dragOver && 'drag-over')}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) acceptFile(e.target.files[0]) }}
            />
            {file ? (
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-[#C9A84C]" />
                <div className="text-left">
                  <p className="text-[14px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>{file.name}</p>
                  <p className="text-[11px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {(file.size / 1024).toFixed(0)} KB
                    {extractedText
                      ? ' · Text extracted ✓'
                      : extracting
                        ? ' · Extracting text…'
                        : ' · Extraction failed'}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); setExtractedText('') }}
                  className="ml-4 text-[rgba(250,247,240,0.4)] hover:text-[#f87171] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <FileSearch size={36} className="text-[rgba(201,168,76,0.4)] mb-4" />
                <p className="text-[24px] text-[rgba(250,247,240,0.7)] mb-2" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  Drop your contract here
                </p>
                <p className="text-[11px] text-[rgba(250,247,240,0.35)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                  PDF or DOCX · Max 10 MB · English, Tamil, Hindi supported
                </p>
                <Button variant="outline" size="sm" className="mt-5" onClick={e => e.stopPropagation()}>
                  BROWSE FILES
                </Button>
              </>
            )}
          </div>

          {/* Role selector */}
          {file && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <p className="text-[12px] text-[rgba(250,247,240,0.5)] mb-3 text-center" style={{ fontFamily: 'Lora, serif' }}>
                You are reviewing this contract as:
              </p>
              <div className="grid grid-cols-4 gap-3">
                {REVIEW_ROLES.map((r) => (
                  <SelectionCard
                    key={r.value}
                    selected={role === r.value}
                    onClick={() => setRole(r.value)}
                    title={r.label}
                    description={r.desc}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {error && (
            <p className="text-[12px] text-[#f87171] mb-4" style={{ fontFamily: 'DM Mono, monospace' }}>{error}</p>
          )}

          {file && role && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <FormField label="Analysis Language">
                <div className="flex gap-0 max-w-sm mx-auto">
                  {[
                    { value: 'en', label: 'English' },
                    { value: 'ta', label: 'Tamil' },
                    { value: 'hi', label: 'Hindi' },
                  ].map((ln) => (
                    <button
                      key={ln.value}
                      onClick={() => setLanguage(ln.value as Language)}
                      className={`flex-1 py-2 text-[12px] border transition-all ${language === ln.value
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

              <Button
                variant="primary"
                size="xl"
                loading={analyzing}
                disabled={extracting || !extractedText}
                onClick={handleAnalyze}
                icon={<FileSearch size={16} />}
                className="w-full justify-center text-[16px]"
                style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
              >
                {analyzing ? 'Analysing Contract...' : extracting ? 'Extracting Text...' : 'Analyse Contract'}
              </Button>
            </motion.div>
          )}
        </>
      )}

      {/* Analysis results */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Risk score banner */}
            <div className="flex items-center gap-8 p-6 bg-[#161616] border border-[rgba(201,168,76,0.2)] mb-6">
              <RiskScoreGauge score={analysis.riskScore} />
              <div className="flex-1">
                <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)] mb-2" style={{ fontFamily: 'DM Mono, monospace' }}>
                  ANALYSIS SUMMARY
                </p>
                <p className="text-[16px] text-[#FAF7F0] leading-relaxed" style={{ fontFamily: 'Lora, serif' }}>
                  {analysis.summary}
                </p>
                <div className="flex items-center gap-4 mt-4">
                  {[
                    { label: 'RISK', count: analysis.riskClauses?.length || 0, color: '#f87171' },
                    { label: 'MISSING', count: analysis.missingClauses?.length || 0, color: '#fb923c' },
                    { label: 'NEGOTIATE', count: analysis.negotiateClauses?.length || 0, color: '#fbbf24' },
                    { label: 'STANDARD', count: analysis.standardClauses?.length || 0, color: '#4ade80' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2" style={{ background: color }} />
                      <span className="text-[11px] text-[rgba(250,247,240,0.5)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                        {count} {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnalysis(null)}
                className="text-[10px]"
              >
                NEW REVIEW
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[rgba(201,168,76,0.15)] mb-0">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3 text-[11px] border-b-2 transition-all',
                    activeTab === tab.id
                      ? 'border-[#C9A84C] text-[#FAF7F0]'
                      : 'border-transparent text-[rgba(250,247,240,0.4)] hover:text-[rgba(250,247,240,0.7)]'
                  )}
                  style={{ fontFamily: 'DM Mono, monospace' }}
                >
                  {tab.icon}
                  {tab.label}
                  <span className="w-5 h-5 flex items-center justify-center border border-current text-[9px]">
                    {tabClauses[tab.id]?.length || 0}
                  </span>
                </button>
              ))}
            </div>

            {/* Clause list */}
            <div className="space-y-3 pt-4">
              {(tabClauses[activeTab] || []).length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle size={24} className="text-[rgba(250,247,240,0.2)] mx-auto mb-2" />
                  <p className="text-[13px] text-[rgba(250,247,240,0.3)]" style={{ fontFamily: 'Lora, serif' }}>
                    No issues found in this category.
                  </p>
                </div>
              ) : (
                (tabClauses[activeTab] || []).map((clause, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <ClauseCard clause={clause} type={activeTab as 'risk' | 'missing' | 'negotiate' | 'standard'} />
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
