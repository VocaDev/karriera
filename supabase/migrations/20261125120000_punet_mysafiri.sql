-- 25.11 · Mysafiri (guest mode): kush s'ka hyrë e sheh listën e punëve dhe detajet e tyre, pa llogari.
-- Ekzekutohet PAS 20261118100000_punet_e_mia.sql (kolona "private") dhe supabase/j6-hyrja-rls.sql (revoke all nga anon).
-- Mund të ekzekutohet disa herë. NUK është aplikuar ende: Genti e aplikon (SQL Editor) kur e miraton.
--
-- Pse: që nga J6 anon s'ka asnjë grant dhe asnjë policy te public.punet, kështu që mysafiri merr 0 rreshta.
--
-- Çka lejon, dhe asgjë më shumë:
--   1. anon lexon VETËM punët publike aktive: `not private and aktive`. Punët private ("Sill linkun tënd") dhe
--      shpalljet e skaduara s'dalin kurrë. Policy s'thërret lloji_im() (anon s'ka execute mbi të).
--   2. anon lexon VETËM këto kolona (grant i kolonave): pa pronari_id, që kush e postoi një punë të mos dalë
--      jashtë llogarive. App-i (src/lib/punet.ts, FUSHAT_PUBLIKE) kërkon pikërisht këto kolona për mysafirin.
--   3. Asnjë insert / update / delete për anon. ⭐ (punet_e_ruajtura), CV, gatishmeria, intervistat dhe profili mbeten
--      pa asnjë grant për anon (revoke te migrimet e tyre). Edge Functions refuzojnë pa JWT (_shared/thirresi.ts → 401).
--
-- Realtime: app-i s'e dëgjon kanalin e punëve pa llogari (src/app/(tabs)/_layout.tsx, src/app/(tabs)/pune/index.tsx).


-- ============================================================
-- 1. Grant i kolonave (vetëm lexim)
-- ============================================================
revoke all on public.punet from anon;
grant select (
  id, titulli, kompania, qyteti, roli, pershkrimi, aftesite, burimi, krijuar_me,
  linku, portali, afati, aktive, kerkesat, private
) on public.punet to anon;


-- ============================================================
-- 2. RLS: vetëm punët publike aktive
-- ============================================================
-- punet_lexo (20261118100000) mbetet siç është: vetëm për authenticated.
drop policy if exists "punet_lexo_mysafiri" on public.punet;
create policy "punet_lexo_mysafiri" on public.punet
  for select to anon
  using (not private and aktive);

notify pgrst, 'reload schema';


/* ============================================================
   TESTI (SQL Editor, si postgres). Brenda një transaksioni që kthehet mbrapsht: s'mbetet asgjë në bazë.
   Sukses = vetëm NOTICE "OK". Çdo kontroll që dështon ndalon testin me "TESTI DËSHTOI: ...".

begin;

-- Një kërkues test me një punë private, dhe një punë publike joaktive.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000aa', 'test-mysafir@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}');
insert into public.punet (id, titulli, kompania, qyteti, burimi, private, linku, pronari_id)
  values ('00000000-0000-4000-8000-0000000000f9', 'Test Private', 'Test Sh.p.k.', 'Prishtinë', 'perdoruesi', true,
          'https://shembull.com/pune/mysafir', '00000000-0000-4000-8000-0000000000aa');
insert into public.punet (id, titulli, kompania, qyteti, burimi, aktive)
  values ('test-mysafir-joaktive', 'Test Joaktive', 'Test Sh.p.k.', 'Prishtinë', 'seed', false);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$ begin
  if (select count(*) from public.punet where private) <> 0 then raise exception 'TESTI DËSHTOI: anon sheh punë private'; end if;
  if (select count(*) from public.punet where not aktive) <> 0 then raise exception 'TESTI DËSHTOI: anon sheh punë joaktive'; end if;
  if (select count(*) from public.punet where id = '00000000-0000-4000-8000-0000000000f9') <> 0 then raise exception 'TESTI DËSHTOI: anon e gjen punën private me id'; end if;
  raise notice 'OK 1: anon sheh vetëm punët publike aktive (%)', (select count(*) from public.punet);
end $$;

-- pronari_id s'lexohet nga anon.
do $$ begin
  begin
    perform pronari_id from public.punet limit 1;
    raise exception 'TESTI DËSHTOI: anon lexon pronari_id';
  exception when insufficient_privilege then
    raise notice 'OK 2: anon s''e lexon pronari_id';
  end;
end $$;

-- anon s'shton, s'ndryshon, s'fshin.
do $$ begin
  begin
    insert into public.punet (titulli, kompania, qyteti, burimi) values ('X', 'Y', 'Prishtinë', 'perdoruesi');
    raise exception 'TESTI DËSHTOI: anon shtoi një punë';
  exception when insufficient_privilege then
    raise notice 'OK 3: anon s''shton';
  end;
  begin
    update public.punet set titulli = 'X';
    raise exception 'TESTI DËSHTOI: anon ndryshoi';
  exception when insufficient_privilege then
    raise notice 'OK 4: anon s''ndryshon';
  end;
  begin
    delete from public.punet;
    raise exception 'TESTI DËSHTOI: anon fshiu';
  exception when insufficient_privilege then
    raise notice 'OK 5: anon s''fshin';
  end;
end $$;

-- Të dhënat personale mbeten të mbyllura për anon.
do $$ begin
  begin
    perform 1 from public.punet_e_ruajtura limit 1;
    raise exception 'TESTI DËSHTOI: anon lexon punet_e_ruajtura';
  exception when insufficient_privilege then
    raise notice 'OK 6: anon s''lexon ⭐';
  end;
  begin
    perform 1 from public.profiles limit 1;
    raise exception 'TESTI DËSHTOI: anon lexon profiles';
  exception when insufficient_privilege then
    raise notice 'OK 7: anon s''lexon profilet';
  end;
end $$;

rollback;
*/
