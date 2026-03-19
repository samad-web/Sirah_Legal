import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Scale, Check } from 'lucide-react'
import { getIntakeFormPublic, submitIntakeForm } from '@/lib/api-additions'
import type { IntakeForm, IntakeFormField } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea } from '@/components/ui/FormFields'

export default function IntakePublicPage() {
  const { formId } = useParams<{ formId: string }>()
  const [form, setForm] = useState<Pick<IntakeForm, 'id' | 'title' | 'fields'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!formId) return
    getIntakeFormPublic(formId)
      .then(data => {
        setForm(data)
        // Init empty values
        const init: Record<string, string> = {}
        data.fields.forEach((f: IntakeFormField) => { init[f.id] = '' })
        setValues(init)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [formId])

  const handleSubmit = async () => {
    if (!form || !formId) return
    // Validate required fields
    const missing = form.fields.filter(f => f.required && !values[f.id]?.trim())
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map(f => f.label).join(', ')}`)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await submitIntakeForm(formId, {
        respondent_email: email || undefined,
        data: values,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border border-gold border-t-transparent animate-spin" />
      </div>
    )
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center">
          <Scale size={32} className="text-gold mx-auto mb-4" />
          <h1 className="text-[24px] text-foreground mb-2" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            Form Not Found
          </h1>
          <p className="text-[12px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
            This intake form does not exist or has been removed.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-14 h-14 bg-forest border border-gold/40 flex items-center justify-center mx-auto mb-6">
            <Check size={24} className="text-gold" />
          </div>
          <h1 className="text-[28px] text-foreground mb-2" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
            Submitted Successfully
          </h1>
          <p className="text-[13px] text-muted" style={{ fontFamily: 'Lora, serif' }}>
            Thank you. Your information has been submitted to the advocate. They will be in touch with you shortly.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Gold top line */}
      <div className="h-[2px] bg-gold/50" />

      <div className="max-w-[640px] mx-auto p-6 md:p-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Scale size={22} className="text-gold" />
          <span className="text-[11px] text-gold/60 tracking-widest" style={{ fontFamily: 'DM Mono, monospace' }}>
            LEXDRAFT — CLIENT INTAKE
          </span>
        </div>

        <h1 className="text-[32px] text-foreground mb-2" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
          {form.title}
        </h1>
        <p className="text-[12px] text-muted mb-8" style={{ fontFamily: 'DM Mono, monospace' }}>
          Please fill in the form below. All information is confidential.
        </p>

        <div className="gold-line-solid mb-8" />

        <div className="space-y-5">
          {/* Respondent email (optional) */}
          <FormField label="Your Email Address" hint="Optional — for follow-up communication">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </FormField>

          {/* Dynamic fields */}
          {form.fields.map(field => (
            <FormField key={field.id} label={field.label} required={field.required}>
              {field.type === 'textarea' ? (
                <Textarea
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  rows={4}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              ) : (
                <Input
                  type={field.type}
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              )}
            </FormField>
          ))}

          {error && (
            <p className="text-[11px] text-red-400" style={{ fontFamily: 'DM Mono, monospace' }}>{error}</p>
          )}

          <Button variant="primary" size="lg" loading={submitting} onClick={handleSubmit} className="w-full justify-center">
            SUBMIT FORM
          </Button>

          <p className="text-[10px] text-muted/50 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>
            By submitting, you consent to your information being used for legal consultation purposes.
          </p>
        </div>
      </div>
    </div>
  )
}
