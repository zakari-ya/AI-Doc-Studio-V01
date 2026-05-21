-- AI Doc Studio Supabase bootstrap schema.
-- This migration resets the old Clerk-linked documents table and replaces it
-- with Supabase Auth ownership.

create extension if not exists pgcrypto;

drop table if exists public.documents cascade;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  original_file_name text not null,
  storage_bucket text not null default 'documents-temp',
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null,
  status text not null check (status in ('uploading', 'uploaded', 'processing', 'completed', 'failed', 'expired')),
  extracted_text text,
  reconstructed_markdown text,
  error_message text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_auth_user_id_idx
  on public.documents (auth_user_id);

create index if not exists documents_expires_at_idx
  on public.documents (expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

alter table public.documents enable row level security;

-- Application document writes happen through Vercel API routes using the
-- Supabase service role. No direct browser policies are needed here.

create table if not exists public.rate_limiter_flexible (
  key varchar(255) primary key,
  points integer not null default 0,
  expire bigint
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'documents-temp',
  'documents-temp',
  false,
  15728640,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
