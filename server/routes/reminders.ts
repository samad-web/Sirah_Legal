import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireLawyer } from '../middleware/auth.js'
import { sendHearingReminder } from '../lib/email.js'

export const remindersRouter = Router()

remindersRouter.use(requireAuth, requireLawyer)

// POST /api/reminders/send-upcoming
// Finds all timeline events in the next 2 days where reminder_sent=false,
// sends email to assigned clients, marks reminder_sent=true.
remindersRouter.post('/send-upcoming', async (req, res, next) => {
  try {
    const now = new Date()
    const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

    const todayStr = now.toISOString().slice(0, 10)
    const in2DaysStr = in2Days.toISOString().slice(0, 10)

    // Get all upcoming events that haven't had reminders sent
    const { data: events, error: eventsError } = await supabase
      .from('case_timeline_events')
      .select('id, title, event_date, event_type, case_id, cases(title, lawyer_id)')
      .eq('reminder_sent', false)
      .gte('event_date', todayStr)
      .lte('event_date', in2DaysStr)

    if (eventsError) throw eventsError
    if (!events || events.length === 0) {
      res.json({ sent: 0, message: 'No upcoming reminders needed' })
      return
    }

    let sent = 0
    const errors: string[] = []

    for (const event of events) {
      const caseRow = event.cases as { title: string; lawyer_id: string } | null
      if (!caseRow) continue

      // Get assigned clients for this case
      const { data: assignments } = await supabase
        .from('case_assignments')
        .select('profiles(id, full_name)')
        .eq('case_id', event.case_id)

      const clientIds = (assignments ?? []).map(
        (a: Record<string, unknown>) => (a.profiles as { id: string } | null)?.id,
      ).filter(Boolean) as string[]

      if (clientIds.length === 0) continue

      // Get client auth emails via admin API
      for (const clientId of clientIds) {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(clientId)
          const email = authUser?.user?.email
          if (!email) continue

          await sendHearingReminder(
            email,
            event.title,
            event.event_date,
            caseRow.title,
          )
          sent++
        } catch (err) {
          errors.push(`Failed to send to client ${clientId}: ${String(err)}`)
        }
      }

      // Mark reminder_sent = true
      await supabase
        .from('case_timeline_events')
        .update({ reminder_sent: true })
        .eq('id', event.id)
    }

    res.json({ sent, errors: errors.length > 0 ? errors : undefined })
  } catch (err) {
    next(err)
  }
})
