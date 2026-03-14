import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Edit3,
  RefreshCw,
  FileText,
  FileDown,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

interface DocumentPreviewProps {
  content: string
  isGenerating: boolean
  title?: string
  onExportPdf?: () => void
  onExportDocx?: () => void
  onRegenerateSection?: (section: string) => void
  isRegenerating?: string | null
  className?: string
  language?: string
}

function useTypewriterReveal(content: string, isGenerating: boolean) {
  const [displayedContent, setDisplayedContent] = useState('')
  const [lines, setLines] = useState<string[]>([])

  useEffect(() => {
    if (isGenerating) {
      setDisplayedContent(content)
    } else {
      setDisplayedContent(content)
      setLines(content.split('\n').filter(l => l.trim()))
    }
  }, [content, isGenerating])

  return { displayedContent, lines }
}

function renderDocumentLine(line: string, index: number, language?: string) {
  // Script-agnostic heading: All caps + some punctuation, or specific patterns in other scripts
  // For Tamil/Hindi, we rely on the LLM's structure or specific markers if added.
  // We'll keep the Latin caps check but make it less restrictive if it's a short line.
  const isHeading = line.match(/^[A-Z][A-Z\s\-:]{5,}$/) || (line.length < 50 && line === line.toUpperCase() && line.trim().length > 3)
  const isSubHeading = line.match(/^[A-Z][A-Za-z\s]+:$/) || line.trim().endsWith(':')
  const isClauseNum = line.match(/^(\d+\.?\d*|[a-zA-Z]\.)\s/)
  const isSignature = line.toLowerCase().includes('yours faithfully') ||
    line.toLowerCase().includes('yours sincerely') ||
    line.toLowerCase().includes('advocate for') ||
    line.toLowerCase().includes('signature') ||
    line.includes('இப்படிக்கு') || // Tamil: "Yours faithfully"
    line.includes('தங்கள் உண்மையுள்ள') // Tamil: "Yours truly"
  const isDisclaimer = line.toLowerCase().includes('disclaimer:') || line.includes('பொறுப்புத் துறப்பு:')

  if (isHeading) {
    return (
      <p
        key={index}
        className="text-[13px] font-bold tracking-[0.08em] mt-6 mb-2 text-[#1a1208] uppercase"
        style={{ fontFamily: language === 'ta' ? 'Noto Serif Tamil, serif' : 'DM Mono, monospace' }}
      >
        {line}
      </p>
    )
  }

  if (isSubHeading) {
    return (
      <p
        key={index}
        className="text-[15px] font-semibold mt-4 mb-1 text-[#1a1208]"
        style={{ fontFamily: language === 'ta' ? 'Noto Serif Tamil, serif' : 'Cormorant Garamond, serif' }}
      >
        {line}
      </p>
    )
  }

  if (isClauseNum) {
    return (
      <p
        key={index}
        className="text-[13px] my-2 text-[#1a1208] pl-4"
        style={{ fontFamily: language === 'ta' ? 'Noto Serif Tamil, serif' : 'Cormorant Garamond, serif', lineHeight: '1.8' }}
      >
        {line}
      </p>
    )
  }

  if (isSignature) {
    return (
      <p
        key={index}
        className="text-[13px] mt-6 mb-1 text-[#1a1208]"
        style={{ fontFamily: language === 'ta' ? 'Noto Serif Tamil, serif' : 'Cormorant Garamond, serif', fontStyle: 'italic' }}
      >
        {line}
      </p>
    )
  }

  if (isDisclaimer) {
    return (
      <p
        key={index}
        className="text-[11px] mt-8 pt-3 border-t border-[rgba(26,18,8,0.2)] text-[rgba(26,18,8,0.55)] italic"
        style={{ fontFamily: language === 'ta' ? 'Noto Serif Tamil, serif' : 'Lora, serif' }}
      >
        {line}
      </p>
    )
  }

  if (!line.trim()) {
    return <div key={index} className="h-3" />
  }

  return (
    <p
      key={index}
      className="text-[13px] my-1.5 text-[#1a1208]"
      style={{ fontFamily: language === 'ta' ? 'Noto Serif Tamil, serif' : 'Cormorant Garamond, serif', lineHeight: '1.85' }}
    >
      {line}
    </p>
  )
}

const DOCUMENT_SECTIONS = [
  'Introduction / Opening',
  'Facts of the Matter',
  'Legal Basis',
  'Relief / Demands',
  'Compliance Deadline',
  'Consequences',
  'Valediction',
]

export function DocumentPreview({
  content,
  isGenerating,
  title,
  onExportPdf,
  onExportDocx,
  onRegenerateSection,
  isRegenerating,
  className,
  language,
}: DocumentPreviewProps) {
  const [copied, setCopied] = useState(false)
  const [showSectionMenu, setShowSectionMenu] = useState(false)
  const [editableLines, setEditableLines] = useState<Record<number, string>>({})
  const [editingLine, setEditingLine] = useState<number | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const lines = content.split('\n')
  const revealedLines = isGenerating ? lines : lines

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLineEdit = (index: number, value: string) => {
    setEditableLines(prev => ({ ...prev, [index]: value }))
  }

  return (
    <div className={cn('flex flex-col h-full border-l border-[rgba(201,168,76,0.2)]', className)}>
      {/* Preview header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(201,168,76,0.15)] bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[#C9A84C]" />
          <span
            className="text-[11px] text-[rgba(250,247,240,0.6)] tracking-widest uppercase"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            {isGenerating ? 'GENERATING...' : title ? title.toUpperCase() : 'DOCUMENT PREVIEW'}
          </span>
          {isGenerating && (
            <span className="w-1.5 h-1.5 bg-[#C9A84C] animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {content && !isGenerating && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0] border border-transparent hover:border-[rgba(201,168,76,0.3)] transition-all"
              style={{ fontFamily: 'DM Mono, monospace' }}
            >
              {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
          )}
        </div>
      </div>

      {/* Document content */}
      <div
        ref={previewRef}
        className="flex-1 overflow-y-auto document-preview p-8"
        style={{ minHeight: 0 }}
      >
        {!content && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
            <FileText size={40} className="text-[#8b7355] mb-4" />
            <p className="text-[13px] text-[#8b7355] text-center" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Fill in the form and generate
              <br />your document to see it here.
            </p>
          </div>
        )}

        {(content || isGenerating) && (
          <div>
            {revealedLines.map((line, index) => {
              const displayLine = editableLines[index] ?? line
              if (editingLine === index) {
                return (
                  <textarea
                    key={index}
                    value={displayLine}
                    onChange={(e) => handleLineEdit(index, e.target.value)}
                    onBlur={() => setEditingLine(null)}
                    autoFocus
                    className="w-full text-[13px] bg-transparent border border-[#C9A84C] text-[#1a1208] p-1 resize-none outline-none"
                    style={{
                      fontFamily: language === 'ta' ? 'Noto Serif Tamil, serif' : 'Cormorant Garamond, serif',
                      lineHeight: '1.85',
                      minHeight: '2em',
                    }}
                    rows={Math.max(2, displayLine.split('\n').length)}
                  />
                )
              }

              return (
                <motion.div
                  key={index}
                  initial={isGenerating ? { opacity: 0, y: 3 } : { opacity: 1 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: isGenerating ? index * 0.02 : 0, duration: 0.25 }}
                  onDoubleClick={() => setEditingLine(index)}
                  className="cursor-text group relative"
                >
                  {renderDocumentLine(displayLine, index, language)}
                  <span className="absolute right-0 top-1 opacity-0 group-hover:opacity-50 transition-opacity">
                    <Edit3 size={10} className="text-[#8b7355]" />
                  </span>
                </motion.div>
              )
            })}
            {isGenerating && (
              <span className="inline-block w-[2px] h-[14px] bg-[#C9A84C] animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <AnimatePresence>
        {content && !isGenerating && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[rgba(201,168,76,0.2)] bg-[#0a0a0a] p-3 flex items-center gap-2 flex-wrap"
          >
            <Button
              variant="ghost"
              size="sm"
              icon={<Edit3 size={12} />}
              onClick={() => setEditingLine(0)}
              className="text-[10px]"
            >
              EDIT INLINE
            </Button>

            {onRegenerateSection && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />}
                  onClick={() => setShowSectionMenu(!showSectionMenu)}
                  className="text-[10px]"
                >
                  REGENERATE SECTION <ChevronDown size={10} />
                </Button>
                <AnimatePresence>
                  {showSectionMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute bottom-full mb-1 left-0 bg-[#161616] border border-[rgba(201,168,76,0.3)] min-w-[200px] z-20"
                    >
                      {DOCUMENT_SECTIONS.map((section) => (
                        <button
                          key={section}
                          onClick={() => {
                            onRegenerateSection(section)
                            setShowSectionMenu(false)
                          }}
                          disabled={isRegenerating === section}
                          className="w-full text-left px-3 py-2 text-[11px] text-[rgba(250,247,240,0.7)] hover:bg-[#1B3A2D] hover:text-[#F5EDD6] transition-colors"
                          style={{ fontFamily: 'DM Mono, monospace' }}
                        >
                          {isRegenerating === section ? '↻ ' : ''}
                          {section}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex-1" />

            {onExportPdf && (
              <Button
                variant="outline"
                size="sm"
                icon={<FileText size={12} />}
                onClick={onExportPdf}
                className="text-[10px]"
              >
                EXPORT PDF
              </Button>
            )}
            {onExportDocx && (
              <Button
                variant="outline"
                size="sm"
                icon={<FileDown size={12} />}
                onClick={onExportDocx}
                className="text-[10px]"
              >
                EXPORT DOCX
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
