import { useState, useCallback, useRef } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface ClientUpload {
  id: string
  case_id: string
  client_id: string
  request_id: string | null
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  uploaded_at: string
}

interface FileUploadZoneProps {
  caseId: string
  requestId?: string
  onUploadComplete: (upload: ClientUpload) => void
}

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp']
const MAX_SIZE_MB = 10

export function FileUploadZone({ caseId, requestId, onUploadComplete }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_SIZE_MB} MB.`
    }
    return null
  }

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setIsUploading(true)
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('case_id', caseId)
    if (requestId) formData.append('request_id', requestId)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const upload = await new Promise<ClientUpload>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status === 201) {
            resolve(JSON.parse(xhr.responseText).upload)
          } else {
            try {
              reject(new Error(JSON.parse(xhr.responseText).error ?? 'Upload failed'))
            } catch {
              reject(new Error('Upload failed'))
            }
          }
        })
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
        xhr.open('POST', '/api/uploads')
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.send(formData)
      })

      onUploadComplete(upload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [caseId, requestId, onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        role="button"
        aria-label="Upload file"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !isUploading && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
          isDragging ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-[#2a2a2a] hover:border-[#C9A84C]/50',
          isUploading && 'pointer-events-none opacity-70',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />

        {isUploading ? (
          <div>
            <p className="text-[#FAF7F0]/60 text-sm mb-3">Uploading...</p>
            <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A84C] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[#C9A84C] text-xs mt-2">{progress}%</p>
          </div>
        ) : (
          <>
            <Upload size={20} className="mx-auto mb-2 text-[#FAF7F0]/40" />
            <p className="text-[#FAF7F0]/60 text-sm">
              Drag & drop a file here, or <span className="text-[#C9A84C] underline">browse</span>
            </p>
            <p className="text-[#FAF7F0]/30 text-xs mt-1">
              PDF, DOC, DOCX, JPG, PNG, WEBP — Max {MAX_SIZE_MB} MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-xs mt-2 flex items-center gap-1">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}
    </div>
  )
}
