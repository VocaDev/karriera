-- 18.11 · J7 · "Sill linkun tënd": kërkuesi ngjit linkun e një shpalljeje që e gjeti diku tjetër dhe ajo bëhet
-- një punë PRIVATE: e sheh vetëm ai, dhe e përdor për "A jam gati?" dhe intervistën.
-- Ekzekutohet PAS 20261114120000_punet_portalet.sql dhe 20261115140000_punet_kerkesat.sql. Mund të ekzekutohet disa herë.
-- NUK është aplikuar ende (18.11): pret OK-në e Gentit. Testi me dy llogari është në fund (i komentuar).
--
-- Çka ndryshon:
--   1. punet.private (boolean). true = punë e shtuar nga kërkuesi me link: e lexon VETËM pronari.
--   2. Rregullat e një rreshti privat: burimi "perdoruesi", ka pronar, linku https me emër domeni (jo IP, jo localhost),
--      pa kërkesat e AI-së. Teksti i shpalljes që e ngjit vetë përdoruesi (i tiji, privat) lejohet deri 4000 shkronja
--      (aq sa lexon "gati"); te rreshtat e tjerë kufiri mbetet 1000.
--   3. RLS: kërkuesi shton vetëm punë private në emrin e vet; leximi i kërkuesit s'i përfshin më punët private të të tjerëve.
--      Punëdhënësi dhe qendra s'mund të shtojnë punë private. Fshirja dhe ndryshimi mbeten "vetëm të miat" (J6).
--   4. Një link një herë për llogari (indeks unik), dhe maksimumi 50 punë private për llogari.
--   5. ⭐ ruhet vetëm një punë që e sheh (mos të ruhet me id një punë private e dikujt tjetër).
--   6. punet_portali_vlera_check: kontrolli i vlerës së "portali" që ra gabimisht te 20261114120000
--      (kontrolli inline mori emrin automatik punet_portali_check, pastaj u zëvendësua nga rregulli mes fushave).
--
-- Copyright: teksti i portaleve s'ruhet kurrë (MODELI.md). Këtu ruhet vetëm teksti që përdoruesi e ngjit vetë,
-- te një rresht që e lexon vetëm ai.


-- ============================================================
-- 1. Kolona
-- ============================================================
alter table public.punet
  add column if not exists private boolean not null default false;


-- ============================================================
-- 2. Rregullat e rreshtit privat
-- ============================================================
alter table public.punet drop constraint if exists punet_private_check;
alter table public.punet
  add constraint punet_private_check check (
    not private
    or (
      burimi = 'perdoruesi'
      and pronari_id is not null
      and kerkesat is null
      -- https://emer.domen[:port][/...]: emri mbaron me një TLD me shkronja (ose xn--), kështu që IP-të dhe localhost s'kalojnë.
      -- Pa "@" (s'ka user:pass@host) dhe pa hapësira.
      and linku ~* '^https://[a-z0-9-]+(\.[a-z0-9-]+)*\.([a-z]{2,63}|xn--[a-z0-9-]{1,59})(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    )
  );

-- Përshkrimi: 1000 si më parë, 4000 te punët private (teksti i shpalljes i ngjitur nga vetë përdoruesi).
-- Kontrolli i vjetër është inline (emri automatik, zakonisht punet_pershkrimi_check): e gjejmë sipas përkufizimit.
do $$
declare
  emri text;
begin
  for emri in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.punet'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~ 'char_length\(pershkrimi\) <= 1000'
      and pg_get_constraintdef(c.oid) !~ 'private'
  loop
    execute format('alter table public.punet drop constraint %I', emri);
  end loop;
end $$;

alter table public.punet drop constraint if exists punet_pershkrimi_gjatesia_check;
alter table public.punet
  add constraint punet_pershkrimi_gjatesia_check check (
    char_length(pershkrimi) <= case when private then 4000 else 1000 end
  );


-- ============================================================
-- 3. RLS
-- ============================================================
-- Lexim: kërkuesi sheh punët jo-private (portal, seed, punëdhënës) + punët e veta. Punëdhënësi/qendra: vetëm të vetat.
drop policy if exists "punet_lexo" on public.punet;
create policy "punet_lexo" on public.punet
  for select to authenticated
  using ((public.lloji_im() = 'kerkues' and not private) or pronari_id = auth.uid());

-- Shtim nga punëdhënësi/qendra: si në J6, por kurrë privat.
drop policy if exists "punet_shto" on public.punet;
create policy "punet_shto" on public.punet
  for insert to authenticated
  with check (
    pronari_id = auth.uid() and burimi = 'perdoruesi' and not private
    and public.lloji_im() in ('punedhenes', 'qender')
  );

-- Shtim nga kërkuesi: vetëm punë private, në emrin e vet, me link https.
-- (Pjesa tjetër e rregullave të rreshtit, p.sh. domeni i linkut, është te punet_private_check.)
-- id-ja: vetëm në formën e UUID-së (default gen_random_uuid(); app-i s'e dërgon). Rreshtat "portal" kanë id të
-- parashikueshme ("kosovajob-123") dhe importi bën upsert sipas id-së: një rresht privat me atë id do ta thyente importin.
drop policy if exists "punet_shto_private" on public.punet;
create policy "punet_shto_private" on public.punet
  for insert to authenticated
  with check (
    pronari_id = auth.uid() and burimi = 'perdoruesi' and private
    and id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and linku is not null and linku ~ '^https://'
    and public.lloji_im() = 'kerkues'
  );

-- punet_ndrysho dhe punet_fshi (J6) mbeten: vetëm pronari_id = auth.uid(). Kërkuesi fshin (ose ndryshon fushat e lejuara te)
-- vetëm punët e veta private; s'prek dot asnjë rresht tjetër. Lejet e kolonave mbeten si në J6:
-- "private" s'është te grant update, kështu që një punë s'bëhet dot publike/private pas shtimit.


-- ============================================================
-- 4. Një link një herë për llogari + kufiri
-- ============================================================
-- App-i e ruan linkun në formën kanonike (src/lib/punet.ts, kontrolloLinkun): e njëjta shpallje = i njëjti tekst.
create unique index if not exists punet_private_linku_uq
  on public.punet (pronari_id, linku) where private;

-- Kufiri: 50 punë private për llogari (mbron bazën nga mbushja). security invoker: numëron me RLS-in e thirrësit,
-- dhe pronari i sheh të gjitha punët e veta private.
create or replace function public.kufiri_punet_private()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.private and (
    select count(*) from public.punet p where p.pronari_id = new.pronari_id and p.private
  ) >= 50 then
    raise exception 'Ke arritur kufirin: 50 punë të shtuara me link. Fshi disa që s''të duhen më.'
      using errcode = 'P0001', hint = 'kufiri_private';
  end if;
  return new;
end $$;
revoke execute on function public.kufiri_punet_private() from public, anon, authenticated;

drop trigger if exists punet_kufiri_private on public.punet;
create trigger punet_kufiri_private
  before insert on public.punet
  for each row when (new.private)
  execute function public.kufiri_punet_private();


-- ============================================================
-- 5. ⭐ vetëm për punë që i sheh
-- ============================================================
-- Nënpyetja ekzekutohet me RLS-in e thirrësit: një punë private e dikujt tjetër s'ekziston për të.
drop policy if exists "ruajtura_shto" on public.punet_e_ruajtura;
create policy "ruajtura_shto" on public.punet_e_ruajtura
  for insert to authenticated
  with check (
    pronari_id = auth.uid() and public.lloji_im() = 'kerkues'
    and exists (select 1 from public.punet p where p.id = puna_id)
  );


-- ============================================================
-- 6. Vlera e "portali"
-- ============================================================
alter table public.punet drop constraint if exists punet_portali_vlera_check;
alter table public.punet
  add constraint punet_portali_vlera_check
  check (portali is null or portali in ('kosovajob', 'portalpune', 'ofertapune')) not valid;
alter table public.punet validate constraint punet_portali_vlera_check;

notify pgrst, 'reload schema';


/* ============================================================
   TESTI ME DY LLOGARI (SQL Editor, si postgres). Gjithçka brenda një transaksioni që kthehet mbrapsht (rollback):
   s'mbetet asgjë në bazë. Çdo kontroll që dështon ndalon testin me "TESTI DËSHTOI: ...". Sukses = vetëm NOTICE "OK".

begin;

-- Dy kërkues test (trigger-i krijo_profilin u krijon profilin "kerkues"). roli_synuar, nëse kolona ekziston, s'ka rëndësi këtu.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}');

set local role authenticated;

-- A: shton një punë private dhe e sheh.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
insert into public.punet (id, titulli, kompania, qyteti, burimi, private, linku)
  values ('00000000-0000-4000-8000-0000000000f1', 'Test Developer', 'Test Sh.p.k.', 'Prishtinë', 'perdoruesi', true, 'https://shembull.com/pune/1');
do $$ begin
  if (select count(*) from public.punet where id = '00000000-0000-4000-8000-0000000000f1') <> 1 then raise exception 'TESTI DËSHTOI: A s''e sheh punën e vet'; end if;
  raise notice 'OK 1: A e sheh punën e vet private';
end $$;

-- A: i njëjti link s'shtohet dy herë.
do $$ begin
  insert into public.punet (titulli, kompania, qyteti, burimi, private, linku)
    values ('Test Developer', 'Test Sh.p.k.', 'Prishtinë', 'perdoruesi', true, 'https://shembull.com/pune/1');
  raise exception 'TESTI DËSHTOI: linku u shtua dy herë';
exception when unique_violation then raise notice 'OK 2: linku i dyfishtë refuzohet';
end $$;

-- A: link me IP / http refuzohet.
do $$ begin
  insert into public.punet (titulli, kompania, qyteti, burimi, private, linku)
    values ('Test Developer', 'Test Sh.p.k.', 'Prishtinë', 'perdoruesi', true, 'https://127.0.0.1/admin');
  raise exception 'TESTI DËSHTOI: linku me IP u pranua';
exception when check_violation then raise notice 'OK 3: linku me IP refuzohet';
end $$;

-- A: s'mund ta zërë id-në e një shpalljeje të portalit (importi bën upsert sipas id-së).
do $$ begin
  insert into public.punet (id, titulli, kompania, qyteti, burimi, private, linku)
    values ('kosovajob-999999', 'Test Developer', 'Test Sh.p.k.', 'Prishtinë', 'perdoruesi', true, 'https://shembull.com/pune/9');
  raise exception 'TESTI DËSHTOI: kërkuesi zgjodhi një id portali';
exception when insufficient_privilege then raise notice 'OK 3b: id e portalit refuzohet';
end $$;

-- B: s'e sheh, s'e fshin, s'e ndryshon, s'e ruan me ⭐, s'shton në emër të A-së, s'shton punë publike.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
do $$
declare n int;
begin
  if (select count(*) from public.punet where id = '00000000-0000-4000-8000-0000000000f1') <> 0 then raise exception 'TESTI DËSHTOI: B e sheh punën private të A-së'; end if;
  if (select count(*) from public.punet where not private) = 0 then raise exception 'TESTI DËSHTOI: B s''sheh asnjë punë publike'; end if;
  raise notice 'OK 4: B s''e sheh punën private të A-së, por i sheh punët publike';

  delete from public.punet where id = '00000000-0000-4000-8000-0000000000f1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TESTI DËSHTOI: B e fshiu punën e A-së'; end if;
  update public.punet set titulli = 'E ndryshuar nga B' where id = '00000000-0000-4000-8000-0000000000f1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TESTI DËSHTOI: B e ndryshoi punën e A-së'; end if;
  raise notice 'OK 5: B s''e fshin dhe s''e ndryshon';

  begin
    insert into public.punet_e_ruajtura (puna_id) values ('00000000-0000-4000-8000-0000000000f1');
    raise exception 'TESTI DËSHTOI: B e ruajti me ⭐ punën private të A-së';
  exception when insufficient_privilege then raise notice 'OK 6: B s''e ruan me ⭐';
  end;

  begin
    insert into public.punet (titulli, kompania, qyteti, burimi, private, linku, pronari_id)
      values ('Test Developer', 'Test Sh.p.k.', 'Prishtinë', 'perdoruesi', true, 'https://shembull.com/pune/2',
              '00000000-0000-4000-8000-00000000000a');
    raise exception 'TESTI DËSHTOI: B shtoi një punë në emër të A-së';
  exception when insufficient_privilege then raise notice 'OK 7: B s''shton në emër të A-së';
  end;

  begin
    insert into public.punet (titulli, kompania, qyteti, burimi, private, linku)
      values ('Test Developer', 'Test Sh.p.k.', 'Prishtinë', 'perdoruesi', false, 'https://shembull.com/pune/3');
    raise exception 'TESTI DËSHTOI: kërkuesi shtoi një punë publike';
  exception when insufficient_privilege then raise notice 'OK 8: kërkuesi s''shton punë publike';
  end;
end $$;

-- A: e fshin punën e vet.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int;
begin
  delete from public.punet where id = '00000000-0000-4000-8000-0000000000f1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TESTI DËSHTOI: A s''e fshiu punën e vet'; end if;
  raise notice 'OK 9: A e fshin punën e vet private';
end $$;

reset role;
rollback;
*/
