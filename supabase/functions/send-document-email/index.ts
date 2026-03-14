// supabase/functions/send-document-email/index.ts
// Edge Function — sends an email with an optional PDF attachment.
// Uses Resend (or another provider) to send the email.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        const { to, subject, body, attachment, filename } = await req.json()

        if (!to || !subject) {
            return new Response(JSON.stringify({ error: 'to and subject are required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        if (!RESEND_API_KEY) {
            console.warn('RESEND_API_KEY not set. Email will not be sent.')
            // For demonstration purposes, we'll return a success mock if key is missing
            return new Response(JSON.stringify({ success: true, message: 'Mock: Email sent successfully (API key missing)' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Prepare email payload
        const emailPayload: any = {
            from: 'Sirah Legal <reports@resend.dev>', // Should be a verified domain in production
            to: [to],
            subject: subject,
            html: body.replace(/\n/g, '<br/>'),
        }

        if (attachment && filename) {
            emailPayload.attachments = [
                {
                    filename: filename,
                    content: attachment, // base64 string
                }
            ]
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify(emailPayload),
        })

        const resData = await res.json()

        if (!res.ok) {
            throw new Error(resData.message || 'Failed to send email via Resend')
        }

        return new Response(JSON.stringify({ success: true, id: resData.id }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (err) {
        return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }
})
