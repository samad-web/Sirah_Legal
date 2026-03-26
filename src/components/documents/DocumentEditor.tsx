import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Save, Sparkles, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { updateDocument } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'

interface DocumentEditorProps {
  documentId: string
  initialContent: string
  onSaved?: () => void
}

const AUTOSAVE_DEBOUNCE_MS = 2000
const MAX_CHARS = 500_000

export function DocumentEditor({ documentId, initialContent, onSaved }: DocumentEditorProps) {
  const toast = useToast()
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const saveDocument = useCallback(async (content: string) => {
    setIsSaving(true)
    setSaveError(null)

    try {
      await updateDocument(documentId, { content } as Parameters<typeof updateDocument>[1])
      setIsDirty(false)
      setLastSaved(new Date())
      onSaved?.()
      toast.success('Document saved')
    } catch {
      setSaveError('Save failed. Changes are not persisted yet.')
      toast.error('Save failed — changes not persisted')
    } finally {
      setIsSaving(false)
    }
  }, [documentId, onSaved, toast])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start editing your document...' }),
      CharacterCount.configure({ limit: MAX_CHARS }),
    ],
    content: initialContent,
    onUpdate: ({ editor: ed }) => {
      setIsDirty(true)
      setSaveError(null)

      // Debounced autosave
      clearTimeout(autosaveTimer.current)
      autosaveTimer.current = setTimeout(() => {
        saveDocument(ed.getHTML())
      }, AUTOSAVE_DEBOUNCE_MS)
    },
  })

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => clearTimeout(autosaveTimer.current)
  }, [])

  const handleManualSave = useCallback(() => {
    if (!editor || !isDirty) return
    clearTimeout(autosaveTimer.current)
    saveDocument(editor.getHTML())
  }, [editor, isDirty, saveDocument])

  const handleRegenerateSection = useCallback(async () => {
    if (!editor) return

    const { from, to } = editor.state.selection
    if (from === to) {
      alert('Select a section of text first, then click Regenerate Section.')
      return
    }

    const selectedText = editor.state.doc.textBetween(from, to, '\n')
    const instruction = window.prompt(
      'How should this section be rewritten?\n\nExample: "Make this more formal" or "Add a penalty clause"',
    )

    if (!instruction?.trim()) return

    setIsRegenerating(true)
    let result = ''

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/generate/section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          document_id: documentId,
          selected_text: selectedText,
          instruction: instruction.trim(),
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Regeneration failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) result += parsed.text
              if (parsed.error) throw new Error(parsed.error)
            } catch (e) {
              if (e instanceof SyntaxError) continue
              throw e
            }
          }
        }
      }

      // Replace selected text with regenerated text
      if (result) {
        editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, result).run()
        setIsDirty(true)
      }
    } catch {
      alert('Regeneration failed. Please try again.')
    } finally {
      setIsRegenerating(false)
    }
  }, [editor, documentId])

  const charCount = editor?.storage.characterCount.characters() ?? 0
  const isNearLimit = charCount > MAX_CHARS * 0.9

  return (
    <div className="flex flex-col h-full border border-border/40 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-surface">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
            {isSaving ? 'Saving...' :
             isDirty ? '● Unsaved changes' :
             lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Ready'}
          </span>
          {saveError && (
            <span role="alert" className="text-xs text-red-400">{saveError}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerateSection}
            disabled={isRegenerating}
            title="Select text, then click to regenerate that section with AI"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] rounded-md hover:bg-[#C9A84C]/20 disabled:opacity-40 transition-colors"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {isRegenerating ? 'Regenerating...' : 'Regenerate section'}
          </button>

          <button
            onClick={handleManualSave}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#FAF7F0]/5 border border-[#FAF7F0]/10 text-[#FAF7F0]/60 rounded-md hover:text-[#FAF7F0] disabled:opacity-30 transition-colors"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            <Save size={12} />
            Save
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <EditorContent
          editor={editor}
          className={cn(
            'prose prose-invert max-w-none min-h-[300px]',
            'prose-p:text-[#FAF7F0]/90 prose-p:leading-relaxed',
            'prose-headings:text-[#FAF7F0] prose-headings:font-semibold',
            'prose-strong:text-[#FAF7F0]',
            'prose-li:text-[#FAF7F0]/90',
            '[&_.tiptap]:outline-none [&_.tiptap]:min-h-[300px]',
          )}
        />
      </div>

      {/* Footer: character count */}
      <div className="px-4 py-2 border-t border-border/40 flex justify-end">
        <span
          className={cn('text-xs', isNearLimit ? 'text-red-400' : 'text-muted')}
          style={{ fontFamily: 'DM Mono, monospace' }}
        >
          {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
        </span>
      </div>
    </div>
  )
}
