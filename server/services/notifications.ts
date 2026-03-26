import { supabase } from '../lib/supabase.js'

export type NotificationType =
  | 'client_upload'
  | 'request_fulfilled'
  | 'new_message'
  | 'document_request_created'
  | 'case_status_changed'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link ?? null,
  })

  if (error) {
    // Log but don't throw — notifications are non-critical
    console.error('[notifications] Insert failed:', error.message)
  }
}

// Helper: notify advocate when client uploads a file
export async function notifyAdvocateClientUpload(
  lawyerId: string,
  clientName: string,
  caseTitle: string,
  caseId: string,
  fileName: string,
): Promise<void> {
  await createNotification({
    userId: lawyerId,
    type: 'client_upload',
    title: 'New file uploaded',
    body: `${clientName} uploaded "${fileName}" to case "${caseTitle}"`,
    link: `/clients?case=${caseId}&tab=audit`,
  })
}

// Helper: notify advocate when request is marked fulfilled
export async function notifyAdvocateRequestFulfilled(
  lawyerId: string,
  clientName: string,
  requestTitle: string,
  caseId: string,
): Promise<void> {
  await createNotification({
    userId: lawyerId,
    type: 'request_fulfilled',
    title: 'Document request fulfilled',
    body: `${clientName} marked "${requestTitle}" as complete`,
    link: `/clients?case=${caseId}&tab=requests`,
  })
}

// Helper: notify advocate of new client message
export async function notifyAdvocateNewMessage(
  lawyerId: string,
  clientName: string,
  caseTitle: string,
  caseId: string,
): Promise<void> {
  await createNotification({
    userId: lawyerId,
    type: 'new_message',
    title: 'New message',
    body: `${clientName} sent a message in "${caseTitle}"`,
    link: `/messages?case=${caseId}`,
  })
}

// Helper: notify client of new document request
export async function notifyClientDocumentRequest(
  clientId: string,
  requestTitle: string,
  caseTitle: string,
): Promise<void> {
  await createNotification({
    userId: clientId,
    type: 'document_request_created',
    title: 'Document requested',
    body: `Your advocate has requested: "${requestTitle}" for case "${caseTitle}"`,
    link: '/client/dashboard',
  })
}

// Helper: notify client of case status change
export async function notifyClientCaseStatusChange(
  clientId: string,
  caseTitle: string,
  newStatus: string,
): Promise<void> {
  await createNotification({
    userId: clientId,
    type: 'case_status_changed',
    title: 'Case status updated',
    body: `"${caseTitle}" is now marked as ${newStatus}`,
    link: '/client/dashboard',
  })
}
