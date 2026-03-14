import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { logDocumentAccess } from '@/lib/supabase'

/**
 * A lightweight hook for audit logging document access.
 * Fire-and-forget — never throws or surfaces errors to the UI.
 *
 * Usage:
 *   const logAccess = useAuditLog()
 *   logAccess(documentId, 'preview')
 */
export function useAuditLog() {
    const { user } = useAuth()

    const logAccess = useCallback(
        (documentId: string, action: 'preview' | 'download' | 'view_list') => {
            if (!user) return
            // fire-and-forget
            logDocumentAccess(user.id, documentId, action).catch(() => { })
        },
        [user],
    )

    return logAccess
}
