# Rishikimi i dizajnit · Karriera · 25.11.2026

> Rishikim dhe plan, pa kod. Bazuar te 51 screenshot-et e 24.11 (`docs/testi-web-24-11/`, llogaria Demo Kërkues, light + dark), te kodi në `bdbc59f` dhe te bordi `design/karriera-ui.html` (drejtimi D · Gjurmimi). Screenshot-et janë nga web-i, ndaj tab bar-i është lart; në telefon është poshtë. Punëdhënësi dhe qendra s'kanë screenshot-e: për ta flas vetëm nga kodi.
>
> Mockup-et para/pas: `docs/dizajni-mockups/index.html` (hape në shfletues).

---

## 1. Verdikti në 5 rreshta

1. **Çka funksionon:** skeleti është i drejtë dhe më i mirë se shumica e app-eve studentore: chrome i sistemit (tab-at native, segmented control, form sheets, haptics, badge me numër të vërtetë), rruga CV → Përputhja → Intervista → Mëso → Gati, numra të vërtetë pa pikë të shpikura, dhe kopje e ndershme ("Vlerësim i AI-së, jo garanci punësimi").
2. **Pse duket e zbehtë për Gen Z:** çdo ekran është e njëjta recetë: gradient lart, karta me të njëjtin rreze 22, butona pill të zinj, Plus Jakarta 700 kudo. S'ka asnjë fytyrë, asnjë figurë, asnjë logo. Arta, ylli i app-it, shfaqet si shkronja "A" në një rreth gri (dhe Arbëri po ashtu "A").
3. **"Portokalli mbi të zezë" s'është problemi; mënyra si përdoret, po.** Portokallia vetë është e mirë dhe e dallueshme. E prish (a) gradienti kafe `#2B1A10` në kokën e çdo ekrani në dark (`TabEkrani.tsx:17-18`, `ui.tsx:36-43`), që e lyen gjithë app-in kafe, (b) tab bar-i portokalli (`(tabs)/_layout.tsx:37`), pra portokallia s'do më të thotë "progres", (c) mungesa e çdo ngjyre tjetër me kuptim.
4. **Funksionet më të forta janë fshehur:** intervista hapet me shkrim si parazgjedhje (`intervista/index.tsx:84`), avatari zë 30% të ekranit, roast-i i CV-së rri poshtë faqes, dhe ekrani i CV-së i jep përparësi "Ngarko PDF" edhe kur CV-ja është analizuar tashmë.
5. **Rruga:** mbaj drejtimin D, hiq gradientin, shto **2 ngjyra me rol** (Kobalt = Arta dhe intervista, Limon = fitoret e vërteta), vendos **portretin e Artës** kudo ku sot është "A", ilustrime vetëm në 6 momente, dhe bëje **intervistën me zë hyrjen kryesore**. Pa ndryshuar arkitekturën.

---

## 2. Ngjyra dhe brendi

### Rregulli i ri (një fjali për secilën)

| Ngjyra | Do të thotë | Ku del | Ku nuk del kurrë |
|---|---|---|---|
| Portokallia (`theksi`) | sa afër je: progres | Unaza, %, rruga, shiriti i progresit | tab bar, butona të zakonshëm, sfonde |
| **Kobalti (`blu`)** e re | Arta: praktika me intervistuesen | kartat e intervistës, "Arta flet", butoni "Praktiko intervistën", ilustrimi i intervistës | progres, gabime |
| **Limoni (`limon`)** e re | ke fituar diçka të vërtetë | streak, rekord personal, "Gati" (≥ 80%), CV e re mbi notën e vjetër | tekst mbi sfond të çelët, dekor |
| Gjelbër / kuqe (`ok`, `keq`) | semantike | ✓ ke, ✕ mungon, gabime | dekor |
| Neutralet | gjithçka tjetër | sfonde, karta, tekst, kontrolle | |

Pra: **portokallia = sa afër je, bluja = Arta, limoni = kur fiton.** Ngjyra hyn në përmbajtje (unaza, karta e intervistës, momenti i fitores), jo në chrome. Kështu app-i merr më shumë ngjyrë pa u bërë "ngjyra kudo".

### Tokenat (mapuar te `useTema`, `src/lib/tema.ts`)

Kontrasti është WCAG 2.1, i llogaritur (skripti në fund). Kufiri: 4,5:1 për tekst normal, 3:1 për tekst të madh (≥ 24 px, ose ≥ 18,7 px bold) dhe ikona.

**Ndryshime te tokenat ekzistues**

| Token | Light sot → propozim | Dark | Pse |
|---|---|---|---|
| `zbehur` | `#75726D` → **`#6A6762`** | `#9C9CA3` (pa ndryshim) | sot 4,39 mbi `sfondi` dhe 4,09 mbi `karta2`: **dështon**. I riu: 5,16 / 4,81 / 5,63 mbi të bardhë. Dark: 6,37 mbi `karta`. |
| `theksi` | `#F2611D` (pa ndryshim) | `#FF7A3D` | mbetet për mbushje, Unazën dhe numrat e mëdhenj. Light mbi të bardhë = 3,23: kalon vetëm për tekst të madh. |
| `theksiTeksti` **i ri** | **`#B23A0A`** | `#FF7A3D` | për tekst të vogël portokalli ("−5 nga herë e kaluar", chip-at `theks`). 6,00 mbi të bardhë, 5,50 mbi `sfondi`, 5,06 mbi `theksiButë`. Dark: 6,71 mbi `karta`. |
| `okTeksti` **i ri** | **`#157A45`** | `#3DD68C` | `ok` light `#1E9E5A` = 3,45 mbi të bardhë: mirë për ikona, jo për tekst. I riu 5,38; dark 9,26. |
| `theksiButë` | `#FDE8DA` | `#2B1A10` | mbetet vetëm si sfond i chip-it `theks`. **Nuk** përdoret më si sfond koke ose gradient. |

**Tokenat e rinj**

| Token | Roli | Light | Dark | Kontrasti |
|---|---|---|---|---|
| `blu` | Arta, intervista, butoni i saj | **`#2B50D6`** | **`#8AA4FF`** | L: 6,52 mbi të bardhë, e bardha mbi të 6,52 · D: 7,31 mbi `karta`, 8,12 mbi `sfondi`; teksti mbi butonin dark = `#0B1230` (7,73) |
| `bluButë` | sfondi i kartave të intervistës, flluska e Artës | **`#E8EDFF`** | **`#16203F`** | `blu` mbi të: 5,58 (L) · 6,73 (D) |
| `limon` | mbushja e momentit të fitores (gjithmonë me tekst `teksti` sipër) | **`#FFE066`** | **`#FFD84D`** | `#141414` mbi të: 14,13 (L) · 13,32 (D). Dark si tekst mbi `karta`: 12,56 |
| `limonButë` | sfondi i rreshtit të streak-ut / rekordit | **`#FFF4C2`** | **`#2E2608`** | `limonTeksti` mbi të: 5,83 (L); `limon` mbi të 10,87 (D) |
| `limonTeksti` | tekst i vogël mbi `limonButë` | **`#7A5900`** | `#FFD84D` | 5,83 (L) · 12,56 (D mbi `karta`) |

Në `type Tema` kjo shton 7 fusha (`theksiTeksti`, `okTeksti`, `blu`, `bluButë`, `limon`, `limonButë`, `limonTeksti`). Bluja s'është vjollcë dhe s'bën gradient me asgjë: kështu i shmangim klishetë e "AI-së" (vjollcë → blu, shkëlqim).

### Chrome pa ngjyrë

- **Hiq gradientin** kudo: `GradientiSiper` (`TabEkrani.tsx:35-45`), `Faqja` (`ui.tsx:36-43`), `hyrja.tsx:239`, `Fillimi.tsx:72`, `ProfiliIm.tsx:121`, `KreuIPunedhenesit.tsx` (përdor `GradientiSiper`).
- **Koka e tab-ave** merr `t.sfondi`, jo `t.theksiButë` (`TabEkrani.tsx:17-18`). Në iOS 26, titulli i madh mbi sfond të qetë është vetë pamja native.
- **Tab bar-i** pa `tintColor={t.theksi}` (`(tabs)/_layout.tsx:37`, `organizata/_layout.tsx:14`): ose ngjyra e sistemit, ose `t.teksti`. Kjo e kthen portokallinë te kuptimi i saj, siç e thotë AGENTS.md #13.
- **Dark**: `sfondi` `#0E0E0F` mbetet. Pa gradientin kafe, dark-u bëhet grafit i pastër dhe portokallia + bluja dalin vetë.

### Tipografia

- Plus Jakarta Sans mbetet për UI-në (i ka ë, ç). Por sot pothuajse çdo titull është 700/800: hierarkia bëhet me madhësi dhe ngjyrë, jo me peshë. Titujt e kartave 600, teksti 400, vetëm titujt e ekranit 700.
- Madhësitë me presje (`16.5`, `12.5`, `14.5`) → një shkallë: 12 · 13 · 15 · 17 · 20 · 28 · 34 · 56 (numrat).
- Asnjë tekst nën 12 pt. Sot shiriti "E RE" është 9 px dhe me shkronja të mëdha (`KartaPunes.tsx:66-67`).
- Opsional (faza 3): një font display vetëm për numrat e mëdhenj (Unaza, nota), p.sh. Bricolage Grotesque (OFL, ka ë/ç; ta provojmë me "Gati 72%" para se ta vendosim).

---

## 3. Imazheria

**Parimi:** imazhe vetëm aty ku tregojnë diçka që s'e thotë teksti. Asnjë stock-foto me shtrëngim duarsh, laptop në tavolinë ose njerëz që qeshin para një grafiku. Stili: **objekte të vërteta dhe Arta**, me ngjyrat e rolit (portokalli/blu/limon) mbi sfond neutral.

| Ku | Çka | Stili | Burimi dhe licenca |
|---|---|---|---|
| **Kudo ku sot del "A"** (chat, historiku, Stërvitja, Rezultatet, Cilësimet "Kush të interviston") | portreti i Artës dhe i Arbërit, 3 shprehje (neutrale, buzëqesh, mendon) | rrethor, sfond `bluButë`, ndriçim i butë | **I bëjmë vetë:** render nga i njëjti model 3D (`arta.glb`, MPFB/MakeHuman, dalja CC0) në WebView ose Blender, PNG 512 px, `assets/images/arta/`. Pa licencë të huaj. |
| **Intervista** (sfondi pas avatarit) | zyra | foto e turbulluar, e errët | seanca tjetër po e shton tashmë; vetëm të jetë Unsplash/Pexels (licenca lejon përdorim komercial pa atribuim, s'lejon shitjen e fotos si e tillë) ose foto jona. |
| **Fillimi** (role picker, `Fillimi.tsx`) | 2 ilustrime: SWE (laptop + kod) · Zyrë (telefon + kalendar) në vend të ikonave | "spot" i vogël 96 px, objekte, jo njerëz | **Të bëra vetë** si SVG (Unaza + objekte), ose **Open Peeps** (CC0) nëse duam njerëz. |
| **Gjendjet bosh** (Punët pa rezultat, Historiku bosh, Pa CV, "S'kemi çka të krahasojmë", Pa internet, Kandidatët bosh) | 6 ilustrime të vogla, një seri | e njëjta gjuhë si më lart | të bëra vetë (SVG) ose unDraw (falas, komercial, pa atribuim; **ndalon** përdorimin për trajnim AI) të ringjyrosura me tokenat. Max 120 px, sipër titullit. |
| **Kartat e punëve** | monogram i kompanisë (2 shkronja) | katror 40 px, rreze 10, njëra nga 6 ngjyra të buta të nxjerra nga emri | **Kod**, pa logo të huaja (logot janë marka tregtare; s'i marrim nga portalet). Punëdhënësit e regjistruar ngarkojnë logon e vet më vonë. |
| **Momenti "Gati"** (≥ 80%) dhe streak | Unaza e mbyllur + konfeti i vogël 0,6 s | `limon` + `theksi` | kod (Reanimated), respekton Reduce Motion. |
| **Rezultatet** | Arta + numri; jo grafik dekorativ | | portreti më lart |

Fotot tona (studentë të UMIB-it) vetëm me pëlqim me shkrim. Skedarët e imazheve: `expo-image` (cache, placeholder), WebP, ≤ 60 KB secili.

---

## 4. Ndjesia native: boshllëqet ndaj listës në AGENTS.md

| # | Pika | Gjendja | Ku | Çka duhet |
|---|---|---|---|---|
| 1 | Titujt e mëdhenj | **Pjesërisht** | tab-at OK (`TabEkrani.tsx:13`); por `cv/index.tsx:132`, `intervista/historiku.tsx:63`, `intervista/rezultatet.tsx:230`, `permbledhja.tsx` vizatojnë `Titulli` brenda përmbajtjes nën një kokë Stack-u bosh me shigjetë: dy koka | `headerLargeTitleEnabled` dhe `title` në Stack për këto ekrane, hiq `Titulli` nga përmbajtja |
| 1b | Ngjyra e kokës | **Jo** | `TabEkrani.tsx:17-18` = `theksiButë` | `t.sfondi` (shih §2) |
| 2 | Sheets | **OK** | `_layout.tsx:116-130` (`[0.75, 1]`, dorezë, X) | "Shto tekstin" (`pune/teksti.tsx`) dhe "Kush të interviston" mund të jenë `fitToContents` |
| 3 | Haptics | **OK** | `lib/prekja.ts`, përdoret me masë | shto `sukses` kur mbaron intervista dhe kur del "Gati" (kontrollo `intervista/rezultatet.tsx`) |
| 4 | Press feedback | **OK** | `Prekshme.tsx` | ylli i ruajtjes është tekst `★/☆` (`KartaPunes.tsx:87-88`): bëje `Ikona` `star`/`star.fill` |
| 5 | Tab badges | **OK** | `(tabs)/_layout.tsx:47` | |
| 6 | Segmented control | **Tepër** | intervista ka 4 segmente njëri pas tjetrit (`intervista/index.tsx:247, 273, 290` + Arta/Arbër) | mbaj vetëm Gjuhën; Arta/Arbër me portrete (2 karta të vogla); Gjatësia dhe Shkruaj/Fol dalin te "Më shumë" |
| 7 | Long-press te karta e punës | **Mungon** | `KartaPunes.tsx:63` s'ka `Link.Menu` / `onLongPress` | `Link.Menu` (Ruaje, Ndaje, Hape në shfletues), fallback `ActionSheetIOS` / `Alert` |
| 8 | Share, in-app browser | **OK** | `pune/[id].tsx` | |
| 9 | Pull-to-refresh, skeleton | **OK** | `TabScroll`, `Skeleti.tsx` | |
| 10 | Dark mode pa blic | **OK** | | pa gradientin bëhet edhe më i pastër |
| 11 | Dynamic Type | **Pjesërisht** | `maxFontSizeMultiplier` edhe te tekst 16 px (`historiku.tsx:140`) dhe 22 px (`rezultatet.tsx:250`); shiriti 9 px (`KartaPunes.tsx:66`) | kufizo vetëm numrat gjigantë; provo 130% te karta e punës dhe te chat-i |
| 12 | Ikona dhe splash | **OK** | Unaza | |
| 13 | Portokallia vetëm për progres | **Jo** | tab tint (`(tabs)/_layout.tsx:37`, `organizata/_layout.tsx:14`), shiriti "E RE" (`KartaPunes.tsx:65`), ikonat e rreshtave te Profili dhe Sot (`(sot)/index.tsx:259`) | tab-at neutralë; "E re" = chip neutral; ikonat në `zbehur` |
| + | Shenjat "AI" (unslop) | | `cv/analiza.tsx:344, 354` ("REZULTATI I ANALIZËS", "NOTA E CV-SË" me shkronja të mëdha); "→" në tekst (`cv/index.tsx:263-264`); emoji në segment (`cv/analiza.tsx:488` "Roast 🔥") | sentence case; chevron i sistemit në vend të "→"; ikonë `flame` në vend të emoji |
| + | Arta dhe Arbëri | **Gabim** | të dy kanë `inicialja: "A"` (`lib/intervista/tipet.ts:31-32`) | portreti (§3); deri atëherë "Ar" / "Ab" |

---

## 5. Rrjedhat (UX)

### 5.1 Hapja e parë dhe mysafiri

- **Sot:** hyrja kërkon llogari para se të shohësh qoftë edhe një punë. Dega `claude/mysafir-1790ac` (seanca *mysafir*) e zgjidh: mysafiri hyn te Punët. **Mbaje** dhe shto një ekran të vetëm mirëseardhjeje (jo tur me 3 faqe): portreti i Artës + 1 fjali + "Shiko punët" / "Kam llogari".
- Fjalia e parë: "Gjej punën. Shih sa je gati. Praktiko me Artën." (3 folje, pa "AI-powered").
- Role picker (`Fillimi.tsx`): 2 karta me ilustrim, jo me ikonë. "Për çfarë pune po përgatitesh?" është mirë. Butoni "Dil nga llogaria" në fund të onboarding-ut është i panevojshëm: hiqe.
- Leja e mikrofonit dhe kamerës: vetëm kur nis intervistën me zë (tashmë kështu, mbaje).

### 5.2 CV → A jam gati? → Intervista → Rezultatet

| Hapi | Fërkimi sot | Rregullimi |
|---|---|---|
| CV | Kur CV-ja ekziston, ekrani prapë hapet me "Ngarko CV-në (PDF)" të madh e të zi. Analiza (62/100) është poshtë. | Kur ka CV: lart nota + 3 rregullimet kryesore + "Rindërto". "Ngarko version të ri" bëhet rresht dytësor. |
| Analiza | Nota, pastaj 10 sugjerime, pastaj seksionet; **Roast** është toggle poshtë faqes. | Roast-i del si kartë e vogël menjëherë pas notës ("Roast-i i CV-së tënde: 1 fjali" + "Ndaje"). Kjo është gjëja që Gen Z ia tregon shokut. |
| A jam gati? | Unaza dhe "Afër: disa gjëra të mungojnë" janë mirë. "Pse ky numër" është paragraf i gjatë. "Çka ke / Çka të mungon" del poshtë. | Pas Unazës: 2 kolona të shkurtra "Ke 5 · Të mungojnë 3" me chip-a, pastaj 1 hap kryesor me buton "Praktiko këtë me Artën" (blu). Paragrafi "Pse" mbyllet ("Pse 50%?" → hapet). |
| Intervista: nisja | Lista e **të gjitha** punëve si radio (10+ rreshta), pastaj 4 segmente, pastaj "Nis intervistën" larg poshtë (screenshot 16–17). | Kur vjen nga një punë (`?puna=`), puna është e zgjedhur dhe lista s'shfaqet. Ekrani = karta e Artës (portret, "Arta të pyet për Full-stack Developer") + Gjuha + **"Fol me Artën"** (blu, kryesor) + "Shkruaj në vend" (link). Opsionet e tjera te "Më shumë". |
| Intervista: seanca | Me shkrim si parazgjedhje (`intervista/index.tsx:84`); avatari 30% e lartësisë (`PaneliIZerit.tsx:78`); Arta = "A". "Radha jote" me pikë portokalli. | Me zë si parazgjedhje kur zëri mbështetet. Avatari ≥ 45% e ekranit me sfondin e zyrës. Gjendja me ngjyrë dhe me tekst: **Arta flet** (blu, valë zëri) · **Radha jote** (pika e kuqe e regjistrimit, si iOS) · **Arta mendon** (3 pika). Shiriti i progresit "Pyetja 2 nga 4" mbetet portokalli (është progres). |
| Rezultatet | Lajmi i parë është "55% › 50%" dhe chip "−5 nga kjo intervistë": përdoruesi ndjen se intervista e dëmtoi. | Lajmi i parë: **çka bëre mirë** (1 fjali nga feedback-u) + nota 48/100, pastaj gatishmëria me shpjegim ("Arta gjeti që testet automatike s'dalin në CV: ky është hapi tjetër"). Ndryshimi negativ shfaqet, por në `zbehur`, jo si alarm. Butoni: "Praktiko pyetjen më të dobët" (blu). |

### 5.3 Motivimi që mat progres të vërtetë

- **Streak** (Demo Day, sipas HARTA): 1 ditë = të paktën 1 veprim i vërtetë (intervistë e mbaruar, 10 karta praktike, ose një kontroll "A jam gati?"). Shfaqet te Sot si rresht `limonButë`: "4 ditë rresht · praktiko sot që ta mbash". Pa pikë, pa monedha.
- **Rekordi personal:** "Nota më e mirë e intervistës: 61 → sot 68" (limon) kur e kalon vetveten.
- **"Gati"**: kur një punë kalon 80%, Unaza mbyllet, haptic `sukses`, chip "Gati për këtë punë" në kartën e punës. Ky është i vetmi moment me konfeti.
- **Sot** (`(sot)/index.tsx`): sot ka edhe "Rruga drejt punës" edhe listën me 4 ✓ që thonë të njëjtën gjë (screenshot 02: lista thotë "A jam gati? ✓", karta lart "Hapi tjetër: A jam gati?"). Mbaj **një**: kartën e hapit tjetër, me një buton. Lista bëhet "Puna jote kryesore: 50% · +5 këtë javë".

### 5.4 Toni i kopjes (Gen Z: shkurt, drejt, ngrohtë)

| Sot | Propozim |
|---|---|
| "Ngarko CV-në ose ndërtoje me AI. AI-ja të thotë çka është mirë dhe çka duhet përmirësuar." | "Ngarko CV-në. Të themi çka funksionon dhe çka jo." |
| "Arta, intervistuesja, të bën pyetje për punën që zgjedh, me CV-në tënde si bazë. Ti përgjigjesh me shkrim." | "Arta të pyet si në intervistë të vërtetë, për këtë punë." |
| "Pyetje, karta dhe këshilla që hapen edhe pa lidhje. Asgjë nuk dërgohet askund." | "Praktiko edhe pa internet. Asgjë s'del nga telefoni." |
| "Tani: Përputhja · hape për të parë sa je gati" (në çdo kartë) | hiqe nga lista; në kartë vetëm "50% gati" kur ka rezultat |
| "−5 nga herë e kaluar" (portokalli/kuqe) | "5 më pak se herën e kaluar · ja pse" |
| "Intervista mbaroi" | "E mbarove! Ja si shkoi." |

Rregull: fjalia e parë ≤ 8 fjalë, folje në fillim, "ti", pa "AI-ja" në çdo fjali (thuaj "Arta" ose "ne"), asnjë "!" përveç momentit të fitores.

### 5.5 Punëdhënësi (Kreu · Pozitat · Kandidatët · Kompania)

Pa screenshot-e; nga kodi (`KreuIPunedhenesit.tsx`, `Kandidatet.tsx`, `organizata/_layout.tsx`):
- Përdor të njëjtin gradient dhe tab tint portokalli: rregullohen bashkë me §2.
- Kandidatët anonimë me renditje janë ide e fortë. Karta e kandidatit duhet të tregojë **ngjashmërinë** me pozitën me Unazë të vogël (portokalli = progres i kandidatit), aftësitë ✓/– me `okTeksti`/`zbehur`, dhe kodin anonim si monogram me ngjyrë të nxjerrë nga kodi (jo foto).
- Gjendja "S'janë aktivizuar ende" dhe "bosh" kanë nevojë për ilustrimin e gjendjes bosh dhe një veprim ("Shto pozitën e parë").
- Para Demo Day: një kalim screenshot-esh me llogarinë e punëdhënësit (s'është bërë më 24.11).

---

## 6. Rregullimet ekran pas ekrani (të renditura)

Efort: S ≤ 2 orë · M ≈ gjysmë dite · L ≈ 1–2 ditë. Ndikimi: 3 = e ndjen çdo përdorues.

| # | Ekrani | Problemi | Rregullimi | Efort | Ndikim |
|---|---|---|---|---|---|
| 1 | **Intervista: seanca** | Arta = "A"; Arbëri po ashtu "A" | Portreti i Artës/Arbërit kudo (`lib/intervista/ui.tsx:58-74`, `tipet.ts`) | M | 3 |
| 2 | **Intervista: seanca** | Me shkrim si parazgjedhje; avatari i vogël | Fol si parazgjedhje kur mbështetet; avatari ≥ 45% (`intervista/index.tsx:84`, `PaneliIZerit.tsx:78`) | S | 3 |
| 3 | **Intervista: nisja** | Lista e të gjitha punëve + 4 segmente; butoni larg | Puna e zgjedhur nga konteksti, karta e Artës, "Fol me Artën" lart; opsionet te "Më shumë" | M | 3 |
| 4 | **Intervista: seanca** | Gjendjet (Arta flet / radha jote / mendon) vetëm me tekst të vogël | Ngjyra `blu` për Artën, pika e kuqe për mikrofonin, tekst + ikonë (`intervista/[id].tsx:376`) | S | 3 |
| 5 | **Rezultatet** | Lajmi i parë është rënia "55% › 50%" | Rendi: çka bëre mirë → nota → gatishmëria me shpjegim → "Praktiko pyetjen më të dobët" (`intervista/rezultatet.tsx:228-260`) | M | 3 |
| 6 | **CV-ja ime** | "Ngarko PDF" dominon edhe kur CV-ja ekziston | Gjendja me CV: nota + 3 rregullime + Rindërto lart; ngarkimi dytësor (`cv/index.tsx:127-270`) | M | 3 |
| 7 | **CV: analiza** | Roast-i i fshehur poshtë; etiketa ALL CAPS | Karta e roast-it pas notës; sentence case (`cv/analiza.tsx:344, 354, 487`) | S | 3 |
| 8 | **Gjithë app-i** | Gradienti kafe/portokalli dhe koka `theksiButë` | Hiq gradientin, koka `sfondi` (§2, 6 skedarë) | S | 3 |
| 9 | **Gjithë app-i** | Tab bar portokalli; kontrast `zbehur` dështon | Tab tint neutral; `zbehur` `#6A6762`; `theksiTeksti`, `okTeksti` (`tema.ts`, 2 layout-e) | S | 3 |
| 10 | **Punët: lista** | Çdo kartë e njëjtë; rruga + "Tani: Përputhja…" në çdo kartë | Monogram i kompanisë; hiq rrugën nga kartat pa rezultat, trego "50% gati" vetëm kur ka; "E RE" → chip neutral (`KartaPunes.tsx`) | M | 3 |
| 11 | **A jam gati?** | Paragrafi "Pse ky numër" para "Çka ke / Çka mungon" | Ke/Mungon si chip-a menjëherë pas Unazës; "Pse 50%?" e palosur; butoni blu "Praktiko këtë me Artën" (`gati/[id].tsx`, `GatiPjeset.tsx`) | M | 3 |
| 12 | **Sot** | Karta "Gatishmëria jote" e prishur (B1); hero dhe lista përsërisin njëra-tjetrën | Rregullo B1; mbaj vetëm kartën e hapit tjetër + rreshtin e punës kryesore (`(sot)/index.tsx:186-254`) | M | 2 |
| 13 | **Punët: lista** | S'ka long-press | `Link.Menu` me Ruaje / Ndaje / Hape (`KartaPunes.tsx`, `(tabs)/pune/index.tsx`) | S | 2 |
| 14 | **Gjendjet bosh** (6) | Vetëm ikonë info + tekst | Ilustrim i vogël + titull + 1 veprim | M | 2 |
| 15 | **Fillimi** | Ikona të vogla në kartat e rolit; "Dil nga llogaria" | Ilustrime; hiq daljen (`Fillimi.tsx`) | S | 2 |
| 16 | **Stërvitja** | 3 karta të njëjta; "Kompetencat e tua" thotë "Bëj intervistën e parë" edhe pas një interviste (B5) | Karta e Artës (blu, portret) e madhe lart; rregullo B5; Praktika si rresht | M | 2 |
| 17 | **Detaji i punës** | 4 butona me peshë të njëjtë (Apliko, Shiko gatishmërinë, Ruaje, Ndaje) | 1 kryesor (Shiko sa je gati), "Apliko" dytësor, Ruaje/Ndaje te koka si ikona (`pune/[id].tsx`) | S | 2 |
| 18 | **Historiku** | Kartë e vetme, numri 48 pa kontekst | Portreti, data, nota me ndryshimin "+7 nga e para" (limon kur është rekord) | S | 2 |
| 19 | **Ylli i ruajtjes** | Glif tekst `★/☆` | `Ikona` star/star.fill (`KartaPunes.tsx:87-88`) | S | 1 |
| 20 | **Ekranet me `Titulli`** | Dy koka (shigjeta + titull në përmbajtje) | Titull i madh i Stack-ut (`cv/index.tsx`, `historiku.tsx`, `rezultatet.tsx`, `permbledhja.tsx`) | S | 1 |
| 21 | **Profili** | Ikonë personi gri | Inicialet e përdoruesit me ngjyrë; rreshtat me ikona `zbehur` | S | 1 |
| 22 | **Punëdhënësi** | I pa testuar vizualisht | Kalim screenshot-esh + monogramet e kandidatëve | M | 2 |

---

## 7. Plani

Çdo rresht = një seancë. Seancat në të njëjtën fazë që s'prekin të njëjtët skedarë mund të ecin paralelisht.

### Faza 1 · Fitore të shpejta (këtë javë, deri 30.11)

| Seanca | Çka | Skedarët |
|---|---|---|
| 1A · Tokenat dhe chrome | §2: 7 tokena të rinj, `zbehur` i ri, hiq gradientin, koka `sfondi`, tab tint neutral | `src/lib/tema.ts`, `src/components/TabEkrani.tsx`, `src/components/ui.tsx`, `src/app/hyrja.tsx`, `src/components/Fillimi.tsx`, `src/components/ProfiliIm.tsx`, `src/components/KreuIPunedhenesit.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/organizata/_layout.tsx` |
| 1B · Unslop i kopjes dhe etiketave | ALL CAPS → sentence case, "→" → chevron, emoji → ikonë, ylli si `Ikona`, "E RE" → chip, kopja e §5.4 | `src/app/cv/analiza.tsx`, `src/app/cv/index.tsx`, `src/components/KartaPunes.tsx`, `src/app/intervista/index.tsx`, `src/app/(tabs)/stervitja/index.tsx`, `src/app/praktika/index.tsx` |
| 1C · Intervista me zë si parazgjedhje | `menyra` = "fol" kur `mbeshtetetZeri`; avatari ≥ 45%; gjendjet me ngjyrë (pret 1A për `blu`) | `src/app/intervista/index.tsx`, `src/app/intervista/[id].tsx`, `src/lib/intervista/PaneliIZerit.tsx` |
| 1D · Sot B1 + kontrasti | B1 (karta e prishur), heq dyfishimin hero/listë | `src/app/(tabs)/(sot)/index.tsx`, `src/components/RreshtiVecorise.tsx` |

### Faza 2 · Para 09.12 (përdorimi i vërtetë)

| Seanca | Çka | Skedarët |
|---|---|---|
| 2A · Portretet e Artës dhe Arbërit | Render 3 shprehje × 2 nga `arta.glb` / modeli i Arbërit, PNG 512, `AvatariIntervistuesit` me `expo-image` | `assets/images/arta/*`, `assets/images/arber/*`, `src/lib/intervista/ui.tsx`, `src/lib/intervista/tipet.ts` |
| 2B · Nisja e intervistës | Puna nga konteksti, karta e Artës, "Fol me Artën", "Më shumë" | `src/app/intervista/index.tsx` |
| 2C · Rezultatet | Rendi i ri, ndryshimi negativ i qetë, "Praktiko pyetjen më të dobët" | `src/app/intervista/rezultatet.tsx` |
| 2D · CV-ja ime + roast | Gjendja me CV lart, karta e roast-it pas notës | `src/app/cv/index.tsx`, `src/app/cv/analiza.tsx` |
| 2E · Karta e punës | Monogram, pa rrugë kur s'ka rezultat, long-press menu | `src/components/KartaPunes.tsx`, `src/components/Monogrami.tsx` (i ri), `src/app/(tabs)/pune/index.tsx` |
| 2F · A jam gati? | Ke/Mungon lart, "Pse?" e palosur, butoni blu | `src/app/gati/[id].tsx`, `src/components/GatiPjeset.tsx` |

### Faza 3 · Para Demo Day (13.01)

| Seanca | Çka | Skedarët |
|---|---|---|
| 3A · Ilustrimet e gjendjeve bosh dhe Fillimi | 6 + 2 SVG në të njëjtin stil, komponent `Ilustrimi` | `assets/images/ilustrime/*`, `src/components/GjendjaBosh.tsx` (i ri), `src/components/Fillimi.tsx`, ekranet me gjendje bosh |
| 3B · Streak dhe rekordi | Streak nga veprime të vërteta (pret tabelën në Supabase), rreshti `limonButë` te Sot, rekordi te Historiku | `src/app/(tabs)/(sot)/index.tsx`, `src/app/intervista/historiku.tsx`, `src/lib/` (lexuesi i streak-ut), migrim i ri |
| 3C · Momenti "Gati" | Unaza mbyllet + konfeti 0,6 s + haptic, Reduce Motion = vetëm fade | `src/components/Unaza.tsx`, `src/lib/levizja.ts`, `src/app/gati/[id].tsx` |
| 3D · Punëdhënësi | Kalim screenshot-esh (light + dark), monogramet, gjendjet bosh | `src/components/KreuIPunedhenesit.tsx`, `src/components/Kandidatet.tsx`, `src/app/organizata/**` |
| 3E · Tipografia | Shkalla e madhësive, peshat 400/600/700, Dynamic Type 130% në çdo ekran; opsional font display për numrat | `src/components/ui.tsx`, `src/lib/tema.ts`, `app/_layout.tsx` (fontet) |
| 3F · Bordi | Përditëso `design/karriera-ui.html` me tokenat e rinj që bordi dhe app-i të mos ndahen | `design/karriera-ui.html` |

---

### Shënime

- Llogaritja e kontrastit: formula WCAG 2.1 (luminanca relative), e njëjta për çdo çift në tabelat më lart.
- Asgjë këtu s'është provuar në telefon. Pas fazës 1: screenshot-e në iPhone (Expo Go), light + dark, Dynamic Type 130%.
- Vendimet e mëdha që i takojnë Gentit dhe Edonikut: (1) dy ngjyrat e reja, (2) intervista me zë si parazgjedhje, (3) portretet nga modeli 3D.
