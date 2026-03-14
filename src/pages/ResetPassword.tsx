import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Scale, Eye, EyeOff, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/FormFields'

export default function ResetPasswordPage() {
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)
    const [hasSession, setHasSession] = useState(false)

    // Supabase puts the access token in the URL hash on redirect
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setHasSession(!!session)
        })
    }, [])

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirm) {
            setError('Passwords do not match.')
            return
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }
        setLoading(true)
        setError('')
        try {
            const { error: updateErr } = await supabase.auth.updateUser({ password })
            if (updateErr) throw updateErr
            setDone(true)
            setTimeout(() => navigate('/login'), 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex h-screen">
            {/* Left panel */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="w-1/2 bg-[#0a0a0a] border-r border-[rgba(201,168,76,0.2)] flex flex-col items-center justify-center px-16"
            >
                <div className="max-w-sm">
                    <div className="text-[rgba(201,168,76,0.5)] text-5xl mb-4" style={{ fontFamily: 'Georgia, serif' }}>"</div>
                    <blockquote
                        className="text-[32px] text-[#FAF7F0] leading-[1.3] mb-6"
                        style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontStyle: 'italic' }}
                    >
                        Justice delayed is justice denied.
                    </blockquote>
                    <div className="gold-line-solid mb-4" />
                    <p className="text-[12px] text-[rgba(250,247,240,0.45)] tracking-widest" style={{ fontFamily: 'DM Mono, monospace' }}>
                        — William E. Gladstone
                    </p>
                    <div className="mt-16 flex items-center gap-3">
                        <Scale size={20} className="text-[#C9A84C]" />
                        <span className="text-[22px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                            LexDraft
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Right panel */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-1/2 flex items-center justify-center px-16 bg-[#0E0E0E]"
            >
                <div className="w-full max-w-sm">
                    <div className="mb-8">
                        <p className="text-[11px] tracking-widest text-[rgba(201,168,76,0.7)] mb-2" style={{ fontFamily: 'DM Mono, monospace' }}>
                            RESET PASSWORD
                        </p>
                        <h1 className="text-[36px] text-[#FAF7F0]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
                            {done ? 'Password updated.' : 'Choose a new password.'}
                        </h1>
                    </div>

                    {done ? (
                        <div className="border border-[rgba(134,239,172,0.3)] bg-[rgba(134,239,172,0.05)] p-4 flex items-center gap-3">
                            <Check size={16} className="text-[#86efac] shrink-0" />
                            <p className="text-[12px] text-[#86efac]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                Password changed. Redirecting to sign in...
                            </p>
                        </div>
                    ) : !hasSession ? (
                        <div className="border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.05)] p-4">
                            <p className="text-[12px] text-[#C9A84C]" style={{ fontFamily: 'DM Mono, monospace' }}>
                                This link has expired or is invalid. Please request a new password reset.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-4">
                            <FormField label="New Password" required>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Min. 8 characters"
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

                            <FormField label="Confirm Password" required>
                                <Input
                                    type="password"
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    placeholder="Repeat password"
                                    required
                                />
                            </FormField>

                            {error && (
                                <p className="text-[11px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>{error}</p>
                            )}

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                loading={loading}
                                className="w-full justify-center mt-2"
                                style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}
                            >
                                Set New Password
                            </Button>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    )
}
