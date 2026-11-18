-- WP2 · 15.11 · Roli i synuar (SWE / Asistent/PR) dhe gjuha e intervistës te profili.
-- HARTA MVP 18.11: "Llogaria + roli". Roli dhe gjuha i zgjedh kërkuesi vetë (onboarding + Cilësimet),
-- por kurrë lloji i llogarisë. Ekzekutohet pas supabase/j6-hyrja-rls.sql. Mund të ekzekutohet disa herë.
--
-- Gjendja e gjetur live (vetëm lexim, 14.11): profiles.gjuha ka tashmë check ('sq','en','de') dhe të 7 rreshtat
-- janë 'sq'; kolona nuk ka roli_synuar; UPDATE lejohej për (emri, organizata, gjuha).


-- ============================================================
-- 1 · Kolona roli_synuar (null = kërkuesi s'e ka zgjedhur ende → onboarding)
-- ============================================================
alter table public.profiles add column if not exists roli_synuar text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_roli_synuar_check'
  ) then
    alter table public.profiles
      add constraint profiles_roli_synuar_check check (roli_synuar in ('SWE', 'Asistent/PR'));
  end if;

  -- Gjuha: vetëm shqip, anglisht, gjermanisht. Live ekziston (profiles_gjuha_check); e shtojmë vetëm nëse mungon.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_gjuha_check'
  ) then
    alter table public.profiles
      add constraint profiles_gjuha_check check (gjuha in ('sq', 'en', 'de'));
  end if;
end $$;


-- ============================================================
-- 2 · Lejet e kolonave: nga app-i ndryshohen VETËM emri, gjuha dhe roli_synuar.
--     "lloji" (kerkues / punedhenes / qender), "id", "organizata" dhe "krijuar_me" s'ndryshohen kurrë nga app-i.
--     (Para kësaj lejohej edhe "organizata"; asnjë ekran s'e ndryshon, prandaj e heqim.)
-- ============================================================
revoke update on public.profiles from authenticated;
grant update (emri, gjuha, roli_synuar) on public.profiles to authenticated;
-- select mbetet si te J6 (tabela e plotë, por RLS kthen vetëm rreshtin tim): roli_synuar lexohet nga kërkuesi vetë.


-- ============================================================
-- 3 · RLS: ndryshon vetëm rreshti im, dhe roli_synuar ka kuptim vetëm për kërkuesin.
--     Punëdhënësi dhe qendra s'e vendosin dot (with check) edhe pse kolona është e ndryshueshme.
--     "lloji" s'ka leje UPDATE, prandaj lloji i rreshtit të ri = lloji i vjetër; policy-ja mbështetet te kjo.
-- ============================================================
drop policy if exists "profili_ndrysho" on public.profiles;
create policy "profili_ndrysho" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and (roli_synuar is null or lloji = 'kerkues'));


-- ============================================================
-- 4 · Trigger-i i regjistrimit: pranon roli_synuar nga metadata, por vetëm vlerat e lejuara dhe vetëm për kërkuesin
--     (një vlerë tjetër → null, regjistrimi nuk dështon). "lloji" mbetet si te J6: vetëm kerkues ose punedhenes.
-- ============================================================
create or replace function public.krijo_profilin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_lloji text := case when new.raw_user_meta_data ->> 'lloji' = 'punedhenes' then 'punedhenes' else 'kerkues' end;
  v_roli  text := new.raw_user_meta_data ->> 'roli_synuar';
begin
  insert into public.profiles (id, lloji, emri, organizata, roli_synuar)
  values (
    new.id,
    v_lloji,
    coalesce(left(new.raw_user_meta_data ->> 'emri', 80), ''),
    left(nullif(trim(new.raw_user_meta_data ->> 'organizata'), ''), 80),
    case when v_lloji = 'kerkues' and v_roli in ('SWE', 'Asistent/PR') then v_roli end
  );
  return new;
end $$;
revoke execute on function public.krijo_profilin() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Si ta provosh pas ekzekutimit (me një llogari të vërtetë, nga app-i ose me çelësin publishable):
--   1. update public.profiles set roli_synuar = 'SWE' ...            → ok (kerkues)
--   2. update public.profiles set roli_synuar = 'Kuzhinier' ...      → gabim (check)
--   3. update public.profiles set lloji = 'qender' ...               → "permission denied for table profiles"
--   4. punëdhënësi: update ... set roli_synuar = 'SWE'               → "new row violates row-level security policy"
-- ------------------------------------------------------------
