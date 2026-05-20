-- AI Doc Studio Supabase bootstrap schema.
-- Run this in the Supabase SQL editor before deploying the Vercel app.

create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
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

create index if not exists documents_clerk_user_id_idx
  on public.documents (clerk_user_id);

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

-- The application uses the service role key from Vercel API routes for document
-- records. No browser policies are created intentionally.

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
