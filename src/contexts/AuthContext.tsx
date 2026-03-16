import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, type Profile } from '@/lib/supabase'
import { getProfile, upsertProfile } from '@/lib/api'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: string
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange is the single source of truth for auth state.
    // It always fires INITIAL_SESSION immediately on registration, so
    // calling getSession() separately is redundant and creates concurrent
    // token refreshes that invalidate each other and cause unexpected SIGNED_OUT.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        // Clear profile on sign-out. Profile loading on sign-in is handled
        // by the separate useEffect below — keeping it out of this callback
        // prevents a refresh loop where a server 401 on the profile fetch
        // triggers refreshSession(), which re-fires onAuthStateChange, which
        // triggers another profile fetch, etc.
        if (!session?.user) setProfile(null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Fetch the profile whenever the authenticated user's ID changes.
  // Runs after onAuthStateChange has committed the user to React state.
  useEffect(() => {
    if (!user) return
    getProfile(user.id)
      .then(prof => setProfile(prof))
      .catch(() => setProfile(null))
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (user) {
      const prof = await getProfile(user.id)
      setProfile(prof)
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error('Not authenticated')
    const updated = await upsertProfile({ ...updates, id: user.id })
    setProfile(updated)
  }

  const role = (user?.user_metadata?.role as string) ?? 'lawyer'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
