# Intervista · përkufizimi i "e gatshme" (24.11.2026)

Qëllimi (Genti, 24.11): *"Ai Interview to work with voice and everything fully finished."* Ky skedar është lista e kontrollit. Çdo rresht: **done** (me `skedar:rresht`), **missing** (do ndërtohet), **phone** (kodi është, por vetëm telefoni e provon) ose **Genti** (kërkon vendimin e tij). Përditësuar 24.11 pas Hapit 1 dhe pas katër shtesave të menaxherit (Claude me rrjedhë, historiku, fleta e lejes, matja e re). Hapat 2 (Arbër 3D) dhe 3 (kamera) presin PO-në e Gentit.

Burimet: `CLAUDE.md` §5 "AI Interview Practice", §4 (ndjesia native, lëvizja), §7, §11; `HARTA.md`; bordi `design/karriera-ui.html` (ekranet 13, 14, 15, 17, 26, 27, 31, 32, 34, 38, 39).

## A. CLAUDE.md §5: kërkesat e intervistës

| # | Kërkesa | Gjendja | Ku / çfarë mungon |
|---|---|---|---|
| A1 | Leja e mikrofonit kërkohet vetëm kur duhet, me arsye | done · phone | fleta `LejaModal.tsx` (shpjegon para dritares së sistemit), `useZeri.ts` `sigurohuPerLejen`; vetëm në Fol; `app.json:44` (teksti iOS) |
| A2 | Refuzimi i lejes trajtohet | done · phone | ekrani "Mikrofoni është i fikur" `LejaModal.tsx` me "Hap Cilësimet" dhe "Vazhdo me shkrim" |
| A3 | Gjendje të qarta: regjistron · dëgjon · flet AI-ja | done | `useZeri.ts:401` (statusi me fjalë), `PaneliIZerit.tsx:104` (pika/pulsi), unaza e kuqe e nivelit `PaneliIZerit.tsx:198` |
| A4 | Start | done | mikrofoni i madh `PaneliIZerit.tsx:199`, `useZeri.ts:341` |
| A5 | Stop (dërgo) | done | prekja e dytë `useZeri.ts:342`; automatik në 90 s `useRegjistruesi.ts:114` |
| A6 | Anulo regjistrimin pa e dërguar | done · phone | buton "Anulo" `PaneliIZerit.tsx:92`, `useZeri.ts:403`; dalja nga ekrani e fshin WAV-in `useRegjistruesi.ts:163` |
| A7 | Pauzë / dalje nga intervista | done | "Dil" me konfirmim `[id].tsx:116`; intervista vazhdon brenda 24 orësh |
| A8 | "Ndalo" intervistuesin + "Përsërit pyetjen" | done · phone | `useZeri.ts:368`, `useZeri.ts:378` |
| A9 | Rrjeti bie (para dërgimit, gjatë dërgimit, gjatë zërit) | done · phone | para: `useZeri.ts` (mikrofoni s'hapet pa internet); gjatë: `klienti.ts:426` (transkripti mbahet, "Provo përsëri"); zëri që këputet pas tekstit: `onGabimZerit` → pyetja mbetet në ekran |
| A10 | AI/TTS/STT dështon | done | `useZeri.ts:174` (zëri dështon → teksti në ekran), `useIntervista.ts:222` (transkripti mbetet), `intervista-zeri/index.ts:281` |
| A11 | Pa dërgime të dyfishta | done | `useIntervista.ts:198` (ref `zene`), qiraja e kthesës `_shared/intervista-kthesa.ts:131`, `dergon` fik butonin |
| A12 | UI i shpejtë gjatë audios | done · phone | audio vjen në copa ~200 ms (`intervista-zeri/index.ts` `transmetoZerin`), jo një mesazh 0,65 MB; luhet në WebView `avatari-faqja.ts:225` |
| A13 | Gjuhët SQ / EN / DE | done · phone | gjuha te nisja `index.tsx:271`, STT me `language` `zeri-groq.ts:22`, TTS zbulon gjuhën nga teksti; kualiteti i zërit dëgjohet vetëm në telefon |
| A14 | Shkruaj ⇄ Fol në çdo çast | done | `[id].tsx:250` (segmenti), `useIntervista.ts:251` |
| A15 | Zgjedhja Arta / Arbër | done (zëri); **Arbër 3D: Genti** | `ui.tsx` `ZgjidhIntervistuesin`; zëri `Charon` `zeri-gemini.ts:27`; ende unazë, pa model |
| A16 | Raporti dhe ndryshimi i gatishmërisë | done | `rezultatet.tsx:222-262` (para → pas, ±15 nga kodi) |
| A17 | Historiku i intervistave | done · phone | ekrani `src/app/intervista/historiku.tsx` (nota, data, ndryshimi i gatishmërisë, "nga e para te e fundit"), hapet nga Profili; lexon `lexoHistorikun` `klienti.ts` (RLS) |
| A18 | Kamera + gjuha e trupit (§5, "Avatar, camera") | **missing** | s'ka kamerë; Hapi 3 |
| A19 | Vonesa nga "mbarova" te zëri i pyetjes | partial: 10,1 s → 5,8 s, **jo < 3 s** | shih seksionin D: Claude (~4,8 s) dominon; hapat e mbetur janë vendim i Gentit |

## B. Ekranet e bordit

| Ekrani | Çka kërkon | Gjendja | Ku / çfarë mungon |
|---|---|---|---|
| 13 | Para intervistës: kamera, mikrofoni, drita | missing | Hapi 3 (kamera); mikrofoni kontrollohet te A1 |
| 14 | Live: avatari, titrat, gjendja, "Përsërit" | done · phone | `[id].tsx` + `PaneliIZerit.tsx`; titrat = biseda e ekranit |
| 15 | Rezultatet | done | `rezultatet.tsx` |
| 17 | Gatishmëria u rrit (mbyllja e ciklit) | done | karta "Gatishmëria për këtë punë" `rezultatet.tsx:241` |
| 26 | Po i përgatis rezultatet | done | `[id].tsx:172` |
| 27 | Pa internet | done | `ShiritiPaInternet`, `useZeri.ts:351`, `[id].tsx:145` |
| 31 | Historiku (lista + ndryshimi) | done · phone | shih A17 |
| 32 | Transkripti (çka the vërtet) | done | përgjigjet e tua te `rezultatet.tsx:298` |
| 34 | Zgjidh intervistën (puna, gjuha, gjatësia, Shkruaj · Fol, Arta/Arbër) | done | `src/app/intervista/index.tsx` |
| 38 | Leja në kontekst para iOS | done · phone | fleta `LejaModal.tsx` (faza "shpjegim"): "Vazhdo" / "Jo tani"; iOS e hap si pageSheet |
| 39 | Leja u refuzua | done · phone | `LejaModal.tsx` (faza "refuzuar"): tri hapat, "Hap Cilësimet", "Vazhdo me shkrim" |

## C. Arbër, kamera, integriteti

| Pika | Gjendja |
|---|---|
| Arbër me fytyrë mashkullore (model 3D) | Hapi 2: gjetja e rrugës; **asgjë s'shkarkohet pa PO të Gentit** |
| Kamera e kandidatit + MediaPipe në WebView | Hapi 3: prova e `getUserMedia`, përndryshe `expo-camera` (varësi e re: PO e Gentit) |
| Sinjalet e integritetit | jashtë fushës |

## D. Vonesa e zërit: matja (24.11)

Skripti `supabase/functions/_provat/zeri-vonesa.ts` përdor kodin e vërtetë të serverit (Groq STT, Claude Sonnet 5.5 për kthesën, Gemini TTS) dhe mat nga "kandidati mbaroi" deri te **byte-i i parë i audios së pyetjes**. Një ekzekutim, nga laptopi, 24.11 (ngarkimi i WAV-it nga telefoni, start i ftohtë dhe DB s'përfshihen: shto ~0,3–1 s):

| Hapi | Vjetër | Rrjedhë (v1) | + Claude me rrjedhë (v2) |
|---|---|---|---|
| STT (Groq, 16 s audio) | 0,7 s | 0,8 s | 1,2 s |
| Teksti i kthesës (Claude) | 6,1 s | 5,4 s | 4,8 s |
| Reagimi gati (fusha "reagimi" mbyllet) | n/a | n/a | 3,7 s |
| **Audio e parë (reagimi)** | **10,1 s** | **7,1 s** | **5,8 s** |
| Fundi i audios | 11,5 s | 10,9 s | 10,4 s |

(v2 është çka bën tani serveri. Zëri i pyetjes nis kur kthesa mbaron; byte-i i tij i parë arrin ~8 s, ndërsa reagimi luhet nga 5,8 s deri ~10 s, pra pa pushim mes tyre. Dy ekzekutime të ndryshme, vlera STT/Claude luhaten ±0,5 s.)

Çka ndryshoi: (0, v2) Claude kthen JSON me rrjedhë dhe `onReagimi` jep tekstin e `reagimi` sapo mbyllet; TTS i tij nis aty (`_shared/intervista-ai.ts` `pyetMeRrjedhe`; teksti i folur është saktësisht ai që ruhet, e verifikuar nga skripti); (1) vlerësimi i përgjigjes s'është më në rrugën kritike (`nePlan`, `_shared/intervista-kthesa.ts:48`); (2) TTS me rrjedhë SSE: byte-i i parë ~1,7 s pas tekstit, jo ~4,5 s; (3) një kërkesë e vetme NDJSON: pa dy kërkesa të reja nga telefoni; (4) transkripti del në ekran pas ~0,8 s, jo pas kthesës; (5) pranimi "Mirë, e kuptoj." luhet nga kesh-i në ~0 s (pa ndryshim).

**Pse jo < 3 s:** para `reagimi` Claude duhet të shkruajë `shprehja`, `vazhdo`, `lloji`, `qasja` dhe `arsyeja_e_qasjes` (një fjali), kështu që reagimi mbyllet pas ~3,7 s; pastaj TTS ka ~1,7 s deri te byte-i i parë dhe STT 0,8–1,2 s. Kufiri me këtë skemë dhe këtë model është ~5,5 s. Opsionet që mbeten janë vendim i Gentit: (b) Haiku 5.5 për kthesën (shumë më shpejt, por shqipja dhe `qasja` duhen provuar); (c) heqja e `arsyeja_e_qasjes` nga skema (~0,5–1 s). Asnjëra s'është bërë: logjika `qasja` mbetet e paprekur.

## E. Prova në telefon

Çka s'provohet pa telefon: AudioStream WAV në iPhone, sesioni i audios regjistrim → luajtje, AudioWorklet në WKWebView, ngarkimi multipart, lip-sync-u, kamera në WebView. Lista e numëruar për Genti-n është te raporti dhe te `docs/zeri-ne-app.md` §11.
