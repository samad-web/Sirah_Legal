import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Briefcase, Gavel, FolderOpen,
  Flag, CreditCard, Bell, ClipboardList, ChevronDown, ChevronLeft, ChevronRight, Eye,
  MessageSquare, Send, Upload, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getClientCases,
  getClientCaseTimeline,
  getClientCaseDocuments,
} from '@/lib/api'
import {
  getClientCaseMessages,
  sendClientMessage,
  getClientDocumentRequests,
  fulfilDocumentRequest,
} from '@/lib/api-additions'
import type { Document, Case, CaseTimelineEvent, CaseMessage, DocumentRequest } from '@/lib/supabase'
import { useAuditLog } from '@/lib/useAuditLog'
import { formatDate } from '@/lib/utils'
import { DocumentPreview } from '@/components/ui/DocumentPreview'

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  notice: 'text-[#93c5fd] bg-[rgba(147,197,253,0.08)] border-[rgba(147,197,253,0.25)]',
  contract: 'text-[#86efac] bg-[rgba(134,239,172,0.08)] border-[rgba(134,239,172,0.25)]',
  'title-report': 'text-[#fbbf24] bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.25)]',
  'contract-review': 'text-[#f9a8d4] bg-[rgba(249,168,212,0.08)] border-[rgba(249,168,212,0.25)]',
}

const EVENT_ICONS: Record<CaseTimelineEvent['event_type'], React.ReactNode> = {
  hearing:   <Gavel size={13} />,
  filing:    <FolderOpen size={13} />,
  order:     <ClipboardList size={13} />,
  milestone: <Flag size={13} />,
  payment:   <CreditCard size={13} />,
  notice:    <Bell size={13} />,
}

const EVENT_COLORS: Record<CaseTimelineEvent['event_type'], string> = {
  hearing:   'text-[#93c5fd] bg-[rgba(147,197,253,0.12)] border-[rgba(147,197,253,0.3)]',
  filing:    'text-[#86efac] bg-[rgba(134,239,172,0.12)] border-[rgba(134,239,172,0.3)]',
  order:     'text-[#fbbf24] bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.3)]',
  milestone: 'text-gold bg-gold-faint border-gold-dim',
  payment:   'text-[#f9a8d4] bg-[rgba(249,168,212,0.12)] border-[rgba(249,168,212,0.3)]',
  notice:    'text-[#c4b5fd] bg-[rgba(196,181,253,0.12)] border-[rgba(196,181,253,0.3)]',
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function isUpcoming(dateStr: string) {
  return new Date(dateStr) > new Date()
}

function isToday(dateStr: string) {
  const t = new Date()
  const d = new Date(dateStr)
  return d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientDashboardPage() {
  const { profile, user } = useAuth()
  const logAccess = useAuditLog()

  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [timeline, setTimeline] = useState<CaseTimelineEvent[]>([])
  const [caseDocs, setCaseDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCase, setLoadingCase] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [caseDropdownOpen, setCaseDropdownOpen] = useState(false)

  // Messaging
  const [messages, setMessages] = useState<CaseMessage[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const msgEndRef = useRef<HTMLDivElement>(null)

  // Document requests
  const [docRequests, setDocRequests] = useState<DocumentRequest[]>([])
  const [fulfillingId, setFulfillingId] = useState<string | null>(null)

  // Calendar
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d
  })
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null)

  // Group timeline events by date (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CaseTimelineEvent[]>()
    timeline.forEach(e => {
      const key = e.event_date.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    })
    return map
  }, [timeline])

  // ── Initial load ─────────────────────────────────────────────────────────
  const fetchCases = useCallback(async () => {
    if (!user) return
    try {
      const clientCases = await getClientCases(user.id)
      setCases(clientCases)
      if (clientCases.length > 0) setSelectedCase(clientCases[0])
    } catch (err) {
      console.error('[LexDraft] Client Dashboard: failed to load cases:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchCases() }, [fetchCases])

  // ── Load timeline + docs + messages + requests when selected case changes ──
  useEffect(() => {
    if (!selectedCase) { setTimeline([]); setCaseDocs([]); setMessages([]); setDocRequests([]); return }
    setLoadingCase(true)
    Promise.all([
      getClientCaseTimeline(selectedCase.id),
      getClientCaseDocuments(selectedCase.id),
      getClientCaseMessages(selectedCase.id).catch(() => [] as CaseMessage[]),
      getClientDocumentRequests().catch(() => [] as DocumentRequest[]),
    ])
      .then(([events, docs, msgs, reqs]) => {
        setTimeline(events)
        setCaseDocs(docs)
        setMessages(msgs)
        setDocRequests((reqs as DocumentRequest[]).filter(r => r.case_id === selectedCase.id))
      })
      .catch(err => console.error('[LexDraft] case detail load failed:', err))
      .finally(() => setLoadingCase(false))
  }, [selectedCase?.id])

  // Auto-scroll messages to bottom
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async () => {
    if (!msgInput.trim() || !selectedCase) return
    setSendingMsg(true)
    try {
      const msg = await sendClientMessage(selectedCase.id, msgInput.trim())
      setMessages(prev => [...prev, msg])
      setMsgInput('')
    } catch (err) {
      console.error('[LexDraft] send message failed:', err)
    } finally {
      setSendingMsg(false)
    }
  }

  const handleFulfilRequest = async (requestId: string) => {
    setFulfillingId(requestId)
    try {
      const updated = await fulfilDocumentRequest(requestId)
      setDocRequests(prev => prev.map(r => r.id === requestId ? updated : r))
    } catch (err) {
      console.error('[LexDraft] fulfil request failed:', err)
    } finally {
      setFulfillingId(null)
    }
  }

  const handlePreview = (doc: Document) => {
    setPreviewDoc(doc)
    logAccess(doc.id, 'preview')
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-[1400px]">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <h1 className="text-[36px] text-foreground mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
          {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Client'}.
        </h1>
        <p className="text-[12px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
          CLIENT PORTAL — Document access is restricted to your assigned cases.
        </p>
      </motion.div>

      <div className="gold-line-solid mb-8" />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border border-gold border-t-transparent animate-spin" />
        </div>
      ) : cases.length === 0 ? (
        <div className="border border-border/40 p-16 flex flex-col items-center justify-center text-center">
          <Briefcase size={36} className="text-muted/30 mb-4" />
          <p className="text-[16px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            You have not been assigned to any case yet.
          </p>
          <p className="text-[11px] text-muted/60 mt-2" style={{ fontFamily: 'DM Mono, monospace' }}>
            Your advocate will assign you once your case is opened.
          </p>
        </div>
      ) : (
        <>
          {/* ── Case selector ─────────────────────────────────────────────── */}
          <div className="mb-6">
            <p className="text-[11px] tracking-widest text-muted mb-3" style={{ fontFamily: 'DM Mono, monospace' }}>
              YOUR CASES
            </p>
            {cases.length === 1 ? (
              /* Single case — just show the card */
              <CaseCard c={cases[0]} selected />
            ) : (
              /* Multiple cases — dropdown selector */
              <div className="relative">
                <button
                  onClick={() => setCaseDropdownOpen(o => !o)}
                  className="w-full md:w-auto flex items-center gap-3 px-4 py-3 bg-surface-2 border border-border hover:border-gold/40 transition-all text-left"
                >
                  <Briefcase size={15} className="text-gold shrink-0" />
                  <span className="flex-1 text-[13px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    {selectedCase?.title}
                  </span>
                  <span className={`text-[10px] border px-2 py-0.5 mr-2 ${
                    selectedCase?.status === 'active'
                      ? 'text-[#86efac] border-[rgba(134,239,172,0.3)]'
                      : 'text-muted border-muted/30'
                  }`} style={{ fontFamily: 'DM Mono, monospace' }}>
                    {selectedCase?.status.toUpperCase()}
                  </span>
                  <ChevronDown size={14} className={`text-muted transition-transform ${caseDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {caseDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 md:right-auto md:min-w-[360px] z-20 bg-surface border border-border shadow-lg"
                    >
                      {cases.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCase(c); setCaseDropdownOpen(false) }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-0 ${
                            selectedCase?.id === c.id ? 'bg-forest' : 'hover:bg-surface-2'
                          }`}
                        >
                          <Briefcase size={14} className={selectedCase?.id === c.id ? 'text-gold' : 'text-muted'} />
                          <span className={`text-[13px] flex-1 ${selectedCase?.id === c.id ? 'text-parchment' : 'text-foreground'}`}
                            style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                            {c.title}
                          </span>
                          <span className={`text-[10px] border px-2 py-0.5 ${
                            c.status === 'active' ? 'text-[#86efac] border-[rgba(134,239,172,0.3)]' : 'text-muted border-muted/30'
                          }`} style={{ fontFamily: 'DM Mono, monospace' }}>
                            {c.status.toUpperCase()}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ── Selected case detail ──────────────────────────────────────── */}
          {selectedCase && (
            <motion.div key={selectedCase.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              {/* Case header strip */}
              {cases.length > 1 && (
                <div className="mb-6">
                  <CaseCard c={selectedCase} selected />
                </div>
              )}

              {loadingCase ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-5 h-5 border border-gold border-t-transparent animate-spin" />
                </div>
              ) : (
                <div className="space-y-8">

                {/* ── Document Requests ─────────────────────────────────── */}
                {docRequests.length > 0 && (
                  <div>
                    <p className="text-[11px] tracking-widest text-muted mb-4" style={{ fontFamily: 'DM Mono, monospace' }}>
                      DOCUMENT REQUESTS
                    </p>
                    <div className="border border-border/40 divide-y divide-border/20">
                      {docRequests.map(req => (
                        <div key={req.id} className="flex items-start gap-4 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif' }}>{req.title}</p>
                            {req.description && (
                              <p className="text-[11px] text-muted mt-0.5" style={{ fontFamily: 'Lora, serif' }}>{req.description}</p>
                            )}
                          </div>
                          {req.status === 'pending' ? (
                            <button
                              onClick={() => handleFulfilRequest(req.id)}
                              disabled={fulfillingId === req.id}
                              className="flex items-center gap-1.5 text-[10px] border border-gold/40 text-gold px-3 py-1.5 hover:bg-forest transition-all disabled:opacity-50 shrink-0"
                              style={{ fontFamily: 'DM Mono, monospace' }}
                            >
                              {fulfillingId === req.id
                                ? <div className="w-3 h-3 border border-gold border-t-transparent animate-spin" />
                                : <Upload size={11} />}
                              MARK DONE
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-[#86efac] border border-[rgba(134,239,172,0.3)] px-2 py-1 shrink-0" style={{ fontFamily: 'DM Mono, monospace' }}>
                              <CheckCircle2 size={11} /> FULFILLED
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Messaging ─────────────────────────────────────────── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare size={13} className="text-muted" />
                    <p className="text-[11px] tracking-widest text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                      MESSAGES
                    </p>
                  </div>
                  <div className="border border-border/40 flex flex-col" style={{ height: '320px' }}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <MessageSquare size={22} className="text-muted/30 mb-2" />
                          <p className="text-[12px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>No messages yet.</p>
                          <p className="text-[10px] text-muted/50 mt-1" style={{ fontFamily: 'DM Mono, monospace' }}>Send a message to your advocate below.</p>
                        </div>
                      ) : (
                        messages.map(msg => {
                          const isMe = msg.sender_id === user?.id
                          return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] px-3 py-2 text-[12px] ${isMe ? 'bg-forest border border-gold/20 text-parchment' : 'bg-surface-2 border border-border/40 text-foreground'}`}
                                style={{ fontFamily: 'Lora, serif' }}>
                                <p>{msg.content}</p>
                                <p className="text-[9px] text-muted/60 mt-1 text-right" style={{ fontFamily: 'DM Mono, monospace' }}>
                                  {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          )
                        })
                      )}
                      <div ref={msgEndRef} />
                    </div>
                    <div className="border-t border-border/40 flex items-center gap-2 p-2">
                      <input
                        value={msgInput}
                        onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                        placeholder="Type a message…"
                        className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted/40 outline-none px-2 py-1"
                        style={{ fontFamily: 'Lora, serif' }}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!msgInput.trim() || sendingMsg}
                        className="p-2 text-gold hover:text-gold/80 disabled:opacity-30 transition-colors"
                      >
                        {sendingMsg ? <div className="w-4 h-4 border border-gold border-t-transparent animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 lg:gap-8">

                  {/* ── Calendar ────────────────────────────────────────── */}
                  <div>
                    {/* Calendar header */}
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] tracking-widest text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                        CASE CALENDAR
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                          className="w-7 h-7 flex items-center justify-center text-muted hover:text-foreground border border-transparent hover:border-border/50 transition-all"
                        >
                          <ChevronLeft size={13} />
                        </button>
                        <span className="text-[11px] text-foreground/80 min-w-[110px] text-center" style={{ fontFamily: 'DM Mono, monospace' }}>
                          {calendarDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}
                        </span>
                        <button
                          onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                          className="w-7 h-7 flex items-center justify-center text-muted hover:text-foreground border border-transparent hover:border-border/50 transition-all"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Calendar grid */}
                    <div className="border border-border/40">
                      {/* Day-of-week headers */}
                      <div className="grid grid-cols-7 border-b border-border/40">
                        {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
                          <div key={d} className="py-2 text-center">
                            <span className="text-[9px] text-muted/60 tracking-wider" style={{ fontFamily: 'DM Mono, monospace' }}>{d}</span>
                          </div>
                        ))}
                      </div>

                      {/* Day cells */}
                      {(() => {
                        const year = calendarDate.getFullYear()
                        const month = calendarDate.getMonth()
                        const firstDay = new Date(year, month, 1).getDay()
                        const daysInMonth = new Date(year, month + 1, 0).getDate()
                        const todayStr = new Date().toISOString().slice(0, 10)
                        const cells: React.ReactNode[] = []

                        // Leading empty cells
                        for (let i = 0; i < firstDay; i++) {
                          cells.push(<div key={`e-${i}`} className="h-16 border-b border-r border-border/20 bg-surface/30 last:border-r-0" />)
                        }

                        for (let day = 1; day <= daysInMonth; day++) {
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                          const dayEvents = eventsByDate.get(dateStr) ?? []
                          const isToday = dateStr === todayStr
                          const isSelected = dateStr === selectedCalDate
                          const colIndex = (firstDay + day - 1) % 7

                          cells.push(
                            <div
                              key={dateStr}
                              onClick={() => setSelectedCalDate(isSelected ? null : dateStr)}
                              className={`h-16 border-b border-border/20 p-1.5 flex flex-col cursor-pointer transition-colors select-none
                                ${colIndex < 6 ? 'border-r' : ''} border-r-border/20
                                ${isSelected ? 'bg-forest/60' : isToday ? 'bg-gold/5' : 'hover:bg-surface-2'}`}
                            >
                              <span className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-none mb-0.5
                                ${isToday ? 'bg-gold text-[#0E0E0E] font-bold' : isSelected ? 'text-gold' : 'text-foreground/70'}
                              `} style={{ fontFamily: 'DM Mono, monospace' }}>
                                {day}
                              </span>

                              {/* Event dots */}
                              <div className="flex flex-wrap gap-0.5 mt-auto">
                                {dayEvents.slice(0, 3).map((ev, idx) => (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center gap-0.5 text-[8px] border px-1 py-0 leading-4 ${EVENT_COLORS[ev.event_type]}`}
                                    style={{ fontFamily: 'DM Mono, monospace' }}
                                    title={ev.title}
                                  >
                                    {EVENT_ICONS[ev.event_type]}
                                  </span>
                                ))}
                                {dayEvents.length > 3 && (
                                  <span className="text-[8px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>+{dayEvents.length - 3}</span>
                                )}
                              </div>
                            </div>
                          )
                        }

                        // Trailing empty cells to complete the grid
                        const totalCells = firstDay + daysInMonth
                        const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)
                        for (let i = 0; i < trailing; i++) {
                          cells.push(<div key={`t-${i}`} className="h-16 border-b border-r border-border/20 bg-surface/30 last:border-r-0" />)
                        }

                        return <div className="grid grid-cols-7">{cells}</div>
                      })()}
                    </div>

                    {/* Selected date events */}
                    <AnimatePresence>
                      {selectedCalDate && (
                        <motion.div
                          key={selectedCalDate}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                          className="mt-3 border border-gold/20 bg-surface-2"
                        >
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30">
                            <span className="text-[11px] text-gold/80 tracking-widest" style={{ fontFamily: 'DM Mono, monospace' }}>
                              {new Date(selectedCalDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
                            </span>
                            <button onClick={() => setSelectedCalDate(null)} className="text-muted/50 hover:text-muted text-[10px]" style={{ fontFamily: 'DM Mono, monospace' }}>✕</button>
                          </div>

                          {(eventsByDate.get(selectedCalDate) ?? []).length === 0 ? (
                            <p className="px-4 py-3 text-[11px] text-muted/60" style={{ fontFamily: 'DM Mono, monospace' }}>
                              No events on this date.
                            </p>
                          ) : (
                            <div className="divide-y divide-border/20">
                              {(eventsByDate.get(selectedCalDate) ?? []).map(ev => (
                                <div key={ev.id} className="flex items-start gap-3 px-4 py-3">
                                  <span className={`w-7 h-7 shrink-0 flex items-center justify-center border ${EVENT_COLORS[ev.event_type]}`}>
                                    {EVENT_ICONS[ev.event_type]}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <span className={`text-[9px] border px-1.5 py-0.5 ${EVENT_COLORS[ev.event_type]}`} style={{ fontFamily: 'DM Mono, monospace' }}>
                                        {ev.event_type.toUpperCase()}
                                      </span>
                                      {isToday(ev.event_date) && (
                                        <span className="text-[9px] bg-gold/20 border border-gold/40 text-gold px-1.5 py-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>TODAY</span>
                                      )}
                                    </div>
                                    <p className="text-[13px] text-foreground leading-snug" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                                      {ev.title}
                                    </p>
                                    {ev.description && (
                                      <p className="text-[11px] text-muted mt-0.5" style={{ fontFamily: 'Lora, serif' }}>{ev.description}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* No events hint */}
                    {timeline.length === 0 && (
                      <div className="mt-4 border border-border/30 p-6 flex flex-col items-center text-center">
                        <Flag size={20} className="text-muted/30 mb-2" />
                        <p className="text-[12px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>No events scheduled yet.</p>
                        <p className="text-[10px] text-muted/50 mt-1" style={{ fontFamily: 'DM Mono, monospace' }}>Your advocate will add hearings and milestones here.</p>
                      </div>
                    )}
                  </div>

                  {/* ── Case Documents ──────────────────────────────────── */}
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <p className="text-[11px] tracking-widest text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                        CASE DOCUMENTS
                      </p>
                      {caseDocs.length > 0 && (
                        <Link to="/client/documents"
                          className="text-[11px] text-gold/70 hover:text-gold nav-hover-gold"
                          style={{ fontFamily: 'DM Mono, monospace' }}>
                          VIEW ALL →
                        </Link>
                      )}
                    </div>

                    {caseDocs.length === 0 ? (
                      <div className="border border-border/30 p-10 flex flex-col items-center text-center">
                        <FileText size={24} className="text-muted/30 mb-3" />
                        <p className="text-[13px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                          No documents linked to this case yet.
                        </p>
                        <p className="text-[10px] text-muted/50 mt-1" style={{ fontFamily: 'DM Mono, monospace' }}>
                          Documents shared by your advocate will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-border/40 overflow-x-auto">
                        <div className="min-w-[480px]">
                          {/* Header */}
                          <div className="grid grid-cols-[2fr_1fr_1fr_36px] gap-4 px-4 py-2.5 border-b border-border/40 bg-surface">
                            {['Document', 'Type', 'Date', ''].map(h => (
                              <span key={h} className="text-[10px] tracking-widest text-muted/60"
                                style={{ fontFamily: 'DM Mono, monospace' }}>{h}</span>
                            ))}
                          </div>

                          {caseDocs.map((doc, i) => (
                            <motion.div
                              key={doc.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => handlePreview(doc)}
                              className="grid grid-cols-[2fr_1fr_1fr_36px] gap-4 px-4 py-3.5 border-b border-border/20 last:border-0 hover:bg-surface-2 transition-colors items-center cursor-pointer group"
                            >
                              <span className="text-[13px] text-foreground truncate group-hover:text-gold transition-colors"
                                style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                                {doc.title}
                              </span>
                              <span className={`text-[10px] border px-2 py-0.5 w-fit ${TYPE_COLORS[doc.type] || ''}`}
                                style={{ fontFamily: 'DM Mono, monospace' }}>
                                {doc.type.toUpperCase().replace('-', ' ')}
                              </span>
                              <span className="text-[11px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                                {formatDate(doc.created_at)}
                              </span>
                              <div className="flex items-center justify-center opacity-30 group-hover:opacity-70 transition-opacity">
                                <Eye size={14} className="text-gold" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* ── Document preview modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {previewDoc && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 md:p-8"
            onClick={e => e.target === e.currentTarget && setPreviewDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-background border border-border w-full max-w-3xl h-[82vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-surface shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[10px] border px-2 py-0.5 shrink-0 ${TYPE_COLORS[previewDoc.type] || ''}`}
                    style={{ fontFamily: 'DM Mono, monospace' }}>
                    {previewDoc.type.toUpperCase().replace('-', ' ')}
                  </span>
                  <span className="text-[13px] text-foreground truncate" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    {previewDoc.title}
                  </span>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-[11px] text-muted hover:text-foreground px-3 py-1 border border-border hover:border-gold/40 transition-all shrink-0 ml-4"
                  style={{ fontFamily: 'DM Mono, monospace' }}
                >
                  CLOSE
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <DocumentPreview content={previewDoc.content || ''} isGenerating={false} title={previewDoc.title} className="h-full" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── CaseCard sub-component ───────────────────────────────────────────────────

function CaseCard({ c, selected }: { c: Case; selected?: boolean }) {
  return (
    <div className={`flex items-start gap-4 p-4 border transition-all ${
      selected ? 'bg-surface-2 border-gold/30' : 'border-border/30'
    }`}>
      <div className="w-8 h-8 flex items-center justify-center bg-forest border border-gold/30 shrink-0 mt-0.5">
        <Briefcase size={14} className="text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-[17px] text-foreground leading-tight"
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
            {c.title}
          </h3>
          <span className={`text-[10px] border px-2 py-0.5 ${
            c.status === 'active' ? 'text-[#86efac] border-[rgba(134,239,172,0.3)]' : 'text-muted border-muted/30'
          }`} style={{ fontFamily: 'DM Mono, monospace' }}>
            {c.status.toUpperCase()}
          </span>
        </div>
        {c.description && (
          <p className="text-[12px] text-muted mt-1 line-clamp-2" style={{ fontFamily: 'Lora, serif' }}>
            {c.description}
          </p>
        )}
        <p className="text-[10px] text-muted/50 mt-1.5" style={{ fontFamily: 'DM Mono, monospace' }}>
          Opened {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </div>
  )
}
