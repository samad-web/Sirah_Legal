import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, Plus, Briefcase, Link2, Trash2, X, Copy, Check, RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
    getCases, createCase, deleteCase, updateCase,
    getClientProfiles, assignClientToCase, removeClientFromCase,
    getUserDocuments, linkDocumentToCase, unlinkDocumentFromCase,
    getLinkedCaseDocumentIds, getClientsForCase,
    type Case, type Profile, type Document,
} from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea } from '@/components/ui/FormFields'
import { cn } from '@/lib/utils'
import { createClientAccount } from '@/lib/client-api'

function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

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
            const [c, cl, docs] = await Promise.all([
                getCases(user.id),
                getClientProfiles(user.id),
                getUserDocuments(user.id),
            ])
            setCases(c)
            setClients(cl)
            setMyDocs(docs)
        } catch (err) {
            console.error('[LexDraft] ManageClients: failed to load data:', err)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => { fetchAll() }, [fetchAll])

    const loadCaseDetail = async (c: Case) => {
        setSelectedCase(c)
        const [cl, docIds] = await Promise.all([
            getClientsForCase(c.id),
            getLinkedCaseDocumentIds(c.id),
        ])
        setCaseClients(cl)
        setCaseDocIds(docIds)
    }

    const handleCreateCase = async () => {
        if (!user || !caseTitle.trim()) return
        try {
            const c = await createCase(user.id, caseTitle.trim(), caseDesc.trim())
            setCases(prev => [c, ...prev])
            setCaseTitle('')
            setCaseDesc('')
            setShowNewCase(false)
        } catch (err) {
            console.error('[LexDraft] Failed to create case:', err)
            alert('Failed to create case. Please try again.')
        }
    }

    const handleDeleteCase = async (id: string) => {
        if (!confirm('Delete this case and all its assignments?')) return
        try {
            await deleteCase(id)
            setCases(prev => prev.filter(c => c.id !== id))
            if (selectedCase?.id === id) setSelectedCase(null)
        } catch (err) {
            console.error('[LexDraft] Failed to delete case:', err)
            alert('Failed to delete case.')
        }
    }

    const handleToggleCaseStatus = async (c: Case) => {
        const next = c.status === 'active' ? 'closed' : 'active'
        try {
            await updateCase(c.id, { status: next })
            setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: next } : x))
            if (selectedCase?.id === c.id) setSelectedCase(prev => prev ? { ...prev, status: next } : prev)
        } catch (err) {
            console.error('[LexDraft] Failed to update case status:', err)
        }
    }

    const handleCreateClient = async () => {
        if (!user || !clientName.trim() || !clientEmail.trim()) return
        setCreatingClient(true)
        setClientError('')
        try {
            const data = await createClientAccount(clientEmail.trim(), tempPassword, clientName.trim())

            setClientCreated({ email: data.email, password: tempPassword })
            setClientName('')
            setClientEmail('')
            await fetchAll()
        } catch (err) {
            setClientError(err instanceof Error ? err.message : 'Failed to create client')
        } finally {
            setCreatingClient(false)
        }
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
        } catch (err) {
            console.error('[LexDraft] Failed to toggle client assignment:', err)
        }
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
        } catch (err) {
            console.error('[LexDraft] Failed to toggle document link:', err)
        }
    }

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const handleResetPassword = async (email: string) => {
        await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })
        alert(`Password reset email sent to ${email}`)
    }

    return (
        <div className="p-8 max-w-[1400px]">
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
                <div className="grid grid-cols-[1fr_1fr] gap-8">
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
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="bg-[#161616] border border-[rgba(201,168,76,0.25)] p-4 mb-4 space-y-3"
                                >
                                    <FormField label="Case Title" required>
                                        <Input value={caseTitle} onChange={e => setCaseTitle(e.target.value)} placeholder="e.g. Property Dispute — M/s ABC vs XYZ" />
                                    </FormField>
                                    <FormField label="Description">
                                        <Textarea value={caseDesc} onChange={e => setCaseDesc(e.target.value)} rows={2} placeholder="Brief description..." />
                                    </FormField>
                                    <div className="flex gap-2">
                                        <Button variant="primary" size="sm" onClick={handleCreateCase} disabled={!caseTitle.trim()}>SAVE</Button>
                                        <Button variant="ghost" size="sm" onClick={() => setShowNewCase(false)}>CANCEL</Button>
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

                            {/* New client form */}
                            <AnimatePresence>
                                {showNewClient && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        className="bg-[#161616] border border-[rgba(201,168,76,0.25)] p-4 mb-4 space-y-3"
                                    >
                                        {clientCreated ? (
                                            <div className="space-y-3">
                                                <div className="p-3 bg-[rgba(134,239,172,0.06)] border border-[rgba(134,239,172,0.25)]">
                                                    <p className="text-[11px] text-[#86efac] mb-2" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                        ✓ CLIENT ACCOUNT CREATED
                                                    </p>
                                                    <p className="text-[12px] text-[rgba(250,247,240,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                        Email: {clientCreated.email}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-[12px] text-[rgba(250,247,240,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                            Password: <span className="text-[#C9A84C]">{clientCreated.password}</span>
                                                        </p>
                                                        <button
                                                            onClick={() => handleCopy(`Email: ${clientCreated.email}\nPassword: ${clientCreated.password}`)}
                                                            className="p-1 text-[rgba(250,247,240,0.4)] hover:text-[#C9A84C] transition-colors"
                                                        >
                                                            {copied ? <Check size={12} className="text-[#86efac]" /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                    <p className="text-[10px] text-[rgba(250,247,240,0.3)] mt-2" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                        Share these credentials securely. Password shown only once.
                                                    </p>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => setShowNewClient(false)}>CLOSE</Button>
                                            </div>
                                        ) : (
                                            <>
                                                <FormField label="Client Full Name" required>
                                                    <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
                                                </FormField>
                                                <FormField label="Client Email" required>
                                                    <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@email.com" />
                                                </FormField>
                                                <div className="p-3 bg-[#0a0a0a] border border-[rgba(201,168,76,0.1)]">
                                                    <p className="text-[10px] text-[rgba(250,247,240,0.35)] mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>TEMP PASSWORD (auto-generated)</p>
                                                    <p className="text-[13px] text-[#C9A84C] font-mono">{tempPassword}</p>
                                                </div>
                                                {clientError && (
                                                    <p className="text-[11px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>ERROR: {clientError}</p>
                                                )}
                                                <div className="flex gap-2">
                                                    <Button variant="primary" size="sm" loading={creatingClient} onClick={handleCreateClient} disabled={!clientName.trim() || !clientEmail.trim()}>
                                                        CREATE ACCOUNT
                                                    </Button>
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
                                            <div>
                                                <p className="text-[13px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                                                    {client.full_name || 'Unnamed Client'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleResetPassword(client.full_name || '')}
                                                className="flex items-center gap-1.5 text-[10px] text-[rgba(250,247,240,0.35)] hover:text-[#C9A84C] transition-colors"
                                                style={{ fontFamily: 'DM Mono, monospace' }}
                                                title="Send password reset email"
                                            >
                                                <RefreshCw size={11} />
                                                RESET PW
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Case Detail ── */}
                    <div>
                        {!selectedCase ? (
                            <div className="h-full flex flex-col items-center justify-center border border-[rgba(201,168,76,0.1)] p-12 text-center">
                                <Briefcase size={28} className="text-[rgba(250,247,240,0.1)] mb-4" />
                                <p className="text-[14px] text-[rgba(250,247,240,0.3)]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                                    Select a case to manage clients and documents.
                                </p>
                            </div>
                        ) : (
                            <motion.div
                                key={selectedCase.id}
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {/* Case header */}
                                <div className="p-5 bg-[#161616] border border-[rgba(201,168,76,0.25)]">
                                    <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>
                                        SELECTED CASE
                                    </p>
                                    <h2 className="text-[22px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                                        {selectedCase.title}
                                    </h2>
                                    {selectedCase.description && (
                                        <p className="text-[12px] text-[rgba(250,247,240,0.4)] mt-1" style={{ fontFamily: 'Lora, serif' }}>
                                            {selectedCase.description}
                                        </p>
                                    )}
                                </div>

                                {/* Assign Clients */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                            ASSIGNED CLIENTS ({caseClients.length})
                                        </p>
                                        <Button variant="outline" size="sm" icon={<Users size={12} />} onClick={() => setShowAssignClient(!showAssignClient)}>
                                            MANAGE
                                        </Button>
                                    </div>

                                    <AnimatePresence>
                                        {showAssignClient && clients.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -6 }}
                                                className="mb-3 p-3 bg-[#0a0a0a] border border-[rgba(201,168,76,0.15)] space-y-1"
                                            >
                                                {clients.map(client => {
                                                    const isAssigned = caseClients.some(c => c.id === client.id)
                                                    return (
                                                        <button
                                                            key={client.id}
                                                            onClick={() => handleToggleClientAssignment(client.id)}
                                                            className={cn(
                                                                'w-full flex items-center gap-3 px-3 py-2 text-left transition-all border',
                                                                isAssigned
                                                                    ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.3)] text-[#F5EDD6]'
                                                                    : 'bg-transparent border-transparent text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0]'
                                                            )}
                                                        >
                                                            <span className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${isAssigned ? 'border-[#C9A84C] bg-[#C9A84C]' : 'border-[rgba(250,247,240,0.3)]'}`}>
                                                                {isAssigned && <Check size={9} className="text-[#0E0E0E]" />}
                                                            </span>
                                                            <span className="text-[12px]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                                {client.full_name || 'Unnamed Client'}
                                                            </span>
                                                        </button>
                                                    )
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {caseClients.length === 0 ? (
                                        <p className="text-[12px] text-[rgba(250,247,240,0.3)] p-3 border border-[rgba(201,168,76,0.08)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                            No clients assigned.
                                        </p>
                                    ) : (
                                        <div className="space-y-1">
                                            {caseClients.map(c => (
                                                <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-[#161616] border border-[rgba(201,168,76,0.1)]">
                                                    <span className="text-[12px] text-[#FAF7F0]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                        {c.full_name || 'Unnamed Client'}
                                                    </span>
                                                    <button
                                                        onClick={() => handleToggleClientAssignment(c.id)}
                                                        className="p-1 text-[rgba(250,247,240,0.25)] hover:text-[#f87171] transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Link Documents */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                            LINKED DOCUMENTS ({caseDocIds.length})
                                        </p>
                                        <Button variant="outline" size="sm" icon={<Link2 size={12} />} onClick={() => setShowLinkDocs(!showLinkDocs)}>
                                            MANAGE
                                        </Button>
                                    </div>

                                    <AnimatePresence>
                                        {showLinkDocs && myDocs.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -6 }}
                                                className="mb-3 p-3 bg-[#0a0a0a] border border-[rgba(201,168,76,0.15)] space-y-1 max-h-48 overflow-y-auto"
                                            >
                                                {myDocs.map(doc => {
                                                    const isLinked = caseDocIds.includes(doc.id)
                                                    return (
                                                        <button
                                                            key={doc.id}
                                                            onClick={() => handleToggleDocLink(doc.id)}
                                                            className={cn(
                                                                'w-full flex items-center gap-3 px-3 py-2 text-left transition-all border',
                                                                isLinked
                                                                    ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.3)] text-[#F5EDD6]'
                                                                    : 'bg-transparent border-transparent text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0]'
                                                            )}
                                                        >
                                                            <span className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${isLinked ? 'border-[#C9A84C] bg-[#C9A84C]' : 'border-[rgba(250,247,240,0.3)]'}`}>
                                                                {isLinked && <Check size={9} className="text-[#0E0E0E]" />}
                                                            </span>
                                                            <span className="text-[12px] truncate" style={{ fontFamily: 'DM Mono, monospace' }}>
                                                                {doc.title}
                                                            </span>
                                                        </button>
                                                    )
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {caseDocIds.length === 0 ? (
                                        <p className="text-[12px] text-[rgba(250,247,240,0.3)] p-3 border border-[rgba(201,168,76,0.08)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                            No documents linked. Use MANAGE to link existing drafted documents.
                                        </p>
                                    ) : (
                                        <div className="space-y-1">
                                            {myDocs.filter(d => caseDocIds.includes(d.id)).map(doc => (
                                                <div key={doc.id} className="flex items-center justify-between px-3 py-2 bg-[#161616] border border-[rgba(201,168,76,0.1)]">
                                                    <span className="text-[12px] text-[#FAF7F0] truncate" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                                                        {doc.title}
                                                    </span>
                                                    <button
                                                        onClick={() => handleToggleDocLink(doc.id)}
                                                        className="p-1 text-[rgba(250,247,240,0.25)] hover:text-[#f87171] transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
