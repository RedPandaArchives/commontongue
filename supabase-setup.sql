-- Run this once in your Supabase project -> SQL Editor.

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  room        text not null default 'lobby',
  sender_id   text not null,          -- the authenticated user's id
  sender_name text not null,
  source_lang text not null,          -- language code the message was written in, e.g. 'DE'
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists messages_room_created_idx on messages (room, created_at);
alter publication supabase_realtime add table messages;

alter table messages enable row level security;
create policy "authed read" on messages for select to authenticated using (true);
create policy "post as self" on messages for insert to authenticated with check (auth.uid()::text = sender_id);

-- ── Translation cache ─────────────────────────────────────────────
-- Content-keyed: one row per (source|target|text). The first person to need
-- a given translation writes it; everyone else reads it. Dedupes both across
-- viewers of the same message AND across repeated identical messages.
create table if not exists translations (
  cache_key  text primary key,        -- "SRC|TGT|original text"
  text       text not null,           -- the translation
  created_at timestamptz not null default now()
);

alter table translations enable row level security;
create policy "authed read tr"  on translations for select to authenticated using (true);
create policy "authed write tr" on translations for insert to authenticated with check (true);
