import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText, PenLine, ShieldCheck, MapPin,
  ArrowRight, Download, Trash2, FileDown, MoreHorizontal
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserDocuments, deleteDocument, type Document } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'

const quickActions = [
  {
    title: 'Draft a Legal Notice',
    description: 'Notices, demand letters, rejoinders',
    icon: <FileText size={20} className="text-[#C9A84C]" />,
    to: '/draft/notice',
    tag: 'NOTICE',
  },
  {
    title: 'Draft a Contract',
    description: 'NDA, employment, vendor agreements',
    icon: <PenLine size={20} className="text-[#C9A84C]" />,
    to: '/draft/contract',
    tag: 'CONTRACT',
  },
  {
    title: 'Review a Contract',
    description: 'Risk flagging and clause analysis',
    icon: <ShieldCheck size={20} className="text-[#C9A84C]" />,
    to: '/review/contract',
    tag: 'REVIEW',
  },
  {
    title: 'Title Research Report',
    description: 'Property title opinion and chain',
    icon: <MapPin size={20} className="text-[#C9A84C]" />,
    to: '/draft/title-report',
    tag: 'TITLE',
  },
]

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

export default function DashboardPage() {
  const { profile } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const { user } = useAuth()

  const fetchDocuments = useCallback(() => {
    if (!user) return
    getUserDocuments(user.id)
      .then(setDocuments)
      .catch(err => console.error('[LexDraft] Dashboard: failed to load documents:', err))
      .finally(() => setLoadingDocs(false))
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

  const handleDelete = async (id: string) => {
    if (confirm('Delete this document?')) {
      await deleteDocument(id)
      setDocuments(docs => docs.filter(d => d.id !== id))
    }
  }

  const recentDocs = documents.slice(0, 10)

  return (
    <div className="p-8 max-w-[1400px]">
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
          {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Advocate'}.
        </h1>
        <p
          className="text-[12px] text-[rgba(250,247,240,0.45)]"
          style={{ fontFamily: 'DM Mono, monospace' }}
        >
          {[
            profile?.bar_council_no,
            profile?.firm_name,
          ].filter(Boolean).join(' · ') || 'Complete your profile in Settings'}
        </p>
      </motion.div>

      {/* Gold line */}
      <div className="gold-line-solid mb-8" />

      {/* Quick actions */}
      <div className="mb-10">
        <p
          className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)] mb-4"
          style={{ fontFamily: 'DM Mono, monospace' }}
        >
          QUICK ACTIONS
        </p>
        <div className="grid grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <motion.div
              key={action.to}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link to={action.to} className="block">
                <div className="bg-[#161616] border border-[rgba(201,168,76,0.2)] p-5 h-full hover:border-[#C9A84C] hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-200 group relative">
                  <div className="flex items-start justify-between mb-4">
                    {action.icon}
                    <span
                      className="text-[10px] text-[rgba(201,168,76,0.6)] border border-[rgba(201,168,76,0.2)] px-1.5 py-0.5"
                      style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                      {action.tag}
                    </span>
                  </div>
                  <h3
                    className="text-[18px] text-[#FAF7F0] mb-1 leading-tight"
                    style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
                  >
                    {action.title}
                  </h3>
                  <p
                    className="text-[11px] text-[rgba(250,247,240,0.4)]"
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  >
                    {action.description}
                  </p>
                  <div className="absolute bottom-5 right-5 opacity-30 group-hover:opacity-80 transition-opacity">
                    <ArrowRight size={16} className="text-[#C9A84C]" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Usage bar */}
      <div className="mb-10 bg-[#161616] border border-[rgba(201,168,76,0.15)] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-[rgba(250,247,240,0.5)] tracking-widest" style={{ fontFamily: 'DM Mono, monospace' }}>
            DOCUMENTS THIS MONTH
          </p>
          <p className="text-[11px] text-[rgba(250,247,240,0.5)]" style={{ fontFamily: 'DM Mono, monospace' }}>
            {profile?.documents_this_month || 0} / {profile?.plan === 'free' ? 5 : profile?.plan === 'solo' ? 50 : '∞'}
          </p>
        </div>
        <div className="h-1 bg-[rgba(250,247,240,0.05)] w-full">
          <div
            className="h-full bg-[#C9A84C] transition-all duration-500"
            style={{
              width: `${Math.min(100, ((profile?.documents_this_month || 0) / (profile?.plan === 'free' ? 5 : 50)) * 100)}%`
            }}
          />
        </div>
        {profile?.plan === 'free' && (
          <p className="text-[10px] text-[rgba(250,247,240,0.3)] mt-2" style={{ fontFamily: 'DM Mono, monospace' }}>
            Free plan · <Link to="/settings" className="text-[#C9A84C] hover:underline">Upgrade to Solo ₹999/mo →</Link>
          </p>
        )}
      </div>

      {/* Recent documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p
            className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)]"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            RECENT DOCUMENTS
          </p>
          <Link
            to="/documents"
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
              No documents yet. Start drafting with one of the actions above.
            </p>
          </div>
        ) : (
          <div className="border border-[rgba(201,168,76,0.15)]">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-[rgba(201,168,76,0.1)] bg-[#0a0a0a]">
              {['Document Name', 'Type', 'Date', 'Status', 'Actions'].map((h) => (
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
                className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3.5 border-b border-[rgba(201,168,76,0.08)] hover:bg-[#161616] transition-colors items-center group"
              >
                <span
                  className="text-[13px] text-[#FAF7F0] truncate"
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
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0] hover:bg-[#1B3A2D] transition-colors"
                    title="Download"
                  >
                    <Download size={13} />
                  </button>
                  <button
                    className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0] hover:bg-[#222] transition-colors"
                    title="More"
                  >
                    <MoreHorizontal size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-[rgba(250,247,240,0.4)] hover:text-[#f87171] hover:bg-[#1c1010] transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
