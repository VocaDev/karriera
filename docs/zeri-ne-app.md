# Zëri në app · intervista me zë pa laptop (plani, 15.11.2026)

Qëllimi: një intervistë e vetme me çelësin **"Shkruaj · Fol"**. E njëjta intervistë, të njëjtat tabela (`intervistat`, `intervista_kthesat`), e njëjta logjikë e kthesës (`intervista-kthesa`), i njëjti raport. Fol vetëm shton dy gjëra rreth saj: zërin e kandidatit → tekst (STT), dhe tekstin e intervistuesit → zë (TTS).

**Ofruesit (vendimi i menaxherit, 15.11, pret provën e dëgjimit të Gentit):** STT me **Groq Whisper** (`whisper-large-v3`), TTS me **Gemini TTS** (`gemini-3.8-flash-tts`, çelës AI Studio). Secili është pas përshtatësit të vet (`_shared/zeri.ts`: `Degjuesi` dhe `Folesi`), që të ndërrohen veç e veç. Azure AI Speech ishte zgjedhja e parë, por Kosova s'është në listën e vendeve të regjistrimit; nëse pranohet një ditë, implementimi REST ekziston në commit-in `5f4db0d` (`_shared/zeri-azure.ts`).

## 1. Çka bën prototipi sot (`Karriera-Intervista`, dega `spike/s1-regjistrimi`)

- **Faqja në WebView** (`app/src/spike/intervista-faqja.ts`): TalkingHead 1.8 + three.js nga jsDelivr, avatari `mpfb-opt.glb` (nga `VocaDev/karriera@461cbaa`, `spike/mpfb-opt.glb`, 2,9 MB), kamera + MediaPipe për sytë, mikrofoni regjistrohet brenda faqes (MediaRecorder).
- **Truri në laptop** (`truri/server.mjs`, porta 8787): Claude me streaming, fjali pas fjalie; zëri me **edge-tts** (endpoint-i jozyrtar i Edge-it) që kthen **WordBoundary** për çdo fjalë; dëgjimi me Google STT. Seancat vetëm në memorie.
- **Lip-sync:** kohët e fjalëve nga edge-tts → hartë shkronjë → vizemë për shqipen (`sqVisemes`) → `head.speakAudio({ audio, words, wtimes, wdurations, visemes, vtimes, vdurations })`. Arbëri s'ka model mashkullor: një unazë pulson me zërin.

Çka s'kalon në app: laptopi, edge-tts, Google STT, seancat në memorie, prompt-et e veta (app-i ka prompt-et e WP4 te `_shared/intervista-ai.ts`).

## 2. Rrjedha për çdo kthesë (versioni 18.11: teksti i pari, zëri në dy pjesë)

```
App (Fol)                                   Edge Function intervista-zeri                  Ofruesit
─────────                                   ─────────────────────────────                  ────────
(në hapje: "mbushesi" merret një herë për intervistë: "Mirë, e kuptoj.")
prek mikrofonin → leje (vetëm kur zgjidhet Fol, me arsye)
"Po të dëgjoj · 0:12" · AudioStream → WAV 16 kHz mono int16
prek përsëri (ose 90 s) → pranimi luhet MENJËHERË nga kesh-i, pastaj "Arta po mendon…"
POST multipart {intervista_id, nr, audio.wav} ─►
                                            auth + pronari + intervista aktive + nr aktual + kufiri ditor
                                            STT ──────────────────────────────────────► Groq Whisper
                                            perpunoKthesen() = KODI I NJËJTË si intervista-kthesa ─► Claude
◄─ { transkripti, kthesa (teksti), zeri: null }   (pa TTS: teksti del menjëherë në ekran)
transkripti + pyetja e re shfaqen si tekst; avatari "mendon"
2 × POST { veprimi: "fol", nr, pjesa: "reagimi" | "pyetja" } PARALELISHT ─►  TTS ──► Gemini (WAV 24 kHz)
reagimi vjen (~4,4 s) → "Po flet Arta"; pyetja radhitet pas tij (gati ~0,9 s më vonë, pa pushim)
faqja mbaron të dyja → radha jote · "Përsërit pyetjen" luan të njëjtën audio pa thirrje të re
```

- **Pyetja e parë** (pas `intervista-nis`) dhe çdo pyetje kur intervista rihapet: të njëjtat dy thirrje `fol`. Teksti merret **nga DB**, jo nga app-i, që funksioni të mos bëhet TTS falas për çdo tekst.
- **Fundi:** reagimi i fundit + mbyllja ("Kaq ishte nga ana ime…") vijnë me zë brenda përgjigjes së fundit (reagimi i fundit s'ruhet në DB); raporti kërkohet njëkohësisht; rezultatet hapen pasi intervistuesi mbaron së foluri. Ekrani i rezultateve s'ndryshon.
- **Ndalo / Përsërit:** "Ndalo" (sa flet) e hesht avatarin dhe radha kalon te kandidati; "Përsërit pyetjen" (radha jote) e luan pyetjen sërish nga kesh-i.
- **Shkruaj · Fol** ndërrohet në çdo çast (lart në ekran); biseda dhe gjendja e intervistës janë të njëjtat.
- **Gabimet bien te teksti pa e humbur intervistën:** STT dështon → pyetja mbetet, "Provo përsëri" ose Shkruaj; kthesa dështon pas STT-së → serveri kthen edhe transkriptin, app-i e mban dhe e riprovon përmes `intervista-kthesa`; zëri i pyetjes s'vjen → pyetja është në ekran, radha kalon te kandidati; sekretet mungojnë ose kufiri ditor → Shkruaj. Pa internet / vonesë: tekstet e `src/lib/mesazhet.ts` ("S'ke lidhje me internetin, prandaj…", "Po vonon më shumë se zakonisht"), mikrofoni s'hapet pa internet. Leja e mikrofonit e refuzuar → Shkruaj.

## 3. Lip-sync

Gemini TTS kthen vetëm audio: pa vizema, pa kohë fjalësh.

| Rruga | Çka jep | Kosto / vonesë | Vendimi |
|---|---|---|---|
| **Kohë të vlerësuara në faqe** | kohëzgjatja e saktë nga `decodeAudioData`, e ndarë mes fjalëve sipas peshës | 0 thirrje, 0 ms | **po** |
| Whisper me `timestamp_granularities[]=word` mbi audion tonë | kohë të vërteta fjalësh | +1 thirrje për kthesë (≥ 10 s të faturuara), +0,5 s | jo tani |
| Vetëm amplituda (AnalyserNode → nofulla) | lëvizje pa forma buzësh | 0 | vetëm për unazën e Arbërit |

**Zgjedhja:** faqja dekodon WAV-in, e di kohëzgjatjen, dhe e ndan mes fjalëve: pesha = numri i vizemave të fjalës, + pushim pas presjes (2,5) dhe pas fundit të fjalisë (5), pa ~80 ms në fillim dhe ~120 ms në fund. Pastaj `head.speakAudio({ audio, words, wtimes, wdurations, visemes, vtimes, vdurations })` me hartën `sqVisemes` (e njëjta hartë edhe për en/de: s'është fonetike, por buzët ecin në ritëm). Nëse në telefon duket keq: hapi i radhës është Whisper me kohë fjalësh mbi audion e TTS-së (vetëm `fjalet` vijnë nga serveri; faqja s'ndryshon).

## 4. Zërat

### 4a. Azure AI Speech, opsional (25.11)

**Gjendja:** regjistrimi falas i Azure-s s'ofrohet nga Kosova (s'është te lista e vendeve; Genti s'përdor adresë të rreme). Kodi mbetet i vogël dhe opsional: **pa `AZURE_SPEECH_KEY` kapërcehet pa zë** dhe zinxhiri fillon te Gemini. Rruga kryesore sot është Gemini (§4c).

| Intervistuesi | sq | en | de |
|---|---|---|---|
| Arta (femër) | `sq-AL-AnilaNeural` | `en-US-JennyNeural` | `de-DE-KatjaNeural` |
| Arbër (mashkull) | `sq-AL-IlirNeural` | `en-US-AndrewNeural` | `de-DE-ConradNeural` |

Emrat dhe gjinia u kontrolluan te [lista zyrtare e zërave](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts). Për herë të parë Arbër ka zë mashkullor shqip.

- **REST, pa SDK** (`_shared/zeri-azure.ts`): `POST https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, SSML, formati `raw-24khz-16bit-mono-pcm` (i njëjti PCM 24 kHz që luan app-i me rrjedhë; për rrugën pa rrjedhë serveri e mbështjell si WAV). **Një kërkesë për kthesë** të intervistuesit.
- **Lip-sync:** zërat sq-AL s'kanë vizema (docs të Azure). Faqja e lëviz gojën si më parë: nga vala e vërtetë e zërit te rruga me rrjedhë, nga kohët e vlerësuara të fjalëve te rruga pa rrjedhë. Pa ndryshim te faqja.
- **Rendi:** Azure (vetëm me sekret) → modelet e Gemini-t me rradhë (§4c) → pyetja me tekst dhe fjalia "Zëri s'është i disponueshëm tani (kufiri i shërbimit). Pyetja është në ekran." (`kodi: "kuota"`). Pa `AZURE_SPEECH_KEY` ose `AZURE_SPEECH_REGION`, Azure kapërcehet pa zë.
- **429:** Azure pret sipas `retry-after` dhe riprovon një herë kur vonesa është e shkurtër (≤ 5 s; F0 lejon 20 kërkesa në 60 s). Gemini: shih §4c. "ditor": asnjë ofrues s'ka zë sot, ndaj app-i s'kërkon më dhe kandidati vazhdon me zë me pyetjen në ekran.
- **Kufiri mujor:** `public.zeri_azure_muaji` + `zeri_azure_rezervo()` (migrimi `20261125122000_zeri_azure.sql`) rezervojnë shkronjat para çdo kërkese dhe ndalen në **480 000** në muaj (UTC), nën 0,5 milion të F0 (shifra nga menaxheri; faqja e çmimeve s'u kontrollua). Numërohet teksti i dërguar (pa etiketat `<speak>` / `<voice>`, si e faturon Azure). **Pa migrimin, Azure kapërcehet** (fail-closed) dhe log-u e thotë.
- **Mostrat për veshin:** `_provat/zeri-azure-mostra.ts` (3 fjali shqip × 2 zëra), vetëm kur sekretet janë në mjedis; ende s'është ekzekutuar.

### 4c. Gemini: kufijtë, rradha e modeleve dhe si kursehen kërkesat (25.11)

Niveli falas (faqja e kufijve te AI Studio e Gentit, 25.11): `gemini-3.8-flash-tts` lejon **3 kërkesa në minutë** (kulmi i parë: 5/3) dhe ka edhe kufi ditor; gabimi 429 i Google-it tha **10 në ditë**. Kuotat janë për projekt dhe për model; kufiri ditor rinis në mesnatë sipas orës së Paqësorit ([docs](https://ai.google.dev/gemini-api/docs/rate-limits)). **S'krijohen projekte apo çelësa shtesë** për të shumëfishuar kuotat: është kundër kushteve të Google-it.

- **Kufizues i përbashkët** (`_shared/zeri-kufizuesi.ts`, migrimi `20261125123000_zeri_tts_kufijte.sql`, vetëm `service_role`): dritare rrëshqitëse 60 s për çdo model, kufi ditor dhe bllokim pas një 429. Para çdo kërkese rezervohet një vend. **Pa migrimin**, numërohet vetëm në kujtesën e instancës (dy instanca bashkë mund ta kalojnë kufirin; 429 e Google-it e bllokon modelin dhe kalohet te tjetri).
- **Rradha** (`_shared/zeri-rrotullimi.ts`): `gemini-3.8-flash-tts` → `gemini-3.1-flash-tts-preview` → `gemini-3.8-flash-lite-tts`; merret i pari me vend të lirë. Kur janë të gjitha plot, **pritet vendi i radhës deri në ~15 s** (app-i tregon "Arta po mendon…"); më shumë se kaq → `kodi: "kuota"`.
- **429:** modeli bllokohet sa thotë Google-i (pa vonesë të thënë: 60 s, ose deri në mesnatën e Paqësorit për kufirin ditor). Brenda përshtatësit s'ka më riprovim: asnjë kërkesë pa vend të rezervuar. **400 / 404** (model që s'e pranon kërkesën): bllokohet 1 orë.
- **Shqipja** ([docs](https://aistudio.google.com/docs/speech-generation), 25.11): "Tosk Albanian" figuron **vetëm te 3.8 Flash TTS**; te Flash-Lite "—"; për **3.1 preview** tabela e gjuhëve s'ka kolonë, dhe docs s'thonë as nëse punon me Interactions API / streaming, as nëse ka zërat Kore / Charon. **E paprovuar.** Para demos, dëgjoji: `_provat/zeri-lite-mostra.ts <dosja> [modeli]`. `GEMINI_LITE_SQ=0` e heq Lite për shqip; 3.1 fiket me `TTS_RPM_LIMITS` (rpm 0).
- **Kufijtë ndryshohen pa kod** me sekretin `TTS_RPM_LIMITS`, formati `modeli=rpm[/rpd]` me presje. Hyrja e zëvendëson krejt parazgjedhjen e atij modeli (pa `/rpd` = pa kufi ditor); rpm 0 e fik. Parazgjedhja: `gemini-3.8-flash-tts=3/10,gemini-3.1-flash-tts-preview=3,gemini-3.8-flash-lite-tts=3`. Kufijtë ditorë të dy të fundit s'dihen: **Genti i shikon te AI Studio** dhe i shton. Kur paguhet, p.sh. `gemini-3.8-flash-tts=<rpm i ri>` (pa `/rpd` nëse s'ka kufi ditor).
- **Parapërgatitja:** pranimi (i vetmi tekst fiks që merret në sfond) kërkohet ndërsa kandidati përgjigjet, me përparësi të ulët: nga kesh-i, ose vetëm kur mbeten të paktën 2 vende të lira (njëri i ruhet pyetjes), pa pritur kurrë. Kur s'bëhet, serveri kthen listë bosh dhe app-i e kërkon sërish te pyetja tjetër. Mbyllja shkon në të njëjtën kërkesë me reagimin e fundit, ndaj s'ka çka të parapërgatitet veç.
- **Një kërkesë për kthesë** (reagimi + pyetja, ose reagimi + mbyllja, në një audio).
- **Kur s'ka zë:** `kodi: "kuota"` dhe "Zëri s'është i disponueshëm tani (kufiri i shërbimit). Pyetja është në ekran."
- **Kesh i teksteve fikse** (`_shared/zeri-keshi.ts`): përshëndetja me pyetjen e parë (e njëjta për të njëjtën punë, intervistues dhe gjuhë) dhe pranimi i shkurtër. Kujtesa e instancës + tabela `zeri_kesh` (migrimi `20261125121000_zeri_kesh.sql`, i aplikuar). Për shqip ruhet vetëm audio e 3.8 Flash TTS. Pyetjet e AI-së s'ruhen: mund të kenë hollësi nga përgjigjet.
- **"Përsërit pyetjen"** luan audion që u tha, nga telefoni: 0 kërkesa. Pranimi ruhet edhe në telefon.

**Sa intervista përballon niveli falas** (llogari nga kodi, jo matje; 6 përgjigje, hera e parë për punën = 8 kërkesa):

| Modele në punë | Kërkesa / min | Intervista / orë, sa lejon RPM |
|---|---|---|
| Vetëm 3.8 Flash TTS | 3 | ~22 |
| 3.8 + 3.1 (ose + Lite) | 6 | ~45 |
| Të tre | 9 | ~67 |

**Tavani i vërtetë është kufiri ditor.** Me 10 në ditë, 3.8 Flash TTS mjafton për **1 intervistë me 6 përgjigje në ditë**. Nëse edhe dy të tjerët kanë rreth 10 (e panjohur), dalin gjithsej ~3 në ditë; pasi harxhohen, pyetjet dalin vetëm me tekst. Për një kandidat të vetëm, me tre modele s'pritet nëse kthesat janë ≥ ~7 s larg njëra-tjetrës. Skriptet te `_provat/` e përdorin të njëjtën kuotë pa u numëruar (i mbron bllokimi pas 429).

**Kërkesat TTS për një intervistë të plotë** (N = numri i përgjigjeve; nga kodi, jo i matur në prodhim):

| Intervista | Para (versioni i testuar nga Genti) | Tani, hera e parë për punën | Tani, e njëjta punë sërish |
|---|---|---|---|
| N = 3 (e shkurtër, minimumi) | 8 | 5 | 3 |
| N = 6 (4 pyetje + 2 vazhduese) | 14 | 8 | 6 |
| N = 9 (e plotë) | 20 | 11 | 9 |

Para: 1 (pyetja e parë) + 1 (pranimi) + 2 × N, +1 për çdo "Përsërit". Tani: 1 + 1 + N; herën tjetër N (përshëndetja dhe pranimi nga kesh-i; pa migrimin, përshëndetja mund të kushtojë sërish 1 nëse instanca është e re). Shtesë vetëm kur diçka dështon (një model tjetër pas gabimit, zëri rezervë) ose kur pyetja thuhet sërish pas rihapjes / Shkruaj → Fol (+1).

### 4b. Gemini: zërat

Gemini ka 30 zëra të gatshëm me përshkrim, jo me gjuhë; gjuha zbulohet nga teksti. Shqipja figuron si "Tosk Albanian" (vetëm te 3.8 Flash TTS, jo te Flash-Lite).

| Intervistuesi | Zëri | Përshkrimi (docs) |
|---|---|---|
| Arta | `Kore` | Firm (femëror) |
| Arbër | `Charon` | Informative (mashkullor) |

Stili për çdo kthesë (`speech_metadata.style`): intervistues i qetë, i ngrohtë, profesional, ritëm i natyrshëm, shqip standard. Prova e dëgjimit vendos; zërat ndërrohen te `ZERAT` në `_shared/zeri-gemini.ts`.

## 5. Formati i audios

- **Kandidati:** `expo-audio` `AudioStream.startFileRecordingAsync({ format: "wav" })` (Android + iOS), 16 kHz mono int16; iOS e konverton vetë. Serveri lexon header-in e WAV-it dhe e rimostron nëse pajisja dha tjetër shkallë. 90 s ≈ 2,9 MB, nën kufirin 25 MB të Groq. Në web, Fol s'ofrohet.
- **Intervistuesi:** Gemini kthen WAV 24 kHz mono 16 bit (nëse vjen PCM pa header, serveri e mbështjell). ≈ 48 KB/s, pra ≈ 0,5 MB për një kthesë 10 s (base64 ≈ 0,65 MB).

## 6. Buxheti i kohës për kthesë (nga "ndalo" deri te zëri)

Matur: 15.11 (5 thirrje) dhe 18.11 (4 thirrje, `_provat/zeri-kohet.ts` dhe `_provat/zeri-stream.ts`), nga laptopi.

| Matja | Rezultati |
|---|---|
| Gemini TTS, një kërkesë (pa streaming) | **4,4–5,3 s**, pothuajse pa marrë parasysh gjatësinë (edhe "Mirë, e kuptoj.", 15 shkronja: 4,7 s) |
| Reagimi + pyetja paralelisht | reagimi gati pas 4,4 s (4,5 s audio), pyetja 0,9 s më vonë: **pa pushim** mes tyre |
| Gemini TTS me `stream: true` | audio e parë pas **2,7 s**, fundi pas 5,2 s (SSE, 165 copa) |
| Groq Whisper (6 s audio) | 0,49 s |

| Nga "ndalo" | Çka sheh/dëgjon kandidati |
|---|---|
| 0–0,2 s | pranimi ("Mirë, e kuptoj.", nga kesh-i) dhe "Arta po mendon…" |
| ~3–5 s | transkripti i tij dhe pyetja e re si tekst (ngarkimi + STT + Claude) |
| ~7,5–10 s | "Po flet Arta": reagimi, pastaj pyetja pa pushim |

**Perceptimi:** ekrani s'ngrin kurrë (pranimi brenda sekondës, teksti pas ~3–5 s), por zëri i pyetjes vjen pas ~8 s. Hapi i radhës, i matur: **streaming end-to-end** (Gemini SSE → Edge Function → app me `expo/fetch` → luajtje progresive në WebView) e ul zërin e parë me ~2 s; rreth një ditë punë, jo para demos.

## 7. Kostoja e një interviste 10-minutëshe

Supozim: kandidati flet ~5 min (6 përgjigje × 50 s), intervistuesi ~8 kthesa × ~12 s ≈ **100 s audio**.

| | Free tier | Me pagesë |
|---|---|---|
| STT Groq `whisper-large-v3`, 5 min (min. 10 s për thirrje) | brenda kufijve falas të Groq | 5/60 × $0,111/orë ≈ **$0,01** |
| TTS Gemini 3.8 Flash TTS, 100 s × 25 token/s = 2 500 token audio | falas (Standard free tier) | 2 500 × $9/1 M ≈ **$0,02** (2026); $18/1 M nga 01.01.2027 ≈ **$0,05** |
| **Zëri gjithsej** | **$0** | **≈ $0,03** (2026) · **≈ $0,06** (2027) |

Claude mbetet sa te intervista me tekst; zëri s'shton thirrje AI. Kufijtë e free tier (kërkesa në minutë / ditë) s'janë në faqet e çmimeve dhe API s'ktheu header kufijsh në provë; kontrollohen në AI Studio dhe në konsolën e Groq.

**Kufiri ditor:** 30 minuta zë për përdorues në 24 orë (sekondat e regjistruara + sekondat e zërit të intervistuesit), plus kufiri ekzistues prej 3 intervistash të reja në ditë. Tabela `intervista_zeri` (migrim i ri, i paaplikuar) mban vetëm numra.

## 8. Çka ruhet

- **Ruhet:** transkripti te `intervista_kthesat.pergjigja` (si një përgjigje e shkruar), vlerësimi dhe raporti si sot; te `intervista_zeri`: `user_id`, `intervista_id`, `lloji`, `sekonda_stt`, `sekonda_tts`, koha. Asnjë tekst aty.
- **S'ruhet kurrë:** audio. WAV-i i kandidatit jeton në memorien e funksionit gjatë kërkesës dhe në cache të telefonit derisa ngarkohet (fshihet pas dërgimit); audio e intervistuesit jeton vetëm në WebView gjatë lojës. Asnjë log me transkript ose audio.

## 9. App-i

- `src/app/intervista/index.tsx`: segmenti **Shkruaj · Fol** (parazgjedhja Shkruaj derisa zëri të jetë live; në web vetëm Shkruaj).
- `src/app/intervista/[id].tsx`: segmenti edhe gjatë intervistës; në Fol, `PaneliIZerit`: avatari lart (WebView), statusi **Arta flet · Po të dëgjoj · Arta po mendon · Radha jote**, transkripti i të dyve, butoni i madh i mikrofonit (prek për të folur, prek për ta dërguar).
- Kodi: `PaneliIZerit.tsx`, `useZeri.ts` (rrjedha), `useRegjistruesi.ts` (+ `.web.ts`), `Avatari.tsx` (+ `.web.tsx`), `avatari-faqja.ts` (faqja), `mesazhet.ts` (protokolli). Server: `_shared/intervista-kthesa.ts` (kthesa e përbashkët), `_shared/zeri.ts` (përshtatësit + WAV), `_shared/zeri-groq.ts`, `_shared/zeri-gemini.ts`, `intervista-zeri/`, migrimi `20261115130000_intervista_zeri.sql`, prova `_provat/zeri-mostra.ts`.
- Avatari: faqja e prototipit e shkurtuar (pa kamerë, pa MediaPipe, pa mikrofon në faqe). GLB-ja është te `assets/avatar/arta.glb`; faqja e ngarkon nga jsDelivr te commit-i i ngrirë ku është tashmë publik (i njëjti skedar, blob `01d4e1b`), sepse një skedar lokal s'lexohet besueshëm nga një WebView me HTML string në Expo Go.
- Arbër: unaza neutrale që pulson me zërin, pa fytyrë femërore.
- Leja e mikrofonit kërkohet vetëm kur fillon Fol, me arsyen në shqip; refuzimi → Shkruaj, me mesazh.

## 10. Go-live (vetëm me OK-në e Gentit; asgjë s'është bërë)

1. **SQL** (SQL Editor), pas migrimeve të javës: `supabase/migrations/20261115130000_intervista_zeri.sql` (tabela `intervista_zeri`, minutat e zërit; kërkon `intervistat`).
2. **Sekretet:** `GEMINI_API_KEY` dhe `GROQ_API_KEY` (i ka vendosur Genti). `ANTHROPIC_API_KEY` si më parë.
3. **Deploy** (të gjitha `--no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`):
   - `supabase functions deploy intervista-zeri` (i ri)
   - `supabase functions deploy intervista-kthesa` (logjika e kthesës u zhvendos te `_shared/intervista-kthesa.ts`, pa ndryshim sjelljeje)
   - `supabase functions deploy intervista-nis` dhe `supabase functions deploy intervista-raporti` (ndajnë `_shared/intervista-ai.ts`, ku janë 4 hook-et e zërit; prompt-et e tekstit s'ndryshojnë)
4. **App:** varësitë e reja (`expo-audio`, `expo-file-system`, `react-native-webview`) janë në Expo Go; s'duhet build. `app.json` ka plugin-in e `expo-audio` me arsyen shqip të mikrofonit (vlen në build).

### 10b. Go-live për zërin (25.11, vetëm me OK-në e Gentit)

**Pa Azure (rruga e sotme):** `zeri_kesh` është aplikuar dhe funksionet e raundit të kaluar janë bërë deploy. Për kufizuesin dhe rradhën e modeleve:

1. **SQL:** `supabase/migrations/20261125123000_zeri_tts_kufijte.sql` (**i paaplikuar dhe i paprovuar në një Postgres**; pa të, numërohet vetëm brenda një instance).
2. **Sekreti** `TTS_RPM_LIMITS`: vetëm nëse kufijtë te AI Studio ndryshojnë nga parazgjedhja (§4c).
3. **Deploy:** vetëm `intervista-zeri` (komanda te hapi 3 më poshtë). Funksionet e tjera s'preken.
4. Prova: një intervistë me Fol; te log-et s'duhet të ketë "Numëruesi te DB s'u përdor". Rreshtat `[zeri-rrotullimi]` tregojnë cili model s'dha zë.

**Me Azure, nëse një ditë hapet llogaria:**

1. **Genti** krijon resursin "Speech" në Azure (niveli falas **F0**) dhe vendos te Supabase → Edge Functions → Secrets: `AZURE_SPEECH_KEY` dhe `AZURE_SPEECH_REGION` (p.sh. `westeurope`). Çelësi s'shkruhet askund tjetër.
2. **SQL:** `supabase/migrations/20261125122000_zeri_azure.sql` (numëruesi mujor; pa të Azure kapërcehet). Pa Azure, mjafton `20261125121000_zeri_kesh.sql` (kesh-i; opsional).
3. **Deploy:** `supabase functions deploy intervista-zeri --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`.
4. Prova: një intervistë me Fol; te log-et s'duhet të ketë `[zeri-azure] HTTP` ose "Numëruesi i Azure-s s'u lexua".

## 11. Prova në telefon (6 hapa, Expo Go)

1. **Nisja:** Intervista → zgjidh një punë → "Si përgjigjesh: Fol" → Nis. Del dritarja "Përgjigju me zë" me arsyen → "Lejo mikrofonin" → leja e sistemit → Lejo. Pritet: avatari (Arta) ose unaza (Arbër) brenda ~5 s, "Arta po mendon…", pastaj "Po flet Arta" me përshëndetjen dhe pyetjen e parë; teksti i pyetjes në bisedë.
2. **Përgjigjja:** prek mikrofonin → "Po të dëgjoj · 0:0x", unaza e kuqe lëviz me zërin → fol ~15 s → prek përsëri. Pritet: "Mirë, e kuptoj." menjëherë, "Po e shkruaj atë që the…", pastaj transkripti yt dhe pyetja e re si tekst, pastaj zëri (reagimi + pyetja pa pushim).
3. **Ndalo dhe Përsërit:** sa flet Arta, prek "Ndalo" → hesht, "Radha jote". Prek "Përsërit pyetjen" → e thotë sërish pa pritje.
4. **Shkruaj · Fol:** lart, kalo te Shkruaj → fusha e tekstit, biseda e njëjtë; shkruaj një përgjigje dhe dërgoje; kthehu te Fol → pyetja e re thuhet me zë.
5. **Pa internet:** fik Wi-Fi dhe të dhënat sa është radha jote → statusi "Pa internet", prekja e mikrofonit jep mesazhin "S'ke lidhje me internetin, prandaj…"; ndize → vazhdo normalisht.
6. **Fundi dhe leja e refuzuar:** përgjigju deri në fund (ose Dil → "Përfundo dhe shiko rezultatet") → mbyllja me zë, pastaj Rezultatet (ekrani i njëjtë si me shkrim). Fshi lejen e mikrofonit te Cilësimet, nis një intervistë të re me Fol → "Mikrofoni është i bllokuar" → "Vazhdo me shkrim" e kalon te Shkruaj.

Kontrollo edhe: errët/i ndritshëm, iPhone në Silent (zëri dëgjohet), dhe se pas regjistrimit zëri i Artës del nga altoparlanti (sesioni i audios kthehet në "playback").

## 12. Çka u provua dhe çka jo

U provua:
- Prova e dëgjimit me kodin e vërtetë të përshtatësve (`_provat/zeri-mostra.ts`, 5 thirrje): 4 mostra Gemini (Arta/Arbër × sq/en) te `docs/zeri-mostra/` (s'futen në git) dhe një transkriptim Whisper i "Arta sq": origjinali *"Mirë se erdhe. Më trego pak për veten dhe pse të intereson kjo punë."* → Whisper *"Mirëse Erdhe, më tërgo pak për vetën dhe pse t'intereson kjo punë?"* (kuptimi mbetet; gabime të vogla drejtshkrimi).
- Faqja e avatarit në shfletues: TalkingHead + modeli ngarkohen, Arta përshëndet me dorë dhe flet, `foli_filloi` → `foli_mbaroi`; Arbër: unaza pulson me zërin.
- Leximi i WAV-it dhe rimostrimi (test lokal në Deno); `tsc`, `expo lint`, `deno check`, `expo export -p web`.
- 18.11: kohët e Gemini TTS (3 thirrje) dhe streaming-u (1 thirrje), shih §6. Në shfletues: pranimi ndërpritet nga reagimi, pyetja radhitet pas reagimit pa pushim, "Ndalo" e hesht avatarin.

E paprovuar: funksioni `intervista-zeri` live (s'është bërë deploy), STT mbi zë njeriu (prova ishte mbi zërin e TTS-së), regjistrimi WAV i AudioStream në Expo Go në iPhone dhe Android, kalimi i audio session-it në iOS mes regjistrimit dhe WebView-it, ngarkimi multipart nga telefoni, lip-sync-u i vlerësuar në telefon me audion e Gemini-t.
