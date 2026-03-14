import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Trash2, Download, FileText, Eye, X, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserDocuments, deleteDocument, type Document, supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/FormFields'
import { DocumentPreview } from '@/components/ui/DocumentPreview'
import { formatDate, cn } from '@/lib/utils'
import { exportToPdf, getPdfBlob } from '@/lib/pdf-export'
import { exportToDocx, getDocxBlob } from '@/lib/docx-export'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { EmailModal } from '@/components/ui/EmailModal'
import { Mail } from 'lucide-react'

type FilterType = 'all' | 'notice' | 'contract' | 'title-report' | 'contract-review'
type FilterLang = 'all' | 'en' | 'ta' | 'hi'

const TYPE_LABELS: Record<string, string> = {
  notice: 'NOTICE',
  contract: 'CONTRACT',
  'title-report': 'TITLE REPORT',
  'contract-review': 'REVIEW',
}

const TYPE_COLORS: Record<string, string> = {
  notice: 'text-[#93c5fd] border-[rgba(147,197,253,0.3)]',
  contract: 'text-[#86efac] border-[rgba(134,239,172,0.3)]',
  'title-report': 'text-[#fbbf24] border-[rgba(251,191,36,0.3)]',
  'contract-review': 'text-[#f9a8d4] border-[rgba(249,168,212,0.3)]',
}

export default function DocumentsPage() {
  const { user, profile } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterLang, setFilterLang] = useState<FilterLang>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [emailDoc, setEmailDoc] = useState<Document | null>(null)

  const fetchDocuments = useCallback(() => {
    if (!user) return
    getUserDocuments(user.id)
      .then(setDocuments)
      .catch(err => console.error('[LexDraft] Documents: failed to load documents:', err))
      .finally(() => setLoading(false))
  }, [user])

  // Load on mount and whenever the route is revisited
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Reactively refresh when any draft page saves a document
  useEffect(() => {
    const onSaved = () => fetchDocuments()
    window.addEventListener('lexdraft:document-saved', onSaved)
    return () => window.removeEventListener('lexdraft:document-saved', onSaved)
  }, [fetchDocuments])

  const filtered = useMemo(() => {
    return documents.filter(doc => {
      const matchSearch = !search || doc.title.toLowerCase().includes(search.toLowerCase())
      const matchType = filterType === 'all' || doc.type === filterType
      const matchLang = filterLang === 'all' || doc.language === filterLang
      return matchSearch && matchType && matchLang
    })
  }, [documents, search, filterType, filterLang])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(d => d.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} documents?`)) return
    await Promise.all([...selectedIds].map(id => deleteDocument(id)))
    setDocuments(docs => docs.filter(d => !selectedIds.has(d.id)))
    setSelectedIds(new Set())
  }

  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return
    setDownloading(true)
    try {
      const zip = new JSZip()
      const selectedDocs = documents.filter(d => selectedIds.has(d.id))

      for (const doc of selectedDocs) {
        if (!doc.content) continue
        const safeTitle = doc.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_')

        // Add PDF
        const pdfBlob = await getPdfBlob(doc.content, doc.title, profile, doc.language as any)
        zip.file(`${safeTitle}.pdf`, pdfBlob)

        // Add DOCX
        const docxBlob = await getDocxBlob(doc.content, doc.title, profile, doc.language as any)
        zip.file(`${safeTitle}.docx`, docxBlob)
      }

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `LexDraft_Export_${new Date().toISOString().split('T')[0]}.zip`)
    } catch (err) {
      console.error('[LexDraft] Bulk download failed:', err)
      alert('Failed to generate ZIP. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return
    await deleteDocument(id)
    setDocuments(docs => docs.filter(d => d.id !== id))
    setPreviewDoc(null)
  }

  const handleSendEmail = async (data: { to: string; subject: string; body: string; attachPdf: boolean }) => {
    if (!emailDoc) return

    let base64Attachment = null
    if (data.attachPdf && emailDoc.content) {
      const blob = await getPdfBlob(emailDoc.content, emailDoc.title, profile, emailDoc.language as any)
      const reader = new FileReader()
      base64Attachment = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        }
        reader.readAsDataURL(blob)
      })
    }

    const { error } = await supabase.functions.invoke('send-document-email', {
      body: {
        to: data.to,
        subject: data.subject,
        body: data.body,
        attachment: base64Attachment,
        filename: `${emailDoc.title.replace(/\s+/g, '_')}.pdf`
      }
    })

    if (error) throw error
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[32px] text-[#FAF7F0] mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
          Documents
        </h1>
        <p className="text-[12px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
          {documents.length} document{documents.length !== 1 ? 's' : ''} total
        </p>
      </div>

      <div className="gold-line-solid mb-6" />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(250,247,240,0.3)]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="pl-8"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-0">
          {(['all', 'notice', 'contract', 'title-report', 'contract-review'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={cn(
                'px-3 py-2 text-[10px] border transition-all',
                filterType === f
                  ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.5)] text-[#F5EDD6]'
                  : 'bg-[#161616] border-[rgba(201,168,76,0.2)] text-[rgba(250,247,240,0.4)] hover:text-[rgba(250,247,240,0.7)]'
              )}
              style={{ fontFamily: 'DM Mono, monospace' }}
            >
              {f === 'all' ? 'ALL' : TYPE_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Lang filter */}
        <div className="flex gap-0">
          {(['all', 'en', 'ta', 'hi'] as FilterLang[]).map((l) => (
            <button
              key={l}
              onClick={() => setFilterLang(l)}
              className={cn(
                'px-3 py-2 text-[10px] border transition-all',
                filterLang === l
                  ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.5)] text-[#F5EDD6]'
                  : 'bg-[#161616] border-[rgba(201,168,76,0.2)] text-[rgba(250,247,240,0.4)] hover:text-[rgba(250,247,240,0.7)]'
              )}
              style={{ fontFamily: 'DM Mono, monospace' }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Download size={12} />}
              onClick={handleBulkDownload}
              loading={downloading}
            >
              DOWNLOAD ZIP ({selectedIds.size})
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={handleBulkDelete}>
              DELETE
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border border-[#C9A84C] border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-[rgba(201,168,76,0.1)]">
          <FileText size={32} className="text-[rgba(250,247,240,0.1)] mx-auto mb-4" />
          <p className="text-[14px] text-[rgba(250,247,240,0.3)]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            {search ? 'No documents match your search.' : 'No documents yet.'}
          </p>
        </div>
      ) : (
        <div className="border border-[rgba(201,168,76,0.15)]">
          {/* Table header */}
          <div className="grid grid-cols-[40px_2.5fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 bg-[#0a0a0a] border-b border-[rgba(201,168,76,0.1)]">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={selectAll}
                className="w-3.5 h-3.5 accent-[#C9A84C]"
              />
            </div>
            {['Document Name', 'Type', 'Created', 'Language', 'Status', 'Actions'].map(h => (
              <span key={h} className="text-[10px] tracking-widest text-[rgba(250,247,240,0.35)]" style={{ fontFamily: 'DM Mono, monospace' }}>{h}</span>
            ))}
          </div>

          {filtered.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                'grid grid-cols-[40px_2.5fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3.5 border-b border-[rgba(201,168,76,0.07)]',
                'hover:bg-[#161616] transition-colors group items-center',
                selectedIds.has(doc.id) && 'bg-[rgba(27,58,45,0.3)]'
              )}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedIds.has(doc.id)}
                  onChange={() => toggleSelect(doc.id)}
                  className="w-3.5 h-3.5 accent-[#C9A84C]"
                />
              </div>
              <span
                className="text-[13px] text-[#FAF7F0] truncate cursor-pointer hover:text-[#F5EDD6]"
                style={{ fontFamily: 'Cormorant Garamond, serif' }}
                onClick={() => setPreviewDoc(doc)}
              >
                {doc.title}
              </span>
              <span className={cn('text-[10px] border px-1.5 py-0.5 w-fit', TYPE_COLORS[doc.type] || '')} style={{ fontFamily: 'DM Mono, monospace' }}>
                {TYPE_LABELS[doc.type] || doc.type.toUpperCase()}
              </span>
              <span className="text-[11px] text-[rgba(250,247,240,0.45)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                {formatDate(doc.created_at)}
              </span>
              <span className="text-[11px] text-[rgba(250,247,240,0.45)] uppercase" style={{ fontFamily: 'DM Mono, monospace' }}>
                {doc.language}
              </span>
              <span className="text-[10px] text-[rgba(250,247,240,0.45)] border border-[rgba(250,247,240,0.1)] px-1.5 py-0.5 w-fit" style={{ fontFamily: 'DM Mono, monospace' }}>
                {doc.status.toUpperCase()}
              </span>
              <div className="flex items-center gap-1 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEmailDoc(doc)} className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0]" title="Email">
                  <Mail size={12} />
                </button>
                <button onClick={() => setPreviewDoc(doc)} className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0]" title="Preview">
                  <Eye size={12} />
                </button>
                <button onClick={() => doc.content && exportToPdf(doc.content, doc.title, profile)} className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0]" title="Export PDF">
                  <Download size={12} />
                </button>
                <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#f87171]" title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[rgba(0,0,0,0.8)] z-50 flex items-center justify-center p-8"
            onClick={e => e.target === e.currentTarget && setPreviewDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              className="bg-[#0E0E0E] border border-[rgba(201,168,76,0.3)] w-full max-w-3xl h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(201,168,76,0.2)] bg-[#0a0a0a]">
                <span className="text-[13px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  {previewDoc.title}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEmailDoc(previewDoc)} className="text-[10px]">
                    EMAIL
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportToPdf(previewDoc.content, previewDoc.title, profile)} className="text-[10px]">
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportToDocx(previewDoc.content, previewDoc.title, profile)} className="text-[10px]">
                    DOCX
                  </Button>
                  <button onClick={() => setPreviewDoc(null)} className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0]">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <DocumentPreview
                  content={previewDoc.content || ''}
                  isGenerating={false}
                  title={previewDoc.title}
                  language={previewDoc.language}
                  onExportPdf={() => exportToPdf(previewDoc.content || '', previewDoc.title, profile, previewDoc.language as any)}
                  onExportDocx={() => exportToDocx(previewDoc.content || '', previewDoc.title, profile, previewDoc.language as any)}
                  className="h-full"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
