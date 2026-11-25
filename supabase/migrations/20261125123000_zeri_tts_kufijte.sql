-- Kufizuesi i përbashkët i kërkesave TTS te Gemini: dritare rrëshqitëse 60 s për çdo model (RPM), kufi ditor sipas
-- mesnatës së Paqësorit (RPD) dhe bllokim pas një 429. E njëjta logjikë si kufizuesiNeKujtese() te
-- supabase/functions/_shared/zeri-kufizuesi.ts. Ruan vetëm emrin e modelit dhe kohën: asnjë tekst, asnjë përdorues.
-- E PAAPLIKUAR: aplikohet vetëm me OK-në e Gentit. Pa të, intervista-zeri numëron vetëm brenda një instance.
-- Mund të ekzekutohet disa herë.

create table if not exists public.zeri_tts_kerkesat (
  id bigint generated always as identity primary key,
  modeli text not null check (char_length(modeli) between 1 and 80),
  krijuar_me timestamptz not null default clock_timestamp()
);
create index if not exists zeri_tts_kerkesat_modeli_koha on public.zeri_tts_kerkesat (modeli, krijuar_me);

create table if not exists public.zeri_tts_bllokimet (
  modeli text primary key check (char_length(modeli) between 1 and 80),
  deri timestamptz not null
);

-- RLS pa asnjë politikë: app-i (anon, authenticated) s'i lexon e s'i shkruan; vetëm çelësi sekret te Edge Function.
alter table public.zeri_tts_kerkesat enable row level security;
alter table public.zeri_tts_bllokimet enable row level security;
revoke all on table public.zeri_tts_kerkesat, public.zeri_tts_bllokimet from public, anon, authenticated;
grant select, insert, delete on table public.zeri_tts_kerkesat to service_role;
grant select, insert, update on table public.zeri_tts_bllokimet to service_role;

-- p_modelet: [{"modeli": "...", "rpm": 3, "rpd": 10 | null}, ...] sipas rendit të parapëlqimit.
-- Kthen {"modeli": "...", "pritja_ms": 0} kur u rezervua një vend, përndryshe {"modeli": null, "pritja_ms": N}.
create or replace function public.zeri_tts_rezervo(p_modelet jsonb, p_ler_te_lira integer default 0)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tani timestamptz;
  v_dita timestamptz;
  v_neser timestamptz;
  v_m jsonb;
  v_modeli text;
  v_rpm integer;
  v_rpd integer;
  v_blloku timestamptz;
  v_dritare integer;
  v_sot integer;
  v_me_e_vjetra timestamptz;
  v_pritja bigint;
  v_min_pritja bigint;
  v_lira integer := 0;
  v_lira_modelit integer;
  v_zgjedhur text;
begin
  if p_modelet is null or jsonb_typeof(p_modelet) <> 'array' then
    raise exception 'p_modelet duhet te jete liste';
  end if;
  -- Një rezervim në një kohë: dy kërkesa të njëkohshme s'mund ta marrin të njëjtin vend të fundit.
  perform pg_advisory_xact_lock(hashtext('public.zeri_tts_rezervo'));
  v_tani := clock_timestamp();
  v_dita := date_trunc('day', v_tani at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  v_neser := (date_trunc('day', v_tani at time zone 'America/Los_Angeles') + interval '1 day') at time zone 'America/Los_Angeles';
  delete from public.zeri_tts_kerkesat k where k.krijuar_me < v_tani - interval '2 days';

  for v_m in select e.value from jsonb_array_elements(p_modelet) as e loop
    v_modeli := v_m ->> 'modeli';
    v_rpm := coalesce((v_m ->> 'rpm')::integer, 0);
    v_rpd := (v_m ->> 'rpd')::integer;
    if v_modeli is null or v_rpm <= 0 then
      continue;
    end if;
    v_pritja := 0;

    v_blloku := null;
    select b.deri into v_blloku from public.zeri_tts_bllokimet b where b.modeli = v_modeli;
    if v_blloku is not null and v_blloku > v_tani then
      v_pritja := ceil(extract(epoch from (v_blloku - v_tani)) * 1000);
    end if;

    select count(*) into v_dritare from public.zeri_tts_kerkesat k
      where k.modeli = v_modeli and k.krijuar_me > v_tani - interval '60 seconds';
    if v_dritare >= v_rpm then
      select k.krijuar_me into v_me_e_vjetra from public.zeri_tts_kerkesat k
        where k.modeli = v_modeli and k.krijuar_me > v_tani - interval '60 seconds'
        order by k.krijuar_me asc offset (v_dritare - v_rpm) limit 1;
      v_pritja := greatest(v_pritja, ceil(extract(epoch from (v_me_e_vjetra + interval '60 seconds' - v_tani)) * 1000)::bigint);
    end if;
    v_lira_modelit := v_rpm - v_dritare;

    if v_rpd is not null then
      select count(*) into v_sot from public.zeri_tts_kerkesat k where k.modeli = v_modeli and k.krijuar_me >= v_dita;
      if v_sot >= v_rpd then
        v_pritja := greatest(v_pritja, ceil(extract(epoch from (v_neser - v_tani)) * 1000)::bigint);
      end if;
      v_lira_modelit := least(v_lira_modelit, v_rpd - v_sot);
    end if;

    if v_pritja = 0 then
      v_lira := v_lira + greatest(v_lira_modelit, 0);
      if v_zgjedhur is null then
        v_zgjedhur := v_modeli;
      end if;
    else
      v_min_pritja := least(coalesce(v_min_pritja, v_pritja), v_pritja);
    end if;
  end loop;

  if v_zgjedhur is not null and v_lira > greatest(coalesce(p_ler_te_lira, 0), 0) then
    insert into public.zeri_tts_kerkesat (modeli, krijuar_me) values (v_zgjedhur, v_tani);
    return jsonb_build_object('modeli', v_zgjedhur, 'pritja_ms', 0);
  end if;
  return jsonb_build_object('modeli', null, 'pritja_ms', coalesce(v_min_pritja, 60000));
end;
$$;

create or replace function public.zeri_tts_blloko(p_modeli text, p_ms bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.zeri_tts_bllokimet as b (modeli, deri)
  values (p_modeli, clock_timestamp() + make_interval(secs => least(greatest(p_ms, 0), 90000000) / 1000.0))
  on conflict (modeli) do update set deri = greatest(b.deri, excluded.deri);
$$;

revoke all on function public.zeri_tts_rezervo(jsonb, integer) from public, anon, authenticated;
revoke all on function public.zeri_tts_blloko(text, bigint) from public, anon, authenticated;
grant execute on function public.zeri_tts_rezervo(jsonb, integer) to service_role;
grant execute on function public.zeri_tts_blloko(text, bigint) to service_role;
