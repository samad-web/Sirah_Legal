import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Gavel, FolderOpen, ClipboardList, Flag, CreditCard, Bell } from 'lucide-react'
import { getAllTimeline } from '@/lib/api-additions'
import type { TimelineEventWithCase } from '@/lib/api-additions'
import type { CaseTimelineEvent } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const EVENT_COLORS: Record<CaseTimelineEvent['event_type'], string> = {
  hearing:   'bg-[rgba(147,197,253,0.15)] border-[rgba(147,197,253,0.4)] text-[#93c5fd]',
  filing:    'bg-[rgba(134,239,172,0.15)] border-[rgba(134,239,172,0.4)] text-[#86efac]',
  order:     'bg-[rgba(251,191,36,0.15)] border-[rgba(251,191,36,0.4)] text-[#fbbf24]',
  milestone: 'bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.4)] text-[#C9A84C]',
  payment:   'bg-[rgba(249,168,212,0.15)] border-[rgba(249,168,212,0.4)] text-[#f9a8d4]',
  notice:    'bg-[rgba(196,181,253,0.15)] border-[rgba(196,181,253,0.4)] text-[#c4b5fd]',
}

const EVENT_DOT: Record<CaseTimelineEvent['event_type'], string> = {
  hearing:   'bg-[#93c5fd]',
  filing:    'bg-[#86efac]',
  order:     'bg-[#fbbf24]',
  milestone: 'bg-[#C9A84C]',
  payment:   'bg-[#f9a8d4]',
  notice:    'bg-[#c4b5fd]',
}

const EVENT_ICONS: Record<CaseTimelineEvent['event_type'], React.ReactNode> = {
  hearing:   <Gavel size={12} />,
  filing:    <FolderOpen size={12} />,
  order:     <ClipboardList size={12} />,
  milestone: <Flag size={12} />,
  payment:   <CreditCard size={12} />,
  notice:    <Bell size={12} />,
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CalendarPage() {
  const [events, setEvents] = useState<TimelineEventWithCase[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setFetchError('')
    try {
      const data = await getAllTimeline()
      setEvents(data)
    } catch (err) {
      console.error('[LexDraft] Calendar: failed to load events:', err)
      setFetchError('Failed to load calendar events.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build event map: dateStr -> events
  const eventMap: Record<string, TimelineEventWithCase[]> = {}
  for (const evt of events) {
    const key = evt.event_date
    if (!eventMap[key]) eventMap[key] = []
    eventMap[key].push(evt)
  }

  const selectedEvents = selectedDay ? (eventMap[selectedDay] ?? []) : []

  function prevMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    setSelectedDay(null)
  }
  function nextMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    setSelectedDay(null)
  }

  function dayStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  // Pad calendar grid
  const gridCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Fill to complete 6 rows
  while (gridCells.length % 7 !== 0) gridCells.push(null)

  return (
    <div className="p-4 md:p-8 max-w-[1200px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[32px] text-foreground mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
          Calendar
        </h1>
        <p className="text-[12px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
          All case timeline events
        </p>
      </div>

      <div className="gold-line-solid mb-8" />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-6 h-6 border border-gold border-t-transparent animate-spin" />
          <p className="text-[11px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>LOADING EVENTS…</p>
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 border border-red-500/20">
          <p className="text-[12px] text-red-400" style={{ fontFamily: 'DM Mono, monospace' }}>{fetchError}</p>
          <button onClick={fetchEvents} className="text-[11px] text-gold hover:text-gold/80" style={{ fontFamily: 'DM Mono, monospace' }}>
            RETRY
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Month navigator */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 text-muted hover:text-foreground border border-border hover:border-gold/40 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-[22px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
              {MONTHS[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 text-muted hover:text-foreground border border-border hover:border-gold/40 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="border border-border/40">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border/40 bg-surface">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-[10px] tracking-widest text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {gridCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="h-24 border-b border-r border-border/20 bg-surface/30" />
                }
                const ds = dayStr(day)
                const dayEvents = eventMap[ds] ?? []
                const isToday = ds === todayStr
                const isSelected = ds === selectedDay

                return (
                  <div
                    key={ds}
                    onClick={() => setSelectedDay(isSelected ? null : ds)}
                    className={cn(
                      'h-24 p-2 border-b border-r border-border/20 cursor-pointer transition-all overflow-hidden',
                      isSelected ? 'bg-forest border-gold/30' : 'hover:bg-surface-2',
                    )}
                  >
                    <span className={cn(
                      'text-[12px] w-6 h-6 flex items-center justify-center',
                      isToday
                        ? 'bg-gold text-background font-bold'
                        : isSelected ? 'text-parchment' : 'text-muted',
                    )} style={{ fontFamily: 'DM Mono, monospace' }}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map(evt => (
                        <div
                          key={evt.id}
                          className={cn('flex items-center gap-1 px-1 py-0.5 border text-[9px] truncate', EVENT_COLORS[evt.event_type])}
                          style={{ fontFamily: 'DM Mono, monospace' }}
                        >
                          <span className={cn('w-1.5 h-1.5 shrink-0', EVENT_DOT[evt.event_type])} />
                          <span className="truncate">{evt.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[9px] text-muted pl-1" style={{ fontFamily: 'DM Mono, monospace' }}>
                          +{dayEvents.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected day events */}
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-gold/25 bg-surface p-5"
            >
              <p className="text-[11px] tracking-widest text-gold/70 mb-4" style={{ fontFamily: 'DM Mono, monospace' }}>
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>

              {selectedEvents.length === 0 ? (
                <p className="text-[13px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  No events on this day.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map(evt => (
                    <div key={evt.id} className={cn('flex items-start gap-3 p-3 border', EVENT_COLORS[evt.event_type])}>
                      <div className="flex items-center justify-center w-7 h-7 shrink-0">
                        {EVENT_ICONS[evt.event_type]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] border px-1.5 py-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                            {evt.event_type.toUpperCase()}
                          </span>
                          {evt.cases?.title && (
                            <span className="text-[10px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                              {evt.cases.title}
                            </span>
                          )}
                        </div>
                        <p className="text-[15px] mt-1 text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                          {evt.title}
                        </p>
                        {evt.description && (
                          <p className="text-[11px] text-muted mt-0.5" style={{ fontFamily: 'Lora, serif' }}>
                            {evt.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {(Object.keys(EVENT_DOT) as CaseTimelineEvent['event_type'][]).map(type => (
              <div key={type} className="flex items-center gap-2">
                <span className={cn('w-2.5 h-2.5', EVENT_DOT[type])} />
                <span className="text-[10px] text-muted capitalize" style={{ fontFamily: 'DM Mono, monospace' }}>{type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
