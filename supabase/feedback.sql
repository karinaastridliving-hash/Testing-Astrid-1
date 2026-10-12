-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Feedback from the website's "Feedback" button. Anyone can SEND feedback; nobody can read it through the website.
-- You read it in the Supabase dashboard: Table Editor -> feedback (export with the "Export to CSV" button).

create table if not exists public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  area       text        not null check (char_length(area) between 1 and 80),
  other_area text        check (char_length(other_area) <= 200),
  kind       text        check (kind in ('Problem', 'Suggestion', 'Praise')),
  rating     smallint    check (rating between 1 and 5),
  message    text        not null check (char_length(message) between 1 and 4000),
  contact    text        check (char_length(contact) <= 200),
  user_email text        default (auth.jwt() ->> 'email'),   -- filled by the server for signed-in users
  page       text        check (char_length(page) <= 300),
  context    jsonb
);

alter table public.feedback enable row level security;

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;

drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated with check (true);
-- (no select/update/delete policy: the website cannot read or change feedback)
