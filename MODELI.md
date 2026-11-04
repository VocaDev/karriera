# Modeli i të dhënave · Karriera

## Tabelat (J5)

### `public.punet` · shpalljet e punës

| Kolona | Tipi | Pse |
|---|---|---|
| `id` | text, çelësi | lista e përdor si `key` dhe adresa e detajeve (`/pune/[id]`) |
| `titulli` | text, 3–120 shkronja | titulli i pozitës |
| `kompania` | text, 2–80 | kompania |
| `qyteti` | text, 2–60 | qyteti ose "Remote" (për "Afër meje" më vonë) |
| `roli` | `SWE` / `Asistent/PR` / `Tjetër` | dy rolet e MVP-së nga HARTA |
| `pershkrimi` | text, deri 1000 | përshkrimi i shkurtër |
| `aftesite` | text[], deri 10 | aftësitë që kërkohen (për "A jam gati?" më vonë) |
| `burimi` | `seed` / `perdoruesi` | kush e shtoi: ne (të dhënat fillestare) apo dikush nga telefoni |
| `krijuar_me` | timestamptz | renditja: më të rejat lart |

**Siguria (RLS):** leximi publik (`select` për `anon`); shtimi lejohet vetëm me `burimi = 'perdoruesi'`; pa `update` dhe `delete` nga app-i. SQL-i: `supabase/migrations/20261104120000_punet.sql`.

## Çka NUK ruhet

- **Pa të dhëna personale ende:** s'ka llogari, emra, email apo CV (vijnë në J6 me Auth dhe RLS "secili sheh të vetat").
- **⭐ "Ruaj" në kartë** mbahet vetëm në telefon dhe humbet kur mbyllet app-i. Bëhet tabelë kur të kemi përdorues (J6).
- **Teksti i plotë i shpalljeve nga portalet** nuk do të ruhet kurrë: vetëm faktet, një përmbledhje me fjalët tona dhe linku te burimi.
- **Video dhe zëri i intervistës** nuk do të ruhen: vetëm notat dhe feedback-u.
- **Çelësat** (baza, AI) nuk janë në tabelë apo në repo: vetëm në `.env` lokal.

## Çka e pyetëm AI-n, çka mbajtëm

- E pyetëm cilat kolona i duhen ekranit Punët nga HARTA: mbajtëm ato që ekrani i tregon sot, plus `aftesite` dhe `roli`, sepse "A jam gati?" do t'i krahasojë me CV-në.
- E pyetëm si ta lejojmë shtimin nga telefoni pa login: mbajtëm policy-n që lejon vetëm `burimi = 'perdoruesi'`, jo `with check (true)`, që askush të mos shtojë "të dhëna zyrtare".
- E pyetëm a duhet `update` si te shablloni i klasës: jo ende, sepse pa login kushdo do të mund të ndryshonte shpalljet e të tjerëve.
