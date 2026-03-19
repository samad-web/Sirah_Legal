-- ─── case_timeline_events ────────────────────────────────────────────────────
-- Lawyer-managed events on a case (hearings, filings, orders, milestones, etc.)
-- visible to clients assigned to that case.

create table if not exists public.case_timeline_events (
  id          uuid        default gen_random_uuid() primary key,
  case_id     uuid        not null references public.cases(id) on delete cascade,
  lawyer_id   uuid        not null references public.profiles(id),
  title       text        not null,
  description text,
  event_date  date        not null,
  event_type  text        not null default 'milestone',
  created_at  timestamptz default now(),
  constraint  event_type_check check (
    event_type in ('hearing', 'filing', 'order', 'milestone', 'payment', 'notice')
  )
);

alter table public.case_timeline_events enable row level security;

drop policy if exists "Lawyers manage timeline events" on public.case_timeline_events;
create policy "Lawyers manage timeline events"
  on public.case_timeline_events
  for all
  using (lawyer_id = auth.uid());

drop policy if exists "Clients read assigned case timeline" on public.case_timeline_events;
create policy "Clients read assigned case timeline"
  on public.case_timeline_events
  for select
  using (
    case_id in (
      select case_id from public.case_assignments
      where client_id = auth.uid()
    )
  );

create index if not exists case_timeline_events_case_id_idx
  on public.case_timeline_events(case_id, event_date desc);
