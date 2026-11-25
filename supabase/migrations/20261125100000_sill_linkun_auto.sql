-- 25.11 · "Sill linkun tënd" e lexon vetë shpalljen (Edge Function lexo-linkun).
-- Ekzekutohet PAS 20261118100000_punet_e_mia.sql. Mund të ekzekutohet disa herë.
-- NUK është aplikuar ende: pret OK-në e Gentit (bashkë me deploy-in e lexo-linkun).
--
-- Çka ndryshon:
--   1. cv_ai_thirrjet pranon funksionin "lexo-linkun": kufiri ditor i leximit të linqeve (20 në 24 orë) numërohet aty.
--      Pa këtë, lexo-linkun kthen 503 dhe app-i vazhdon me fushat me dorë (s'prishet asgjë).
--   2. Një punë private mund të ketë "kerkesat" (forma e portalet, nxjerrë nga lexo-linkun). Më parë punet_private_check
--      e ndalonte (kerkesat is null). Rregullat e tjera të rreshtit privat mbeten të njëjtat.
--
-- Siguria: asnjë ndryshim i RLS-it. Kërkuesi shton vetëm punë private në emrin e vet (punet_shto_private) dhe e lexon
-- vetëm ai (punet_lexo), kështu që "kerkesat" e një pune private s'i sheh askush tjetër. Vlera vjen nga app-i, prandaj
-- kufizohet si te çdo rresht tjetër (punet_kerkesat_check: objekt ≤ 8 KB), app-i e lexon me lexoKerkesat dhe "gati"
-- me kerkesatPerModel (vetëm tekste, me kufij). Update-i i kolonës s'lejohet nga app-i (s'është te grant update i J6).
-- Copyright: "kerkesat" janë faktet me fjalët tona, si te portalet; teksti i faqes s'ruhet.


-- ============================================================
-- 1. Kufiri ditor i lexo-linkun
-- ============================================================
-- Kontrolli inline i 20261111000000 mori emrin automatik (zakonisht cv_ai_thirrjet_funksioni_check): e gjejmë sipas përkufizimit.
do $$
declare
  emri text;
begin
  for emri in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.cv_ai_thirrjet'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~ 'funksioni'
  loop
    execute format('alter table public.cv_ai_thirrjet drop constraint %I', emri);
  end loop;
end $$;

alter table public.cv_ai_thirrjet
  add constraint cv_ai_thirrjet_funksioni_check
  check (funksioni in ('cv-review', 'cv-create', 'lexo-linkun'));


-- ============================================================
-- 2. Kërkesat te punët private
-- ============================================================
alter table public.punet drop constraint if exists punet_private_check;
alter table public.punet
  add constraint punet_private_check check (
    not private
    or (
      burimi = 'perdoruesi'
      and pronari_id is not null
      and linku is not null -- pa këtë, NULL ~ '...' jep NULL dhe check-u kalon
      and linku ~* '^https://[a-z0-9-]+(\.[a-z0-9-]+)*\.([a-z]{2,63}|xn--[a-z0-9-]{1,59})(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    )
  );

notify pgrst, 'reload schema';


/* ============================================================
   PROVA (SQL Editor, si postgres; rollback në fund, s'mbetet asgjë)

begin;
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}');
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
insert into public.punet (id, titulli, kompania, qyteti, burimi, private, linku, kerkesat, aftesite)
  values ('00000000-0000-4000-8000-0000000000f1', 'Test Developer', 'Test Sh.p.k.', 'Prishtinë', 'perdoruesi', true,
          'https://shembull.com/pune/1', '{"permbledhja":"Punë prove.","kerkesat":["React"]}', '{React}');
do $$ begin
  if (select kerkesat->>'permbledhja' from public.punet where id = '00000000-0000-4000-8000-0000000000f1') is distinct from 'Punë prove.'
    then raise exception 'TESTI DËSHTOI: kerkesat s''u ruajt'; end if;
  raise notice 'OK 1: puna private ruhet me kerkesat';
end $$;
do $$ begin
  insert into public.punet (titulli, kompania, qyteti, burimi, private, linku, kerkesat)
    values ('Test Developer', 'Test Sh.p.k.', 'Prishtinë', 'perdoruesi', true, 'https://shembull.com/pune/2', '"jo objekt"');
  raise exception 'TESTI DËSHTOI: kerkesat jo-objekt u pranua';
exception when check_violation then raise notice 'OK 2: kerkesat jo-objekt refuzohet';
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.punet where id = '00000000-0000-4000-8000-0000000000f1') <> 0
    then raise exception 'TESTI DËSHTOI: B e sheh punën private të A-së'; end if;
  raise notice 'OK 3: B s''e sheh';
end $$;

reset role;
insert into public.cv_ai_thirrjet (user_id, funksioni) values ('00000000-0000-4000-8000-00000000000a', 'lexo-linkun');
do $$ begin
  insert into public.cv_ai_thirrjet (user_id, funksioni) values ('00000000-0000-4000-8000-00000000000a', 'tjeter');
  raise exception 'TESTI DËSHTOI: funksion i panjohur u pranua';
exception when check_violation then raise notice 'OK 4: cv_ai_thirrjet pranon lexo-linkun, jo të tjerë';
end $$;
rollback;
*/
