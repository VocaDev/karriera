# gati ("A jam gati?")

Krahason CV-në e fundit të kërkuesit me një punë konkrete dhe e ruan rezultatin te `public.gatishmeria` (`burimi = 'cv'`).
App-i: `llogaritGatishmerine(punaId)` në `src/lib/gati.ts`, ekrani `src/app/gati/[id].tsx`.

**Request:** `POST /functions/v1/gati` · `{ "puna_id": "<punet.id>" }`

**Response 200:**

```json
{
  "gatishmeria": {
    "id": "uuid",
    "puna_id": "p3",
    "cv_id": "uuid | null",
    "burimi": "cv",
    "intervista_id": null,
    "perqindja": 62,
    "ke": [{ "aftesia": "React Native", "deshmia": "Projekti i diplomës me Expo" }],
    "mungon": [{ "aftesia": "Testimi (Jest)", "pse": "Shpallja kërkon teste.", "si": "Shkruaj 3 teste për projektin tënd." }],
    "hapat": ["…", "…"],
    "arsyeja": "4 nga 6 kërkesat i ke me dëshmi; mungojnë testimi dhe REST API.",
    "modeli": "claude-haiku-5-5",
    "krijuar_me": "2026-11-15T10:00:00Z"
  }
}
```

**Gabimet:** `{ "error": "<fjali në shqip>" }`, me `"kodi": "pa_cv"` kur s'ka CV.
400 kërkesë e keqe · 401 pa sesion · 403 jo kërkues · 404 puna / CV-ja / PDF-ja s'u gjet · 413 / 415 PDF e keqe ·
422 shpallja s'thotë çka kërkon, ose AI-ja refuzoi · 429 kufiri (10 në 24 orë, tabela `gati_thirrjet`) · 500 / 502 / 503 gabim serveri ose AI-je.

## Si punon

1. `_shared/thirresi.ts`: sesion i vërtetë dhe llogari `kerkues`. Kufiri i tij (`cv_ai_thirrjet`) pranon vetëm funksionet e CV-së, ndaj `gati` e numëron vetë te `gati_thirrjet`.
2. Puna dhe CV-ja lexohen me JWT-në e përdoruesit (RLS). CV-ja e fundit sipas `versioni`: nëse ka `permbajtja` (CV e strukturuar), dërgohet ajo pa emër, email, telefon dhe datëlindje; përndryshe PDF-ja nga bucket-i `cv`.
3. Gjuha e teksteve: `profiles.gjuha` (`sq` / `en` / `de`), përndryshe shqip.
4. AI-ja: `MODELI` te `_shared/cv-ai.ts` (`claude-haiku-5-5`), `PERPJEKJA = "medium"` këtu. Structured output me zod; listat priten në kufijtë e kontratës (`ke` ≤ 10, `mungon` ≤ 8, `hapat` 1–3).
5. Rreshti shkruhet me çelësin sekret. Log-et s'kanë tekst CV-je, pune apo AI-je.

## Go-live

1. SQL Editor: `supabase/migrations/20261115110000_gatishmeria.sql` (pas `punet` dhe `cv`).
2. `supabase functions deploy gati --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr` (`ANTHROPIC_API_KEY` është vendosur për CV-në).
3. Prova me llogaritë demo: kërkuesi me CV merr rezultat; pa CV merr `pa_cv`; punëdhënësi merr 403; thirrja e 11-të brenda 24 orëve merr 429; kërkuesi s'i sheh rreshtat e tjetrit.
