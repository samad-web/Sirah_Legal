import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
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
  default_dispute: string | null
  letterhead_url: string | null
  signature_url: string | null
  email_notifications: boolean
  plan: string
  documents_this_month: number
  role: string
  created_by_lawyer_id: string | null
  created_at: string
}

export interface Case {
  id: string
  lawyer_id: string
  title: string
  description: string | null
  status: 'active' | 'closed' | 'archived'
  created_at: string
  updated_at: string
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
