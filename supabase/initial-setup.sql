-- TBD Visual Identity Session
-- Однократный запуск в Supabase SQL Editor для нового пустого проекта.

create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'archived')),
  edit_token_hash text not null,
  current_section integer not null default 0 check (current_section between 0 and 8),
  current_question integer not null default 0 check (current_question between 0 and 100),
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  archived_at timestamptz,
  admin_note text
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  section_id text not null,
  question_id text not null,
  question_type text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

create table if not exists public."references" (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  section_id text not null,
  question_id text not null,
  reference_group_id text not null,
  reference_type text not null check (reference_type in ('reference', 'anti-reference')),
  url text,
  title text,
  notes jsonb not null default '[]'::jsonb,
  likes_text text,
  mood_only_text text,
  avoid_copying_text text,
  dislikes_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id, reference_group_id)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  section_id text not null,
  question_id text not null,
  reference_group_id text,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  caption text,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'ready')),
  created_at timestamptz not null default now()
);

create table if not exists public.submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists submissions_status_updated_idx on public.submissions(status, updated_at desc);
create index if not exists answers_submission_idx on public.answers(submission_id);
create index if not exists references_submission_idx on public."references"(submission_id);
create index if not exists attachments_submission_idx on public.attachments(submission_id);
create index if not exists attachments_ready_idx on public.attachments(submission_id, upload_status);
create index if not exists submission_events_submission_idx on public.submission_events(submission_id, created_at);

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_profiles where id = user_id);
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

alter table public.admin_profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.answers enable row level security;
alter table public."references" enable row level security;
alter table public.attachments enable row level security;
alter table public.submission_events enable row level security;

drop policy if exists "Admins can read own profile" on public.admin_profiles;
create policy "Admins can read own profile"
on public.admin_profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Admins can read submissions" on public.submissions;
create policy "Admins can read submissions"
on public.submissions for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can update submissions" on public.submissions;
create policy "Admins can update submissions"
on public.submissions for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can read answers" on public.answers;
create policy "Admins can read answers"
on public.answers for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can read references" on public."references";
create policy "Admins can read references"
on public."references" for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can read attachments" on public.attachments;
create policy "Admins can read attachments"
on public.attachments for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can read events" on public.submission_events;
create policy "Admins can read events"
on public.submission_events for select
to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brief-attachments',
  'brief-attachments',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read brief attachments" on storage.objects;
create policy "Admins can read brief attachments"
on storage.objects for select
to authenticated
using (bucket_id = 'brief-attachments' and public.is_admin());

create or replace function public.grant_admin(target_email text, target_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_id uuid;
begin
  select id into target_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_id is null then
    raise exception 'Сначала создайте пользователя % в Authentication > Users', target_email;
  end if;

  insert into public.admin_profiles (id, email, display_name)
  values (target_id, lower(target_email), target_display_name)
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name;

  return target_id;
end;
$$;

revoke all on function public.grant_admin(text, text) from public, anon, authenticated;
grant execute on function public.grant_admin(text, text) to service_role;

comment on table public.submissions is 'Анонимные анкеты TBD. Публичный клиент не имеет прямого доступа; операции проходят через Edge Function.';
comment on table public.attachments is 'Метаданные приватных файлов bucket brief-attachments.';
