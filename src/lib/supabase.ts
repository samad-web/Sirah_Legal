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

export interface CaseTimelineEvent {
  id: string
  case_id: string
  lawyer_id: string
  title: string
  description: string | null
  event_date: string        // YYYY-MM-DD
  event_type: 'hearing' | 'filing' | 'order' | 'milestone' | 'payment' | 'notice'
  created_at: string
}

export interface DocumentFile {
  id: string
  document_id: string
  file_name: string
  file_type: string
  storage_path: string
  uploaded_at: string
}

export interface CaseNote {
  id: string
  case_id: string
  lawyer_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface CaseMessage {
  id: string
  case_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
  sender?: { id: string; full_name: string | null; role: string }
}

export interface DocumentRequest {
  id: string
  case_id: string
  lawyer_id: string
  client_id: string
  title: string
  description: string | null
  status: 'pending' | 'fulfilled' | 'cancelled'
  created_at: string
  fulfilled_at: string | null
  client?: { id: string; full_name: string | null }
  case?: { id: string; title: string }
}

export interface ClauseLibraryItem {
  id: string
  lawyer_id: string
  title: string
  content: string
  category: string | null
  tags: string[] | null
  created_at: string
}

export interface DocumentVersion {
  id: string
  document_id: string
  content?: string
  version_number: number
  created_by: string | null
  created_at: string
}

export interface CaseStatusHistory {
  id: string
  case_id: string
  old_status: string | null
  new_status: string
  changed_by: string | null
  note: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  document_id: string
  action: string
  created_at: string
  client?: { id: string; full_name: string | null }
  document?: { id: string; title: string }
}

export interface IntakeFormField {
  id: string
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'date'
  required?: boolean
}

export interface IntakeForm {
  id: string
  lawyer_id: string
  case_id: string | null
  title: string
  fields: IntakeFormField[]
  created_at: string
}

export interface IntakeSubmission {
  id: string
  form_id: string
  respondent_email: string | null
  data: Record<string, unknown>
  submitted_at: string
}
