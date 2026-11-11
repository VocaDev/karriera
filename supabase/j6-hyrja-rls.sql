-- J6 · 11.11 · Hyrja në llogari dhe Row Level Security.
-- Qëllimi: dy llogari që nuk i shohin të dhënat e njëra-tjetrës.
-- Tri llojet e llogarisë (profiles.lloji):
--   kerkues     lexon punët, ruan me ⭐ punët e veta (privat), nuk poston punë
--   punedhenes  poston punë, sheh, ndryshon dhe fshin vetëm punët e veta
--   qender      si punëdhënësi + numrat e përgjithshëm (vetëm totale, asnjë emër)
-- Ekzekutohet pas supabase/migrations/20261104120000_punet.sql. Mund të ekzekutohet disa herë.


-- ============================================================
-- Hapi A · Mbyllim derën: pa hyrë, askush nuk lexon asgjë.
-- ============================================================
drop policy if exists "punet_shto" on public.punet;  -- policy-ja zhvillim e J5 (anon shtonte punë)
drop policy if exists "punet_lexo" on public.punet;
revoke all on public.punet from anon;


-- ============================================================
-- Profili: një rresht për çdo llogari, me llojin e llogarisë.
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  lloji       text not null default 'kerkues' check (lloji in ('kerkues', 'punedhenes', 'qender')),
  emri        text not null default '' check (char_length(emri) <= 80),
  organizata  text check (char_length(organizata) <= 80),
  gjuha       text not null default 'sq' check (gjuha in ('sq', 'en', 'de')),
  krijuar_me  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Përdoruesi mund ta ndryshojë emrin, organizatën dhe gjuhën, KURRË llojin (vetëm SQL Editor-i).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (emri, organizata, gjuha) on public.profiles to authenticated;

drop policy if exists "profili_lexo" on public.profiles;
create policy "profili_lexo" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profili_ndrysho" on public.profiles;
create policy "profili_ndrysho" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Profili krijohet nga serveri sapo krijohet llogaria. Nga regjistrimi merret vetëm dëshira:
-- "punedhenes" ose, për çdo gjë tjetër, "kerkues". "qender" nuk zgjidhet dot vetë.
create or replace function public.krijo_profilin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, lloji, emri, organizata)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'lloji' = 'punedhenes' then 'punedhenes' else 'kerkues' end,
    coalesce(left(new.raw_user_meta_data ->> 'emri', 80), ''),
    left(nullif(trim(new.raw_user_meta_data ->> 'organizata'), ''), 80)
  );
  return new;
end $$;
revoke execute on function public.krijo_profilin() from public, anon, authenticated;

drop trigger if exists kur_krijohet_llogaria on auth.users;
create trigger kur_krijohet_llogaria
  after insert on auth.users
  for each row execute function public.krijo_profilin();

-- Ndihmësi i policy-ve: cili është lloji im? (lexon vetëm rreshtin tim te profiles)
create or replace function public.lloji_im()
returns text language sql stable set search_path = '' as $$
  select lloji from public.profiles where id = auth.uid()
$$;
revoke execute on function public.lloji_im() from public, anon;
grant execute on function public.lloji_im() to authenticated;


-- ============================================================
-- Hapi C · Punët: çdo punë e re ka pronarin (pronari_id), që e vendos serveri.
-- ============================================================
alter table public.punet
  add column if not exists pronari_id uuid default auth.uid() references auth.users (id) on delete cascade;
-- Rreshtat "seed" mbeten pa pronar: i lexojnë të gjithë, s'i ndryshon askush nga app-i.

-- Lejet e kolonave: nga app-i ndryshohen vetëm fushat e shpalljes, kurrë pronari_id apo burimi.
revoke all on public.punet from authenticated;
grant select, insert, delete on public.punet to authenticated;
grant update (titulli, kompania, qyteti, roli, pershkrimi, aftesite) on public.punet to authenticated;

-- Lexim: kërkuesi i sheh të gjitha punët (për këtë e ka app-in).
-- Punëdhënësi dhe qendra shohin VETËM punët e veta: dy punëdhënës s'ia shohin njëri-tjetrit shpalljet.
create policy "punet_lexo" on public.punet
  for select to authenticated
  using (public.lloji_im() = 'kerkues' or pronari_id = auth.uid());

-- Shtim: vetëm punëdhënësi dhe qendra, dhe vetëm në emrin e vet.
create policy "punet_shto" on public.punet
  for insert to authenticated
  with check (pronari_id = auth.uid() and burimi = 'perdoruesi' and public.lloji_im() in ('punedhenes', 'qender'));

-- Ndryshim dhe fshirje: vetëm punët e mia.
drop policy if exists "punet_ndrysho" on public.punet;
create policy "punet_ndrysho" on public.punet
  for update to authenticated using (pronari_id = auth.uid()) with check (pronari_id = auth.uid());

drop policy if exists "punet_fshi" on public.punet;
create policy "punet_fshi" on public.punet
  for delete to authenticated using (pronari_id = auth.uid());


-- ============================================================
-- ⭐ Punët e ruajtura: private, secili sheh vetëm të vetat.
-- ============================================================
create table if not exists public.punet_e_ruajtura (
  pronari_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  puna_id     text not null references public.punet (id) on delete cascade,
  ruajtur_me  timestamptz not null default now(),
  primary key (pronari_id, puna_id)
);
alter table public.punet_e_ruajtura enable row level security;

revoke all on public.punet_e_ruajtura from anon, authenticated;
grant select, insert, delete on public.punet_e_ruajtura to authenticated;

drop policy if exists "ruajtura_lexo" on public.punet_e_ruajtura;
create policy "ruajtura_lexo" on public.punet_e_ruajtura
  for select to authenticated using (pronari_id = auth.uid());

drop policy if exists "ruajtura_shto" on public.punet_e_ruajtura;
create policy "ruajtura_shto" on public.punet_e_ruajtura
  for insert to authenticated with check (pronari_id = auth.uid() and public.lloji_im() = 'kerkues');

drop policy if exists "ruajtura_fshi" on public.punet_e_ruajtura;
create policy "ruajtura_fshi" on public.punet_e_ruajtura
  for delete to authenticated using (pronari_id = auth.uid());


-- ============================================================
-- Qendra e karrierës: vetëm numrat e përgjithshëm, asnjë rresht personal.
-- security definer = funksioni numëron të gjitha rreshtat, por kthen vetëm totale,
-- dhe vetëm kur e thërret një llogari "qender".
-- ============================================================
create or replace function public.numrat_e_qendres()
returns table (kerkues bigint, punedhenes bigint, punet bigint, ruajtje bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.lloji_im() is distinct from 'qender' then
    raise exception 'Vetëm për qendrën e karrierës' using errcode = '42501';
  end if;
  return query select
    (select count(*) from public.profiles p where p.lloji = 'kerkues'),
    (select count(*) from public.profiles p where p.lloji = 'punedhenes'),
    (select count(*) from public.punet),
    (select count(*) from public.punet_e_ruajtura);
end $$;
revoke execute on function public.numrat_e_qendres() from public, anon;
grant execute on function public.numrat_e_qendres() to authenticated;

-- Si bëhet një llogari "qender" (vetëm këtu, nga SQL Editor-i):
-- update public.profiles set lloji = 'qender', organizata = 'Qendra e Karrierës UMIB'
--   where id = (select id from auth.users where email = '...');

-- ============================================================
-- Realtime: puna e re i shkon kërkuesit menjëherë. Realtime-i zbaton të njëjtin RLS (punet_lexo):
-- vetëm llogaritë e kyçura i marrin ngjarjet, anon asgjë.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'punet'
  ) then
    alter publication supabase_realtime add table public.punet;
  end if;
end $$;

notify pgrst, 'reload schema';
