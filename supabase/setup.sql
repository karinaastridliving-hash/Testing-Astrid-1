-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Saved shortlists, one private set per signed-in user, and a company-email-only rule.

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

-- Each person can read and change only their own rows, and only with a company email.
drop policy if exists "own rows: read"   on public.shortlist;
drop policy if exists "own rows: insert" on public.shortlist;
drop policy if exists "own rows: update" on public.shortlist;
drop policy if exists "own rows: delete" on public.shortlist;
create policy "own rows: read"   on public.shortlist for select using (auth.uid() = user_id and (auth.jwt() ->> 'email') ilike '%@astridliving.com');
create policy "own rows: insert" on public.shortlist for insert with check (auth.uid() = user_id and (auth.jwt() ->> 'email') ilike '%@astridliving.com');
create policy "own rows: update" on public.shortlist for update using (auth.uid() = user_id) with check (auth.uid() = user_id and (auth.jwt() ->> 'email') ilike '%@astridliving.com');
create policy "own rows: delete" on public.shortlist for delete using (auth.uid() = user_id);

-- Only @astridliving.com addresses can ever have an account (blocks sign-ups from other domains).
create or replace function public.enforce_company_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) not like '%@astridliving.com' then
    raise exception 'Only @astridliving.com email addresses are allowed.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_company_email on auth.users;
create trigger enforce_company_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_company_email();
