import { supabase } from './supabase'

// createClientAccount now goes through the Express backend (POST /api/clients)
// Re-exported from api.ts for backwards compatibility with ManageClients.tsx
export { createClientAccount } from './api'

/**
 * Triggers a password reset email for the given client.
 */
export async function resetClientPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })

  if (error) {
    throw error
  }

  return true
}
