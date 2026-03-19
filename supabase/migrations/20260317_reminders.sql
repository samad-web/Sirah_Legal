-- Feature 1: Hearing Reminders
alter table case_timeline_events
  add column if not exists reminder_sent boolean not null default false;
