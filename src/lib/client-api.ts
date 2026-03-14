import { supabase } from './supabase'

/**
 * Creates a client account by calling the Supabase Edge Function 'create-client-user'.
 * This function handles creating both the Auth user and the profile row in a single transaction.
 * 
 * @param email Client's email address
 * @param password Temporary password
 * @param fullName Client's full name
 * @returns { userId, email } on success
 */
export async function createClientAccount(email: string, password: string, fullName: string) {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        throw new Error('Not authenticated')
    }

    // Calls the Edge Function (hosted on the same Supabase project)
    const { data, error } = await supabase.functions.invoke('create-client-user', {
        body: { email, password, fullName },
    })

    if (error) {
        throw error
    }

    return data as { userId: string; email: string }
}

/**
 * Triggers a password reset email for the given client.
 * The email will contain a link redirecting to /reset-password?#access_token=...
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
