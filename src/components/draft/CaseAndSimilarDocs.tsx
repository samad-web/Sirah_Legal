import { useState, useEffect, useCallback } from 'react'
import { Briefcase, FileText, ChevronDown, Clock, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getCases } from '@/lib/api'
import { getSimilarDocuments } from '@/lib/api-additions'
import type { Case } from '@/lib/supabase'
import type { SimilarDocument } from '@/lib/api-additions'
import { cn } from '@/lib/utils'

interface CaseAndSimilarDocsProps {
  /** Document type to find similar docs for */
  documentType: 'notice' | 'contract' | 'title-report' | 'contract-review'
  /** Called when a case is selected/deselected */
  onCaseSelect?: (caseId: string | null, caseTitle: string | null) => void
  /** Called when user clicks a similar document (to preview/reference) */
  onDocumentClick?: (docId: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  notice: 'Notices',
  contract: 'Contracts',
  'title-report': 'Title Reports',
  'contract-review': 'Reviews',
}

export function CaseAndSimilarDocs({ documentType, onCaseSelect, onDocumentClick }: CaseAndSimilarDocsProps) {
  const { user } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [similarDocs, setSimilarDocs] = useState<SimilarDocument[]>([])
  const [docSource, setDocSource] = useState<'case' | 'recent'>('recent')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Load cases on mount
  useEffect(() => {
    if (!user) return
    getCases().then(setCases).catch(() => setCases([]))
  }, [user])

  // Load similar docs when type or case changes
  const loadSimilarDocs = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSimilarDocuments(documentType, {
        caseId: selectedCaseId ?? undefined,
        limit: 5,
      })
      setSimilarDocs(result.documents)
      setDocSource(result.source)
    } catch {
      setSimilarDocs([])
    } finally {
      setLoading(false)
    }
  }, [documentType, selectedCaseId])

  useEffect(() => {
    loadSimilarDocs()
  }, [loadSimilarDocs])

  const handleCaseChange = (caseId: string) => {
    const newId = caseId === '' ? null : caseId
    setSelectedCaseId(newId)
    const caseTitle = cases.find(c => c.id === newId)?.title ?? null
    onCaseSelect?.(newId, caseTitle)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const activeCases = cases.filter(c => c.status === 'active')

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden bg-[#0a0a0a]/50">
      {/* Header — clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Briefcase size={14} className="text-gold/60" />
          <span className="text-[11px] tracking-widest text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
            CASE & SIMILAR DOCUMENTS
          </span>
          {selectedCaseId && (
            <span className="text-[10px] text-gold border border-gold/30 px-1.5 py-0.5 rounded" style={{ fontFamily: 'DM Mono, monospace' }}>
              {cases.find(c => c.id === selectedCaseId)?.title ?? 'Selected'}
            </span>
          )}
          {!selectedCaseId && similarDocs.length > 0 && (
            <span className="text-[10px] text-muted/60" style={{ fontFamily: 'DM Mono, monospace' }}>
              {similarDocs.length} similar {TYPE_LABELS[documentType]?.toLowerCase() ?? 'documents'}
            </span>
          )}
        </div>
        <ChevronDown size={14} className={cn('text-muted/40 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t border-border/20 px-4 py-3 space-y-4">
          {/* Case selector */}
          {activeCases.length > 0 && (
            <div>
              <label className="block text-[10px] text-muted/60 mb-1.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                LINK TO CASE (optional)
              </label>
              <select
                value={selectedCaseId ?? ''}
                onChange={e => handleCaseChange(e.target.value)}
                className="w-full bg-[#161616] border border-border/40 text-foreground text-[13px] px-3 py-2 rounded focus:border-gold/50 focus:outline-none transition-colors"
                style={{ fontFamily: 'Lora, serif' }}
              >
                <option value="">No case selected</option>
                {activeCases.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title} — {c.status.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Similar documents */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-muted/60" style={{ fontFamily: 'DM Mono, monospace' }}>
                {docSource === 'case' ? 'DOCUMENTS IN THIS CASE' : `RECENT ${TYPE_LABELS[documentType]?.toUpperCase() ?? 'DOCUMENTS'}`}
              </p>
              {loading && (
                <div className="w-3 h-3 border border-gold border-t-transparent animate-spin" />
              )}
            </div>

            {!loading && similarDocs.length === 0 && (
              <p className="text-[11px] text-muted/40 py-2" style={{ fontFamily: 'Lora, serif' }}>
                No similar documents found. This will be your first {documentType.replace('-', ' ')}.
              </p>
            )}

            {similarDocs.length > 0 && (
              <div className="space-y-1">
                {similarDocs.map(doc => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onDocumentClick?.(doc.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-2/50 transition-colors text-left group"
                  >
                    <FileText size={13} className="text-muted/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-foreground/80 truncate" style={{ fontFamily: 'Lora, serif' }}>
                        {doc.title}
                      </p>
                      <p className="text-[9px] text-muted/40 flex items-center gap-1.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                        <Clock size={9} />
                        {formatDate(doc.created_at)}
                        <span className="mx-0.5">·</span>
                        {doc.language.toUpperCase()}
                        <span className="mx-0.5">·</span>
                        {doc.status.toUpperCase()}
                      </p>
                    </div>
                    <ExternalLink size={11} className="text-muted/20 group-hover:text-gold/60 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
