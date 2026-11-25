-- 25.11 · Punëdhënësi sheh "Më të mirët" për punët e veta: kandidatë anonimë, të renditur sipas "A jam gati?".
-- Bordi, rreshti 8 (ekranet 59, 61, 62, 63): "Kandidati #A7", përqindja, çka ka dhe çka i mungon, intervista.
--
-- RENDI: ekzekutohet PAS 20261115110000_gatishmeria.sql, 20261115120000_intervistat.sql dhe
-- 20261118100000_punet_e_mia.sql (përdor gatishmeria, intervistat, punet.private). Varet edhe nga
-- supabase/j6-hyrja-rls.sql: profiles, lloji_im(), punet.pronari_id, punet_e_ruajtura.
-- Versioni 20261125110000 (jo ...100000): 20261125100000 është i zënë nga sill_linkun_auto.
-- Mund të ekzekutohet disa herë. NUK është aplikuar live: e aplikon Genti.
--
-- Privatësia (CV-ja dhe gatishmëria janë të dhëna personale), e zbatuar këtu në bazë, jo në app:
--   1. Pëlqimi: kërkuesi shfaqet VETËM nëse e ka ndezur vetë "Lejo punëdhënësit të më shohin anonimisht"
--      (public.dukshmeria.anonim = true). Pa rresht = i padukshëm (i fikur si parazgjedhje).
--   2. Anonim: punëdhënësi s'ka asnjë grant mbi gatishmeria / intervistat / profiles të të tjerëve (RLS: vetëm të vetat).
--      I vetmi rrugë është kandidatet_anonim(), që kthen vetëm:
--        - një etiketë ("Kandidati #K27") dhe një kod të paqartë PËR ÇDO PUNË (md5 i punëdhënësit + punës + kandidatit):
--          i njëjti person ka kod dhe etiketë tjetër te çdo pozitë, kështu që s'lidhet dot mes pozitave;
--        - përqindjen; kohën vetëm në kova ('kete_jave' / 'kete_muaj' / 'me_heret'), jo datën e saktë;
--        - EMRAT e aftësive si etiketa të shkurtra (≤ 40 shenja, ≤ 4 fjalë, pa thonjëza, pa shenja si : ; @, pa numra
--          4-shifrorë); çdo gjë tjetër hiqet. Kurrë "deshmia" apo "arsyeja" (ato citojnë CV-në);
--        - notën e intervistës praktike për atë punë.
--      Kurrë user_id, emër, email, CV, tekst të CV-së apo përgjigje të intervistës.
--   3. Vetëm punët e mia: rreshtat vijnë vetëm për punë me pronari_id = auth.uid(); vetëm llogaria "punedhenes".
--   4. "Kur jam gati": vetëm kontrolli i fundit i kandidatit për atë punë, nëse është ≥ 60% dhe nga 90 ditët e fundit.
--   5. Totalet që përfshijnë edhe kërkues pa pëlqim (⭐ dhe kontrollet "A jam gati?") dalin vetëm kur janë ≥ 5
--      (k-anonimiteti); nën 5 kthehet null dhe app-i shkruan "më pak se 5". Një numër 1–2 do ta tregonte personin.
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
-- 2 · Etiketat e aftësive: vetëm emra të shkurtër, kurrë citate nga CV-ja
-- ============================================================
-- Nga një listë jsonb [{ "aftesia": ... }] mban maks. 8 emra që duken si emër aftësie:
-- 1–40 shenja, 1–4 fjalë, vetëm shkronja/numra (edhe ë ç ä ö ü ß, pavarësisht locale-it të bazës) dhe . + # / & ( ) -,
-- pa numra 4-shifrorë (vite, telefona).
-- Hapësirat e shumta bëhen një. Çka s'kalon hiqet krejt (s'shkurtohet: një citat i shkurtuar mbetet citat).
-- immutable + pa qasje në tabela: s'ka nevojë për security definer.
create or replace function public.etiketat_e_aftesive(p_lista jsonb)
returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(a.emri order by a.n), '{}')
  from (
    select x.n, regexp_replace(trim(x.e ->> 'aftesia'), '\s+', ' ', 'g') as emri
    from jsonb_array_elements(case when jsonb_typeof(p_lista) = 'array' then p_lista else '[]'::jsonb end)
         with ordinality as x (e, n)
    where jsonb_typeof(x.e) = 'object'
  ) a
  where a.emri ~ '^[[:alnum:]ëËçÇäöüÄÖÜß][[:alnum:]ëËçÇäöüÄÖÜß .+#/&()-]{0,39}$'
    and a.emri !~ '[0-9]{4,}'
    and array_length(regexp_split_to_array(a.emri, ' '), 1) <= 4
    and a.n <= 8
$$;
revoke execute on function public.etiketat_e_aftesive(jsonb) from public, anon, authenticated;


-- ============================================================
-- 3 · Kandidatët anonimë për punët e mia
-- ============================================================
-- security definer: lexon gatishmërinë e të tjerëve (që RLS-i ia fsheh punëdhënësit), por kthen vetëm kolonat anonime
-- dhe vetëm sipas rregullave lart. p_puna_id = null → të gjitha punët e mia.
-- Funksioni i vjetër (nëse u ekzekutua një version i parë me llogaritur_me) hiqet: forma e rezultatit ndryshon.
drop function if exists public.numrat_e_pozitave();
drop function if exists public.kandidatet_anonim(text);
create function public.kandidatet_anonim(p_puna_id text default null)
returns table (
  puna_id          text,
  kodi             text,     -- 16 hex: çelësi i kandidatit vetëm për këtë punëdhënës DHE këtë punë
  etiketa          text,     -- "Kandidati #K27" (po ashtu për punë)
  perqindja        int,
  ke               text[],   -- etiketa të shkurtra aftësish, maks. 8
  mungon           text[],   -- etiketa të shkurtra aftësish, maks. 8
  burimi           text,     -- 'cv' ose 'intervista'
  llogaritur_kur   text,     -- 'kete_jave' (≤ 7 ditë) / 'kete_muaj' (≤ 30) / 'me_heret' (≤ 90)
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
    -- Kodi varet nga punëdhënësi, puna DHE kandidati: s'lidhet dot i njëjti person mes dy pozitave.
    select f.*, md5(v_uid::text || ':' || f.puna_id || ':' || f.user_id::text) as h
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
    public.etiketat_e_aftesive(x.ke),
    public.etiketat_e_aftesive(x.mungon),
    x.burimi,
    case
      when x.krijuar_me > now() - interval '7 days' then 'kete_jave'
      when x.krijuar_me > now() - interval '30 days' then 'kete_muaj'
      else 'me_heret'
    end,
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
-- 4 · Numrat për secilën punë timen (vetëm totale)
-- ============================================================
--   gati         kandidatë të dukshëm (si te kandidatet_anonim: pëlqim, ≥ 60%, 90 ditë). Të gjithë kanë dhënë pëlqimin
--                dhe punëdhënësi i sheh gjithsesi te lista, prandaj numri del i plotë.
--   ruajtur      sa kërkues e kanë ruajtur me ⭐ ┐ përfshijnë edhe kërkues pa pëlqim: dalin vetëm kur janë ≥ 5,
--   kontrolluan  sa kërkues kanë kontrolluar   ┘ përndryshe null ("më pak se 5" në app).
--                "A jam gati?" për të
create function public.numrat_e_pozitave()
returns table (puna_id text, gati bigint, ruajtur bigint, kontrolluan bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  k_min constant bigint := 5;  -- k-anonimiteti
begin
  if v_uid is null or public.lloji_im() is distinct from 'punedhenes' then
    raise exception 'Vetëm për punëdhënësit' using errcode = '42501';
  end if;

  return query
  select
    n.id,
    n.gati,
    case when n.ruajtur >= k_min then n.ruajtur end,
    case when n.kontrolluan >= k_min then n.kontrolluan end
  from (
    select
      p.id,
      p.krijuar_me,
      (select count(*) from public.kandidatet_anonim(p.id)) as gati,
      (select count(*) from public.punet_e_ruajtura r where r.puna_id = p.id) as ruajtur,
      (select count(distinct g.user_id) from public.gatishmeria g where g.puna_id = p.id) as kontrolluan
    from public.punet p
    where p.pronari_id = v_uid and not p.private
  ) n
  order by n.krijuar_me desc;
end $$;
revoke execute on function public.numrat_e_pozitave() from public, anon;
grant execute on function public.numrat_e_pozitave() to authenticated;

notify pgrst, 'reload schema';


/* ============================================================
   TESTI NË SQL EDITOR (si postgres). Gjithçka brenda një transaksioni që kthehet mbrapsht: s'mbetet asgjë.
   Çdo kontroll që dështon ndalon testin me "TESTI DËSHTOI: ...". Sukses = vetëm NOTICE "OK".
   (Testi nga jashtë, vetëm me çelësin publishable: node --env-file=.env scripts/test-kandidatet.mjs)

begin;

-- A: kërkues, i dukshëm, 80% për punën 1 dhe 70% për punën 2. B: kërkues, 90% por pa pëlqim.
-- D: kërkues, i dukshëm, 50%. C: punëdhënës, pronar i të dy punëve. E: punëdhënës tjetër.
-- S1..S4: kërkues që vetëm e ruajnë punën 1 me ⭐ (për pragun 5).
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'kand-a@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues","emri":"Emri Sekret"}'),
  ('00000000-0000-4000-8000-0000000000b1', 'kand-b@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-0000000000d1', 'kand-d@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-000000000051', 'kand-s1@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-000000000052', 'kand-s2@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-000000000053', 'kand-s3@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-000000000054', 'kand-s4@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"kerkues"}'),
  ('00000000-0000-4000-8000-0000000000c1', 'kand-c@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"punedhenes","organizata":"Test SH.P.K."}'),
  ('00000000-0000-4000-8000-0000000000e1', 'kand-e@karriera.invalid', 'authenticated', 'authenticated', '{"lloji":"punedhenes","organizata":"Tjetër SH.P.K."}');

insert into public.punet (id, titulli, kompania, qyteti, burimi, pronari_id) values
  ('00000000-0000-4000-8000-0000000000f2', 'Junior Developer', 'Test SH.P.K.', 'Mitrovicë', 'perdoruesi', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-0000000000f3', 'Asistent/e zyre', 'Test SH.P.K.', 'Mitrovicë', 'perdoruesi', '00000000-0000-4000-8000-0000000000c1');

-- Aftësitë e A-së përfshijnë edhe "aftësi" që janë citate nga CV-ja: duhet të hiqen.
insert into public.gatishmeria (user_id, puna_id, burimi, perqindja, ke, mungon, arsyeja, modeli) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000f2', 'cv', 80,
   '[{"aftesia":"React Native","deshmia":"Praktika te Firma Sekrete"},
     {"aftesia":"Punova te \"Firma Sekrete\" 2019-2023","deshmia":"x"},
     {"aftesia":"Kontakt: emri@shembull.com","deshmia":"x"},
     {"aftesia":"Menaxhova ekipin e shitjeve në degën e Mitrovicës për tri vite","deshmia":"x"},
     {"aftesia":"C#","deshmia":"x"}]',
   '[{"aftesia":"Testimi","pse":"x","si":"y"}]', 'Arsye me emrin Emri Sekret', 'test'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000f3', 'cv', 70, '[]', '[]', 'x', 'test'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000f2', 'cv', 90, '[]', '[]', 'x', 'test'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000f2', 'cv', 50, '[]', '[]', 'x', 'test');

insert into public.dukshmeria (user_id, anonim) values
  ('00000000-0000-4000-8000-0000000000a1', true),
  ('00000000-0000-4000-8000-0000000000d1', true);

-- 4 ⭐ për punën 1 (nën pragun 5).
insert into public.punet_e_ruajtura (pronari_id, puna_id) values
  ('00000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-0000000000f2'),
  ('00000000-0000-4000-8000-000000000052', '00000000-0000-4000-8000-0000000000f2'),
  ('00000000-0000-4000-8000-000000000053', '00000000-0000-4000-8000-0000000000f2'),
  ('00000000-0000-4000-8000-000000000054', '00000000-0000-4000-8000-0000000000f2');

set local role authenticated;

-- C (pronari): sheh vetëm A-në, anonim, pa dëshmi, pa arsye, pa citate, pa datë të saktë.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
do $$
declare r record; r2 record; n int; nr record;
begin
  select count(*) into n from public.kandidatet_anonim('00000000-0000-4000-8000-0000000000f2');
  if n <> 1 then raise exception 'TESTI DËSHTOI: C pret 1 kandidat për punën 1, mori %', n; end if;
  select * into r from public.kandidatet_anonim('00000000-0000-4000-8000-0000000000f2');
  if r.perqindja <> 80 then raise exception 'TESTI DËSHTOI: kandidati i gabuar (%)', r.perqindja; end if;
  if r.etiketa !~ '^Kandidati #[A-Z][0-9]{2}$' then raise exception 'TESTI DËSHTOI: etiketa %', r.etiketa; end if;
  if row_to_json(r)::text ~* 'sekret|kand-a|0000000000a1|shembull|Menaxhova|Arsye' then
    raise exception 'TESTI DËSHTOI: rreshti nxjerr të dhëna personale: %', row_to_json(r);
  end if;
  raise notice 'OK 1: C sheh vetëm kandidatin e dukshëm ≥ 60%%, anonim: %', r.etiketa;

  -- Pika 3: vetëm etiketa të shkurtra; citatet, email-i dhe fjalia e gjatë hiqen.
  if r.ke <> array['React Native', 'C#'] or r.mungon <> array['Testimi'] then
    raise exception 'TESTI DËSHTOI: aftësitë %', row_to_json(r);
  end if;
  raise notice 'OK 2: vetëm emrat e shkurtër të aftësive (citatet hiqen)';

  -- Pika 3: koha vetëm në kova; s'ka kolonë me datën e saktë.
  if r.llogaritur_kur <> 'kete_jave' then raise exception 'TESTI DËSHTOI: llogaritur_kur %', r.llogaritur_kur; end if;
  if row_to_json(r)::jsonb ? 'llogaritur_me' then raise exception 'TESTI DËSHTOI: del data e saktë'; end if;
  raise notice 'OK 3: koha del vetëm si kovë (%)', r.llogaritur_kur;

  -- Pika 3: i njëjti kandidat te puna 2 ka kod tjetër (s'lidhet mes pozitave).
  select * into r2 from public.kandidatet_anonim('00000000-0000-4000-8000-0000000000f3');
  if r2.kodi is null or r2.kodi = r.kodi then raise exception 'TESTI DËSHTOI: kodi i njëjtë mes pozitave'; end if;
  if (select count(distinct k.kodi) from public.kandidatet_anonim() k) <> 2 then
    raise exception 'TESTI DËSHTOI: lista e plotë s''ka 2 kode të ndryshme';
  end if;
  raise notice 'OK 4: kod tjetër për çdo pozitë (% / %)', r.etiketa, r2.etiketa;

  -- Pika 2: gati i plotë (pëlqim); ⭐ 4 < 5 → null; kontrolluan 3 (A, B, D) < 5 → null.
  select * into nr from public.numrat_e_pozitave() x where x.puna_id = '00000000-0000-4000-8000-0000000000f2';
  if nr.gati <> 1 then raise exception 'TESTI DËSHTOI: numrat gati = %', nr.gati; end if;
  if nr.ruajtur is not null then raise exception 'TESTI DËSHTOI: ⭐ nën 5 del si numër (%)', nr.ruajtur; end if;
  if nr.kontrolluan is not null then raise exception 'TESTI DËSHTOI: kontrollet nën 5 dalin si numër (%)', nr.kontrolluan; end if;
  raise notice 'OK 5: totalet nën 5 kthehen null';

  -- C s'lexon drejtpërdrejt gatishmërinë, pëlqimet apo profilet e kandidatëve.
  if (select count(*) from public.gatishmeria) <> 0 then raise exception 'TESTI DËSHTOI: C lexon gatishmerine'; end if;
  if (select count(*) from public.dukshmeria) <> 0 then raise exception 'TESTI DËSHTOI: C lexon dukshmerine'; end if;
  if (select count(*) from public.profiles where lloji = 'kerkues') <> 0 then raise exception 'TESTI DËSHTOI: C lexon profilet'; end if;
  raise notice 'OK 6: C s''ka qasje direkte në tabelat';

  begin
    perform public.vendos_dukshmerine(true);
    raise exception 'TESTI DËSHTOI: punëdhënësi ndryshoi dukshmërinë';
  exception when insufficient_privilege then raise notice 'OK 7: punëdhënësi s''ka pëlqim për të ndryshuar';
  end;
end $$;

-- Pika 2: me 5 ⭐ numri del.
reset role;
insert into public.punet_e_ruajtura (pronari_id, puna_id) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000f2');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
do $$ begin
  if (select x.ruajtur from public.numrat_e_pozitave() x where x.puna_id = '00000000-0000-4000-8000-0000000000f2') is distinct from 5 then
    raise exception 'TESTI DËSHTOI: 5 ⭐ s''dalin si 5';
  end if;
  raise notice 'OK 8: me 5 ⭐ numri del (5)';
end $$;

-- E (punëdhënës tjetër): s'sheh asgjë për punët e C-së.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.kandidatet_anonim('00000000-0000-4000-8000-0000000000f2')) <> 0 then
    raise exception 'TESTI DËSHTOI: E sheh kandidatët e punës së C-së';
  end if;
  if (select count(*) from public.numrat_e_pozitave()) <> 0 then raise exception 'TESTI DËSHTOI: E sheh numrat e C-së'; end if;
  raise notice 'OK 9: punëdhënësi tjetër s''sheh asgjë';
end $$;

-- A (kërkues): s'i thërret dot funksionet e punëdhënësit; e fik pëlqimin dhe zhduket.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
do $$ begin
  begin
    perform * from public.kandidatet_anonim();
    raise exception 'TESTI DËSHTOI: kërkuesi thirri kandidatet_anonim';
  exception when insufficient_privilege then raise notice 'OK 10: kërkuesi s''i sheh kandidatët';
  end;
  begin
    perform public.etiketat_e_aftesive('[]'::jsonb);
    raise exception 'TESTI DËSHTOI: app-i thërret etiketat_e_aftesive';
  exception when insufficient_privilege then raise notice 'OK 11: ndihmësi s''thirret nga app-i';
  end;
  if (select count(*) from public.dukshmeria) <> 1 then raise exception 'TESTI DËSHTOI: A s''e sheh pëlqimin e vet'; end if;
  perform public.vendos_dukshmerine(false);
  raise notice 'OK 12: A e fiki pëlqimin';
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.kandidatet_anonim()) <> 0 then raise exception 'TESTI DËSHTOI: A shfaqet pa pëlqim'; end if;
  raise notice 'OK 13: pa pëlqim, A s''shfaqet më';
end $$;

reset role;
rollback;
*/
