-- Secure Networking Tracker — contacts schema + Row Level Security
--
-- Run this once against your Neon database after enabling Managed Better Auth
-- and the Data API (Neon console > your project > Auth / Data API).
--
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- or paste it into the Neon SQL editor.

create extension if not exists pgcrypto; -- for gen_random_uuid()

create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  -- Ownership column. Defaults to the signed-in user's id (set by Managed
  -- Better Auth / the Data API via the auth.user_id() SQL function) and can
  -- never be null, so every row is always owned by exactly one user.
  user_id     text not null default auth.user_id(),
  name        text not null,
  company     text,
  role        text,
  met_at      text, -- free text: where/how you met this person
  notes       text,
  priority    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint contacts_user_id_not_null check (user_id is not null),
  constraint contacts_name_not_blank check (btrim(name) <> ''),
  constraint contacts_priority_valid check (priority in ('high', 'medium', 'low'))
);

-- Row Level Security: without this, the constraints above still validate
-- data shape, but any authenticated user could read or write any row. RLS is
-- what actually confines each user to their own contacts.
alter table contacts enable row level security;

-- Four separate, explicit policies — one per operation — each scoped to
-- auth.user_id() = user_id. Postgres AND's together every policy that
-- applies to a statement, so there is no way to combine these into an
-- accidental bypass.

drop policy if exists contacts_select_own on contacts;
create policy contacts_select_own
  on contacts for select
  to authenticated
  using (auth.user_id() = user_id);

drop policy if exists contacts_insert_own on contacts;
create policy contacts_insert_own
  on contacts for insert
  to authenticated
  with check (auth.user_id() = user_id);

drop policy if exists contacts_update_own on contacts;
create policy contacts_update_own
  on contacts for update
  to authenticated
  using (auth.user_id() = user_id)        -- can only touch rows you already own
  with check (auth.user_id() = user_id);  -- and can't rewrite them to belong to someone else

drop policy if exists contacts_delete_own on contacts;
create policy contacts_delete_own
  on contacts for delete
  to authenticated
  using (auth.user_id() = user_id);

-- Keep updated_at accurate without relying on client-supplied values.
create or replace function set_contacts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at
  before update on contacts
  for each row
  execute function set_contacts_updated_at();

create index if not exists contacts_user_id_idx on contacts (user_id);
