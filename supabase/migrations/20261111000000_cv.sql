
-- CV-ja dhe analizat e saj.
-- Të dhënat janë private: çdo përdorues menaxhon vetëm CV-të e veta.

create table if not exists public.cvs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  burimi          text not null check (burimi in ('ngarkuar', 'krijuar')),
  emri_skedarit   text,
  storage_path    text,
  versioni        integer not null default 1 check (versioni >= 1),
  formati         text not null default 'ks'
                  check (formati in ('ks', 'europass', 'eu', 'us', 'uk', 'ats')),
  gjuha           text not null default 'sq'
                  check (gjuha in ('sq', 'en')),
  permbajtja      jsonb,
  krijuar_me      timestamptz not null default now(),

  unique (id, user_id)
);

create table if not exists public.cv_reviews (
  id              uuid primary key default gen_random_uuid(),
  cv_id           uuid not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  nota            integer not null check (nota between 0 and 100),
  analiza         jsonb not null,
  krijuar_me      timestamptz not null default now(),

  foreign key (cv_id, user_id)
    references public.cvs(id, user_id)
    on delete cascade
);

-- Aktivizimi i RLS.
alter table public.cvs enable row level security;
alter table public.cv_reviews enable row level security;

-- CV: përdoruesi lexon, shton, ndryshon dhe fshin vetëm CV-të e veta.
drop policy if exists "cvs_lexo_own" on public.cvs;
create policy "cvs_lexo_own" on public.cvs
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "cvs_shto_own" on public.cvs;
create policy "cvs_shto_own" on public.cvs
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "cvs_perditeso_own" on public.cvs;
create policy "cvs_perditeso_own" on public.cvs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "cvs_fshi_own" on public.cvs;
create policy "cvs_fshi_own" on public.cvs
  for delete to authenticated
  using (user_id = auth.uid());

-- Analizat: përdoruesi sheh vetëm analizat e CV-ve të veta.
drop policy if exists "cv_reviews_lexo_own" on public.cv_reviews;
create policy "cv_reviews_lexo_own" on public.cv_reviews
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "cv_reviews_shto_own" on public.cv_reviews;
create policy "cv_reviews_shto_own" on public.cv_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

-- Lejet për përdoruesit e autentikuar.
grant select, insert, update, delete on public.cvs to authenticated;
grant select, insert on public.cv_reviews to authenticated;

-- Bucket privat për PDF-të e CV-ve (maksimumi 5 MB).
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cv',
  'cv',
  false,
  5242880,
  array['application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf'];

-- Skedarët ruhen në dosjen me ID-në e përdoruesit:
-- cv/{user_id}/{filename}.pdf

drop policy if exists "cv_storage_lexo_own" on storage.objects;
create policy "cv_storage_lexo_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "cv_storage_shto_own" on storage.objects;
create policy "cv_storage_shto_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "cv_storage_perditeso_own" on storage.objects;
create policy "cv_storage_perditeso_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "cv_storage_fshi_own" on storage.objects;
create policy "cv_storage_fshi_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
