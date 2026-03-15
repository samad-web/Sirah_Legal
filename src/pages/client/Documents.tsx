import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Download, FileText, Eye, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getClientDocuments } from '@/lib/api'
import type { Document } from '@/lib/supabase'
import { useAuditLog } from '@/lib/useAuditLog'
import { Input } from '@/components/ui/FormFields'
import { DocumentPreview } from '@/components/ui/DocumentPreview'
import { Button } from '@/components/ui/Button'
import { formatDate, cn } from '@/lib/utils'
import { exportToPdf } from '@/lib/pdf-export'
import { exportToDocx } from '@/lib/docx-export'

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

export default function ClientDocumentsPage() {
    const { user, profile } = useAuth()
    const logAccess = useAuditLog()
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<FilterType>('all')
    const [filterLang, setFilterLang] = useState<FilterLang>('all')
    const [previewDoc, setPreviewDoc] = useState<Document | null>(null)

    const fetchDocuments = useCallback(() => {
        if (!user) return
        getClientDocuments(user.id)
            .then(setDocuments)
            .catch(err => console.error('[LexDraft] Client Documents: failed to load:', err))
            .finally(() => setLoading(false))
    }, [user])

    useEffect(() => { fetchDocuments() }, [fetchDocuments])

    const filtered = useMemo(() => {
        return documents.filter(doc => {
            const matchSearch = !search || doc.title.toLowerCase().includes(search.toLowerCase())
            const matchType = filterType === 'all' || doc.type === filterType
            const matchLang = filterLang === 'all' || doc.language === filterLang
            return matchSearch && matchType && matchLang
        })
    }, [documents, search, filterType, filterLang])

    const handlePreview = (doc: Document) => {
        setPreviewDoc(doc)
        logAccess(doc.id, 'preview')
    }

    const handleDownloadPdf = (doc: Document) => {
        logAccess(doc.id, 'download')
        if (doc.content) exportToPdf(doc.content, doc.title, profile)
    }

    const handleDownloadDocx = (doc: Document) => {
        logAccess(doc.id, 'download')
        if (doc.content) exportToDocx(doc.content, doc.title, profile)
    }

    return (
        <div className="p-4 md:p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-[32px] text-[#FAF7F0] mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
                    My Documents
                </h1>
                <p className="text-[12px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {documents.length} document{documents.length !== 1 ? 's' : ''} — showing documents assigned to your cases
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
                        {search ? 'No documents match your search.' : 'No documents have been shared with you yet.'}
                    </p>
                </div>
            ) : (
                <div className="border border-[rgba(201,168,76,0.15)] overflow-x-auto">
                 <div className="min-w-[560px]">
                    {/* Table header */}
                    <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 bg-[#0a0a0a] border-b border-[rgba(201,168,76,0.1)]">
                        {['Document Name', 'Type', 'Created', 'Language', 'Actions'].map(h => (
                            <span key={h} className="text-[10px] tracking-widest text-[rgba(250,247,240,0.35)]" style={{ fontFamily: 'DM Mono, monospace' }}>{h}</span>
                        ))}
                    </div>

                    {filtered.map((doc, i) => (
                        <motion.div
                            key={doc.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="grid grid-cols-[2.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3.5 border-b border-[rgba(201,168,76,0.07)] hover:bg-[#161616] transition-colors group items-center"
                        >
                            <span
                                className="text-[13px] text-[#FAF7F0] truncate cursor-pointer hover:text-[#F5EDD6]"
                                style={{ fontFamily: 'Cormorant Garamond, serif' }}
                                onClick={() => handlePreview(doc)}
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
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handlePreview(doc)} className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0]" title="Preview">
                                    <Eye size={12} />
                                </button>
                                <button onClick={() => handleDownloadPdf(doc)} className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0]" title="Export PDF">
                                    <Download size={12} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                 </div>{/* end min-w wrapper */}
                </div>
            )}

            {/* Preview modal */}
            <AnimatePresence>
                {previewDoc && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[rgba(0,0,0,0.8)] z-50 flex items-end sm:items-center justify-center p-0 sm:p-8"
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
                                    <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(previewDoc)} className="text-[10px]">
                                        PDF
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDownloadDocx(previewDoc)} className="text-[10px]">
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
