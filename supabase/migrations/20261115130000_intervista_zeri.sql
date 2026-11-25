-- Intervista me zë (15.11): sa zë përdor secili, për kufirin ditor të minutave të zërit.
--
-- RENDI: PAS 20261115120000_intervistat.sql (FK te intervistat). Mund të ekzekutohet disa herë.
--
-- Kush shkruan: VETËM Edge Function intervista-zeri (çelësi sekret). App-i s'e lexon dhe s'e shkruan.
-- Privatësia: vetëm numra. Asnjë audio, asnjë transkript, asnjë tekst. Audio s'ruhet askund.

create table if not exists public.intervista_zeri (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  intervista_id   uuid,
  -- "pergjigje" = audio e kandidatit → tekst (+ zëri i pyetjes tjetër); "fol" = vetëm zëri i një pyetjeje
  lloji           text not null check (lloji in ('pergjigje', 'fol')),
  sekonda_stt     numeric(7, 2) not null default 0 check (sekonda_stt between 0 and 600),
  sekonda_tts     numeric(7, 2) not null default 0 check (sekonda_tts between 0 and 600),
  krijuar_me      timestamptz not null default now(),

  foreign key (intervista_id, user_id)
    references public.intervistat(id, user_id)
    on delete set null (intervista_id)
);

create index if not exists intervista_zeri_dita on public.intervista_zeri (user_id, krijuar_me desc);

alter table public.intervista_zeri enable row level security;
revoke all on public.intervista_zeri from anon, authenticated;
-- Pa policy: vetëm çelësi sekret (Edge Functions) e lexon dhe e shkruan.

notify pgrst, 'reload schema';
