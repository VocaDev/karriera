-- Orari i importit nga portalet (pg_cron + pg_net), sipas docs "Scheduling Edge Functions".
-- NUK është ekzekutuar (14.11). Ekzekutohet në SQL Editor vetëm pasi:
--   1. migrimi 20261114120000_punet_portalet.sql është aplikuar,
--   2. funksioni "portalet" është deploy-uar dhe një thirrje me {"provo": true} kthen raport të mirë,
--   3. app-i e filtron Realtime-in te burimi = 'perdoruesi' (përndryshe çdo punë e importuar = një njoftim).
--
-- Një thirrje për çdo portal, me 10 minuta largësi: Edge Function ka 150 s kohë (plani falas;
-- docs "Edge Functions · Limits"). Radha ka rëndësi për dublikatat: KosovaJob i pari.
-- Oraret janë në UTC: 05:00 UTC = 06:00 në Kosovë (dimër).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Sekretet në Vault (jo në kod). Vendos vlerat e vërteta këtu, në SQL Editor, jo në Git.
select vault.create_secret('https://mlnfamjdkmyszvxxhddr.supabase.co', 'project_url');
select vault.create_secret('<E NJËJTA VLERË SI PORTALET_SEKRETI>', 'portalet_sekreti');

create or replace function public.thirr_portalet(portali text)
returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portalet',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-portalet-sekreti', (select decrypted_secret from vault.decrypted_secrets where name = 'portalet_sekreti')
    ),
    body := jsonb_build_object('portalet', jsonb_build_array(portali)),
    timeout_milliseconds := 150000
  );
$$;
revoke execute on function public.thirr_portalet(text) from public, anon, authenticated;

select cron.schedule('portalet-kosovajob',  '0 5 * * *',  $$ select public.thirr_portalet('kosovajob') $$);
select cron.schedule('portalet-portalpune', '10 5 * * *', $$ select public.thirr_portalet('portalpune') $$);
-- OfertaPune s'ka orar: i ktheu botit tonë 403 (14.11). Vetëm me leje me shkrim.

-- Kontrolli: select * from cron.job_run_details order by start_time desc limit 10;
--            select id, status_code, left(content, 500) from net._http_response order by id desc limit 5;
-- Ndalimi:   select cron.unschedule('portalet-kosovajob'); (dhe të tjerat)
