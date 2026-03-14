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

// Types
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
  role: 'lawyer' | 'client'
  created_by_lawyer_id: string | null
  logo_url: string | null
  signature_url: string | null
  font_family: string | null
  font_size: number | null
  font_color: string | null
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

export interface CaseAssignment {
  case_id: string
  client_id: string
  assigned_at: string
}

export interface CaseDocument {
  case_id: string
  document_id: string
  linked_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  document_id: string | null
  action: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ClientAccount {
  id: string
  full_name: string | null
  email: string
  cases: Case[]
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

// Helpers
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveDocument(doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .insert(doc)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getUserDocuments(userId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function deleteDocument(id: string) {
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}

/** Bumps documents_this_month by 1 for the given user. Silently no-ops on error. */
export async function incrementDocumentCount(userId: string): Promise<void> {
  try {
    await supabase.rpc('increment_document_count', { uid: userId })
  } catch {
    // RPC may not exist — fall back to a client-side read-modify-write
    try {
      const profile = await getProfile(userId)
      if (profile) {
        await supabase
          .from('profiles')
          .update({ documents_this_month: (profile.documents_this_month || 0) + 1 })
          .eq('id', userId)
      }
    } catch (fallbackErr) {
      console.error('[LexDraft] Could not increment document count:', fallbackErr)
    }
  }
}

export async function updateDocument(id: string, updates: Partial<Document>) {
  const { data, error } = await supabase
    .from('documents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Cases ───────────────────────────────────────────────────

export async function getCases(lawyerId: string): Promise<Case[]> {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createCase(
  lawyerId: string,
  title: string,
  description: string,
): Promise<Case> {
  const { data, error } = await supabase
    .from('cases')
    .insert({ lawyer_id: lawyerId, title, description })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCase(id: string, updates: Partial<Pick<Case, 'title' | 'description' | 'status'>>) {
  const { data, error } = await supabase
    .from('cases')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCase(id: string) {
  const { error } = await supabase.from('cases').delete().eq('id', id)
  if (error) throw error
}

// ─── Case Assignments ─────────────────────────────────────────

export async function assignClientToCase(caseId: string, clientId: string) {
  const { error } = await supabase
    .from('case_assignments')
    .upsert({ case_id: caseId, client_id: clientId })
  if (error) throw error
}

export async function removeClientFromCase(caseId: string, clientId: string) {
  const { error } = await supabase
    .from('case_assignments')
    .delete()
    .eq('case_id', caseId)
    .eq('client_id', clientId)
  if (error) throw error
}

export async function getClientsForCase(caseId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('case_assignments')
    .select('profiles!case_assignments_client_id_fkey(*)')
    .eq('case_id', caseId)
  if (error) throw error
  return (data || []).map((row: any) => row.profiles).filter(Boolean)
}

// ─── Case Documents ──────────────────────────────────────────

export async function linkDocumentToCase(caseId: string, documentId: string) {
  const { error } = await supabase
    .from('case_documents')
    .upsert({ case_id: caseId, document_id: documentId })
  if (error) throw error
}

export async function unlinkDocumentFromCase(caseId: string, documentId: string) {
  const { error } = await supabase
    .from('case_documents')
    .delete()
    .eq('case_id', caseId)
    .eq('document_id', documentId)
  if (error) throw error
}

export async function getDocumentsForCase(caseId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('case_documents')
    .select('documents(*)')
    .eq('case_id', caseId)
  if (error) throw error
  return (data || []).map((row: any) => row.documents).filter(Boolean)
}

export async function getLinkedCaseDocumentIds(caseId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('case_documents')
    .select('document_id')
    .eq('case_id', caseId)
  if (error) throw error
  return (data || []).map((row: { document_id: string }) => row.document_id)
}

// ─── Client Documents (via RPC) ───────────────────────────────

/**
 * Returns all documents a client is allowed to see,
 * via the `get_client_documents` SQL function (security definer).
 * Also enforced by RLS on the documents table.
 */
export async function getClientDocuments(clientId: string): Promise<Document[]> {
  const { data, error } = await supabase.rpc('get_client_documents', { p_client_id: clientId })
  if (error) throw error
  return data || []
}

/**
 * Returns all cases a client is assigned to,
 * via the `get_client_cases` SQL function (security definer).
 */
export async function getClientCases(clientId: string): Promise<Case[]> {
  const { data, error } = await supabase.rpc('get_client_cases', { p_client_id: clientId })
  if (error) throw error
  return data || []
}

// ─── Client Account Management ───────────────────────────────

/**
 * Returns all client profiles created by the given lawyer.
 */
export async function getClientProfiles(lawyerId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'client')
    .eq('created_by_lawyer_id', lawyerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ─── Audit Logs ──────────────────────────────────────────────

export async function logDocumentAccess(
  userId: string,
  documentId: string,
  action: 'preview' | 'download' | 'view_list',
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase
      .from('audit_logs')
      .insert({ user_id: userId, document_id: documentId, action, metadata: metadata || null })
  } catch {
    // Fire-and-forget — never surface audit log errors to UI
  }
}

export async function getAuditLogs(documentId: string): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// SQL schema (for reference, run in Supabase dashboard):
/*
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  bar_council_no text,
  state_bar text,
  firm_name text,
  office_address text,
  default_language text default 'en',
  default_state text,
  plan text default 'free',
  documents_this_month int default 0,
  created_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  title text,
  type text,
  language text,
  content text,
  analysis jsonb,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id),
  file_name text,
  file_type text,
  storage_path text,
  uploaded_at timestamptz default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table documents enable row level security;
alter table document_files enable row level security;

-- Policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Users can manage own documents" on documents for all using (auth.uid() = user_id);
create policy "Users can manage own files" on document_files for all using (
  auth.uid() = (select user_id from documents where id = document_id)
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
*/
