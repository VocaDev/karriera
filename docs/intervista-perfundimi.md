# Intervista · përkufizimi i "e gatshme" (24.11.2026)

Qëllimi (Genti, 24.11): *"Ai Interview to work with voice and everything fully finished."* Ky skedar është lista e kontrollit. Çdo rresht: **done** (me `skedar:rresht`), **missing** (do ndërtohet), **phone** (kodi është, por vetëm telefoni e provon) ose **Genti** (kërkon vendimin e tij). Gjendja fillestare është nga 24.11, para punës; kolona "Gjendja" përditësohet sa përparon puna.

Burimet: `CLAUDE.md` §5 "AI Interview Practice", §4 (ndjesia native, lëvizja), §7, §11; `HARTA.md`; bordi `design/karriera-ui.html` (ekranet 13, 14, 15, 17, 26, 27, 31, 32, 34, 38, 39).

## A. CLAUDE.md §5: kërkesat e intervistës

| # | Kërkesa | Gjendja | Ku / çfarë mungon |
|---|---|---|---|
| A1 | Leja e mikrofonit kërkohet vetëm kur duhet, me arsye | done · phone | `useZeri.ts:244` (Alert me arsyen para dritares së sistemit; vetëm në Fol); `app.json:44` (teksti iOS) |
| A2 | Refuzimi i lejes trajtohet | done · phone | `useZeri.ts:247` (i bllokuar → Cilësimet ose Shkruaj), `useZeri.ts:280` (refuzoi → Shkruaj) |
| A3 | Gjendje të qarta: regjistron · dëgjon · flet AI-ja | done | `useZeri.ts:401` (statusi me fjalë), `PaneliIZerit.tsx:104` (pika/pulsi), unaza e kuqe e nivelit `PaneliIZerit.tsx:198` |
| A4 | Start | done | mikrofoni i madh `PaneliIZerit.tsx:199`, `useZeri.ts:341` |
| A5 | Stop (dërgo) | done | prekja e dytë `useZeri.ts:342`; automatik në 90 s `useRegjistruesi.ts:114` |
| A6 | Anulo regjistrimin pa e dërguar | **missing** | `anulo()` ekziston `useRegjistruesi.ts:140` por s'ka buton; dalja nga ekrani s'e fshin skedarin |
| A7 | Pauzë / dalje nga intervista | done | "Dil" me konfirmim `[id].tsx:116`; intervista vazhdon brenda 24 orësh |
| A8 | "Ndalo" intervistuesin + "Përsërit pyetjen" | done · phone | `useZeri.ts:368`, `useZeri.ts:378` |
| A9 | Rrjeti bie (para dërgimit, gjatë dërgimit, gjatë zërit) | partial | para dhe gjatë dërgimit: done (`useZeri.ts:351`, `useIntervista.ts:215`); gjatë zërit që vjen në rrjedhë: do ndërtohet bashkë me streaming-un |
| A10 | AI/TTS/STT dështon | done | `useZeri.ts:174` (zëri dështon → teksti në ekran), `useIntervista.ts:222` (transkripti mbetet), `intervista-zeri/index.ts:281` |
| A11 | Pa dërgime të dyfishta | done | `useIntervista.ts:198` (ref `zene`), qiraja e kthesës `_shared/intervista-kthesa.ts:131`, `dergon` fik butonin |
| A12 | UI i shpejtë gjatë audios | partial · phone | audio e madhe si një mesazh base64 te WebView; me rrjedhë vjen në copa të vogla |
| A13 | Gjuhët SQ / EN / DE | done · phone | gjuha te nisja `index.tsx:271`, STT me `language` `zeri-groq.ts:22`, TTS zbulon gjuhën nga teksti; kualiteti i zërit dëgjohet vetëm në telefon |
| A14 | Shkruaj ⇄ Fol në çdo çast | done | `[id].tsx:250` (segmenti), `useIntervista.ts:251` |
| A15 | Zgjedhja Arta / Arbër | done (zëri); **Arbër 3D: Genti** | `ui.tsx` `ZgjidhIntervistuesin`; zëri `Charon` `zeri-gemini.ts:27`; ende unazë, pa model |
| A16 | Raporti dhe ndryshimi i gatishmërisë | done | `rezultatet.tsx:222-262` (para → pas, ±15 nga kodi) |
| A17 | Historiku i intervistave | partial | lista e 5 të fundit lart te Rezultatet `rezultatet.tsx:133`; s'ka ekran "Intervistat e tua" (bordi 31) |
| A18 | Kamera + gjuha e trupit (§5, "Avatar, camera") | **missing** | s'ka kamerë; Hapi 3 |
| A19 | Vonesa nga "mbarova" te zëri i pyetjes | **missing** | ~8–10 s sot (`docs/zeri-ne-app.md` §6); synimi < 3 s, shih seksionin D |

## B. Ekranet e bordit

| Ekrani | Çka kërkon | Gjendja | Ku / çfarë mungon |
|---|---|---|---|
| 13 | Para intervistës: kamera, mikrofoni, drita | missing | Hapi 3 (kamera); mikrofoni kontrollohet te A1 |
| 14 | Live: avatari, titrat, gjendja, "Përsërit" | done · phone | `[id].tsx` + `PaneliIZerit.tsx`; titrat = biseda e ekranit |
| 15 | Rezultatet | done | `rezultatet.tsx` |
| 17 | Gatishmëria u rrit (mbyllja e ciklit) | done | karta "Gatishmëria për këtë punë" `rezultatet.tsx:241` |
| 26 | Po i përgatis rezultatet | done | `[id].tsx:172` |
| 27 | Pa internet | done | `ShiritiPaInternet`, `useZeri.ts:351`, `[id].tsx:145` |
| 31 | Historiku (lista + ndryshimi) | missing | shih A17 |
| 32 | Transkripti (çka the vërtet) | done | përgjigjet e tua te `rezultatet.tsx:298` |
| 34 | Zgjidh intervistën (puna, gjuha, gjatësia, Shkruaj · Fol, Arta/Arbër) | done | `src/app/intervista/index.tsx` |
| 38 | Leja në kontekst para iOS | partial | Alert me arsye `useZeri.ts:270`, jo fletë; mjafton për kursin, e shënuar |
| 39 | Leja u refuzua | partial | Alert me dy rrugë `useZeri.ts:248`, jo ekran i plotë |

## C. Arbër, kamera, integriteti

| Pika | Gjendja |
|---|---|
| Arbër me fytyrë mashkullore (model 3D) | Hapi 2: gjetja e rrugës; **asgjë s'shkarkohet pa PO të Gentit** |
| Kamera e kandidatit + MediaPipe në WebView | Hapi 3: prova e `getUserMedia`, përndryshe `expo-camera` (varësi e re: PO e Gentit) |
| Sinjalet e integritetit | jashtë fushës |

## D. Vonesa e zërit: matja

Matje e vjetër (18.11, nga laptopi): STT 0,5 s · Claude ~2–3 s · Gemini TTS pa streaming 4,4 s · dy thirrje të ndara nga app-i. Kandidati dëgjon pyetjen pas ~8–10 s.

Plani: një përgjigje e vetme me rrjedhë (`application/x-ndjson`), transkripti dhe teksti dalin sapo janë gati, zëri vjen në copa nga Gemini SSE, luhet nga copa e parë. Synimi: **< 3 s nga "mbarova" te audio e parë e pyetjes**. Kufiri fizik: Gemini TTS ka ~2 s deri te byte-i i parë, plus STT dhe Claude; shih rezultatin e matur te raporti dhe te `supabase/functions/_provat/zeri-vonesa.ts`.

## E. Prova në telefon

Çka s'provohet pa telefon: AudioStream WAV në iPhone, sesioni i audios regjistrim → luajtje, AudioWorklet në WKWebView, ngarkimi multipart, lip-sync-u, kamera në WebView. Lista e numëruar për Genti-n është te raporti dhe te `docs/zeri-ne-app.md` §11.
