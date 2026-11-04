-- J5: shpalljet e punës në Supabase (M1 lexim, M2 shtim nga telefoni).
-- Pa login ende (vjen në J6): kushdo lexon; nga app-i mund të shtohet vetëm si "perdoruesi".

create table if not exists public.punet (
  id          text primary key default gen_random_uuid()::text,
  titulli     text not null check (char_length(titulli) between 3 and 120),
  kompania    text not null check (char_length(kompania) between 2 and 80),
  qyteti      text not null check (char_length(qyteti) between 2 and 60),
  roli        text not null default 'Tjetër' check (roli in ('SWE', 'Asistent/PR', 'Tjetër')),
  pershkrimi  text not null default '' check (char_length(pershkrimi) <= 1000),
  aftesite    text[] not null default '{}' check (cardinality(aftesite) <= 10),
  burimi      text not null default 'perdoruesi' check (burimi in ('seed', 'perdoruesi')),
  krijuar_me  timestamptz not null default now()
);

alter table public.punet enable row level security;

-- Leximi: publik (shpalljet nuk janë të dhëna private).
drop policy if exists "punet_lexo" on public.punet;
create policy "punet_lexo" on public.punet
  for select to anon, authenticated using (true);

-- Shtimi: lejohet vetëm si "perdoruesi", kurrë si "seed". Pa update/delete nga app-i.
drop policy if exists "punet_shto" on public.punet;
create policy "punet_shto" on public.punet
  for insert to anon, authenticated with check (burimi = 'perdoruesi');

grant select, insert on public.punet to anon, authenticated;

-- Të dhëna fillestare (kompani të sajuara, si më parë në src/data/punet.ts).
insert into public.punet (id, titulli, kompania, qyteti, roli, pershkrimi, aftesite, burimi) values
  ('p1', 'Junior React Native Developer', 'Dardania Soft', 'Prishtinë', 'SWE',
   'Zhvillim i aplikacioneve mobile për klientë në Gjermani. Mentorim nga një senior.', '{React Native,TypeScript,Git}', 'seed'),
  ('p2', 'Praktikant Backend (Node.js)', 'Ibri Tech', 'Mitrovicë', 'SWE',
   'Praktikë 3-mujore me pagesë. API dhe baza të dhënash për një platformë logjistike.', '{Node.js,SQL,REST API}', 'seed'),
  ('p3', 'Frontend Developer (remote)', 'Kodi Studio', 'Remote', 'SWE',
   'Ueb-faqe dhe dashboard-e në Next.js. Takime në anglisht.', '{React,Next.js,CSS}', 'seed'),
  ('p4', 'Asistent/e Administrative', 'Rugova Group', 'Pejë', 'Asistent/PR',
   'Organizim i takimeve, korrespondencë me klientët, arkivim i dokumenteve.', '{Komunikim,Excel,Anglisht}', 'seed'),
  ('p5', 'Koordinator/e PR dhe Rrjete Sociale', 'Agjencia Iliria', 'Prishtinë', 'Asistent/PR',
   'Postime për rrjetet sociale, komunikata për media, raporte mujore.', '{Shkrim,Canva,Instagram}', 'seed'),
  ('p6', 'Asistent/e në Shërbimin ndaj Klientit', 'Sharri Telecom', 'Prizren', 'Asistent/PR',
   'Përgjigje klientëve me telefon dhe email në shqip dhe gjermanisht.', '{Gjermanisht,Durim,Komunikim}', 'seed')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
