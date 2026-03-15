import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, ArrowRight, Briefcase } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getClientDocuments, getClientCases } from '@/lib/api'
import type { Document, Case } from '@/lib/supabase'
import { useAuditLog } from '@/lib/useAuditLog'
import { formatDate } from '@/lib/utils'
import { DocumentPreview } from '@/components/ui/DocumentPreview'

const TYPE_COLORS: Record<string, string> = {
    notice: 'text-[#93c5fd] bg-[rgba(147,197,253,0.08)] border-[rgba(147,197,253,0.25)]',
    contract: 'text-[#86efac] bg-[rgba(134,239,172,0.08)] border-[rgba(134,239,172,0.25)]',
    'title-report': 'text-[#fbbf24] bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.25)]',
    'contract-review': 'text-[#f9a8d4] bg-[rgba(249,168,212,0.08)] border-[rgba(249,168,212,0.25)]',
}

const STATUS_COLORS: Record<string, string> = {
    draft: 'text-[rgba(250,247,240,0.5)] border-[rgba(250,247,240,0.15)]',
    exported: 'text-[#86efac] border-[rgba(134,239,172,0.3)]',
    shared: 'text-[#C9A84C] border-[rgba(201,168,76,0.3)]',
}

function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
}

export default function ClientDashboardPage() {
    const { profile, user } = useAuth()
    const logAccess = useAuditLog()
    const [documents, setDocuments] = useState<Document[]>([])
    const [cases, setCases] = useState<Case[]>([])
    const [loadingDocs, setLoadingDocs] = useState(true)
    const [previewDoc, setPreviewDoc] = useState<Document | null>(null)

    const fetchData = useCallback(async () => {
        if (!user) return
        try {
            const [docs, clientCases] = await Promise.all([
                getClientDocuments(user.id),
                getClientCases(user.id),
            ])
            setDocuments(docs)
            setCases(clientCases)
        } catch (err) {
            console.error('[LexDraft] Client Dashboard: failed to load data:', err)
        } finally {
            setLoadingDocs(false)
        }
    }, [user])

    useEffect(() => { fetchData() }, [fetchData])

    const handlePreview = (doc: Document) => {
        setPreviewDoc(doc)
        logAccess(doc.id, 'preview')
    }

    const recentDocs = documents.slice(0, 8)

    return (
        <div className="p-4 md:p-8 max-w-[1400px]">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mb-10"
            >
                <h1
                    className="text-[36px] text-[#FAF7F0] mb-1"
                    style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}
                >
                    {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Client'}.
                </h1>
                <p
                    className="text-[12px] text-[rgba(250,247,240,0.45)]"
                    style={{ fontFamily: 'DM Mono, monospace' }}
                >
                    CLIENT PORTAL — Document access is restricted to your assigned cases.
                </p>
            </motion.div>

            {/* Gold line */}
            <div className="gold-line-solid mb-8" />

            {/* Assigned Cases */}
            {cases.length > 0 && (
                <div className="mb-10">
                    <p
                        className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)] mb-4"
                        style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                        YOUR CASES
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {cases.map((c, i) => (
                            <motion.div
                                key={c.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                className="bg-[#161616] border border-[rgba(201,168,76,0.2)] p-5 hover:border-[rgba(201,168,76,0.4)] transition-all"
                            >
                                <div className="flex items-start gap-3 mb-3">
                                    <Briefcase size={16} className="text-[#C9A84C] shrink-0 mt-0.5" />
                                    <div>
                                        <h3
                                            className="text-[16px] text-[#FAF7F0] leading-tight"
                                            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
                                        >
                                            {c.title}
                                        </h3>
                                        {c.description && (
                                            <p
                                                className="text-[11px] text-[rgba(250,247,240,0.4)] mt-1 line-clamp-2"
                                                style={{ fontFamily: 'Lora, serif' }}
                                            >
                                                {c.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span
                                    className={`text-[10px] border px-2 py-0.5 ${c.status === 'active'
                                            ? 'text-[#86efac] border-[rgba(134,239,172,0.3)]'
                                            : 'text-[rgba(250,247,240,0.5)] border-[rgba(250,247,240,0.15)]'
                                        }`}
                                    style={{ fontFamily: 'DM Mono, monospace' }}
                                >
                                    {c.status.toUpperCase()}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Documents */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <p
                        className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)]"
                        style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                        RECENT DOCUMENTS
                    </p>
                    <Link
                        to="/client/documents"
                        className="text-[11px] text-[rgba(201,168,76,0.7)] hover:text-[#C9A84C] nav-hover-gold"
                        style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                        VIEW ALL →
                    </Link>
                </div>

                {loadingDocs ? (
                    <div className="flex items-center justify-center py-12 text-[rgba(250,247,240,0.3)]">
                        <div className="w-5 h-5 border border-[#C9A84C] border-t-transparent animate-spin" />
                    </div>
                ) : recentDocs.length === 0 ? (
                    <div className="border border-[rgba(201,168,76,0.1)] p-12 flex flex-col items-center justify-center text-center">
                        <FileText size={32} className="text-[rgba(250,247,240,0.15)] mb-4" />
                        <p
                            className="text-[14px] text-[rgba(250,247,240,0.3)]"
                            style={{ fontFamily: 'Cormorant Garamond, serif' }}
                        >
                            No documents have been shared with you yet.
                        </p>
                    </div>
                ) : (
                    <div className="border border-[rgba(201,168,76,0.15)] overflow-x-auto">
                     <div className="min-w-[540px]">
                        {/* Table header */}
                        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-[rgba(201,168,76,0.1)] bg-[#0a0a0a]">
                            {['Document Name', 'Type', 'Date', 'Status', 'View'].map((h) => (
                                <span
                                    key={h}
                                    className="text-[10px] tracking-widest text-[rgba(250,247,240,0.35)]"
                                    style={{ fontFamily: 'DM Mono, monospace' }}
                                >
                                    {h}
                                </span>
                            ))}
                        </div>
                        {recentDocs.map((doc, i) => (
                            <motion.div
                                key={doc.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.04 }}
                                className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3.5 border-b border-[rgba(201,168,76,0.08)] hover:bg-[#161616] transition-colors items-center group cursor-pointer"
                                onClick={() => handlePreview(doc)}
                            >
                                <span
                                    className="text-[13px] text-[#FAF7F0] truncate hover:text-[#F5EDD6]"
                                    style={{ fontFamily: 'Cormorant Garamond, serif' }}
                                >
                                    {doc.title}
                                </span>
                                <span
                                    className={`text-[10px] border px-2 py-0.5 w-fit ${TYPE_COLORS[doc.type] || ''}`}
                                    style={{ fontFamily: 'DM Mono, monospace' }}
                                >
                                    {doc.type.toUpperCase().replace('-', ' ')}
                                </span>
                                <span
                                    className="text-[11px] text-[rgba(250,247,240,0.45)]"
                                    style={{ fontFamily: 'DM Mono, monospace' }}
                                >
                                    {formatDate(doc.created_at)}
                                </span>
                                <span
                                    className={`text-[10px] border px-2 py-0.5 w-fit ${STATUS_COLORS[doc.status] || ''}`}
                                    style={{ fontFamily: 'DM Mono, monospace' }}
                                >
                                    {doc.status.toUpperCase()}
                                </span>
                                <div className="opacity-30 group-hover:opacity-80 transition-opacity">
                                    <ArrowRight size={14} className="text-[#C9A84C]" />
                                </div>
                            </motion.div>
                        ))}
                     </div>{/* end min-w wrapper */}
                    </div>
                )}
            </div>

            {/* Preview modal */}
            {previewDoc && (
                <div
                    className="fixed inset-0 bg-[rgba(0,0,0,0.8)] z-50 flex items-center justify-center p-8"
                    onClick={(e) => e.target === e.currentTarget && setPreviewDoc(null)}
                >
                    <motion.div
                        initial={{ scale: 0.96, y: 16 }}
                        animate={{ scale: 1, y: 0 }}
                        className="bg-[#0E0E0E] border border-[rgba(201,168,76,0.3)] w-full max-w-3xl h-[80vh] flex flex-col"
                    >
                        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(201,168,76,0.2)] bg-[#0a0a0a]">
                            <span className="text-[13px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                                {previewDoc.title}
                            </span>
                            <button
                                onClick={() => setPreviewDoc(null)}
                                className="text-[11px] text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0] px-3 py-1 border border-[rgba(201,168,76,0.2)] hover:border-[rgba(201,168,76,0.5)] transition-all"
                                style={{ fontFamily: 'DM Mono, monospace' }}
                            >
                                CLOSE
                            </button>
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
                </div>
            )}
        </div>
    )
}
