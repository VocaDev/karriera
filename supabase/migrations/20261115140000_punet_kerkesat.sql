-- 15.11 · Kërkesat e një shpalljeje, të nxjerra nga AI-ja (Haiku) kur Edge Function "portalet" e lexon shpalljen.
-- I shton tabelës "punet" kolonën "kerkesat" (jsonb, e lejuar null). Mund të ekzekutohet disa herë.
-- NUK është aplikuar ende (15.11): pret OK-në e Gentit. Ekzekutohet PAS 20261114120000_punet_portalet.sql.
--
-- Forma e objektit (src/lib/punet.ts, tipi "Kerkesat"; vlerësohet te supabase/functions/portalet/kerkesat.ts):
--   { permbledhja, detyrat[], kerkesat[], perparesi[], arsimi, pervoja, gjuhet[], orari, paga, perfitimet[], aplikimi }
-- Të gjitha me fjalët tona: teksti i shpalljes s'ruhet kurrë (MODELI.md), vetëm faktet e nxjerra.
-- null = AI-ja s'u përdor ose dështoi: ekrani tregon "pershkrimi" dhe "aftesite" si më parë.
--
-- Siguria: asnjë ndryshim i RLS-it. Kolona lexohet nga ata që e lexojnë tashmë "punet" (policy punet_lexo,
-- grant select në tabelë); rreshtat "portal" i shkruan vetëm Edge Function me çelësin sekret.
-- Update-i i punëdhënësit është me kolona të caktuara (J6), kështu që s'e ndryshon dot më pas. Insert-i i tij
-- është me grant në tabelë, pra mund ta dërgojë kolonën te rreshti i vet "perdoruesi": check-u e kufizon në një
-- objekt ≤ 8 KB dhe app-i e lexon me kujdes (src/lib/punet.ts, lexoKerkesat) dhe e shfaq vetëm si tekst.

alter table public.punet
  add column if not exists kerkesat jsonb;

alter table public.punet drop constraint if exists punet_kerkesat_check;
alter table public.punet
  add constraint punet_kerkesat_check check (
    kerkesat is null or (jsonb_typeof(kerkesat) = 'object' and pg_column_size(kerkesat) <= 8000)
  );

notify pgrst, 'reload schema';
