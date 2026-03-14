import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Mail, Paperclip, Check } from 'lucide-react'
import { Button } from './Button'
import { FormField, Input, Textarea } from './FormFields'
import { cn } from '@/lib/utils'

interface EmailModalProps {
    isOpen: boolean
    onClose: () => void
    onSend: (data: { to: string; subject: string; body: string; attachPdf: boolean }) => Promise<void>
    defaultSubject?: string
    defaultBody?: string
    documentTitle?: string
}

export function EmailModal({
    isOpen,
    onClose,
    onSend,
    defaultSubject = '',
    defaultBody = '',
    documentTitle,
}: EmailModalProps) {
    const [to, setTo] = useState('')
    const [subject, setSubject] = useState(defaultSubject)
    const [body, setBody] = useState(defaultBody)
    const [attachPdf, setAttachPdf] = useState(true)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)

    const handleSend = async () => {
        if (!to || !subject) return
        setSending(true)
        try {
            await onSend({ to, subject, body, attachPdf })
            setSent(true)
            setTimeout(() => {
                setSent(false)
                onClose()
            }, 2000)
        } catch (err) {
            console.error('[LexDraft] Failed to send email:', err)
            alert('Failed to send email. Please try again.')
        } finally {
            setSending(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-[rgba(0,0,0,0.8)] z-[100] flex items-center justify-center p-4"
                    onClick={e => e.target === e.currentTarget && onClose()}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="bg-[#0E0E0E] border border-[rgba(201,168,76,0.3)] w-full max-w-lg overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,168,76,0.2)] bg-[#0a0a0a]">
                            <div className="flex items-center gap-2">
                                <Mail size={16} className="text-[#C9A84C]" />
                                <span className="text-[14px] text-[#FAF7F0] tracking-wide" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                                    Email Document
                                </span>
                            </div>
                            <button onClick={onClose} className="p-1 text-[rgba(250,247,240,0.4)] hover:text-[#FAF7F0] transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <FormField label="To" required>
                                <Input
                                    value={to}
                                    onChange={e => setTo(e.target.value)}
                                    placeholder="recipient@example.com"
                                    type="email"
                                />
                            </FormField>

                            <FormField label="Subject" required>
                                <Input
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    placeholder="Subject of the email"
                                />
                            </FormField>

                            <FormField label="Message">
                                <Textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    placeholder="Write your message here..."
                                    rows={6}
                                />
                            </FormField>

                            {documentTitle && (
                                <div className="flex items-center justify-between p-3 bg-[#161616] border border-[rgba(201,168,76,0.15)] rounded-sm">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Paperclip size={14} className="text-[rgba(201,168,76,0.5)] flex-shrink-0" />
                                        <span className="text-[11px] text-[rgba(250,247,240,0.6)] truncate" style={{ fontFamily: 'DM Mono, monospace' }}>
                                            {documentTitle}.pdf
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setAttachPdf(!attachPdf)}
                                        className={cn(
                                            "text-[9px] px-2 py-1 border transition-all",
                                            attachPdf
                                                ? "bg-[#1B3A2D] border-[rgba(201,168,76,0.4)] text-[#F5EDD6]"
                                                : "bg-transparent border-[rgba(250,247,240,0.1)] text-[rgba(250,247,240,0.3)]"
                                        )}
                                        style={{ fontFamily: 'DM Mono, monospace' }}
                                    >
                                        {attachPdf ? 'ATTACHED' : 'ATTACH'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-[#0a0a0a] border-t border-[rgba(201,168,76,0.1)] flex justify-end gap-3">
                            <Button variant="outline" onClick={onClose} disabled={sending}>
                                CANCEL
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleSend}
                                loading={sending}
                                disabled={sent}
                                icon={sent ? <Check size={14} /> : <Send size={14} />}
                            >
                                {sent ? 'SENT' : 'SEND EMAIL'}
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
