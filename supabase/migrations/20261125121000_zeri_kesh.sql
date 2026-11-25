-- Kesh-i i audios për tekstet FIKSE të intervistës me zë (përshëndetja me pyetjen e parë, pranimi i shkurtër), që i
-- njëjti tekst të mos kushtojë kërkesë TTS për herë të dytë. Asnjë përgjigje e kandidatit dhe asnjë pyetje e AI-së.
-- E PAAPLIKUAR: me OK-në e Gentit. Pa të, intervista-zeri ruan vetëm në kujtesën e instancës. Mund të ekzekutohet disa herë.

create table if not exists public.zeri_kesh (
  celesi text primary key check (char_length(celesi) = 64),
  shkalla integer not null check (shkalla between 8000 and 96000),
  audio_base64 text not null check (char_length(audio_base64) <= 2000000),
  krijuar_me timestamptz not null default now()
);

-- RLS pa asnjë politikë: app-i s'e lexon e s'e shkruan; vetëm çelësi sekret te Edge Function.
alter table public.zeri_kesh enable row level security;
revoke all on table public.zeri_kesh from public, anon, authenticated;
grant select, insert on table public.zeri_kesh to service_role;
