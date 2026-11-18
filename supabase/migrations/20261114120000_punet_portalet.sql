-- 14.11 · Shpalljet e vërteta nga portalet e Kosovës (KosovaJob, PortalPune, OfertaPune).
-- I shton tabelës "punet" fushat që i duhen importit dhe "Hape në shfletues".
-- Ekzekutohet PAS 20261104120000_punet.sql dhe supabase/j6-hyrja-rls.sql. Mund të ekzekutohet disa herë.
-- NUK është aplikuar ende (14.11): pret OK-në e Gentit. Hapat: supabase/functions/README.md, pjesa "Portalet".
--
-- Siguria: app-i s'mund të shtojë rreshta "portal". Policy-ja punet_shto (J6) lejon vetëm
-- burimi = 'perdoruesi'; rreshtat "portal" i shkruan vetëm Edge Function "portalet" me çelësin sekret.
-- Rreshtat "portal" s'kanë pronar (pronari_id null): s'i ndryshon e s'i fshin askush nga app-i
-- (punet_ndrysho / punet_fshi kërkojnë pronari_id = auth.uid()); kërkuesi i lexon si çdo punë tjetër.
-- MODELI.md: teksti i plotë i shpalljes nuk ruhet kurrë. "pershkrimi" i një rreshti "portal" është
-- një përmbledhje me fjalët tona (faktet: roli, qyteti, afati, aftësitë), plus linku te burimi.

-- 1. burimi: shtohet "portal".
alter table public.punet drop constraint if exists punet_burimi_check;
alter table public.punet
  add constraint punet_burimi_check check (burimi in ('seed', 'perdoruesi', 'portal'));

-- 2. Fushat e reja.
alter table public.punet
  -- Linku i shpalljes origjinale ("Hape në shfletues"). Edhe "Sill linkun tënd" do ta përdorë.
  add column if not exists linku        text check (linku is null or (linku ~ '^https://' and char_length(linku) <= 500)),
  -- Nga cili portal erdhi: vetëm te rreshtat "portal".
  add column if not exists portali      text check (portali is null or portali in ('kosovajob', 'portalpune', 'ofertapune')),
  -- ID-ja e shpalljes te portali (për të mos e shtuar dy herë të njëjtën).
  add column if not exists id_e_jashtme text check (id_e_jashtme is null or char_length(id_e_jashtme) between 1 and 80),
  -- Titulli + kompania të normalizuar: e njëjta punë në dy portale (KosovaJob dhe OfertaPune janë e njëjta firmë).
  add column if not exists gjurma       text check (gjurma is null or char_length(gjurma) <= 220),
  -- Afati i aplikimit (data, sipas portalit). Null = portali s'e tregon.
  add column if not exists afati        date,
  -- false = skadoi ose s'është më te portali. Rreshtat s'fshihen: ⭐ e ruajtura s'humbasin.
  add column if not exists aktive       boolean not null default true,
  -- Hera e fundit që importi e pa shpalljen te portali.
  add column if not exists pare_me      timestamptz;

-- 3. Rregullat mes fushave: "portal" ⇔ ka portalin, id-në dhe linkun. Kështu as punëdhënësi
--    (që mund të shtojë rreshta "perdoruesi") s'mund të shtiret si portal.
alter table public.punet drop constraint if exists punet_portali_check;
alter table public.punet
  add constraint punet_portali_check check (
    (burimi = 'portal' and portali is not null and id_e_jashtme is not null and linku is not null and gjurma is not null)
    or (burimi <> 'portal' and portali is null and id_e_jashtme is null and gjurma is null)
  );

-- 4. Një rresht për çdo shpallje të portalit. (id-ja e rreshtit është gjithashtu "<portali>-<id_e_jashtme>".)
create unique index if not exists punet_portali_id_e_jashtme_uq
  on public.punet (portali, id_e_jashtme) where burimi = 'portal';
create index if not exists punet_gjurma_idx on public.punet (gjurma) where burimi = 'portal';
create index if not exists punet_aktive_krijuar_idx on public.punet (aktive, krijuar_me desc);

-- 5. Lejet mbeten si në J6: authenticated ka update vetëm te fushat e shpalljes, jo te fushat e importit.
--    (Insert-i i punëdhënësit mund të dërgojë "linku"; rregulli 3 e ndalon portali / id_e_jashtme / gjurma.)

notify pgrst, 'reload schema';
