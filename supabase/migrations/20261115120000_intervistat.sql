-- Intervista me tekst (WP4, 15.11): HARTA AI 02.12, "intervistë me tekst me output të strukturuar".
--
-- RENDI: ekzekutohet PAS 20261104120000_punet.sql, 20261111000000_cv.sql dhe
-- 20261115110000_gatishmeria.sql (WP3), sepse shton FK-në gatishmeria.intervista_id → intervistat.
-- Mund të ekzekutohet disa herë.
--
-- Kush shkruan çka:
--   intervistat          VETËM Edge Functions intervista-nis / -kthesa / -raporti (çelësi sekret)
--   intervista_kthesat   VETËM Edge Functions; app-i vetëm lexon rreshtat e vet
--   gatishmeria          intervista-raporti shton një rresht me burimi = 'intervista' (tabela e WP3)
--
-- Privatësia: pyetjet dhe përgjigjet janë të dhëna personale. Asnjë funksion s'i shkruan në log.
-- Zëri dhe video (më vonë, 09.12) nuk ruhen kurrë: vetëm teksti, notat dhe feedback-u.


-- ============================================================
-- Intervistat: një rresht për çdo intervistë praktike për një punë konkrete.
-- ============================================================
create table if not exists public.intervistat (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  puna_id         text references public.punet(id) on delete set null,   -- punet.id është TEXT
  cv_id           uuid references public.cvs(id) on delete set null,
  gjuha           text not null check (gjuha in ('sq', 'en', 'de')),
  roli            text not null check (roli in ('SWE', 'Asistent/PR', 'Tjetër')),
  gjatesia        text not null default 'shkurter' check (gjatesia in ('shkurter', 'plote')),
  -- aktive → mbaroi (pyetjet mbaruan) → po_vleresohet (raporti po shkruhet) → perfunduar
  gjendja         text not null default 'aktive'
                  check (gjendja in ('aktive', 'mbaroi', 'po_vleresohet', 'perfunduar')),
  nr_pyetjeve     int not null default 0 check (nr_pyetjeve between 0 and 20),  -- pyetjet kryesore (pa vazhdimet)
  -- Puna dhe një përmbledhje e CV-së (pa emër, email, telefon), ngrirë në nisje. App-i s'e lexon.
  konteksti       jsonb not null default '{}',
  nota            int check (nota between 0 and 100),
  raporti         jsonb,
  perpunim_nga    timestamptz,       -- "qiraja" e raportit: kundër dy raporteve njëherësh
  krijuar_me      timestamptz not null default now(),
  perfunduar_me   timestamptz,

  unique (id, user_id)
);

create index if not exists intervistat_e_mia on public.intervistat (user_id, krijuar_me desc);
create index if not exists intervistat_per_pune on public.intervistat (user_id, puna_id, krijuar_me desc);


-- ============================================================
-- Kthesat: një rresht për çdo pyetje (edhe pyetjet vazhduese), me përgjigjen dhe vlerësimin e saj.
-- ============================================================
create table if not exists public.intervista_kthesat (
  id              uuid primary key default gen_random_uuid(),
  intervista_id   uuid not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  nr              int not null check (nr between 1 and 40),
  lloji           text not null check (lloji in ('pyetje', 'vazhdim')),
  reagimi         text check (char_length(reagimi) <= 600),     -- reagimi i shkurtër para pyetjes
  pyetja          text not null check (char_length(pyetja) between 1 and 1000),
  pergjigja       text check (char_length(pergjigja) <= 4000),
  vleresimi       jsonb,                                         -- { mire, permireso, shembull }
  perpunim_nga    timestamptz,                                   -- "qiraja" e kthesës: kundër dërgimit të dyfishtë
  pergjigjur_me   timestamptz,
  krijuar_me      timestamptz not null default now(),

  unique (intervista_id, nr),
  -- Kthesa i përket gjithmonë intervistës së të njëjtit përdorues.
  foreign key (intervista_id, user_id)
    references public.intervistat(id, user_id)
    on delete cascade
);


-- ============================================================
-- RLS: secili lexon vetëm të vetat. Asnjë insert / update / delete nga app-i:
-- pyetjet, nota dhe raporti i shkruajnë vetëm funksionet (përndryshe kushdo do ta vendoste vetë notën).
-- ============================================================
alter table public.intervistat enable row level security;
alter table public.intervista_kthesat enable row level security;

revoke all on public.intervistat from anon, authenticated;
revoke all on public.intervista_kthesat from anon, authenticated;

-- Lejet e kolonave: konteksti (përmbledhja e CV-së për AI-në) dhe qiratë s'dalin te app-i.
grant select (id, puna_id, cv_id, gjuha, roli, gjatesia, gjendja, nr_pyetjeve, nota, raporti, krijuar_me, perfunduar_me)
  on public.intervistat to authenticated;
grant select (id, intervista_id, nr, lloji, reagimi, pyetja, pergjigja, vleresimi, pergjigjur_me, krijuar_me)
  on public.intervista_kthesat to authenticated;

drop policy if exists "intervistat_lexo_own" on public.intervistat;
create policy "intervistat_lexo_own" on public.intervistat
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "intervista_kthesat_lexo_own" on public.intervista_kthesat;
create policy "intervista_kthesat_lexo_own" on public.intervista_kthesat
  for select to authenticated
  using (user_id = auth.uid());


-- ============================================================
-- Lidhja me gatishmërinë (tabela e WP3): rreshti me burimi = 'intervista' tregon cilën intervistë.
-- FK e përbërë: rreshti mund të lidhet vetëm me një intervistë të të njëjtit përdorues.
-- Kur fshihet intervista, gatishmëria mbetet (historia), vetëm intervista_id bëhet null.
-- ============================================================
do $$
begin
  if to_regclass('public.gatishmeria') is null then
    raise exception 'Mungon public.gatishmeria: ekzekuto më parë 20261115110000_gatishmeria.sql (WP3).';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.gatishmeria'::regclass and conname = 'gatishmeria_intervista_fk'
  ) then
    alter table public.gatishmeria
      add constraint gatishmeria_intervista_fk
      foreign key (intervista_id, user_id)
      references public.intervistat(id, user_id)
      on delete set null (intervista_id);
  end if;
end $$;

create index if not exists gatishmeria_intervista on public.gatishmeria (intervista_id) where intervista_id is not null;

notify pgrst, 'reload schema';
