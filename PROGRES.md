# Progresi · Karriera

## J6 · 11.11.2026 · Hyrja në llogari dhe RLS

**Qëllimi:** dy llogari që nuk i shohin të dhënat e njëra-tjetrës. Tri lloje llogarie: kërkues pune, punëdhënës, qendër karriere.

### Si funksionon, në 5 rreshta

1. **Dera mbyllet:** policy-të e J5 u fshinë dhe `anon` s'ka më asnjë leje. Pa hyrë, Supabase kthen `permission denied` për çdo tabelë.
2. **Serveri e di pronarin:** çdo punë dhe çdo ⭐ ka `pronari_id`, që e vendos serveri me `default auth.uid()`; app-i s'e dërgon kurrë.
3. **Policy pyet "a është i yti?":** `using (pronari_id = auth.uid())` vendos cilat rreshta i sheh/prek; `with check (...)` vendos çka lejohet të shkruash. Profili, ⭐ dhe punët e punëdhënësit shihen vetëm nga pronari; kërkuesi i sheh të gjitha shpalljet.
4. **Roli jeton te `profiles.lloji`, jo te `user_metadata`:** trigger-i e krijon profilin, përdoruesi s'mund ta ndryshojë llojin, dhe "qender" jepet vetëm nga SQL Editor-i.
5. **Roja te `_layout.tsx`** (`Stack.Protected`) i tregon secilit vetëm ekranet e veta: hyrja, tab-at e kërkuesit, ose "Punët e mia" e punëdhënësit/qendrës. Roja është për përdoruesin; RLS-i është për sulmuesin.

### Çka punon

| Pjesa | Ku |
|---|---|
| SQL-i (hapat A + C + rolet) | `supabase/j6-hyrja-rls.sql` |
| Hyrja, dhe regjistrimi hap pas hapi (1 Lloji · 2 Të dhënat · 3 Verifikimi dhe 4 Hyrja "së shpejti") | `src/app/hyrja.tsx`, `src/lib/hyrja.ts`, gabimet në shqip `src/lib/hyrja-offline.ts` |
| Sesioni dhe rojet | `src/lib/sesioni.tsx`, `src/app/_layout.tsx` |
| Kërkuesi: punët, ⭐ që ruhet, të ruajturat te Profili | `src/app/(tabs)/`, `src/lib/ruajtura.ts` |
| Punëdhënësi dhe qendra: Punët e mia, Shto, Fshi, numrat | `src/app/organizata/` |
| Puna e re i shkon kërkuesit menjëherë (Realtime) + shenja te "Punët" | `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/pune.tsx` |
| Dil | `src/components/ButoniDil.tsx` |

### Testuar

- `node --env-file=.env scripts/test-rls.mjs`: **34/34** rregulla, vetëm me çelësin publishable (pa hyrë, me llogarinë tjetër, dy punëdhënës që s'ia shohin punët njëri-tjetrit, me rolin e gabuar, me `user_metadata` të ndryshuar, Realtime). Qendra e provuar veçmas: merr vetëm 4 totale.
- `npx tsc --noEmit` pa gabime · `npx expo lint` pa gabime · `npx expo export -p android` ndërtohet; në bundle s'ka asnjë çelës sekret.

### Çka mësuam / çka nuk e kuptuam

> ✏️ Genti / Edonik: shkruajeni me fjalët tuaja para dorëzimit.

## J5 · 04.11.2026 · Lidhja me Supabase

### Çka punon

| Misioni | Gjendja | Ku |
|---|---|---|
| **M0** · AGENTS.md nga EKIPI, BISEDAT, HARTA | ✅ | `AGENTS.md`, seksioni 0 përmbledh idenë, rrjedhën dhe listën brenda / jashtë |
| **M1** · app-i lexon nga Supabase | ✅ | lista e punëve dhe ekrani i detajeve lexojnë tabelën `punet` |
| **M2** · përdoruesi shton nga telefoni | ✅ | "+ Shto" → formulari → "Ruaj në Supabase" → puna e re del e para në listë |
| **M3** · ekrani kryesor i HARTA-s me të dhëna reale | 🟡 pjesërisht | ekrani **Punët** (hapi 2 i HARTA-s) punon plotësisht me të dhëna reale: lista, detajet, shtimi, rifreskimi. "A jam gati?" kërkon AI-në (java e AI-së, 02.12) |

**Baza e të dhënave**
- Tabela `public.punet`: titulli, kompania, qyteti, roli (SWE / Asistent/PR / Tjetër), përshkrimi, aftësitë, burimi, data.
- **RLS e ndezur:** kushdo lexon (shpalljet s'janë private); nga app-i lejohet vetëm shtimi me `burimi = 'perdoruesi'`; app-i s'mund të ndryshojë apo fshijë asgjë. Kufijtë e gjatësisë janë `check` në bazë dhe të njëjtët në formular.
- Migrimi në repo: `supabase/migrations/20261104120000_punet.sql`, me 6 shpalljet fillestare (kompani të sajuara).

**Si e lexon dhe e shkruan app-i**
- `src/lib/supabase.ts`: klienti, me URL-në dhe çelësin **publik** (publishable) nga `.env` (`EXPO_PUBLIC_…`).
- `src/lib/punet.ts`: tri funksione, ekranet thërrasin vetëm këto: `listoPunet()` (M1), `gjePunen(id)` (detajet, `null` kur s'ekziston), `shtoPunen()` (M2).
- `src/app/index.tsx`: lista me `useFocusEffect`, prandaj rilexohet sa herë kthehesh në të (edhe pas shtimit). Ka gjendje për ngarkim, gabim ("Provo përsëri"), listë bosh dhe pull-to-refresh.
- `src/app/pune/[id].tsx`: detajet; roja për id që s'ekziston (`/pune/x99` → "nuk u gjet").
- `src/app/pune/shto.tsx`: formulari; butoni s'aktivizohet pa të dhëna valide dhe s'dërgon dy herë.

**Testuar**
- `npx tsc --noEmit` pa gabime; build-i për Android kompilohet.
- Test automatik (Playwright, versioni web): lista me 6 punë, detajet, roja `/pune/x99`, shtimi i një pune të re që del menjëherë në listë dhe ruhet në Supabase (e kontrolluar në bazë, pastaj e fshirë).
- RLS e provuar me çelësin publik: leximi punon, shtimi si `seed` refuzohet, fshirja s'bën asgjë.

### Çka bëri agjenti (Claude Code)

- Gjeti lidhjen me bazën dhe krijoi tabelën me RLS dhe të dhënat fillestare, pastaj i provoi lejet me çelësin publik.
- Rregulloi `.env`: emrat `NEXT_PUBLIC_…` (Next.js) u bënë `EXPO_PUBLIC_…`, sepse Expo vetëm këto i fut në app. Kontrolloi që në build të jetë vetëm çelësi publik, jo fjalëkalimi i bazës apo çelësi i AI-së.
- Shkroi klientin e Supabase, shtresën `src/lib/punet.ts`, dhe i kaloi lista dhe detajet nga të dhënat në kod (`src/data/punet.ts`, u fshi) te Supabase.
- Shkroi formularin "Shto një punë" dhe e provoi gjithë rrjedhën me test automatik.
- Plotësoi `AGENTS.md` (të shkruar nga ne) me përmbledhjen e idesë dhe gjendjen e backend-it.
- Një commit pas çdo hapi: migrimi → M1 → M2 → AGENTS.md → ky fajll.

**Çka bëmë ne:** vendosëm idenë, HARTA-n dhe bisedat, shkruam `AGENTS.md`, krijuam projektin në Supabase, lexuam diff-in e çdo hapi dhe e provuam në telefon. Çelësat janë vetëm në `.env` lokal, që s'është në repo.

### Çka mësuam / çka nuk e kuptuam

> ✏️ Genti / Edonik: rishkruajeni me fjalët tuaja para dorëzimit.

Mësuam që pa një policy RLS për `select` lista del bosh pa asnjë gabim, dhe që Expo i fut në app vetëm variablat `EXPO_PUBLIC_…`, prandaj fjalëkalimi i bazës dhe çelësi i AI-së s'duhet ta kenë kurrë këtë prefiks. Ende s'e kemi të qartë si do ta lidhim shtimin e punëve me përdoruesin kur të vijë login-i.

### Hapi tjetër (J6 · 11.11 · Auth + RLS)

1. Login me Supabase Auth dhe tabela `profiles` (emri, roli SWE / Asistent/PR, gjuha e intervistës).
2. Tabela `punet_e_ruajtura`: ⭐ në kartë ruhet për secilin përdorues, me RLS "secili sheh vetëm të vetat".
3. Shtimi i punëve lidhet me përdoruesin (`shtuar_nga`), që të mos shtojë kushdo pa llogari.
4. Ngarkimi i CV-së në Supabase Storage (privat), si hap drejt "A jam gati?".
