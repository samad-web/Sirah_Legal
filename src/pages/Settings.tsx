import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Save, Upload, Check, X, ImageIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormFields'
import { INDIAN_STATES } from '@/lib/utils'

const STORAGE_BUCKET = 'advocate-files'

async function uploadFile(userId: string, file: File, slot: 'letterhead' | 'signature'): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${userId}/${slot}.${ext}`

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  // Bust cache so the browser picks up the new file
  return `${data.publicUrl}?t=${Date.now()}`
}

export default function SettingsPage() {
  const { user, profile, updateProfile } = useAuth()

  const [form, setForm] = useState({
    full_name: '',
    bar_council_no: '',
    state_bar: '',
    firm_name: '',
    office_address: '',
    default_language: 'en',
    default_state: '',
    default_dispute: 'arbitration',
    letterhead_url: '' as string | null,
    signature_url: '' as string | null,
    email_notifications: true,
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const letterheadRef = useRef<HTMLInputElement>(null)
  const signatureRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? '',
        bar_council_no: profile.bar_council_no ?? '',
        state_bar: profile.state_bar ?? '',
        firm_name: profile.firm_name ?? '',
        office_address: profile.office_address ?? '',
        default_language: profile.default_language ?? 'en',
        default_state: profile.default_state ?? '',
        default_dispute: profile.default_dispute ?? 'arbitration',
        letterhead_url: profile.letterhead_url ?? null,
        signature_url: profile.signature_url ?? null,
        email_notifications: profile.email_notifications ?? true,
      })
    }
  }, [profile])

  const setField = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleFileUpload = async (file: File, slot: 'letterhead' | 'signature') => {
    if (!user) return
    setUploadError('')

    const maxBytes = 5 * 1024 * 1024 // 5 MB
    if (file.size > maxBytes) {
      setUploadError('File must be under 5 MB.')
      return
    }
    const allowed = slot === 'letterhead'
      ? ['image/png', 'image/jpeg', 'application/pdf']
      : ['image/png', 'image/jpeg']
    if (!allowed.includes(file.type)) {
      setUploadError(slot === 'letterhead' ? 'Letterhead must be PNG, JPG or PDF.' : 'Signature must be PNG or JPG.')
      return
    }

    if (slot === 'letterhead') setUploadingLetterhead(true)
    else setUploadingSignature(true)

    try {
      const url = await uploadFile(user.id, file, slot)
      setField(`${slot}_url`, url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      if (slot === 'letterhead') setUploadingLetterhead(false)
      else setUploadingSignature(false)
    }
  }

  const clearFile = async (slot: 'letterhead' | 'signature') => {
    setField(`${slot}_url`, null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await updateProfile({
        full_name: form.full_name,
        bar_council_no: form.bar_council_no,
        state_bar: form.state_bar,
        firm_name: form.firm_name,
        office_address: form.office_address,
        default_language: form.default_language,
        default_state: form.default_state,
        default_dispute: form.default_dispute,
        letterhead_url: form.letterhead_url,
        signature_url: form.signature_url,
        email_notifications: form.email_notifications,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-[1200px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[32px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
          Settings
        </h1>
        <p className="text-[12px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
          Advocate profile and preferences
        </p>
      </div>

      <div className="gold-line-solid mb-8" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Left — Profile */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-5">
            <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>
              ADVOCATE PROFILE
            </p>
          </div>

          <div className="space-y-4">
            <FormField label="Full Name" required>
              <Input value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Adv. Full Name" />
            </FormField>

            <FormField label="Bar Council Enrollment No." required>
              <Input value={form.bar_council_no} onChange={e => setField('bar_council_no', e.target.value)} placeholder="e.g. TN/1234/2020" />
            </FormField>

            <FormField label="State Bar Council">
              <Select
                value={form.state_bar}
                onChange={e => setField('state_bar', e.target.value)}
                placeholder="Select state bar..."
                options={INDIAN_STATES.map(s => ({ value: s, label: `Bar Council of ${s}` }))}
              />
            </FormField>

            <FormField label="Firm / Chamber Name">
              <Input value={form.firm_name} onChange={e => setField('firm_name', e.target.value)} placeholder="e.g. Sharma & Associates" />
            </FormField>

            <FormField label="Office Address">
              <Textarea
                value={form.office_address}
                onChange={e => setField('office_address', e.target.value)}
                rows={3}
                placeholder="Full office address (used in document headers)"
              />
            </FormField>

            {/* Letterhead upload */}
            <FormField label="Letterhead" hint="PNG, JPG or PDF · Max 5 MB · Used in exported documents">
              <input
                ref={letterheadRef}
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'letterhead') }}
              />
              {form.letterhead_url ? (
                <div className="flex items-center gap-3 p-3 bg-[#161616] border border-[rgba(201,168,76,0.2)]">
                  <ImageIcon size={14} className="text-[#C9A84C] shrink-0" />
                  <span className="text-[11px] text-[rgba(250,247,240,0.6)] flex-1 truncate" style={{ fontFamily: 'DM Mono, monospace' }}>
                    Letterhead uploaded
                  </span>
                  <button
                    onClick={() => clearFile('letterhead')}
                    className="text-[rgba(250,247,240,0.3)] hover:text-[#f87171] transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => letterheadRef.current?.click()}
                  disabled={uploadingLetterhead}
                  className="upload-zone p-4 flex items-center justify-center gap-3 w-full cursor-pointer disabled:opacity-50"
                >
                  {uploadingLetterhead
                    ? <div className="w-4 h-4 border border-[#C9A84C] border-t-transparent animate-spin" />
                    : <Upload size={14} className="text-[rgba(201,168,76,0.5)]" />
                  }
                  <span className="text-[11px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {uploadingLetterhead ? 'UPLOADING…' : 'UPLOAD LETTERHEAD'}
                  </span>
                </button>
              )}
            </FormField>

            {/* Signature upload */}
            <FormField label="Signature" hint="PNG or JPG · Max 5 MB · Transparent background recommended">
              <input
                ref={signatureRef}
                type="file"
                accept=".png,.jpg,.jpeg"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'signature') }}
              />
              {form.signature_url ? (
                <div className="flex items-center gap-3 p-3 bg-[#161616] border border-[rgba(201,168,76,0.2)]">
                  <img
                    src={form.signature_url}
                    alt="Signature preview"
                    className="h-8 object-contain"
                    style={{ background: 'transparent' }}
                  />
                  <span className="text-[11px] text-[rgba(250,247,240,0.6)] flex-1 truncate" style={{ fontFamily: 'DM Mono, monospace' }}>
                    Signature uploaded
                  </span>
                  <button
                    onClick={() => clearFile('signature')}
                    className="text-[rgba(250,247,240,0.3)] hover:text-[#f87171] transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => signatureRef.current?.click()}
                  disabled={uploadingSignature}
                  className="upload-zone p-4 flex items-center justify-center gap-3 w-full cursor-pointer disabled:opacity-50"
                >
                  {uploadingSignature
                    ? <div className="w-4 h-4 border border-[#C9A84C] border-t-transparent animate-spin" />
                    : <Upload size={14} className="text-[rgba(201,168,76,0.5)]" />
                  }
                  <span className="text-[11px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {uploadingSignature ? 'UPLOADING…' : 'UPLOAD SIGNATURE'}
                  </span>
                </button>
              )}
            </FormField>

            {uploadError && (
              <p className="text-[11px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>{uploadError}</p>
            )}
          </div>
        </motion.div>

        {/* Right — Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="mb-5">
            <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>
              PREFERENCES
            </p>
          </div>

          <div className="space-y-4">
            <FormField label="Default Output Language">
              <div className="flex gap-0">
                {[{ v: 'en', l: 'English' }, { v: 'ta', l: 'Tamil' }, { v: 'hi', l: 'Hindi' }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setField('default_language', v)}
                    className={`flex-1 py-2.5 text-[12px] border transition-all ${
                      form.default_language === v
                        ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.5)] text-[#F5EDD6]'
                        : 'bg-[#161616] border-[rgba(201,168,76,0.2)] text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0]'
                    }`}
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="Default Governing State">
              <Select
                value={form.default_state}
                onChange={e => setField('default_state', e.target.value)}
                placeholder="Select state..."
                options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
              />
            </FormField>

            <FormField label="Default Dispute Resolution">
              <div className="space-y-2">
                {[
                  { v: 'arbitration', l: 'Arbitration' },
                  { v: 'litigation', l: 'Litigation' },
                  { v: 'mediation', l: 'Mediation First' },
                ].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setField('default_dispute', v)}
                    className={`w-full text-left px-4 py-2.5 text-[12px] border transition-all ${
                      form.default_dispute === v
                        ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.4)] text-[#F5EDD6]'
                        : 'bg-[#161616] border-[rgba(201,168,76,0.15)] text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0]'
                    }`}
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </FormField>

            <div className="gold-line-solid my-4" />

            {/* Plan details */}
            <div className="p-4 bg-[#161616] border border-[rgba(201,168,76,0.15)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] tracking-widest text-[rgba(250,247,240,0.5)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                  CURRENT PLAN
                </p>
                <span
                  className={`text-[10px] border px-2 py-0.5 ${
                    profile?.plan === 'free'
                      ? 'text-[rgba(250,247,240,0.5)] border-[rgba(250,247,240,0.15)]'
                      : 'text-[#C9A84C] border-[rgba(201,168,76,0.4)]'
                  }`}
                  style={{ fontFamily: 'DM Mono, monospace' }}
                >
                  {(profile?.plan || 'FREE').toUpperCase()}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    Documents this month
                  </span>
                  <span className="text-[11px] text-[rgba(250,247,240,0.6)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {profile?.documents_this_month || 0} / {profile?.plan === 'free' ? 5 : profile?.plan === 'solo' ? 50 : '∞'}
                  </span>
                </div>
                <div className="h-1 bg-[rgba(250,247,240,0.05)]">
                  <div
                    className="h-full bg-[#C9A84C] transition-all"
                    style={{
                      width: `${Math.min(100, ((profile?.documents_this_month || 0) / (profile?.plan === 'free' ? 5 : 50)) * 100)}%`
                    }}
                  />
                </div>
              </div>

              {profile?.plan === 'free' && (
                <Button variant="primary" size="sm" className="w-full justify-center">
                  UPGRADE TO SOLO — ₹999/MO
                </Button>
              )}
            </div>

            {/* Email notifications */}
            <div className="flex items-center justify-between p-4 bg-[#161616] border border-[rgba(201,168,76,0.15)]">
              <div>
                <p className="text-[12px] text-[rgba(250,247,240,0.7)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                  Email Notifications
                </p>
                <p className="text-[10px] text-[rgba(250,247,240,0.35)] mt-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                  Document ready, usage alerts
                </p>
              </div>
              <button
                onClick={() => setField('email_notifications', !form.email_notifications)}
                className={`w-10 h-5 relative border transition-colors ${
                  form.email_notifications
                    ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.4)]'
                    : 'bg-[#161616] border-[rgba(250,247,240,0.1)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 transition-all ${
                    form.email_notifications ? 'left-5 bg-[#C9A84C]' : 'left-0.5 bg-[rgba(250,247,240,0.2)]'
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Save button */}
      <div className="mt-8 flex items-center gap-4">
        <Button
          variant="primary"
          size="lg"
          loading={saving}
          onClick={handleSave}
          icon={saved ? <Check size={16} className="text-green-400" /> : <Save size={15} />}
          className="text-[15px]"
          style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
        >
          {saved ? 'Saved' : 'Save Changes'}
        </Button>
        {saved && (
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-[12px] text-green-400"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            Profile updated successfully
          </motion.p>
        )}
        {saveError && (
          <p className="text-[12px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>
            {saveError}
          </p>
        )}
      </div>
    </div>
  )
}
