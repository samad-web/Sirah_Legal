import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Scale } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/FormFields'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  const { signIn, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setUnconfirmed(false)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password, fullName)
      }
      navigate('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      if (msg.toLowerCase().includes('email not confirmed')) {
        setUnconfirmed(true)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendSent(false)
    await supabase.auth.resend({ type: 'signup', email })
    setResendSent(true)
  }

  const handleGoogle = async () => {
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    }
  }

  return (
    <div className="flex h-screen">
      {/* Left panel — quote */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-1/2 bg-[#0a0a0a] border-r border-[rgba(201,168,76,0.2)] flex flex-col items-center justify-center px-16"
      >
        {/* Decorative corner lines */}
        <div className="absolute top-6 left-6 w-12 h-12 border-t border-l border-[rgba(201,168,76,0.3)]" />
        <div className="absolute bottom-6 right-1/2 translate-x-0 w-12 h-12 border-b border-r border-[rgba(201,168,76,0.3)]" />

        <div className="max-w-sm">
          <div className="text-[rgba(201,168,76,0.5)] text-5xl mb-4" style={{ fontFamily: 'Georgia, serif' }}>"</div>
          <blockquote
            className="text-[32px] text-[#FAF7F0] leading-[1.3] mb-6"
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontStyle: 'italic' }}
          >
            The law is reason, free from passion.
          </blockquote>
          <div className="gold-line-solid mb-4" />
          <p
            className="text-[12px] text-[rgba(250,247,240,0.45)] tracking-widest"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            — Aristotle
          </p>

          <div className="mt-16 flex items-center gap-3">
            <Scale size={20} className="text-[#C9A84C]" />
            <span
              className="text-[22px] text-[#FAF7F0]"
              style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
            >
              LexDraft
            </span>
          </div>
          <p
            className="text-[10px] text-[rgba(250,247,240,0.3)] mt-1 tracking-widest"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            AI LEGAL DRAFTING PLATFORM
          </p>
        </div>
      </motion.div>

      {/* Right panel — form */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-1/2 flex items-center justify-center px-16 bg-[#0E0E0E]"
      >
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p
              className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-2"
              style={{ fontFamily: 'DM Mono, monospace' }}
            >
              {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </p>
            <h1
              className="text-[36px] text-[#FAF7F0]"
              style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}
            >
              {mode === 'login' ? 'Welcome back.' : 'Start drafting.'}
            </h1>
          </div>

          {/* Mode toggle */}
          <div className="flex mb-8 border border-[rgba(201,168,76,0.2)]">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={cn(
                  'flex-1 py-2 text-[11px] tracking-widest transition-all',
                  mode === m
                    ? 'bg-[#1B3A2D] text-[#F5EDD6]'
                    : 'text-[rgba(250,247,240,0.4)] hover:text-[rgba(250,247,240,0.7)]'
                )}
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                {m === 'login' ? 'SIGN IN' : 'SIGN UP'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
              >
                <FormField label="Full Name" required>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Advocate Full Name"
                    required
                  />
                </FormField>
              </motion.div>
            )}

            <FormField label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </FormField>

            <FormField label="Password" required>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(250,247,240,0.4)] hover:text-[rgba(250,247,240,0.8)]"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </FormField>

            {error && (
              <p className="text-[11px] text-[#f87171] py-1" style={{ fontFamily: 'DM Mono, monospace' }}>
                {error}
              </p>
            )}

            {unconfirmed && (
              <div className="border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.05)] p-3">
                <p className="text-[11px] text-[#C9A84C] mb-2" style={{ fontFamily: 'DM Mono, monospace' }}>
                  EMAIL NOT CONFIRMED — check your inbox for a confirmation link.
                </p>
                {resendSent ? (
                  <p className="text-[11px] text-green-400" style={{ fontFamily: 'DM Mono, monospace' }}>
                    ✓ Confirmation email resent.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-[11px] text-[rgba(250,247,240,0.5)] underline hover:text-[#FAF7F0] transition-colors"
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  >
                    Resend confirmation email →
                  </button>
                )}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full justify-center mt-2"
              style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}
            >
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-px bg-[rgba(201,168,76,0.15)]" />
            <span className="text-[10px] text-[rgba(250,247,240,0.3)]" style={{ fontFamily: 'DM Mono, monospace' }}>OR</span>
            <div className="flex-1 h-px bg-[rgba(201,168,76,0.15)]" />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full h-11 border border-[rgba(201,168,76,0.25)] text-[rgba(250,247,240,0.7)] hover:border-[rgba(201,168,76,0.5)] hover:text-[#FAF7F0] transition-all flex items-center justify-center gap-3 text-[12px]"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p
            className="text-center text-[11px] text-[rgba(250,247,240,0.3)] mt-6"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            By continuing, you agree to our{' '}
            <Link to="#" className="text-[rgba(201,168,76,0.7)] hover:text-[#C9A84C] nav-hover-gold">Terms</Link>
            {' '}and{' '}
            <Link to="#" className="text-[rgba(201,168,76,0.7)] hover:text-[#C9A84C] nav-hover-gold">Privacy Policy</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
