-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Saved shortlists: one private set per signed-in user.
-- Who can have an account is controlled in Supabase (Authentication -> Sign In / Providers: turn OFF "Allow new users to sign up"
-- and create each user yourself under Authentication -> Users). To also restrict by email domain, see the optional block at the end.

create table if not exists public.shortlist (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  listing_id text        not null,
  snapshot   jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table public.shortlist enable row level security;

-- Only signed-in users may touch this table (works whether or not "Automatically expose new tables" is on).
revoke all on public.shortlist from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.shortlist to authenticated;

-- Each person can read and change only their own rows.
drop policy if exists "own rows: read"   on public.shortlist;
drop policy if exists "own rows: insert" on public.shortlist;
drop policy if exists "own rows: update" on public.shortlist;
drop policy if exists "own rows: delete" on public.shortlist;
create policy "own rows: read"   on public.shortlist for select using (auth.uid() = user_id);
create policy "own rows: insert" on public.shortlist for insert with check (auth.uid() = user_id);
create policy "own rows: update" on public.shortlist for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on public.shortlist for delete using (auth.uid() = user_id);

-- Remove the old company-email-only rule if it was installed earlier.
drop trigger if exists enforce_company_email on auth.users;
drop function if exists public.enforce_company_email();

-- OPTIONAL: only allow one email domain (replace example.com; also set ALLOWED_EMAIL_DOMAIN in config.js):
-- create or replace function public.enforce_company_email() returns trigger language plpgsql security definer set search_path = public as $$
-- begin if lower(new.email) not like '%@example.com' then raise exception 'Only @example.com addresses are allowed.'; end if; return new; end; $$;
-- create trigger enforce_company_email before insert or update of email on auth.users for each row execute function public.enforce_company_email();
