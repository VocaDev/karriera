-- "A jam gati?" (WP3, 15.11): sa gati është kërkuesi për një punë konkrete (HARTA).
--
-- RENDI: ekzekutohet PAS 20261104120000_punet.sql dhe 20261111000000_cv.sql (përdor punet dhe cvs).
-- Mund të ekzekutohet disa herë.
--
-- Kush shkruan çka:
--   gatishmeria     VETËM Edge Functions (çelësi sekret): `gati` shkruan burimi = 'cv',
--                   intervista (WP4) shkruan burimi = 'intervista'. App-i vetëm lexon rreshtat e vet.
--   gati_thirrjet   VETËM Edge Function `gati`: kufiri ditor i AI-së. App-i s'e sheh.
--                   (cv_ai_thirrjet lejon vetëm 'cv-review' / 'cv-create', prandaj kufiri i `gati` jeton këtu.)


-- ============================================================
-- Gatishmëria: një rresht për çdo llogaritje (historia mbetet; app-i lexon më të renë për punën).
-- ============================================================
create table if not exists public.gatishmeria (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  puna_id         text not null references public.punet(id) on delete cascade,  -- punet.id është TEXT
  cv_id           uuid references public.cvs(id) on delete set null,
  burimi          text not null check (burimi in ('cv', 'intervista')),
  intervista_id   uuid,                  -- WP4 e shton FK-në te intervistat në migrimin e vet
  perqindja       int not null check (perqindja between 0 and 100),
  ke              jsonb not null default '[]',  -- [{ "aftesia": text, "deshmia": text }]
  mungon          jsonb not null default '[]',  -- [{ "aftesia": text, "pse": text, "si": text }]
  hapat           jsonb not null default '[]',  -- [text], 1–3 hapa konkretë
  arsyeja         text not null,                -- pse ky numër, 1–2 fjali
  modeli          text not null,
  krijuar_me      timestamptz not null default now()
);

create index if not exists gatishmeria_e_fundit
  on public.gatishmeria (user_id, puna_id, krijuar_me desc);

alter table public.gatishmeria enable row level security;

-- Telefoni vetëm lexon. Përqindja s'shkruhet nga app-i: përndryshe kushdo do ta vendoste vetë "100%".
revoke all on public.gatishmeria from anon, authenticated;
grant select on public.gatishmeria to authenticated;

drop policy if exists "gatishmeria_lexo_own" on public.gatishmeria;
create policy "gatishmeria_lexo_own" on public.gatishmeria
  for select to authenticated
  using (user_id = auth.uid());


-- ============================================================
-- Kufiri ditor i `gati`: një rresht për çdo thirrje të AI-së (edhe kur dështon).
-- RLS pa asnjë policy dhe pa grant = app-i s'lexon e s'shkruan asgjë këtu.
-- ============================================================
create table if not exists public.gati_thirrjet (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  krijuar_me      timestamptz not null default now()
);

create index if not exists gati_thirrjet_dita on public.gati_thirrjet (user_id, krijuar_me desc);

alter table public.gati_thirrjet enable row level security;
revoke all on public.gati_thirrjet from anon, authenticated;

notify pgrst, 'reload schema';
