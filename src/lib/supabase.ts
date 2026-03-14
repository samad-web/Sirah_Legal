import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Bypass Web Locks API to prevent "Lock broken by steal" errors during HMR
    lock: <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sirah-legal-auth',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string | null
  bar_council_no: string | null
  state_bar: string | null
  firm_name: string | null
  office_address: string | null
  default_language: string
  default_state: string | null
  plan: string
  documents_this_month: number
  created_at: string
}

export interface Document {
  id: string
  user_id: string
  title: string
  type: 'notice' | 'contract' | 'title-report' | 'contract-review'
  language: string
  content: string
  analysis: Record<string, unknown> | null
  status: 'draft' | 'exported' | 'shared'
  created_at: string
  updated_at: string
}

export interface DocumentFile {
  id: string
  document_id: string
  file_name: string
  file_type: string
  storage_path: string
  uploaded_at: string
}
