# CV Edge Functions

Dy funksione që thërrasin AI-në (Anthropic, `claude-sonnet-5-5`) për CV-në. Çelësi i AI-së jeton vetëm këtu, kurrë në app.

Të dy funksionet e kontrollojnë vetë thirrësin (`_shared/thirresi.ts`):

1. sesion i vërtetë (JWT i përdoruesit, `auth.getUser`), përndryshe **401**
2. llogari `kerkues` (`public.lloji_im()`), përndryshe **403**
3. kufiri ditor për përdorues (tabela `cv_ai_thirrjet`), përndryshe **429**

Gabimet kthehen si `{ "error": "<fjali në shqip>" }`; app-i e tregon atë fjali.

## 1. cv-review (IN: AI · 02.12)

Analizon një CV të ngarkuar. App-i: `analizoCV(cvId)` në `src/lib/cv.ts`.

**Request:** `POST /functions/v1/cv-review` · `{ "cv_id": "<uuid>" }`

1. Lexon rreshtin `cvs` dhe PDF-në nga bucket-i `cv` **me JWT-në e përdoruesit**: RLS-i garanton që CV-ja është e tija.
2. Kontrollon 5 MB dhe `%PDF-`, e dërgon PDF-në te AI-ja me structured output (`AnalizaCVSchema`).
3. E ruan analizën te `cv_reviews` me çelësin sekret (app-i s'mund ta shkruajë vetë notën).

**Response:** `{ "review_id": "<uuid>", "analiza": AnalizaCV }` · kufiri: 5 analiza në 24 orë.

## 2. cv-create (del tani: vendimi i Gentit, 11.11)

Ndërtuesi i CV-së nga 5 përgjigje (format Kosovë, shqip). App-i: `krijoCV` në `src/lib/cv.ts`, ekrani `cv/ndertoje`. Rishkrimi në 5 formatet e tjera dhe në anglisht punon këtu, por app-i s'e hap para Demo Day-t (`CV_PAS_DEMO_DAY_HAPUR = false`).

**Request:** `POST /functions/v1/cv-create` · `{ "formati": "ks", "gjuha": "sq", "burimi": { "pergjigjet": [5 tekste] } }` ose `"burimi": { "cv": CvStrukturuar }` për rishkrim. Formatet: `ks`, `europass`, `eu`, `us`, `uk`, `ats`; gjuhët `sq`, `en`. Kufiri: 10 në 24 orë.

## 3. Go-live (vetëm me OK-në e Gentit; asgjë nga këto s'është bërë ende)

1. **SQL**, në SQL Editor, në këtë rend:
   1. `supabase/migrations/20261104120000_punet.sql` (është aplikuar që në J5)
   2. `supabase/j6-hyrja-rls.sql` (është aplikuar që në J6)
   3. `supabase/migrations/20261111000000_cv.sql` (i ri: `cvs`, `cv_reviews`, `cv_ai_thirrjet`, bucket-i `cv` dhe policy-të)
2. **Sekreti:** `supabase secrets set ANTHROPIC_API_KEY=<çelësi>` (ose Dashboard → Edge Functions → Secrets). `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` dhe `SUPABASE_SECRET_KEYS` i jep platforma vetë.
3. **Deploy**, pa verifikimin e gateway-it (çelësat e rinj s'janë JWT; funksioni e verifikon vetë përdoruesin):
   `supabase functions deploy cv-review --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
   `supabase functions deploy cv-create --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
4. **Prova** me dy llogari demo (`.env.demo`): kërkuesi ngarkon PDF dhe merr analizë; punëdhënësi merr 403; kërkuesi s'e sheh CV-në e tjetrit; analiza e 6-të brenda 24 orëve merr 429.
5. **Pastaj** te `src/lib/vecorite.ts`: CV-ja bëhet `{ lloji: "gati" }` vetëm pasi kjo rrjedhë punon në telefon.

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
