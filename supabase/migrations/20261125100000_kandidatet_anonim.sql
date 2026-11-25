-- 25.11 · Punëdhënësi sheh "Më të mirët" për punët e veta: kandidatë anonimë, të renditur sipas "A jam gati?".
-- Bordi, rreshti 8 (ekranet 59, 61, 62, 63): "Kandidati #A7", përqindja, çka ka dhe çka i mungon, intervista.
--
-- RENDI: ekzekutohet PAS 20261115110000_gatishmeria.sql, 20261115120000_intervistat.sql dhe
-- 20261118100000_punet_e_mia.sql (përdor gatishmeria, intervistat, punet.private). Varet edhe nga
-- supabase/j6-hyrja-rls.sql: profiles, lloji_im(), punet.pronari_id, punet_e_ruajtura.
-- Mund të ekzekutohet disa herë. NUK është aplikuar live: e aplikon Genti.
--
-- Privatësia (CV-ja dhe gatishmëria janë të dhëna personale), e zbatuar këtu në bazë, jo në app:
--   1. Pëlqimi: kërkuesi shfaqet VETËM nëse e ka ndezur vetë "Lejo punëdhënësit të më shohin anonimisht"
--      (public.dukshmeria.anonim = true). Pa rresht = i padukshëm (i fikur si parazgjedhje).
--   2. Anonim: punëdhënësi s'ka asnjë grant mbi gatishmeria / intervistat / profiles të të tjerëve (RLS: vetëm të vetat).
--      I vetmi rrugë është funksioni kandidatet_anonim(), që kthen vetëm: një etiketë ("Kandidati #K27"), një kod të
--      paqartë (md5 i punëdhënësit + kandidatit: i njëjti kandidat ka kod tjetër te çdo punëdhënës), përqindjen,
--      EMRAT e aftësive (pa "deshmia", pa "arsyeja": ato citojnë CV-në), datën dhe notën e intervistës praktike.
--      Kurrë user_id, emër, email, CV, tekst të CV-së apo përgjigje të intervistës.
--   3. Vetëm punët e mia: rreshtat vijnë vetëm për punë me pronari_id = auth.uid(); vetëm llogaria "punedhenes".
--   4. "Kur jam gati": vetëm kontrolli i fundit i kandidatit për atë punë, nëse është ≥ 60% dhe nga 90 ditët e fundit.
--
-- Shkrimi: dukshmeria ndryshohet vetëm me vendos_dukshmerine() (vetëm kërkuesi, vetëm rreshti i vet).


-- ============================================================
-- 1 · Pëlqimi i kërkuesit
-- ============================================================
create table if not exists public.dukshmeria (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  anonim        boolean not null default false,
  ndryshuar_me  timestamptz not null default now()
);

alter table public.dukshmeria enable row level security;

-- App-i lexon vetëm rreshtin e vet; s'shkruan drejtpërdrejt (vetëm përmes funksionit më poshtë).
revoke all on public.dukshmeria from anon, authenticated;
grant select on public.dukshmeria to authenticated;

drop policy if exists "dukshmeria_lexo_own" on public.dukshmeria;
create policy "dukshmeria_lexo_own" on public.dukshmeria
  for select to authenticated
  using (user_id = auth.uid());

-- Ndez/fik pëlqimin. Vetëm kërkuesi, vetëm për veten (s'ka parametër për përdoruesin).
create or replace function public.vendos_dukshmerine(p_anonim boolean)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.lloji_im() is distinct from 'kerkues' then
    raise exception 'Vetëm për kërkuesit e punës' using errcode = '42501';
  end if;
  if p_anonim is null then
    raise exception 'Zgjedhja mungon' using errcode = '22004';
  end if;
  insert into public.dukshmeria (user_id, anonim, ndryshuar_me)
  values (auth.uid(), p_anonim, now())
  on conflict (user_id) do update set anonim = excluded.anonim, ndryshuar_me = excluded.ndryshuar_me;
  return p_anonim;
end $$;
revoke execute on function public.vendos_dukshmerine(boolean) from public, anon;
grant execute on function public.vendos_dukshmerine(boolean) to authenticated;


-- ============================================================
-- 2 · Kandidatët anonimë për punët e mia
-- ============================================================
-- security definer: lexon gatishmërinë e të tjerëve (që RLS-i ia fsheh punëdhënësit), por kthen vetëm kolonat anonime
-- dhe vetëm sipas 4 rregullave lart. p_puna_id = null → të gjitha punët e mia.
create or replace function public.kandidatet_anonim(p_puna_id text default null)
returns table (
  puna_id          text,
  kodi             text,     -- 16 shenja hex: çelësi i kandidatit vetëm për këtë punëdhënës
  etiketa          text,     -- "Kandidati #K27"
  perqindja        int,
  ke               text[],   -- vetëm emrat e aftësive, maks. 8
  mungon           text[],   -- vetëm emrat e aftësive, maks. 8
  burimi           text,     -- 'cv' ose 'intervista'
  llogaritur_me    date,
  intervista_nota  int,      -- nota e intervistës praktike më të fundit për këtë punë, ose null
  intervista_nr    int       -- sa intervista praktike të përfunduara për këtë punë
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.lloji_im() is distinct from 'punedhenes' then
    raise exception 'Vetëm për punëdhënësit' using errcode = '42501';
  end if;

  return query
  with punet_e_mia as (
    select p.id
    from public.punet p
    where p.pronari_id = v_uid
      and not p.private
      and (p_puna_id is null or p.id = p_puna_id)
  ),
  te_fundit as (
    -- Kontrolli i fundit i secilit kërkues për secilën punë timen.
    select distinct on (g.user_id, g.puna_id)
      g.user_id, g.puna_id, g.perqindja, g.ke, g.mungon, g.burimi, g.krijuar_me
    from public.gatishmeria g
    join punet_e_mia m on m.id = g.puna_id
    order by g.user_id, g.puna_id, g.krijuar_me desc
  ),
  te_dukshem as (
    select f.*, md5(v_uid::text || ':' || f.user_id::text) as h
    from te_fundit f
    join public.dukshmeria d on d.user_id = f.user_id and d.anonim
    join public.profiles pr on pr.id = f.user_id and pr.lloji = 'kerkues'
    where f.perqindja >= 60
      and f.krijuar_me > now() - interval '90 days'
  )
  select
    x.puna_id,
    substr(x.h, 1, 16),
    'Kandidati #'
      || substr('ABCDEFGHJKLMNPRSTUVZ', 1 + get_byte(decode(substr(x.h, 1, 2), 'hex'), 0) % 20, 1)
      || (10 + (('x' || substr(x.h, 3, 4))::bit(16)::int % 90))::text,
    x.perqindja,
    (select coalesce(array_agg(left(a.e ->> 'aftesia', 80) order by a.n), '{}')
       from jsonb_array_elements(x.ke) with ordinality as a (e, n)
       where a.n <= 8 and coalesce(a.e ->> 'aftesia', '') <> ''),
    (select coalesce(array_agg(left(a.e ->> 'aftesia', 80) order by a.n), '{}')
       from jsonb_array_elements(x.mungon) with ordinality as a (e, n)
       where a.n <= 8 and coalesce(a.e ->> 'aftesia', '') <> ''),
    x.burimi,
    x.krijuar_me::date,
    iv.nota,
    iv.nr::int
  from te_dukshem x
  left join lateral (
    select count(*) as nr,
           (array_agg(i.nota order by i.perfunduar_me desc nulls last, i.krijuar_me desc))[1] as nota
    from public.intervistat i
    where i.user_id = x.user_id
      and i.puna_id = x.puna_id
      and i.gjendja = 'perfunduar'
      and i.nota is not null
  ) iv on true
  order by x.perqindja desc, iv.nota desc nulls last, 2;
end $$;
revoke execute on function public.kandidatet_anonim(text) from public, anon;
grant execute on function public.kandidatet_anonim(text) to authenticated;


-- ============================================================
-- 3 · Numrat për secilën punë timen (vetëm totale)
-- ============================================================
--   gati         kandidatë të dukshëm (si te kandidatet_anonim: pëlqim, ≥ 60%, 90 ditë)
--   ruajtur      sa kërkues e kanë ruajtur me ⭐ (vetëm numri)
--   kontrolluan  sa kërkues kanë kontrolluar "A jam gati?" për të (vetëm numri, edhe ata që s'janë të dukshëm)
create or replace function public.numrat_e_pozitave()
returns table (puna_id text, gati bigint, ruajtur bigint, kontrolluan bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.lloji_im() is distinct from 'punedhenes' then
    raise exception 'Vetëm për punëdhënësit' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    (select count(*) from public.kandidatet_anonim(p.id)),
    (select count(*) from public.punet_e_ruajtura r where r.puna_id = p.id),
    (select count(distinct g.user_id) from public.gatishmeria g where g.puna_id = p.id)
  from public.punet p
  where p.pronari_id = v_uid and not p.private
  order by p.krijuar_me desc;
end $$;
revoke execute on function public.numrat_e_pozitave() from public, anon;
grant execute on function public.numrat_e_pozitave() to authenticated;

notify pgrst, 'reload schema';


/* ============================================================
   TESTI NË SQL EDITOR (si postgres). Gjithçka brenda një transaksioni që kthehet mbrapsht: s'mbetet asgjë.
   Çdo kontroll që dështon ndalon testin me "TESTI DËSHTOI: ...". Sukses = vetëm NOTICE "OK".
   (Testi nga jashtë, vetëm me çelësin publishable: node --env-file=.env scripts/test-kandidatet.mjs)

begin;

-- A: kërkues, i dukshëm, 80%. B: kërkues, 90% por pa pëlqim. D: kërkues, i dukshëm, 50%.
-- C: punëdhënës, pronar i punës. E: punëdhënës tjetër.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'kand-a@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues","emri":"Emri Sekret"}'),
  ('00000000-0000-4000-8000-0000000000b1', 'kand-b@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-0000000000d1', 'kand-d@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-0000000000c1', 'kand-c@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"punedhenes","organizata":"Test SH.P.K."}'),
  ('00000000-0000-4000-8000-0000000000e1', 'kand-e@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"punedhenes","organizata":"Tjetër SH.P.K."}');

insert into public.punet (id, titulli, kompania, qyteti, burimi, pronari_id) values
  ('00000000-0000-4000-8000-0000000000f2', 'Junior Developer', 'Test SH.P.K.', 'Mitrovicë', 'perdoruesi', '00000000-0000-4000-8000-0000000000c1');

insert into public.gatishmeria (user_id, puna_id, burimi, perqindja, ke, mungon, arsyeja, modeli) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000f2', 'cv', 80,
   '[{"aftesia":"React Native","deshmia":"Praktika te Firma Sekrete"}]', '[{"aftesia":"Testimi","pse":"x","si":"y"}]', 'Arsye me emrin Emri Sekret', 'test'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000f2', 'cv', 90, '[]', '[]', 'x', 'test'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000f2', 'cv', 50, '[]', '[]', 'x', 'test');

insert into public.dukshmeria (user_id, anonim) values
  ('00000000-0000-4000-8000-0000000000a1', true),
  ('00000000-0000-4000-8000-0000000000d1', true);

set local role authenticated;

-- C (pronari): sheh vetëm A-në, anonim, pa dëshmi e pa arsye.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
do $$
declare r record; n int;
begin
  select count(*) into n from public.kandidatet_anonim();
  if n <> 1 then raise exception 'TESTI DËSHTOI: C pret 1 kandidat, mori %', n; end if;
  select * into r from public.kandidatet_anonim('00000000-0000-4000-8000-0000000000f2');
  if r.perqindja <> 80 then raise exception 'TESTI DËSHTOI: kandidati i gabuar (%)', r.perqindja; end if;
  if r.etiketa !~ '^Kandidati #[A-Z][0-9]{2}$' then raise exception 'TESTI DËSHTOI: etiketa %', r.etiketa; end if;
  if r.kodi like '%0000000000a1%' or row_to_json(r)::text ~* 'sekret|kand-a|0000000000a1' then
    raise exception 'TESTI DËSHTOI: rreshti nxjerr të dhëna personale: %', row_to_json(r);
  end if;
  if r.ke <> array['React Native'] or r.mungon <> array['Testimi'] then raise exception 'TESTI DËSHTOI: aftësitë %', row_to_json(r); end if;
  raise notice 'OK 1: C sheh vetëm kandidatin e dukshëm ≥ 60%%, anonim: %', r.etiketa;

  select gati into n from public.numrat_e_pozitave() where puna_id = '00000000-0000-4000-8000-0000000000f2';
  if n <> 1 then raise exception 'TESTI DËSHTOI: numrat gati = %', n; end if;
  raise notice 'OK 2: numrat_e_pozitave numëron 1 gati';

  -- C s'lexon drejtpërdrejt gatishmërinë, pëlqimet apo profilet e kandidatëve.
  if (select count(*) from public.gatishmeria) <> 0 then raise exception 'TESTI DËSHTOI: C lexon gatishmerine'; end if;
  if (select count(*) from public.dukshmeria) <> 0 then raise exception 'TESTI DËSHTOI: C lexon dukshmerine'; end if;
  if (select count(*) from public.profiles where lloji = 'kerkues') <> 0 then raise exception 'TESTI DËSHTOI: C lexon profilet'; end if;
  raise notice 'OK 3: C s''ka qasje direkte në tabelat';

  begin
    perform public.vendos_dukshmerine(true);
    raise exception 'TESTI DËSHTOI: punëdhënësi ndryshoi dukshmërinë';
  exception when insufficient_privilege then raise notice 'OK 4: punëdhënësi s''ka pëlqim për të ndryshuar';
  end;
end $$;

-- E (punëdhënës tjetër): s'sheh asgjë për punën e C-së.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.kandidatet_anonim('00000000-0000-4000-8000-0000000000f2')) <> 0 then
    raise exception 'TESTI DËSHTOI: E sheh kandidatët e punës së C-së';
  end if;
  if (select count(*) from public.numrat_e_pozitave()) <> 0 then raise exception 'TESTI DËSHTOI: E sheh numrat e C-së'; end if;
  raise notice 'OK 5: punëdhënësi tjetër s''sheh asgjë';
end $$;

-- A (kërkues): s'i thërret dot funksionet e punëdhënësit; e fik pëlqimin dhe zhduket.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
do $$ begin
  begin
    perform * from public.kandidatet_anonim();
    raise exception 'TESTI DËSHTOI: kërkuesi thirri kandidatet_anonim';
  exception when insufficient_privilege then raise notice 'OK 6: kërkuesi s''i sheh kandidatët';
  end;
  if (select count(*) from public.dukshmeria) <> 1 then raise exception 'TESTI DËSHTOI: A s''e sheh pëlqimin e vet'; end if;
  perform public.vendos_dukshmerine(false);
  raise notice 'OK 7: A e fiki pëlqimin';
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.kandidatet_anonim()) <> 0 then raise exception 'TESTI DËSHTOI: A shfaqet pa pëlqim'; end if;
  raise notice 'OK 8: pa pëlqim, A s''shfaqet më';
end $$;

reset role;
rollback;
*/
