import { Resend } from 'resend'

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'noreply@lexdraft.in'

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  return new Resend(key)
}

export async function sendHearingReminder(
  to: string,
  eventTitle: string,
  eventDate: string,
  caseTitle: string,
): Promise<void> {
  const dateFormatted = new Date(eventDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Reminder: ${eventTitle} — ${caseTitle}`,
    html: `
      <div style="font-family: Georgia, serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <div style="border-top: 2px solid #C9A84C; padding-top: 24px; margin-bottom: 24px;">
          <p style="font-size: 11px; color: #888; letter-spacing: 2px; font-family: monospace; margin: 0 0 8px;">LEXDRAFT — HEARING REMINDER</p>
          <h1 style="font-size: 24px; margin: 0 0 4px;">${eventTitle}</h1>
          <p style="font-size: 13px; color: #555; margin: 0;">${caseTitle}</p>
        </div>
        <p style="font-size: 15px; margin: 0 0 16px;">
          This is a reminder that you have an upcoming <strong>${eventTitle}</strong> scheduled for:
        </p>
        <div style="background: #f9f7f2; border-left: 3px solid #C9A84C; padding: 12px 16px; margin-bottom: 20px;">
          <p style="font-size: 18px; font-weight: bold; margin: 0;">${dateFormatted}</p>
        </div>
        <p style="font-size: 12px; color: #888;">
          Please log into your LexDraft client portal to view full case details and documents.
        </p>
        <div style="margin-top: 32px; border-top: 1px solid #e5e5e5; padding-top: 16px;">
          <p style="font-size: 11px; color: #aaa; margin: 0;">
            You are receiving this because you are assigned to case: ${caseTitle}.
            Contact your advocate if you have questions.
          </p>
        </div>
      </div>
    `,
  })
}
