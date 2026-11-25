# Pyetje më të mira (25.11.2026)

## Çka ndryshoi te prompt-i dhe kodi

- **Specifike:** `intervista-nis` e ngrin te konteksti edhe `punet.kerkesat` (kërkesat, përparësitë, detyrat; deri në 14). Prompt-i kërkon që çdo pyetje kryesore (pas ngrohjes) të emërtojë një kërkesë, aftësi ose projekt.
- **Vazhdimet** gërmojnë te NJË gjë konkrete që sapo tha kandidati, me fjalët e tij.
- **Kundërshtim:** përgjigje e paqartë → një rast i vetëm konkret; pretendim i fryrë ose që s'përputhet me CV-në → përmendet dhe kërkohet provë. Kodi ia shton modelit një shënim kur e vëren (`shenjatEPergjigjes`); "kurrë / asnjëherë" s'quhen fryrje (shpesh pranime të sinqerta).
- **Pa përsëritje:** lista e pyetjeve të bëra te prompt-i + kontroll në kod (`eshtePyetjeEPerseritur`, me rrënjë 5-shkronjëshe për lakimet shqipe): pyetja e përsëritur zëvendësohet me një aftësi të shpalljes që s'është pyetur.
- **Shqip i natyrshëm:** fjali të shkurtra si në të folur, pa përkthime fjalë për fjalë nga anglishtja.
- **E pandryshuar:** skema, qasjet (`qasja`) dhe rregullat që i vendos kodi.

## Para / pas me modelin e vërtetë (Claude Sonnet 5.5, effort low)

`supabase/functions/_provat/intervista-para-pas.ts`: e njëjta bisedë (pozita Junior QA Engineer me Playwright dhe SQL; CV me projektin Karriera, pa Playwright), pyetja e katërt.

**1 · Përgjigje e paqartë.** Kandidati: *"E kemi testuar shumë mirë, kemi bërë shumë gjëra dhe gjithmonë ka shkuar mirë, jemi kujdesur për cilësinë."*

- **Para** (thellim): "Thatë që e testuat shumë mirë, por pa detaje. Më jepni një shembull konkret: çfarë gabimi gjetët te hyrja ose baza e të dhënave, si e testuat dhe çfarë bëtë për ta rregulluar?"
- **Pas** (sfidë): "Thatë se gjithmonë ka shkuar mirë, por kjo tingëllon e përgjithshme. Më tregoni një rast të vetëm: çfarë gabimi gjetët te Karriera, si e testuat vetë dhe si e vutë re?"

**2 · Pretendim i fryrë.** Kandidati: *"Jam ekspert në Playwright, e di gjithçka, i kam shkruar të gjitha testet vetëm dhe kurrë s'kemi pasur asnjë gabim."*

- **Para** (sfidë): "Hmm, Playwright nuk del te CV-ja juaj, e as testet automatike. Mund të më tregoni një test konkret që keni shkruar me Playwright: çfarë testonte, si e shkruat dhe çfarë problemi gjeti?"
- **Pas** (sfidë): "Hmm, CV-ja juaj nuk e përmend Playwright-in fare. Më tregoni një rast konkret: një test e2e që shkruat ju vetë në Playwright, çfarë kontrollonte dhe cili gabim ju doli gjatë shkrimit të tij?"

**Vlerësim i sinqertë:** edhe prompt-i i vjetër kundërshtonte mirë këtu. I riu citon pohimin e kandidatit, emërton projektin dhe kërkon çfarë bëri VETË; ndryshimi është i moderuar. Të dy ende bëjnë pyetje me dy-tri pjesë, megjithëse prompt-i e ndalon. Dy skenarë s'janë provë statistikore; vendos prova me Gentin.

## Shembujt e kontrolleve të kodit (pa AI)

`supabase/functions/_provat/intervista-testet.ts` (6 teste): përgjigje e paqartë → shënim; "ekspert" → kërkohet provë; përgjigje konkrete ose "s'e kam përdorur kurrë" → pa shënim; pyetja e përsëritur me fjalë të ndryshme → zëvendësohet (para: kalonte); prompt-i përmban kërkesat dhe pyetjet e bëra; pyetje të ndryshme me të njëjtën formë (SQL · Playwright) s'quhen përsëritje.
