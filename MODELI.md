# Modeli i të dhënave · Karriera

## J6 · 11.11 · Llogaritë, rolet dhe kush sheh çka

SQL-i i plotë: `supabase/j6-hyrja-rls.sql` (ekzekutohet pas migrimit të J5). Provat: `node --env-file=.env scripts/test-rls.mjs` (30 rregulla, vetëm me çelësin publishable, si një sulmues).

### Tri llojet e llogarisë (`profiles.lloji`)

| Lloji | Çka bën | Si merret |
|---|---|---|
| `kerkues` | lexon punët, ruan me ⭐ punët e veta | zgjidhet gjatë regjistrimit (ose çdo gjë tjetër që s'është punëdhënës) |
| `punedhenes` | poston punë, ndryshon dhe fshin vetëm të vetat | zgjidhet gjatë regjistrimit |
| `qender` | si punëdhënësi + numrat e përgjithshëm (`numrat_e_qendres()`) | **vetëm nga SQL Editor-i** (`update public.profiles set lloji = 'qender' …`) |

Lloji jeton te tabela `profiles` dhe **kurrë s'lexohet nga `user_metadata`**: atë e ndryshon vetë përdoruesi. Te regjistrimi metadata mban vetëm dëshirën; trigger-i `kur_krijohet_llogaria` e kopjon një herë dhe lejon vetëm `kerkues` ose `punedhenes`. Pastaj askush s'e ndryshon nga app-i: `update` lejohet vetëm për `emri`, `organizata`, `gjuha` (lejet e kolonave). Testi e provon: ndryshimi i metadata-s në "qender" s'jep asnjë të drejtë.

### Kush sheh çka

| Tabela | Pa hyrë | Kërkuesi | Punëdhënësi / Qendra | Pse |
|---|---|---|---|---|
| `punet` | asgjë | lexon të gjitha | lexon të gjitha · shton, ndryshon, fshin **vetëm të vetat** (`pronari_id = auth.uid()`) | shpallja është publike për përdoruesit e app-it; vetëm pronari e prek |
| `profiles` | asgjë | vetëm profilin e vet | vetëm profilin e vet | emri dhe email-i janë të dhëna personale |
| `punet_e_ruajtura` | asgjë | vetëm ⭐ e veta | asgjë (s'ka ⭐) | çka ruan dikush është privat |
| `numrat_e_qendres()` | asgjë | asgjë | vetëm qendra: 4 totale, asnjë emër | qendra mat përdorimin, s'sheh njerëz |

`pronari_id` e vendos serveri (`default auth.uid()`); app-i s'e dërgon kurrë. Shpalljet "seed" s'kanë pronar: i lexojnë të gjithë, s'i ndryshon askush.

**Realtime:** tabela `punet` është në `supabase_realtime`. Kur punëdhënësi poston, kërkuesi e merr punën menjëherë (njoftim + shenja te "Punët"). Realtime zbaton të njëjtin RLS: pa hyrë, serveri kthen vetëm "401 Unauthorized", pa të dhëna.

### Çka e pyetëm AI-n, çka mbajtëm (J6)

- **Ku ta ruajmë rolin?** `user_metadata` do të ishte më e lehtë, por atë e ndryshon vetë përdoruesi (gabimi që paralajmëroi Agoni). **Mbajtëm `profiles.lloji`** me leje kolonash.
- **A mund të zgjidhet "qender" gjatë regjistrimit?** Jo: kushdo do të bëhej qendër dhe do të shihte numrat. **Mbajtëm:** qendra jepet vetëm nga SQL Editor-i.
- **`using (true)` te `punet`?** E mbajtëm vetëm për leximin e shpalljeve (jo të dhëna personale) dhe vetëm për `authenticated`. Te `profiles` dhe `punet_e_ruajtura` çdo policy pyet `auth.uid()`.
- **Filtri `.eq()` në telefon?** Të ruajturat dhe profili lexohen **pa filtër**: RLS-i kthen vetëm të miat. Te "Punët e mia" `.eq("pronari_id", …)` vetëm zgjedh çka shfaqet; ndryshimin dhe fshirjen i mbron RLS-i (testi provon që llogaria tjetër s'mund t'i prekë edhe pa filtër).
- **Qendra si i sheh numrat pa i parë rreshtat?** Funksion `security definer` që kthen vetëm totale dhe refuzon çdo llogari që s'është `qender`. E mbajtëm.

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

- **Nga J6:** emri, email-i dhe lloji i llogarisë (`profiles`), dhe ⭐ të ruajturat (`punet_e_ruajtura`), secili i mbrojtur me RLS. CV ende jo.
- **Teksti i plotë i shpalljeve nga portalet** nuk do të ruhet kurrë: vetëm faktet, një përmbledhje me fjalët tona dhe linku te burimi.
- **Video dhe zëri i intervistës** nuk do të ruhen: vetëm notat dhe feedback-u.
- **Çelësat** (baza, AI) nuk janë në tabelë apo në repo: vetëm në `.env` lokal.

## Çka e pyetëm AI-n, çka mbajtëm

- E pyetëm cilat kolona i duhen ekranit Punët nga HARTA: mbajtëm ato që ekrani i tregon sot, plus `aftesite` dhe `roli`, sepse "A jam gati?" do t'i krahasojë me CV-në.
- E pyetëm si ta lejojmë shtimin nga telefoni pa login: mbajtëm policy-n që lejon vetëm `burimi = 'perdoruesi'`, jo `with check (true)`, që askush të mos shtojë "të dhëna zyrtare".
- E pyetëm a duhet `update` si te shablloni i klasës: jo ende, sepse pa login kushdo do të mund të ndryshonte shpalljet e të tjerëve.
