import { supabase } from './supabase'
import type { Profile, Document, Case } from './supabase'

const BASE = '/api'

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const makeHeaders = (t: string): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${t}`,
    ...(init.headers as Record<string, string> ?? {}),
  })

  const res = await fetch(`${BASE}${path}`, { ...init, headers: makeHeaders(token) })

  // On 401, force a token refresh — getSession() only reads the local cache
  // and may return the same expired token. refreshSession() asks Supabase for
  // a new access token using the refresh token.
  if (res.status === 401) {
    const { data: refreshData } = await supabase.auth.refreshSession()
    const freshToken = refreshData.session?.access_token
    if (freshToken && freshToken !== token) {
      const retry = await fetch(`${BASE}${path}`, { ...init, headers: makeHeaders(freshToken) })
      if (!retry.ok) {
        const text = await retry.text()
        throw new Error(text || `API error ${retry.status}`)
      }
      return retry.json() as Promise<T>
    }
    const text = await res.text()
    throw new Error(text || 'API error 401')
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── File upload (multipart — bypasses apiFetch's JSON Content-Type) ─────────

export async function uploadAdvocateFile(
  file: File,
  slot: 'letterhead' | 'signature',
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const form = new FormData()
  form.append('file', file)
  form.append('slot', slot)

  const res = await fetch(`${BASE}/profiles/upload-file`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Upload error ${res.status}`)
  }
  const { url } = await res.json() as { url: string }
  return url
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(_userId?: string): Promise<Profile | null> {
  try {
    return await apiFetch<Profile>('/profiles/me')
  } catch {
    return null
  }
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  return apiFetch<Profile>('/profiles/me', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  })
}

// ─── Documents ───────────────────────────────────────────────────────────────

export interface PaginatedDocuments {
  data: Document[]
  total: number
  page: number
  limit: number
}

export async function getUserDocuments(
  _userId?: string,
  opts: { page?: number; limit?: number; search?: string } = {},
): Promise<PaginatedDocuments> {
  const { page = 1, limit = 20, search } = opts
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) params.set('search', search)
  return apiFetch<PaginatedDocuments>(`/documents?${params}`)
}

export async function saveDocument(
  doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>,
): Promise<Document> {
  return apiFetch<Document>('/documents', {
    method: 'POST',
    body: JSON.stringify(doc),
  })
}

export async function updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
  return apiFetch<Document>(`/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deleteDocument(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' })
}

export async function incrementDocumentCount(_userId?: string): Promise<void> {
  try {
    await apiFetch<{ success: boolean }>('/profiles/increment-count', { method: 'POST', body: '{}' })
  } catch {
    // silently ignore — non-critical counter
  }
}

// ─── Cases (lawyer) ───────────────────────────────────────────────────────────

export async function getCases(_lawyerId?: string): Promise<Case[]> {
  return apiFetch<Case[]>('/cases')
}

export async function createCase(data: { title: string; description?: string; status?: 'active' | 'closed' | 'archived' }): Promise<Case> {
  return apiFetch<Case>('/cases', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateCase(id: string, updates: Partial<Case>): Promise<Case> {
  return apiFetch<Case>(`/cases/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
}

export async function deleteCase(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/cases/${id}`, { method: 'DELETE' })
}

export async function getClientsForCase(caseId: string): Promise<Profile[]> {
  return apiFetch<Profile[]>(`/cases/${caseId}/clients`)
}

export async function assignClientToCase(caseId: string, clientId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/cases/${caseId}/clients/${clientId}`, { method: 'POST', body: '{}' })
}

export async function removeClientFromCase(caseId: string, clientId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/cases/${caseId}/clients/${clientId}`, { method: 'DELETE' })
}

export async function getLinkedCaseDocumentIds(caseId: string): Promise<string[]> {
  return apiFetch<string[]>(`/cases/${caseId}/documents`)
}

export async function linkDocumentToCase(caseId: string, docId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/cases/${caseId}/documents/${docId}`, { method: 'POST', body: '{}' })
}

export async function unlinkDocumentFromCase(caseId: string, docId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/cases/${caseId}/documents/${docId}`, { method: 'DELETE' })
}

// ─── Clients (lawyer managing clients) ───────────────────────────────────────

export async function getClientProfiles(_lawyerId?: string): Promise<Profile[]> {
  return apiFetch<Profile[]>('/clients')
}

export async function createClientAccount(email: string, password: string, fullName: string): Promise<{ userId: string; email: string }> {
  return apiFetch<{ userId: string; email: string }>('/clients', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName }),
  })
}

export async function resetClientPassword(clientId: string): Promise<{ email: string }> {
  return apiFetch<{ email: string }>(`/clients/${clientId}/reset-password`, {
    method: 'POST',
    body: '{}',
  })
}

// ─── Client data access (client role) ────────────────────────────────────────

export async function getClientCases(_userId?: string): Promise<Case[]> {
  return apiFetch<Case[]>('/client/cases')
}

export async function getClientDocuments(_userId?: string): Promise<Document[]> {
  return apiFetch<Document[]>('/client/documents')
}

export async function logDocumentAccess(
  _userId: string,
  documentId: string,
  action: 'preview' | 'download' | 'view_list',
): Promise<void> {
  try {
    await apiFetch<{ success: boolean }>('/client/audit', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, action }),
    })
  } catch {
    // fire-and-forget; never surface errors
  }
}
