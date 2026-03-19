import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Library, Plus, Copy, Check, Pencil, Trash2, Search, X } from 'lucide-react'
import { getClauses, createClause, updateClause, deleteClause } from '@/lib/api-additions'
import type { ClauseLibraryItem } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea } from '@/components/ui/FormFields'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

const CATEGORIES = ['Contract', 'Notice', 'Property', 'Employment', 'Arbitration', 'Family', 'Criminal', 'General']

export default function ClausesPage() {
  const [clauses, setClauses] = useState<ClauseLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ClauseLibraryItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formTags, setFormTags] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchClauses = useCallback(async () => {
    try {
      const data = await getClauses({ search: search || undefined, category: filterCategory || undefined })
      setClauses(data)
    } catch (err) {
      console.error('[LexDraft] Clauses: failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [search, filterCategory])

  useEffect(() => {
    const t = setTimeout(() => fetchClauses(), 300)
    return () => clearTimeout(t)
  }, [fetchClauses])

  function openNew() {
    setEditing(null)
    setFormTitle('')
    setFormContent('')
    setFormCategory('')
    setFormTags('')
    setShowForm(true)
  }

  function openEdit(clause: ClauseLibraryItem) {
    setEditing(clause)
    setFormTitle(clause.title)
    setFormContent(clause.content)
    setFormCategory(clause.category ?? '')
    setFormTags((clause.tags ?? []).join(', '))
    setShowForm(true)
  }

  async function handleSave() {
    if (!formTitle.trim() || !formContent.trim()) return
    setSaving(true)
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean)
    try {
      if (editing) {
        const updated = await updateClause(editing.id, {
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory || null,
          tags: tags.length > 0 ? tags : null,
        })
        setClauses(prev => prev.map(c => c.id === editing.id ? updated : c))
      } else {
        const created = await createClause({
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory || null,
          tags: tags.length > 0 ? tags : null,
        })
        setClauses(prev => [created, ...prev])
      }
      setShowForm(false)
    } catch (err) {
      console.error('[LexDraft] Clauses: save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(id: string) {
    setConfirmDeleteId(id)
  }

  async function doDeleteClause() {
    if (!confirmDeleteId) return
    try {
      await deleteClause(confirmDeleteId)
      setClauses(prev => prev.filter(c => c.id !== confirmDeleteId))
    } catch (err) {
      console.error('[LexDraft] Clauses: delete failed:', err)
    } finally {
      setConfirmDeleteId(null)
    }
  }

  function handleCopy(clause: ClauseLibraryItem) {
    navigator.clipboard.writeText(clause.content).then(() => {
      setCopiedId(clause.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-[1200px]">
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete Clause"
        message="This clause will be permanently removed from your library."
        onConfirm={doDeleteClause}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <div className="mb-8">
        <h1 className="text-[32px] text-foreground mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
          Clause Library
        </h1>
        <p className="text-[12px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
          Save and reuse legal text snippets
        </p>
      </div>

      <div className="gold-line-solid mb-6" />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clauses..."
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap gap-0">
          <button
            onClick={() => setFilterCategory('')}
            className={cn('px-3 py-2 text-[10px] border transition-all', filterCategory === ''
              ? 'bg-forest border-gold/40 text-parchment'
              : 'bg-surface-2 border-border text-muted hover:text-foreground')}
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            ALL
          </button>
          {CATEGORIES.slice(0, 5).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              className={cn('px-3 py-2 text-[10px] border transition-all', filterCategory === cat
                ? 'bg-forest border-gold/40 text-parchment'
                : 'bg-surface-2 border-border text-muted hover:text-foreground')}
              style={{ fontFamily: 'DM Mono, monospace' }}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={openNew}>
          NEW CLAUSE
        </Button>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              className="bg-surface border border-gold/25 w-full max-w-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <p className="text-[15px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  {editing ? 'Edit Clause' : 'New Clause'}
                </p>
                <button onClick={() => setShowForm(false)} className="text-muted hover:text-foreground">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <FormField label="Title" required>
                  <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Indemnification Clause" />
                </FormField>

                <FormField label="Content" required>
                  <Textarea
                    value={formContent}
                    onChange={e => setFormContent(e.target.value)}
                    rows={8}
                    placeholder="Paste or type the clause text here..."
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Category">
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      className="w-full bg-surface-2 border border-border px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-gold/50"
                      style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                      <option value="">Select category...</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FormField>

                  <FormField label="Tags" hint="Comma-separated">
                    <Input
                      value={formTags}
                      onChange={e => setFormTags(e.target.value)}
                      placeholder="e.g. liability, indemnity"
                    />
                  </FormField>
                </div>
              </div>

              <div className="flex gap-2 p-5 border-t border-border/50">
                <Button variant="primary" size="sm" loading={saving} onClick={handleSave} disabled={!formTitle.trim() || !formContent.trim()}>
                  {editing ? 'UPDATE' : 'SAVE'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>CANCEL</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clauses list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border border-gold border-t-transparent animate-spin" />
        </div>
      ) : clauses.length === 0 ? (
        <div className="border border-border/40 p-16 flex flex-col items-center text-center">
          <Library size={32} className="text-muted/20 mb-4" />
          <p className="text-[15px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            {search || filterCategory ? 'No clauses match your search.' : 'No clauses yet. Add your first clause.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clauses.map((clause, i) => (
            <motion.div
              key={clause.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-surface border border-border/40 hover:border-gold/25 transition-all p-4 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-[15px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                      {clause.title}
                    </h3>
                    {clause.category && (
                      <span className="text-[9px] border border-gold/30 px-1.5 py-0.5 text-gold/70" style={{ fontFamily: 'DM Mono, monospace' }}>
                        {clause.category.toUpperCase()}
                      </span>
                    )}
                    {(clause.tags ?? []).map(tag => (
                      <span key={tag} className="text-[9px] border border-border/40 px-1.5 py-0.5 text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-[12px] text-muted line-clamp-3" style={{ fontFamily: 'Lora, serif' }}>
                    {clause.content}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy(clause)}
                    className="p-2 text-muted hover:text-gold transition-colors border border-transparent hover:border-gold/25"
                    title="Copy to clipboard"
                  >
                    {copiedId === clause.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                  </button>
                  <button
                    onClick={() => openEdit(clause)}
                    className="p-2 text-muted hover:text-foreground transition-colors border border-transparent hover:border-border"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(clause.id)}
                    className="p-2 text-muted hover:text-red-400 transition-colors border border-transparent hover:border-red-400/20"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
