// This file contains the additional API functions for features 2-14.
// It is imported and re-exported from api.ts additions appended below.

import { supabase } from './supabase'
import type {
  CaseNote, CaseMessage, DocumentRequest, ClauseLibraryItem,
  DocumentVersion, CaseStatusHistory, AuditLog,
  IntakeForm, IntakeFormField, IntakeSubmission,
  CaseTimelineEvent,
  ClientNotification, ClientNote, ClientFeedback, DocumentAcknowledgment,
} from './supabase'

const BASE = '/api'

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(init.headers as Record<string, string> ?? {}),
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (res.status === 401) {
    const { data: refreshData } = await supabase.auth.refreshSession()
    const freshToken = refreshData.session?.access_token
    if (freshToken && freshToken !== token) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${freshToken}` }
      const retry = await fetch(`${BASE}${path}`, { ...init, headers: retryHeaders })
      if (!retry.ok) { const t = await retry.text(); throw new Error(t || `API error ${retry.status}`) }
      return retry.json() as Promise<T>
    }
    const text = await res.text()
    throw new Error(text || 'API error 401')
  }
  if (!res.ok) { const text = await res.text(); throw new Error(text || `API error ${res.status}`) }
  return res.json() as Promise<T>
}

// ─── All-cases timeline (Feature 2: Calendar) ────────────────────────────────

export interface TimelineEventWithCase extends CaseTimelineEvent {
  cases?: { title: string }
}

export async function getAllTimeline(): Promise<TimelineEventWithCase[]> {
  return apiFetch<TimelineEventWithCase[]>('/cases/timeline/all')
}

// ─── Case Notes (Feature 3) ───────────────────────────────────────────────────

export async function getCaseNotes(caseId: string): Promise<CaseNote[]> {
  return apiFetch<CaseNote[]>(`/cases/${caseId}/notes`)
}

export async function createCaseNote(caseId: string, content: string): Promise<CaseNote> {
  return apiFetch<CaseNote>(`/cases/${caseId}/notes`, { method: 'POST', body: JSON.stringify({ content }) })
}

export async function updateCaseNote(caseId: string, noteId: string, content: string): Promise<CaseNote> {
  return apiFetch<CaseNote>(`/cases/${caseId}/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ content }) })
}

export async function deleteCaseNote(caseId: string, noteId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/cases/${caseId}/notes/${noteId}`, { method: 'DELETE' })
}

// ─── Messages (Feature 4) ─────────────────────────────────────────────────────

export async function getCaseMessages(caseId: string): Promise<CaseMessage[]> {
  return apiFetch<CaseMessage[]>(`/messages/${caseId}`)
}

export async function sendMessage(caseId: string, content: string): Promise<CaseMessage> {
  return apiFetch<CaseMessage>(`/messages/${caseId}`, { method: 'POST', body: JSON.stringify({ content }) })
}

export async function markMessagesRead(caseId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/messages/${caseId}/read`, { method: 'PATCH', body: '{}' })
}

export async function getClientCaseMessages(caseId: string): Promise<CaseMessage[]> {
  return apiFetch<CaseMessage[]>(`/client/messages/${caseId}`)
}

export async function sendClientMessage(caseId: string, content: string): Promise<CaseMessage> {
  return apiFetch<CaseMessage>(`/client/messages/${caseId}`, { method: 'POST', body: JSON.stringify({ content }) })
}

// ─── Document Requests (Feature 5) ────────────────────────────────────────────

export async function getDocumentRequests(caseId?: string): Promise<DocumentRequest[]> {
  const params = caseId ? `?caseId=${caseId}` : ''
  return apiFetch<DocumentRequest[]>(`/document-requests${params}`)
}

export async function createDocumentRequest(data: {
  case_id: string; client_id: string; title: string; description?: string
}): Promise<DocumentRequest> {
  return apiFetch<DocumentRequest>('/document-requests', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateDocumentRequest(id: string, updates: Partial<DocumentRequest>): Promise<DocumentRequest> {
  return apiFetch<DocumentRequest>(`/document-requests/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
}

export async function getClientDocumentRequests(): Promise<DocumentRequest[]> {
  return apiFetch<DocumentRequest[]>('/client/document-requests')
}

export async function fulfilDocumentRequest(id: string): Promise<DocumentRequest> {
  return apiFetch<DocumentRequest>(`/client/document-requests/${id}/fulfil`, { method: 'PATCH', body: '{}' })
}

// ─── Clause Library (Feature 6) ───────────────────────────────────────────────

export async function getClauses(opts?: { search?: string; category?: string }): Promise<ClauseLibraryItem[]> {
  const params = new URLSearchParams()
  if (opts?.search) params.set('search', opts.search)
  if (opts?.category) params.set('category', opts.category)
  return apiFetch<ClauseLibraryItem[]>(`/clauses?${params}`)
}

export async function createClause(data: Omit<ClauseLibraryItem, 'id' | 'lawyer_id' | 'created_at'>): Promise<ClauseLibraryItem> {
  return apiFetch<ClauseLibraryItem>('/clauses', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateClause(id: string, updates: Partial<ClauseLibraryItem>): Promise<ClauseLibraryItem> {
  return apiFetch<ClauseLibraryItem>(`/clauses/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
}

export async function deleteClause(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/clauses/${id}`, { method: 'DELETE' })
}

// ─── Audit Logs (Feature 7) ───────────────────────────────────────────────────

export async function getAuditLogs(opts?: { caseId?: string; limit?: number }): Promise<AuditLog[]> {
  const params = new URLSearchParams()
  if (opts?.caseId) params.set('caseId', opts.caseId)
  if (opts?.limit) params.set('limit', String(opts.limit))
  return apiFetch<AuditLog[]>(`/audit-logs?${params}`)
}

// ─── Document Versions (Feature 9) ────────────────────────────────────────────

export async function getDocumentVersions(docId: string): Promise<DocumentVersion[]> {
  return apiFetch<DocumentVersion[]>(`/documents/${docId}/versions`)
}

export async function getDocumentVersion(docId: string, versionId: string): Promise<DocumentVersion> {
  return apiFetch<DocumentVersion>(`/documents/${docId}/versions/${versionId}`)
}

// ─── Case Status History (Feature 10) ─────────────────────────────────────────

export async function getCaseStatusHistory(caseId: string): Promise<CaseStatusHistory[]> {
  return apiFetch<CaseStatusHistory[]>(`/cases/${caseId}/history`)
}

// ─── Intake Forms (Feature 14) ────────────────────────────────────────────────

export async function getIntakeForms(): Promise<IntakeForm[]> {
  return apiFetch<IntakeForm[]>('/intake-forms')
}

export async function createIntakeForm(data: { title: string; case_id?: string; fields: IntakeFormField[] }): Promise<IntakeForm> {
  return apiFetch<IntakeForm>('/intake-forms', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateIntakeForm(id: string, updates: Partial<IntakeForm>): Promise<IntakeForm> {
  return apiFetch<IntakeForm>(`/intake-forms/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
}

export async function deleteIntakeForm(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/intake-forms/${id}`, { method: 'DELETE' })
}

export async function getIntakeFormPublic(formId: string): Promise<Pick<IntakeForm, 'id' | 'title' | 'fields'>> {
  const res = await fetch(`/api/intake-forms/${formId}/public`)
  if (!res.ok) throw new Error('Form not found')
  return res.json() as Promise<Pick<IntakeForm, 'id' | 'title' | 'fields'>>
}

export async function submitIntakeForm(formId: string, data: { respondent_email?: string; data: Record<string, unknown> }): Promise<IntakeSubmission> {
  const res = await fetch(`/api/intake-forms/${formId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Submission failed')
  return res.json() as Promise<IntakeSubmission>
}

export async function getIntakeFormSubmissions(formId: string): Promise<IntakeSubmission[]> {
  return apiFetch<IntakeSubmission[]>(`/intake-forms/${formId}/submissions`)
}

// ─── eCourts (Feature 12) ─────────────────────────────────────────────────────

export async function searchECourts(params: {
  cnr?: string; caseNo?: string; court?: string; state?: string; year?: string
}): Promise<unknown> {
  const query = new URLSearchParams()
  if (params.cnr) query.set('cnr', params.cnr)
  if (params.caseNo) query.set('caseNo', params.caseNo)
  if (params.court) query.set('court', params.court)
  if (params.state) query.set('state', params.state)
  if (params.year) query.set('year', params.year)
  return apiFetch<unknown>(`/ecourts/search?${query}`)
}

// ─── Reminders (Feature 1) ────────────────────────────────────────────────────

export async function sendUpcomingReminders(): Promise<{ sent: number; errors?: string[] }> {
  return apiFetch<{ sent: number; errors?: string[] }>('/reminders/send-upcoming', { method: 'POST', body: '{}' })
}

// ─── Notifications (Enhancement 1) ───────────────────────────────────────────

export async function getClientNotifications(): Promise<ClientNotification[]> {
  return apiFetch<ClientNotification[]>('/client/notifications')
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/client/notifications/${id}/read`, { method: 'PATCH', body: '{}' })
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<{ success: boolean }>('/client/notifications/read-all', { method: 'PATCH', body: '{}' })
}

// ─── Client Notes (Enhancement 7) ────────────────────────────────────────────

export async function getClientNotes(caseId: string): Promise<ClientNote[]> {
  return apiFetch<ClientNote[]>(`/client/notes?caseId=${caseId}`)
}

export async function createClientNote(caseId: string, content: string, shareWithLawyer = false): Promise<ClientNote> {
  return apiFetch<ClientNote>('/client/notes', {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId, content, share_with_lawyer: shareWithLawyer }),
  })
}

export async function updateClientNote(id: string, content: string, shareWithLawyer?: boolean): Promise<ClientNote> {
  return apiFetch<ClientNote>(`/client/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content, share_with_lawyer: shareWithLawyer }),
  })
}

export async function deleteClientNote(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/client/notes/${id}`, { method: 'DELETE' })
}

// ─── Feedback (Enhancement 8) ─────────────────────────────────────────────────

export async function submitClientFeedback(data: { case_id?: string; rating: number; comment?: string }): Promise<ClientFeedback> {
  return apiFetch<ClientFeedback>('/client/feedback', { method: 'POST', body: JSON.stringify(data) })
}

// ─── Document Acknowledgment (Enhancement 6A) ─────────────────────────────────

export async function acknowledgeDocument(documentId: string): Promise<DocumentAcknowledgment> {
  return apiFetch<DocumentAcknowledgment>('/client/acknowledge', {
    method: 'POST',
    body: JSON.stringify({ document_id: documentId }),
  })
}

export async function getAcknowledgedDocuments(): Promise<DocumentAcknowledgment[]> {
  return apiFetch<DocumentAcknowledgment[]>('/client/acknowledge')
}

// ─── AI Case Summary (Enhancement 11) ────────────────────────────────────────

export async function getAICaseSummary(caseId: string): Promise<{ summary: string }> {
  return apiFetch<{ summary: string }>(`/client/cases/${caseId}/summary`, { method: 'POST', body: '{}' })
}

// ─── Escalation / Priority (Enhancement 15) ──────────────────────────────────

export async function markRequestUrgent(id: string, urgencyNote?: string): Promise<DocumentRequest> {
  return apiFetch<DocumentRequest>(`/client/document-requests/${id}/urgent`, {
    method: 'PATCH',
    body: JSON.stringify({ urgency_note: urgencyNote }),
  })
}

// ─── Similar Documents (for draft pages) ────────────────────────────────────

export interface SimilarDocument {
  id: string
  title: string
  type: string
  language: string
  created_at: string
  status: string
}

export async function getSimilarDocuments(
  type: string,
  opts: { caseId?: string; limit?: number } = {},
): Promise<{ documents: SimilarDocument[]; source: 'case' | 'recent' }> {
  const params = new URLSearchParams({ type })
  if (opts.caseId) params.set('caseId', opts.caseId)
  if (opts.limit) params.set('limit', String(opts.limit))
  return apiFetch(`/documents/similar?${params}`)
}

// ─── Client File Uploads (Phase 1 — Feature 3) ─────────────────────────────

export interface ClientUpload {
  id: string
  case_id: string
  client_id: string
  request_id: string | null
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  uploaded_at: string
  client?: { id: string; full_name: string | null }
}

export async function getUploadsForCase(caseId: string): Promise<ClientUpload[]> {
  return apiFetch<ClientUpload[]>(`/uploads/case/${caseId}`)
}

export async function getUploadSignedUrl(uploadId: string): Promise<{ url: string; expires_in: number }> {
  return apiFetch<{ url: string; expires_in: number }>(`/uploads/${uploadId}/url`)
}

export async function deleteUpload(uploadId: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/uploads/${uploadId}`, { method: 'DELETE' })
}

// ─── Advocate Notifications (Phase 1 — Feature 2) ──────────────────────────

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

export async function getNotifications(limit = 20, offset = 0): Promise<{
  notifications: AppNotification[]
  total: number
  unread_count: number
}> {
  return apiFetch(`/notifications?limit=${limit}&offset=${offset}`)
}

export async function markNotificationReadById(id: string): Promise<void> {
  await apiFetch<{ updated: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' })
}

export async function markAllNotificationsReadGlobal(): Promise<void> {
  await apiFetch<{ updated: boolean }>('/notifications/read-all', { method: 'PATCH' })
}

// ─── Export re-used types ────────────────────────────────────────────────────

export type { ClientNotification, ClientNote, ClientFeedback, DocumentAcknowledgment }
