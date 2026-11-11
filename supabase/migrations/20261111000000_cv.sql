-- CV-ja dhe analizat e saj (Edoniku; rregulluar pas review-së, 11.11).
-- Të dhënat janë private: çdo kërkues sheh dhe menaxhon vetëm CV-të e veta.
--
-- RENDI: ekzekutohet PAS supabase/j6-hyrja-rls.sql, sepse përdor public.lloji_im() dhe public.profiles.
-- Mund të ekzekutohet disa herë.
--
-- Kush shkruan çka:
--   cvs              app-i (kërkuesi) shton dhe fshin rreshtat e vet; versioni dhe pronari i vendos serveri
--   cv_reviews       VETËM Edge Function `cv-review` (çelësi sekret); app-i vetëm lexon
--   cv_ai_thirrjet   VETËM Edge Functions; numëron thirrjet e AI-së për kufirin ditor; app-i s'e sheh
--   storage "cv"     app-i ngarkon PDF-në te dosja {user_id}/; lexon dhe fshin vetëm të vetat


-- ============================================================
-- CV-të
-- ============================================================
create table if not exists public.cvs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  burimi          text not null check (burimi in ('ngarkuar', 'krijuar')),
  emri_skedarit   text check (char_length(emri_skedarit) <= 150),
  storage_path    text,
  versioni        integer not null default 1 check (versioni >= 1),
  formati         text not null default 'ks'
                  check (formati in ('ks', 'europass', 'eu', 'us', 'uk', 'ats')),
  gjuha           text not null default 'sq'
                  check (gjuha in ('sq', 'en')),
  permbajtja      jsonb,
  krijuar_me      timestamptz not null default now(),

  unique (id, user_id),
  -- PDF-ja e ngarkuar jeton vetëm në dosjen e pronarit; CV-ja e krijuar ka përmbajtjen si JSON.
  constraint cvs_burimi_i_plote check (
    (burimi = 'ngarkuar' and storage_path is not null and emri_skedarit is not null
       and storage_path like (user_id::text || '/%'))
    or (burimi = 'krijuar' and permbajtja is not null)
  )
);

-- Versioni: v1, v2, … për secilin përdorues. E llogarit serveri, jo app-i.
create or replace function public.cvs_versioni_tjeter()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.versioni := coalesce(
    (select max(c.versioni) from public.cvs c where c.user_id = new.user_id), 0
  ) + 1;
  return new;
end $$;

drop trigger if exists cvs_versioni on public.cvs;
create trigger cvs_versioni
  before insert on public.cvs
  for each row execute function public.cvs_versioni_tjeter();

alter table public.cvs enable row level security;

revoke all on public.cvs from anon, authenticated;
-- Pa update: çdo ndryshim është version i ri. user_id dhe versioni i vendos serveri.
grant select, delete on public.cvs to authenticated;
grant insert (burimi, emri_skedarit, storage_path, formati, gjuha, permbajtja) on public.cvs to authenticated;

drop policy if exists "cvs_lexo_own" on public.cvs;
create policy "cvs_lexo_own" on public.cvs
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "cvs_shto_own" on public.cvs;
create policy "cvs_shto_own" on public.cvs
  for insert to authenticated
  with check (user_id = auth.uid() and public.lloji_im() = 'kerkues');

drop policy if exists "cvs_perditeso_own" on public.cvs; -- version i vjetër i këtij file-i

drop policy if exists "cvs_fshi_own" on public.cvs;
create policy "cvs_fshi_own" on public.cvs
  for delete to authenticated
  using (user_id = auth.uid());


-- ============================================================
-- Analizat: i shkruan vetëm cv-review (çelësi sekret anashkalon RLS-in). App-i vetëm lexon.
-- ============================================================
create table if not exists public.cv_reviews (
  id              uuid primary key default gen_random_uuid(),
  cv_id           uuid not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  nota            integer not null check (nota between 0 and 100),
  analiza         jsonb not null,
  modeli          text,
  krijuar_me      timestamptz not null default now(),

  -- Analiza i përket gjithmonë CV-së së të njëjtit përdorues.
  foreign key (cv_id, user_id)
    references public.cvs(id, user_id)
    on delete cascade
);

create index if not exists cv_reviews_cv_id on public.cv_reviews (cv_id, krijuar_me desc);

alter table public.cv_reviews enable row level security;

revoke all on public.cv_reviews from anon, authenticated;
grant select on public.cv_reviews to authenticated;

drop policy if exists "cv_reviews_lexo_own" on public.cv_reviews;
create policy "cv_reviews_lexo_own" on public.cv_reviews
  for select to authenticated
  using (user_id = auth.uid());

-- Nota nuk shkruhet nga telefoni: përndryshe kushdo do ta vendoste vetë notën e vet.
drop policy if exists "cv_reviews_shto_own" on public.cv_reviews;


-- ============================================================
-- Kufiri ditor i AI-së: një rresht për çdo thirrje. Vetëm Edge Functions (çelësi sekret).
-- RLS pa asnjë policy = app-i s'lexon e s'shkruan asgjë këtu.
-- ============================================================
create table if not exists public.cv_ai_thirrjet (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  funksioni       text not null check (funksioni in ('cv-review', 'cv-create')),
  krijuar_me      timestamptz not null default now()
);

create index if not exists cv_ai_thirrjet_dita on public.cv_ai_thirrjet (user_id, funksioni, krijuar_me desc);

alter table public.cv_ai_thirrjet enable row level security;
revoke all on public.cv_ai_thirrjet from anon, authenticated;


-- ============================================================
-- Storage: bucket privat për PDF-të (maksimumi 5 MB, vetëm PDF).
-- Skedarët: cv/{user_id}/{uuid}.pdf
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv', 'cv', false, 5242880, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf'];

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
    and public.lloji_im() = 'kerkues'
  );

-- Pa mbishkrim: çdo ngarkim është skedar i ri (version i ri).
drop policy if exists "cv_storage_perditeso_own" on storage.objects;

drop policy if exists "cv_storage_fshi_own" on storage.objects;
create policy "cv_storage_fshi_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
