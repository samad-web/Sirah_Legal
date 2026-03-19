import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Send, Briefcase, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getCases } from '@/lib/api'
import { getCaseMessages, sendMessage, markMessagesRead } from '@/lib/api-additions'
import type { Case } from '@/lib/supabase'
import type { CaseMessage } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export default function MessagesPage() {
  const { user } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [messages, setMessages] = useState<CaseMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  const [showSidebar, setShowSidebar] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchCases = useCallback(async () => {
    if (!user) return
    try {
      const data = await getCases(user.id)
      setCases(data)
    } catch (err) {
      console.error('[LexDraft] Messages: failed to load cases:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchCases() }, [fetchCases])

  const loadMessages = useCallback(async (c: Case) => {
    setSelectedCase(c)
    setShowSidebar(false)
    setLoadingMessages(true)
    try {
      const msgs = await getCaseMessages(c.id)
      setMessages(msgs)
      // Mark as read
      await markMessagesRead(c.id)
      setUnreadMap(prev => ({ ...prev, [c.id]: 0 }))
    } catch (err) {
      console.error('[LexDraft] Messages: failed to load messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = async () => {
    if (!selectedCase || !input.trim() || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    try {
      const msg = await sendMessage(selectedCase.id, content)
      setMessages(prev => [...prev, msg])
    } catch (err) {
      console.error('[LexDraft] Messages: failed to send:', err)
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 1px)' }}>
      {/* Case list sidebar */}
      <div className={cn(
        'shrink-0 border-r border-border flex flex-col',
        'w-full md:w-72',
        showSidebar ? 'flex' : 'hidden md:flex',
      )}>
        <div className="p-5 border-b border-border/60">
          <h1 className="text-[22px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
            Messages
          </h1>
          <p className="text-[11px] text-muted mt-1" style={{ fontFamily: 'DM Mono, monospace' }}>
            Per-case secure chat
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border border-gold border-t-transparent animate-spin" />
            </div>
          ) : cases.length === 0 ? (
            <div className="p-6 text-center">
              <Briefcase size={20} className="text-muted/30 mx-auto mb-2" />
              <p className="text-[12px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>No cases yet.</p>
            </div>
          ) : (
            cases.map(c => (
              <button
                key={c.id}
                onClick={() => loadMessages(c)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border/30 transition-colors',
                  selectedCase?.id === c.id ? 'bg-forest' : 'hover:bg-surface-2',
                )}
              >
                <Briefcase size={14} className={selectedCase?.id === c.id ? 'text-gold mt-0.5 shrink-0' : 'text-muted mt-0.5 shrink-0'} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[13px] truncate', selectedCase?.id === c.id ? 'text-parchment' : 'text-foreground')}
                    style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    {c.title}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {c.status.toUpperCase()}
                  </p>
                </div>
                {(unreadMap[c.id] ?? 0) > 0 && (
                  <span className="w-5 h-5 bg-gold text-background text-[10px] flex items-center justify-center shrink-0">
                    {unreadMap[c.id]}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        !showSidebar ? 'flex' : 'hidden md:flex',
      )}>
        {!selectedCase ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <MessageSquare size={32} className="text-muted/20 mb-4" />
            <p className="text-[16px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Select a case to start messaging.
            </p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-4 py-3 border-b border-border/60 bg-surface shrink-0 flex items-center gap-3">
              <button
                onClick={() => setShowSidebar(true)}
                className="md:hidden p-1.5 -ml-1 text-muted hover:text-foreground transition-colors"
                aria-label="Back to cases"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <p className="text-[15px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                  {selectedCase.title}
                </p>
                <p className="text-[10px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                  {selectedCase.status.toUpperCase()} · Secure case chat
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border border-gold border-t-transparent animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare size={24} className="text-muted/20 mb-3" />
                  <p className="text-[13px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    No messages yet. Start the conversation.
                  </p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === user?.id
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                    >
                      <div className={cn(
                        'max-w-[70%] px-4 py-2.5 border',
                        isMe
                          ? 'bg-forest border-gold/30 text-parchment'
                          : 'bg-surface-2 border-border text-foreground',
                      )}>
                        {!isMe && msg.sender && (
                          <p className="text-[10px] text-gold mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>
                            {msg.sender.full_name ?? msg.sender.role}
                          </p>
                        )}
                        <p className="text-[13px] whitespace-pre-wrap" style={{ fontFamily: 'Lora, serif' }}>
                          {msg.content}
                        </p>
                        <p className="text-[9px] text-muted mt-1 text-right" style={{ fontFamily: 'DM Mono, monospace' }}>
                          {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {msg.read_at && isMe && ' · Read'}
                        </p>
                      </div>
                    </motion.div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border/60 bg-surface shrink-0">
              <div className="flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 bg-surface-2 border border-border px-3 py-2 text-[13px] text-foreground resize-none focus:outline-none focus:border-gold/50 transition-colors placeholder:text-muted/40"
                  style={{ fontFamily: 'Lora, serif' }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSend}
                  loading={sending}
                  disabled={!input.trim()}
                  icon={<Send size={13} />}
                >
                  SEND
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
