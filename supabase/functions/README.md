# Edge Functions

Ky dosje ka funksionet e CV-së (`cv-review`, `cv-create`), `gati` (README i vet: [gati/README.md](gati/README.md)), tri funksionet e intervistës (`intervista-nis`, `intervista-kthesa`, `intervista-raporti`) dhe `portalet` (më poshtë, pjesa "Portalet"). Rendi i vetëm i go-live për të gjitha është te seksioni 3.

## CV: dy funksione

Dy funksione që thërrasin AI-në (Anthropic, `claude-haiku-5-5`: model i lehtë dhe i lirë, vendimi i Gentit 11.11) për CV-në.
`cv-review` me effort `medium`, `cv-create` me effort `low`. Haiku 5.5 s'ka model rezervë kur refuzon: funksioni kthen 422 me një fjali në shqip. Çelësi i AI-së jeton vetëm këtu, kurrë në app.

Të dy funksionet e CV-së (si `gati` dhe `intervista-*`, me kufijtë e tyre) e kontrollojnë vetë thirrësin (`_shared/thirresi.ts`):

1. sesion i vërtetë (JWT i përdoruesit, `auth.getUser`), përndryshe **401**
2. llogari `kerkues` (`public.lloji_im()`), përndryshe **403**
3. kufiri ditor për përdorues (tabela `cv_ai_thirrjet`; vetëm për `cv-review` dhe `cv-create`: `gati` ka `gati_thirrjet`, intervista ka kufirin e vet te `intervista-nis`), përndryshe **429**

Gabimet kthehen si `{ "error": "<fjali në shqip>" }`; app-i e tregon atë fjali.

## 1. cv-review (IN: AI · 02.12)

Analizon një CV, ose një PDF të ngarkuar, ose një CV të krijuar në app (`cvs.permbajtja`). App-i: `analizoCV(cvId)` në `src/lib/cv.ts`.

**Request:** `POST /functions/v1/cv-review` · `{ "cv_id": "<uuid>" }`

1. Lexon rreshtin `cvs` **me JWT-në e përdoruesit**: RLS-i garanton që CV-ja është e tija. Për PDF lexon skedarin nga bucket-i `cv`, kontrollon 5 MB dhe `%PDF-`, dhe e dërgon te AI-ja me structured output; AI-ja e kthen edhe CV-në si të dhëna (`cv`). Për CV të krijuar, `permbajtja` është vetë `cv`.
2. Sugjerimet marrin `id` dhe placeholder-at nga serveri; shqipja e AI-së kontrollohet (`_shared/sugjerimet.ts`).
3. E ruan analizën te `cv_reviews` me çelësin sekret (app-i s'mund ta shkruajë vetë notën).

**Response:** `{ "review_id": "<uuid>", "analiza": AnalizaRuajtur }` (`AnalizaRuajtur` te `_shared/cv-ai.ts`, versioni 2: `versioni: 2`, `nota`, `permbledhja`, `seksionet`, `cv`, `sugjerimet`, `rishkrimet` për app-in e vjetër) · kufiri: 5 analiza në 24 orë.

## 2. cv-create (del tani: vendimi i Gentit, 11.11)

Ndërtuesi i CV-së nga 5 përgjigje (format Kosovë, shqip). App-i: `krijoCV` në `src/lib/cv.ts`, ekrani `cv/ndertoje`. Rishkrimi në 5 formatet e tjera dhe në anglisht punon këtu, por app-i s'e hap para Demo Day-t (`CV_PAS_DEMO_DAY_HAPUR = false`).

**Request:** `POST /functions/v1/cv-create` · `{ "formati": "ks", "gjuha": "sq", "burimi": { "pergjigjet": [5 tekste] } }` ose `"burimi": { "cv": CvStrukturuar }` për rishkrim. Formatet: `ks`, `europass`, `eu`, `us`, `uk`, `ats`; gjuhët `sq`, `en`. Kufiri: 10 në 24 orë.

## 3. Go-live (vetëm me OK-në e Gentit; asgjë nga këto s'është bërë ende)

Rendi i vetëm për degën e bashkuar (7 degët e javës 14–15.11). **Migrimet para kodit që i lexon**: app-i i ri e lexon `punet` me kolonat e reja që në ekranin e parë, prandaj migrimi i portaleve nuk mund të vijë pas app-it.

1. **SQL**, në SQL Editor, në këtë rend:
   1. `supabase/migrations/20261104120000_punet.sql` (është aplikuar që në J5)
   2. `supabase/j6-hyrja-rls.sql` (është aplikuar që në J6)
   3. `supabase/migrations/20261111000000_cv.sql` (është aplikuar: `cvs`, `cv_reviews`, `cv_ai_thirrjet`, bucket-i `cv`)
   4. `supabase/migrations/20261114120000_punet_portalet.sql` (portalet: kolonat e reja te `punet`)
   5. `supabase/migrations/20261115100000_profili_roli.sql` (roli i synuar, gjuha e intervistës)
   6. `supabase/migrations/20261115110000_gatishmeria.sql` (`gatishmeria`, `gati_thirrjet`)
   7. `supabase/migrations/20261115120000_intervistat.sql` (kërkon `gatishmeria`: jep gabim nëse mungon)
2. **Sekretet:** `supabase secrets set ANTHROPIC_API_KEY=<çelësi>` (ose Dashboard → Edge Functions → Secrets) dhe `supabase secrets set PORTALET_SEKRETI=<varg i rastësishëm, 32+ shenja>` (vetëm për `portalet`). `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` dhe `SUPABASE_SECRET_KEYS` i jep platforma vetë.
3. **Deploy**, pa verifikimin e gateway-it (çelësat e rinj s'janë JWT; funksioni e verifikon vetë përdoruesin ose sekretin), në këtë rend:
   `supabase functions deploy cv-review --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
   `supabase functions deploy gati --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
   `supabase functions deploy intervista-nis --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
   `supabase functions deploy intervista-kthesa --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
   `supabase functions deploy intervista-raporti --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
   `supabase functions deploy portalet --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
   (`cv-create` s'ka ndryshuar në këtë bashkim; deploy-o vetëm nëse s'është live. `cv-review` ka ndryshuar: kontrata e re me `cv` dhe `sugjerimet`.)
4. **Prova** me dy llogari demo (`.env.demo`): kërkuesi ngarkon PDF dhe merr analizë; punëdhënësi merr 403; kërkuesi s'e sheh CV-në e tjetrit; analiza e 6-të brenda 24 orëve merr 429. Pastaj `gati` (CV, pa CV → `pa_cv`, punëdhënës 403, thirrja e 11-të 429) dhe intervista nga fillimi në fund (seksionet e tyre më poshtë dhe te `gati/README.md`). Portalet: shih "Go-live" te pjesa e tyre (provë pa shkrim, importi i parë një portal në një kohë, pastaj `supabase/portalet-orari.sql`).
5. **Pastaj** te `src/lib/vecorite.ts`: CV-ja, "A jam gati?" dhe Intervista bëhen `{ lloji: "gati" }` (me `href`) vetëm pasi rrjedha përkatëse punon në telefon.

## 4. Prova lokale e AI-së (pa Supabase)

```powershell
$env:ANTHROPIC_API_KEY = "..."
deno run --allow-env=ANTHROPIC_API_KEY --allow-net=api.anthropic.com --allow-read="C:\PATH\TO\cv.pdf" .\scripts\test-cv-ai.ts "C:\PATH\TO\cv.pdf"
```

Shtyp analizën e plotë. `--krijo` provon edhe krijimin e CV-së me të dhëna testi. PDF-ja dërgohet te Anthropic me çelësin tënd.

## 5. Siguria

- Asnjë çelës në Git, README ose app. Log-et s'përmbajnë CV, emra apo përgjigje të AI-së.
- Teksti brenda PDF-së dhe përgjigjet e përdoruesit trajtohen si të dhëna, jo si udhëzime (prompt injection).
- Nota është vlerësim i AI-së për CV-në, jo parashikim punësimi; app-i e thotë këtë nën notë.

---

# Portalet: shpalljet e vërteta (14.11, prototip; asgjë live ende)

Edge Function `portalet` sjell punët SWE dhe Asistent/PR nga KosovaJob dhe PortalPune te tabela `punet` me `burimi = 'portal'`. E thërret pg_cron, jo app-i. Pa AI: rolet, qyteti dhe aftësitë dalin nga rregulla (`portalet/harta.ts`).

## Burimet (kontrolluar 14.11.2026)

| Portali | robots.txt | Kushtet | Si lexohet | Statusi |
|---|---|---|---|---|
| **KosovaJob** | lejon gjithçka, përveç `/*?*drop=` | s'ka faqe kushtesh (vetëm privatësia) | lista në ballinë (titulli, qyteti, afati) + faqja e shpalljes (kompania, kategoria, orari) | ✅ përdoret |
| **PortalPune** | lejon `/jobs`, jep `sitemap.xml` | "të drejtat e autorit"; pa përfitim për palë të treta pa pëlqim me shkrim | `active_jobs_sitemap` + JSON-LD `JobPosting` te faqja | ✅ vetëm faktet + linku; **t'u kërkohet pëlqimi** (info@portalpune.com) |
| **OfertaPune** | `Crawl-delay: 10` | s'ka faqe kushtesh | lista në ballinë (titulli, kompania, qyteti, afati); parseri ekziston | ❌ **i ktheu botit tonë 403** (14.11): s'e anashkalojmë; pjesë e KosovaJob, shpalljet janë kryesisht edhe atje |
| DuaPune | lejon `*`, bllokon botët e AI-së | **9.3 dhe 9.4 ndalojnë scraper-ët dhe agregatorët** | – | ❌ s'përdoret |
| MerrJep | lejon `*` | – | njoftime të përgjithshme, jo portal pune | ❌ |
| Gjirafa | `Crawl-delay: 300` | – | s'ka më faqe punësh (`/Pune` = 404) | ❌ |
| SuperPuna | – | – | domeni në shitje | ❌ |
| PunaIme, LypPune | – | – | u blenë nga KosovaJob | ❌ |
| APRK (agjencia shtetërore) | s'ka robots.txt | – | lista me JavaScript (`/JobSeeker/Vacancies`) | ⏳ për më vonë |

Rregullat e sjelljes (`portalet/shfletuesi.ts`): një kërkesë në një kohë për host, të paktën 2 s mes kërkesave (ose `Crawl-delay` i portalit, nëse është më i gjatë), robots.txt lexohet në çdo ekzekutim, User-Agent `KarrieraJobsBot/0.1 (university course project; respects robots.txt)` pa të dhëna personale. Faqja e një shpalljeje hapet vetëm një herë (kur është e re) dhe vetëm nëse titulli i ngjan SWE ose Asistent/PR.

## Çka ruhet

`MODELI.md`: teksti i plotë i shpalljes **s'ruhet kurrë**. Për çdo shpallje: titulli, kompania, qyteti, roli, afati, aftësitë që përmend, linku te portali dhe një përmbledhje me fjalët tona ("Pozitë në zhvillim softueri te X, Prishtinë. Afati i aplikimit: … Shpallja përmend: React, Git. Shpallja e plotë dhe aplikimi: te KosovaJob."). Email-et dhe telefonat e rekrutuesve s'merren.

Migrimi `migrations/20261114120000_punet_portalet.sql` (pa aplikuar): `burimi` merr edhe `'portal'`; kolonat e reja `linku`, `portali`, `id_e_jashtme`, `gjurma`, `afati`, `aktive`, `pare_me`. RLS-i i J6 s'ndryshon: app-i shton vetëm `burimi = 'perdoruesi'`; rreshtat `portal` s'kanë pronar, s'i ndryshon e s'i fshin askush nga app-i; kërkuesi i lexon. Shpalljet e skaduara bëhen `aktive = false` (s'fshihen, që ⭐ të mos humbasin).

## Prova lokale (pa databazë)

```powershell
node scripts/provo-portalet.ts "$env:TEMP\portalet.json" 40
```

I njëjti kod (`burimet.ts` + `harta.ts`), pa Supabase. Shtyp numrat për çdo portal dhe rol, dublikatat, dhe e shkruan rezultatin në JSON jashtë Git-it. Zgjat disa minuta (pauzat janë me qëllim).

## Go-live (vetëm me OK-në e Gentit)

**App-i dhe migrimi shkojnë bashkë.** Që nga 14.11 kjo degë ndryshon edhe app-in: `src/lib/punet.ts` lexon kolonat e reja (`linku`, `portali`, `afati`, `aktive`) dhe `listoPunet` kthen vetëm `aktive = true`; Realtime-i dëgjon vetëm `burimi=eq.perdoruesi` (importi s'jep njoftime). `src/app/pune/[id].tsx` tregon afatin dhe ka "Ruaje", "Ndaje" dhe "Hape në shfletues". Pa migrimin, lista dhe detajet dështojnë (kolonat s'ekzistojnë), prandaj **migrimi aplikohet para merge-it të kësaj dege ose bashkë me të, kurrë pas.**

1. **SQL**: `migrations/20261114120000_punet_portalet.sql` në SQL Editor (para merge-it të kësaj dege në `main`).
2. **Merge** i degës (app-i i ri lexon kolonat e reja).
3. **Sekreti**: `supabase secrets set PORTALET_SEKRETI=<varg i rastësishëm, 32+ shenja>`.
4. **Deploy** (funksioni e kontrollon vetë sekretin, s'ka JWT përdoruesi):
   `supabase functions deploy portalet --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
5. **Provë pa shkrim**: `POST /functions/v1/portalet` me header `x-portalet-sekreti` dhe trup `{"provo": true, "portalet": ["kosovajob"]}` → kthen raportin dhe rreshtat, s'shkruan asgjë.
6. **Importi i parë**, një portal në një kohë (`{"portalet": ["kosovajob"]}`, pastaj `portalpune`), sepse funksioni ka 150 s. Me `maks_detaje` 20 (parazgjedhja) importi i parë mund të mbarojë në dy ditë.
7. **Orari**: `supabase/portalet-orari.sql` (pg_cron, çdo ditë 06:00 dhe 06:10 në Kosovë).
8. **Prova në telefon**: një punë "Nga KosovaJob" hapet me "Hape në shfletues"; "Ruaje" del te ⭐; importi s'jep njoftime; punët e skaduara s'dalin në listë.
9. **Më vonë**: "Nga KosovaJob" edhe te karta e listës (`KartaPunes.tsx`).
