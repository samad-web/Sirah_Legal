import { supabase } from './supabase'
import type { Profile, Document } from './supabase'

const BASE = '/api'

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `API error ${res.status}`)
  }
  return res.json() as Promise<T>
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

export async function getUserDocuments(_userId?: string): Promise<Document[]> {
  return apiFetch<Document[]>('/documents')
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
    // silently ignore — this is a non-critical counter
  }
}
