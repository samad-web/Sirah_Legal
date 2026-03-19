import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, Plus, Briefcase, Link2, Trash2, X, Copy, Check, RefreshCw,
    StickyNote, History, Pencil,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
    getCases, createCase, deleteCase, updateCase,
    getClientProfiles, assignClientToCase, removeClientFromCase,
    getUserDocuments, linkDocumentToCase, unlinkDocumentFromCase,
    getLinkedCaseDocumentIds, getClientsForCase, resetClientPassword,
} from '@/lib/api'
import {
    getCaseNotes, createCaseNote, updateCaseNote, deleteCaseNote,
    getDocumentRequests, createDocumentRequest, updateDocumentRequest,
    getAuditLogs, getCaseStatusHistory,
} from '@/lib/api-additions'
import type { Case, Profile, Document, CaseNote, DocumentRequest, AuditLog, CaseStatusHistory } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea } from '@/components/ui/FormFields'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn, formatDate } from '@/lib/utils'
import { createClientAccount } from '@/lib/client-api'

function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

type CaseDetailTab = 'clients' | 'documents' | 'notes' | 'requests' | 'audit' | 'history'

export default function ManageClientsPage() {
    const { user } = useAuth()

    // Cases
    const [cases, setCases] = useState<Case[]>([])
    const [clients, setClients] = useState<Profile[]>([])
    const [myDocs, setMyDocs] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)

    // Selected case (for right-panel detail)
    const [selectedCase, setSelectedCase] = useState<Case | null>(null)
    const [caseClients, setCaseClients] = useState<Profile[]>([])
    const [caseDocIds, setCaseDocIds] = useState<string[]>([])
    const [activeTab, setActiveTab] = useState<CaseDetailTab>('clients')

    // Notes state
    const [notes, setNotes] = useState<CaseNote[]>([])
    const [noteInput, setNoteInput] = useState('')
    const [editingNote, setEditingNote] = useState<CaseNote | null>(null)
    const [savingNote, setSavingNote] = useState(false)

    // Document requests state
    const [requests, setRequests] = useState<DocumentRequest[]>([])
    const [showNewRequest, setShowNewRequest] = useState(false)
    const [reqTitle, setReqTitle] = useState('')
    const [reqDesc, setReqDesc] = useState('')
    const [reqClientId, setReqClientId] = useState('')

    // Audit logs state
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

    // Case history state
    const [statusHistory, setStatusHistory] = useState<CaseStatusHistory[]>([])

    // Confirm dialog
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

    // Inline feedback
    const [caseError, setCaseError] = useState('')
    const [resetMsg, setResetMsg] = useState('')
    const [resetError, setResetError] = useState('')

    // Modals
    const [showNewCase, setShowNewCase] = useState(false)
    const [showNewClient, setShowNewClient] = useState(false)
    const [showLinkDocs, setShowLinkDocs] = useState(false)
    const [showAssignClient, setShowAssignClient] = useState(false)

    // Form states
    const [caseTitle, setCaseTitle] = useState('')
    const [caseDesc, setCaseDesc] = useState('')
    const [clientName, setClientName] = useState('')
    const [clientEmail, setClientEmail] = useState('')
    const [tempPassword] = useState(generateTempPassword)
    const [creatingClient, setCreatingClient] = useState(false)
    const [clientError, setClientError] = useState('')
    const [clientCreated, setClientCreated] = useState<{ email: string; password: string } | null>(null)
    const [copied, setCopied] = useState(false)

    const fetchAll = useCallback(async () => {
        if (!user) return
        try {
            const [c, cl, docsResult] = await Promise.all([
                getCases(user.id),
                getClientProfiles(user.id),
                getUserDocuments(user.id, { limit: 200 }),
            ])
            setCases(c)
            setClients(cl)
            setMyDocs(docsResult.data)
        } catch (err) {
            console.error('[LexDraft] ManageClients: failed to load data:', err)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => { fetchAll() }, [fetchAll])

    const loadCaseDetail = async (c: Case) => {
        setSelectedCase(c)
        setActiveTab('clients')
        setNotes([])
        setRequests([])
        setAuditLogs([])
        setStatusHistory([])
        const [cl, docIds] = await Promise.all([
            getClientsForCase(c.id),
            getLinkedCaseDocumentIds(c.id),
        ])
        setCaseClients(cl)
        setCaseDocIds(docIds)
    }

    const loadTab = useCallback(async (tab: CaseDetailTab) => {
        if (!selectedCase) return
        setActiveTab(tab)
        if (tab === 'notes' && notes.length === 0) {
            try { setNotes(await getCaseNotes(selectedCase.id)) } catch { /* ignore */ }
        }
        if (tab === 'requests' && requests.length === 0) {
            try { setRequests(await getDocumentRequests(selectedCase.id)) } catch { /* ignore */ }
        }
        if (tab === 'audit' && auditLogs.length === 0) {
            try { setAuditLogs(await getAuditLogs({ caseId: selectedCase.id })) } catch { /* ignore */ }
        }
        if (tab === 'history' && statusHistory.length === 0) {
            try { setStatusHistory(await getCaseStatusHistory(selectedCase.id)) } catch { /* ignore */ }
        }
    }, [selectedCase, notes.length, requests.length, auditLogs.length, statusHistory.length])

    const handleCreateCase = async () => {
        if (!user || !caseTitle.trim()) return
        try {
            const c = await createCase({ title: caseTitle.trim(), description: caseDesc.trim() || undefined })
            setCases(prev => [c, ...prev])
            setCaseTitle(''); setCaseDesc(''); setShowNewCase(false)
        } catch { setCaseError('Failed to create case. Please try again.') }
    }

    const handleDeleteCase = (id: string) => {
        setConfirmDialog({
            title: 'Delete Case',
            message: 'Delete this case and all its assignments? This cannot be undone.',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    await deleteCase(id)
                    setCases(prev => prev.filter(c => c.id !== id))
                    if (selectedCase?.id === id) setSelectedCase(null)
                } catch { /* ignore */ }
            },
        })
    }

    const handleToggleCaseStatus = async (c: Case) => {
        const next = c.status === 'active' ? 'closed' : 'active'
        try {
            await updateCase(c.id, { status: next })
            setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: next } : x))
            if (selectedCase?.id === c.id) setSelectedCase(prev => prev ? { ...prev, status: next } : prev)
            // Refresh history if open
            if (activeTab === 'history') {
                try { setStatusHistory(await getCaseStatusHistory(c.id)) } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
    }

    const handleCreateClient = async () => {
        if (!user || !clientName.trim() || !clientEmail.trim()) return
        setCreatingClient(true); setClientError('')
        try {
            const data = await createClientAccount(clientEmail.trim(), tempPassword, clientName.trim())
            setClientCreated({ email: data.email, password: tempPassword })
            setClientName(''); setClientEmail('')
            await fetchAll()
        } catch (err) {
            setClientError(err instanceof Error ? err.message : 'Failed to create client')
        } finally { setCreatingClient(false) }
    }

    const handleToggleClientAssignment = async (clientId: string) => {
        if (!selectedCase) return
        const isAssigned = caseClients.some(c => c.id === clientId)
        try {
            if (isAssigned) {
                await removeClientFromCase(selectedCase.id, clientId)
                setCaseClients(prev => prev.filter(c => c.id !== clientId))
            } else {
                await assignClientToCase(selectedCase.id, clientId)
                const client = clients.find(c => c.id === clientId)
                if (client) setCaseClients(prev => [...prev, client])
            }
        } catch { /* ignore */ }
    }

    const handleToggleDocLink = async (docId: string) => {
        if (!selectedCase) return
        const isLinked = caseDocIds.includes(docId)
        try {
            if (isLinked) {
                await unlinkDocumentFromCase(selectedCase.id, docId)
                setCaseDocIds(prev => prev.filter(id => id !== docId))
            } else {
                await linkDocumentToCase(selectedCase.id, docId)
                setCaseDocIds(prev => [...prev, docId])
            }
        } catch { /* ignore */ }
    }

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    }

    const handleResetPassword = async (clientId: string) => {
        setResetMsg(''); setResetError('')
        try {
            const { email } = await resetClientPassword(clientId)
            setResetMsg(`Password reset email sent to ${email}`)
            setTimeout(() => setResetMsg(''), 4000)
        } catch (err) {
            setResetError(err instanceof Error ? err.message : 'Failed to send reset email')
        }
    }

    // Notes handlers
    const handleSaveNote = async () => {
        if (!selectedCase || !noteInput.trim()) return
        setSavingNote(true)
        try {
            if (editingNote) {
                const updated = await updateCaseNote(selectedCase.id, editingNote.id, noteInput.trim())
                setNotes(prev => prev.map(n => n.id === editingNote.id ? updated : n))
                setEditingNote(null)
            } else {
                const created = await createCaseNote(selectedCase.id, noteInput.trim())
                setNotes(prev => [created, ...prev])
            }
            setNoteInput('')
        } catch { /* ignore */ } finally { setSavingNote(false) }
    }

    const handleDeleteNote = (noteId: string) => {
        if (!selectedCase) return
        setConfirmDialog({
            title: 'Delete Note',
            message: 'This note will be permanently deleted.',
            onConfirm: async () => {
                setConfirmDialog(null)
                try { await deleteCaseNote(selectedCase.id, noteId); setNotes(prev => prev.filter(n => n.id !== noteId)) }
                catch { /* ignore */ }
            },
        })
    }

    // Request handlers
    const handleCreateRequest = async () => {
        if (!selectedCase || !reqTitle.trim() || !reqClientId) return
        try {
            const req = await createDocumentRequest({ case_id: selectedCase.id, client_id: reqClientId, title: reqTitle.trim(), description: reqDesc.trim() || undefined })
            setRequests(prev => [req, ...prev])
            setReqTitle(''); setReqDesc(''); setReqClientId(''); setShowNewRequest(false)
        } catch { /* ignore */ }
    }

    const handleCancelRequest = async (reqId: string) => {
        try {
            const updated = await updateDocumentRequest(reqId, { status: 'cancelled' })
            setRequests(prev => prev.map(r => r.id === reqId ? updated : r))
        } catch { /* ignore */ }
    }

    const TABS: { key: CaseDetailTab; label: string }[] = [
        { key: 'clients', label: 'CLIENTS' },
        { key: 'documents', label: 'DOCS' },
        { key: 'notes', label: 'NOTES' },
        { key: 'requests', label: 'REQUESTS' },
        { key: 'audit', label: 'AUDIT' },
        { key: 'history', label: 'HISTORY' },
    ]

    return (
        <div className="p-4 md:p-8 max-w-[1400px]">
            <ConfirmDialog
                open={!!confirmDialog}
                title={confirmDialog?.title ?? ''}
                message={confirmDialog?.message ?? ''}
                onConfirm={confirmDialog?.onConfirm ?? (() => {})}
                onCancel={() => setConfirmDialog(null)}
            />
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-[32px] text-[#FAF7F0] mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
                    Manage Clients
                </h1>
                <p className="text-[12px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {cases.length} case{cases.length !== 1 ? 's' : ''} · {clients.length} client{clients.length !== 1 ? 's' : ''}
                </p>
            </div>

            <div className="gold-line-solid mb-8" />

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border border-[#C9A84C] border-t-transparent animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    {/* ── Left: Cases ── */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                CASES
                            </p>
                            <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setShowNewCase(true)}>
                                NEW CASE
                            </Button>
                        </div>

                        {/* New case form */}
                        <AnimatePresence>
                            {showNewCase && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                    className="bg-[#161616] border border-[rgba(201,168,76,0.25)] p-4 mb-4 space-y-3"
                                >
                                    <FormField label="Case Title" required>
                                        <Input value={caseTitle} onChange={e => setCaseTitle(e.target.value)} placeholder="e.g. Property Dispute — M/s ABC vs XYZ" />
                                    </FormField>
                                    <FormField label="Description">
                                        <Textarea value={caseDesc} onChange={e => setCaseDesc(e.target.value)} rows={2} placeholder="Brief description..." />
                                    </FormField>
                                    <div className="flex gap-2 items-center flex-wrap">
                                        <Button variant="primary" size="sm" onClick={handleCreateCase} disabled={!caseTitle.trim()}>SAVE</Button>
                                        <Button variant="ghost" size="sm" onClick={() => { setShowNewCase(false); setCaseError('') }}>CANCEL</Button>
                                        {caseError && <p className="text-[11px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>{caseError}</p>}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {cases.length === 0 ? (
                            <div className="border border-[rgba(201,168,76,0.1)] p-8 text-center">
                                <Briefcase size={24} className="text-[rgba(250,247,240,0.15)] mx-auto mb-3" />
                                <p className="text-[13px] text-[rgba(250,247,240,0.3)]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                                    No cases yet. Create a case to get started.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cases.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => loadCaseDetail(c)}
                                        className={cn(
                                            'p-4 border cursor-pointer transition-all',
                                            selectedCase?.id === c.id
                                                ? 'bg-[#1B3A2D] border-[#C9A84C]'
                                                : 'bg-[#161616] border-[rgba(201,168,76,0.15)] hover:border-[rgba(201,168,76,0.35)]'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[15px] text-[#FAF7F0] truncate" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                                                    {c.title}
                                                </p>
                                                {c.description && (
                                                    <p className="text-[11px] text-[rgba(250,247,240,0.4)] mt-0.5 truncate" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                        {c.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span
                                                    className={`text-[9px] border px-2 py-0.5 cursor-pointer transition-all ${c.status === 'active'
                                                        ? 'text-[#86efac] border-[rgba(134,239,172,0.3)] hover:bg-[rgba(134,239,172,0.05)]'
                                                        : 'text-[rgba(250,247,240,0.5)] border-[rgba(250,247,240,0.15)] hover:bg-[rgba(250,247,240,0.05)]'
                                                        }`}
                                                    style={{ fontFamily: 'DM Mono, monospace' }}
                                                    onClick={e => { e.stopPropagation(); handleToggleCaseStatus(c) }}
                                                >
                                                    {c.status.toUpperCase()}
                                                </span>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDeleteCase(c.id) }}
                                                    className="p-1 text-[rgba(250,247,240,0.25)] hover:text-[#f87171] transition-colors"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Clients list */}
                        <div className="mt-8">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                    CLIENT ACCOUNTS
                                </p>
                                <Button variant="outline" size="sm" icon={<Plus size={13} />} onClick={() => { setShowNewClient(true); setClientCreated(null); setClientError('') }}>
                                    CREATE CLIENT
                                </Button>
                            </div>

                            <AnimatePresence>
                                {showNewClient && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                        className="bg-[#161616] border border-[rgba(201,168,76,0.25)] p-4 mb-4 space-y-3"
                                    >
                                        {clientCreated ? (
                                            <div className="space-y-3">
                                                <div className="p-3 bg-[rgba(134,239,172,0.06)] border border-[rgba(134,239,172,0.25)]">
                                                    <p className="text-[11px] text-[#86efac] mb-2" style={{ fontFamily: 'DM Mono, monospace' }}>✓ CLIENT ACCOUNT CREATED</p>
                                                    <p className="text-[12px] text-[rgba(250,247,240,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>Email: {clientCreated.email}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-[12px] text-[rgba(250,247,240,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                            Password: <span className="text-[#C9A84C]">{clientCreated.password}</span>
                                                        </p>
                                                        <button onClick={() => handleCopy(`Email: ${clientCreated.email}\nPassword: ${clientCreated.password}`)} className="p-1 text-[rgba(250,247,240,0.4)] hover:text-[#C9A84C]">
                                                            {copied ? <Check size={12} className="text-[#86efac]" /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                    <p className="text-[10px] text-[rgba(250,247,240,0.3)] mt-2" style={{ fontFamily: 'DM Mono, monospace' }}>Share credentials securely. Password shown once.</p>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => setShowNewClient(false)}>CLOSE</Button>
                                            </div>
                                        ) : (
                                            <>
                                                <FormField label="Client Full Name" required><Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Ramesh Kumar" /></FormField>
                                                <FormField label="Client Email" required><Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@email.com" /></FormField>
                                                <div className="p-3 bg-[#0a0a0a] border border-[rgba(201,168,76,0.1)]">
                                                    <p className="text-[10px] text-[rgba(250,247,240,0.35)] mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>TEMP PASSWORD (auto-generated)</p>
                                                    <p className="text-[13px] text-[#C9A84C] font-mono">{tempPassword}</p>
                                                </div>
                                                {clientError && <p className="text-[11px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>ERROR: {clientError}</p>}
                                                <div className="flex gap-2">
                                                    <Button variant="primary" size="sm" loading={creatingClient} onClick={handleCreateClient} disabled={!clientName.trim() || !clientEmail.trim()}>CREATE ACCOUNT</Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setShowNewClient(false)}>CANCEL</Button>
                                                </div>
                                            </>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {clients.length === 0 ? (
                                <div className="border border-[rgba(201,168,76,0.1)] p-6 text-center">
                                    <Users size={20} className="text-[rgba(250,247,240,0.15)] mx-auto mb-2" />
                                    <p className="text-[12px] text-[rgba(250,247,240,0.3)]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>No clients yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {clients.map(client => (
                                        <div key={client.id} className="flex items-center justify-between px-4 py-2.5 bg-[#161616] border border-[rgba(201,168,76,0.1)] hover:border-[rgba(201,168,76,0.25)] transition-all">
                                            <p className="text-[13px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>{client.full_name || 'Unnamed Client'}</p>
                                            <button onClick={() => handleResetPassword(client.id)} className="flex items-center gap-1.5 text-[10px] text-[rgba(250,247,240,0.35)] hover:text-[#C9A84C] transition-colors" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                <RefreshCw size={11} />RESET PW
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {resetMsg && (
                                <p className="mt-2 text-[11px] text-[#86efac]" style={{ fontFamily: 'DM Mono, monospace' }}>{resetMsg}</p>
                            )}
                            {resetError && (
                                <p className="mt-2 text-[11px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>{resetError}</p>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Case Detail ── */}
                    <div>
                        {!selectedCase ? (
                            <div className="h-full flex flex-col items-center justify-center border border-[rgba(201,168,76,0.1)] p-12 text-center">
                                <Briefcase size={28} className="text-[rgba(250,247,240,0.1)] mb-4" />
                                <p className="text-[14px] text-[rgba(250,247,240,0.3)]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                                    Select a case to manage clients, documents, notes and requests.
                                </p>
                            </div>
                        ) : (
                            <motion.div key={selectedCase.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                                {/* Case header */}
                                <div className="p-4 bg-[#161616] border border-[rgba(201,168,76,0.25)]">
                                    <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>SELECTED CASE</p>
                                    <h2 className="text-[20px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>{selectedCase.title}</h2>
                                    {selectedCase.description && (
                                        <p className="text-[12px] text-[rgba(250,247,240,0.4)] mt-1" style={{ fontFamily: 'Lora, serif' }}>{selectedCase.description}</p>
                                    )}
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-0 border-b border-[rgba(201,168,76,0.15)] overflow-x-auto">
                                    {TABS.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => loadTab(tab.key)}
                                            className={cn(
                                                'px-3 py-2 text-[10px] border-b-2 transition-all whitespace-nowrap',
                                                activeTab === tab.key
                                                    ? 'border-[#C9A84C] text-[#C9A84C]'
                                                    : 'border-transparent text-[rgba(250,247,240,0.4)] hover:text-[rgba(250,247,240,0.7)]'
                                            )}
                                            style={{ fontFamily: 'DM Mono, monospace' }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab content */}
                                {activeTab === 'clients' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>ASSIGNED ({caseClients.length})</p>
                                            <Button variant="outline" size="sm" icon={<Users size={12} />} onClick={() => setShowAssignClient(!showAssignClient)}>MANAGE</Button>
                                        </div>
                                        <AnimatePresence>
                                            {showAssignClient && clients.length > 0 && (
                                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-3 p-3 bg-[#0a0a0a] border border-[rgba(201,168,76,0.15)] space-y-1">
                                                    {clients.map(client => {
                                                        const isAssigned = caseClients.some(c => c.id === client.id)
                                                        return (
                                                            <button key={client.id} onClick={() => handleToggleClientAssignment(client.id)} className={cn('w-full flex items-center gap-3 px-3 py-2 text-left transition-all border', isAssigned ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.3)] text-[#F5EDD6]' : 'bg-transparent border-transparent text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0]')}>
                                                                <span className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${isAssigned ? 'border-[#C9A84C] bg-[#C9A84C]' : 'border-[rgba(250,247,240,0.3)]'}`}>{isAssigned && <Check size={9} className="text-[#0E0E0E]" />}</span>
                                                                <span className="text-[12px]" style={{ fontFamily: 'DM Mono, monospace' }}>{client.full_name || 'Unnamed Client'}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {caseClients.length === 0 ? (
                                            <p className="text-[12px] text-[rgba(250,247,240,0.3)] p-3 border border-[rgba(201,168,76,0.08)]" style={{ fontFamily: 'DM Mono, monospace' }}>No clients assigned.</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {caseClients.map(c => (
                                                    <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-[#161616] border border-[rgba(201,168,76,0.1)]">
                                                        <span className="text-[12px] text-[#FAF7F0]" style={{ fontFamily: 'DM Mono, monospace' }}>{c.full_name || 'Unnamed Client'}</span>
                                                        <button onClick={() => handleToggleClientAssignment(c.id)} className="p-1 text-[rgba(250,247,240,0.25)] hover:text-[#f87171]"><X size={12} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'documents' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>LINKED ({caseDocIds.length})</p>
                                            <Button variant="outline" size="sm" icon={<Link2 size={12} />} onClick={() => setShowLinkDocs(!showLinkDocs)}>MANAGE</Button>
                                        </div>
                                        <AnimatePresence>
                                            {showLinkDocs && myDocs.length > 0 && (
                                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-3 p-3 bg-[#0a0a0a] border border-[rgba(201,168,76,0.15)] space-y-1 max-h-48 overflow-y-auto">
                                                    {myDocs.map(doc => {
                                                        const isLinked = caseDocIds.includes(doc.id)
                                                        return (
                                                            <button key={doc.id} onClick={() => handleToggleDocLink(doc.id)} className={cn('w-full flex items-center gap-3 px-3 py-2 text-left transition-all border', isLinked ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.3)] text-[#F5EDD6]' : 'bg-transparent border-transparent text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0]')}>
                                                                <span className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${isLinked ? 'border-[#C9A84C] bg-[#C9A84C]' : 'border-[rgba(250,247,240,0.3)]'}`}>{isLinked && <Check size={9} className="text-[#0E0E0E]" />}</span>
                                                                <span className="text-[12px] truncate" style={{ fontFamily: 'DM Mono, monospace' }}>{doc.title}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {caseDocIds.length === 0 ? (
                                            <p className="text-[12px] text-[rgba(250,247,240,0.3)] p-3 border border-[rgba(201,168,76,0.08)]" style={{ fontFamily: 'DM Mono, monospace' }}>No documents linked.</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {myDocs.filter(d => caseDocIds.includes(d.id)).map(doc => (
                                                    <div key={doc.id} className="flex items-center justify-between px-3 py-2 bg-[#161616] border border-[rgba(201,168,76,0.1)]">
                                                        <span className="text-[12px] text-[#FAF7F0] truncate" style={{ fontFamily: 'Cormorant Garamond, serif' }}>{doc.title}</span>
                                                        <button onClick={() => handleToggleDocLink(doc.id)} className="p-1 text-[rgba(250,247,240,0.25)] hover:text-[#f87171]"><X size={12} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'notes' && (
                                    <div>
                                        <p className="text-[10px] text-[rgba(250,247,240,0.3)] mb-3 p-2 border border-[rgba(201,168,76,0.08)] bg-[#0a0a0a]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                            <StickyNote size={10} className="inline mr-1" /> Notes are private — visible only to you, not the client.
                                        </p>
                                        <div className="mb-3 space-y-2">
                                            <Textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={3} placeholder="Write a private note about this case..." />
                                            <div className="flex gap-2">
                                                <Button variant="primary" size="sm" loading={savingNote} onClick={handleSaveNote} disabled={!noteInput.trim()}>
                                                    {editingNote ? 'UPDATE NOTE' : 'ADD NOTE'}
                                                </Button>
                                                {editingNote && <Button variant="ghost" size="sm" onClick={() => { setEditingNote(null); setNoteInput('') }}>CANCEL</Button>}
                                            </div>
                                        </div>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {notes.length === 0 ? (
                                                <p className="text-[12px] text-[rgba(250,247,240,0.3)] py-4 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>No notes yet.</p>
                                            ) : notes.map(note => (
                                                <div key={note.id} className="p-3 bg-[#161616] border border-[rgba(201,168,76,0.1)] group">
                                                    <p className="text-[12px] text-[rgba(250,247,240,0.8)] whitespace-pre-wrap" style={{ fontFamily: 'Lora, serif' }}>{note.content}</p>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-[10px] text-[rgba(250,247,240,0.3)]" style={{ fontFamily: 'DM Mono, monospace' }}>{formatDate(note.created_at)}</span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => { setEditingNote(note); setNoteInput(note.content) }} className="p-1 text-[rgba(250,247,240,0.3)] hover:text-[#C9A84C]"><Pencil size={11} /></button>
                                                            <button onClick={() => handleDeleteNote(note.id)} className="p-1 text-[rgba(250,247,240,0.3)] hover:text-[#f87171]"><Trash2 size={11} /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'requests' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>DOCUMENT REQUESTS</p>
                                            <Button variant="outline" size="sm" icon={<Plus size={12} />} onClick={() => setShowNewRequest(!showNewRequest)}>NEW REQUEST</Button>
                                        </div>
                                        <AnimatePresence>
                                            {showNewRequest && (
                                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-3 p-3 bg-[#0a0a0a] border border-[rgba(201,168,76,0.15)] space-y-2">
                                                    <FormField label="Request Title" required>
                                                        <Input value={reqTitle} onChange={e => setReqTitle(e.target.value)} placeholder="e.g. Submit ID proof" />
                                                    </FormField>
                                                    <FormField label="Description">
                                                        <Textarea value={reqDesc} onChange={e => setReqDesc(e.target.value)} rows={2} placeholder="Details about the required document..." />
                                                    </FormField>
                                                    <FormField label="Client" required>
                                                        <select value={reqClientId} onChange={e => setReqClientId(e.target.value)} className="w-full bg-[#161616] border border-[rgba(201,168,76,0.2)] px-3 py-2 text-[12px] text-[#FAF7F0] focus:outline-none" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                            <option value="">Select client...</option>
                                                            {caseClients.map(c => <option key={c.id} value={c.id}>{c.full_name || 'Unnamed'}</option>)}
                                                        </select>
                                                    </FormField>
                                                    <div className="flex gap-2">
                                                        <Button variant="primary" size="sm" onClick={handleCreateRequest} disabled={!reqTitle.trim() || !reqClientId}>SEND REQUEST</Button>
                                                        <Button variant="ghost" size="sm" onClick={() => setShowNewRequest(false)}>CANCEL</Button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {requests.length === 0 ? (
                                                <p className="text-[12px] text-[rgba(250,247,240,0.3)] py-4 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>No requests yet.</p>
                                            ) : requests.map(req => (
                                                <div key={req.id} className="p-3 bg-[#161616] border border-[rgba(201,168,76,0.1)] flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] text-[#FAF7F0] truncate" style={{ fontFamily: 'Cormorant Garamond, serif' }}>{req.title}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[9px] border px-1.5 py-0.5 ${req.status === 'fulfilled' ? 'text-[#86efac] border-[rgba(134,239,172,0.3)]' : req.status === 'cancelled' ? 'text-[rgba(250,247,240,0.3)] border-[rgba(250,247,240,0.1)]' : 'text-[#fbbf24] border-[rgba(251,191,36,0.3)]'}`} style={{ fontFamily: 'DM Mono, monospace' }}>
                                                                {req.status.toUpperCase()}
                                                            </span>
                                                            {req.client && <span className="text-[10px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>{req.client.full_name}</span>}
                                                        </div>
                                                    </div>
                                                    {req.status === 'pending' && (
                                                        <button onClick={() => handleCancelRequest(req.id)} className="p-1 text-[rgba(250,247,240,0.25)] hover:text-[#f87171] shrink-0"><X size={12} /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'audit' && (
                                    <div>
                                        <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)] mb-3" style={{ fontFamily: 'DM Mono, monospace' }}>DOCUMENT ACCESS LOG</p>
                                        {auditLogs.length === 0 ? (
                                            <p className="text-[12px] text-[rgba(250,247,240,0.3)] py-4 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>No access logs yet.</p>
                                        ) : (
                                            <div className="border border-[rgba(201,168,76,0.1)] overflow-x-auto">
                                                <table className="w-full text-[11px] min-w-[400px]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                    <thead>
                                                        <tr className="border-b border-[rgba(201,168,76,0.08)] bg-[#0a0a0a]">
                                                            {['CLIENT', 'DOCUMENT', 'ACTION', 'DATE'].map(h => (
                                                                <th key={h} className="text-left px-3 py-2 text-[rgba(250,247,240,0.35)] font-normal">{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {auditLogs.map(log => (
                                                            <tr key={log.id} className="border-b border-[rgba(201,168,76,0.05)] hover:bg-[#161616]">
                                                                <td className="px-3 py-2 text-[rgba(250,247,240,0.6)]">{log.client?.full_name ?? '—'}</td>
                                                                <td className="px-3 py-2 text-[rgba(250,247,240,0.6)] truncate max-w-[120px]">{log.document?.title ?? '—'}</td>
                                                                <td className="px-3 py-2"><span className="text-[9px] border border-[rgba(201,168,76,0.2)] px-1.5 py-0.5 text-[rgba(201,168,76,0.7)]">{log.action.toUpperCase()}</span></td>
                                                                <td className="px-3 py-2 text-[rgba(250,247,240,0.4)]">{formatDate(log.created_at)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'history' && (
                                    <div>
                                        <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)] mb-3" style={{ fontFamily: 'DM Mono, monospace' }}>STATUS CHANGE HISTORY</p>
                                        {statusHistory.length === 0 ? (
                                            <p className="text-[12px] text-[rgba(250,247,240,0.3)] py-4 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>No status changes recorded.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {statusHistory.map(h => (
                                                    <div key={h.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#161616] border border-[rgba(201,168,76,0.08)]">
                                                        <History size={13} className="text-[rgba(250,247,240,0.3)] shrink-0" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {h.old_status && (
                                                                    <span className="text-[10px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>{h.old_status.toUpperCase()}</span>
                                                                )}
                                                                {h.old_status && <span className="text-[10px] text-[rgba(250,247,240,0.3)]">→</span>}
                                                                <span className="text-[10px] text-[#86efac]" style={{ fontFamily: 'DM Mono, monospace' }}>{h.new_status.toUpperCase()}</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] text-[rgba(250,247,240,0.3)] shrink-0" style={{ fontFamily: 'DM Mono, monospace' }}>{formatDate(h.created_at)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
