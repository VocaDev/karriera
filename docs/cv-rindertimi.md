# CV: analizo → "Shtoje në CV" → rindërto → PDF (14.11)

Analizuesi dhe ndërtuesi i CV-së bëhen një rrjedhë: AI-ja analizon CV-në një herë, kandidati i pranon
sugjerimet me një prekje, dhe app-i e ndërton CV-në e re **vetë, pa AI**. Përparësia mbi një chat AI:
e njeh CV-në tënde, një prekje për çdo ndryshim, versione, PDF e vërtetë, dhe (më vonë) e përshtat për
një punë nga Punët.

## Rrjedha

1. **CV-ja ime** (`cv/index`) → ngarko PDF-në → **Analiza** (`cv/analiza`).
2. Analiza: nota (e ndershme, pa ndryshim), pastaj **"Përmirësoje me një prekje"**:
   - sugjerimet sipas seksioneve (Titulli, Profili, Përvoja, …), secili seksion me "2 nga 3" / "✓ Gati";
   - çdo kartë: lloji (Rishkrim / Drejtshkrim / Shto / Hiq), ku bie, pse, TANI → BËHET, dhe
     **Shtoje në CV** ose **Kalo**; e vendosura bëhet një rresht i vogël me **Zhbëj**;
   - faktet që AI-ja s'i di (`[numri i përdoruesve]`) bëhen fusha të vogla; pa vlerë, sugjerimi s'shtohet
     (dridhje + shënim nën fushë). AI-ja s'shpik numra;
   - **Rregullo të gjitha gabimet**: një prekje pranon të gjitha drejtshkrimet, me **Zhbëj** për grupin;
   - një sugjerim që s'gjendet saktë në CV shfaqet si **Këshillë** (pa buton), një që përplaset me një
     tjetër të pranuar refuzohet me njoftim;
   - shiriti poshtë: "Shtove 3 · Kalove 1 · Mbeten 8", progresi portokalli dhe **Rindërto CV-në · 3**.
     Kur shqyrtohet i fundit: dridhje suksesi + njoftim (një herë).
3. **Rindërto CV-në** (`cv/rindertoje`, nën rojen e kërkuesit): CV-ja si fletë, "Me ndryshimet / Origjinali",
   çdo rresht i ndryshuar ka vijë anësore, tekstin e vjetër të vizatuar dhe "NGA SUGJERIMET" ose
   "NDRYSHUAR NGA TI". Çdo rresht hapet me një prekje (Gati / Anulo / Rikthe). Nota mbetet ajo e
   origjinalit, me shënimin që nota e re vjen vetëm nga një analizë e re. Lidhja "Përshtate për një punë"
   është e kyçur (02.12). **Ruaje dhe shiko PDF-në** → `ruajCV` (version i ri, emri "Rindërtuar nga …")
   → `cv/dokumenti` → PDF/Ndaj.
4. Te dokumenti: **Analizo këtë version** (konfirmim, kufiri 5/ditë) → `cv-review` analizon CV-në e krijuar
   → nota e re e vërtetë, dhe sugjerime të reja për të njëjtin cikël.

Zgjedhjet (pranuar/kaluar, vlerat, rreshtat me dorë) ruhen vetëm në telefon (AsyncStorage, sipas id-së së
analizës: `src/lib/zgjedhjet.ts`) derisa të ruhet versioni. Asgjë s'shkon në server para kësaj.

## Skema e re e analizës (versioni 2)

`cv_reviews.analiza` (jsonb, pa migrim) dhe përgjigjja e `cv-review`:

```ts
{
  versioni: 2,
  gjuha_e_cv: "sq" | "en" | "de" | "tjeter",
  nota, permbledhja, seksionet, pikat_e_forta, fjalia_roast,   // si më parë
  rishkrimet: { para, pas }[],   // nxirren nga sugjerimet (lloji "rishkrim"), për app-in e vjetër
  cv: CvStrukturuar,             // CV-ja ashtu siç është (me gabimet e saj), ku zbatohen sugjerimet
  sugjerimet: {
    id: "s1",                    // nga serveri, unik në analizë
    lloji: "rishkrim" | "gabim" | "shto" | "hiq",
    seksioni: "titulli" | "profili" | "pervoja" | "projektet" | "arsimi" | "aftesite" | "gjuhet",
    indeksi: number | null,      // pozita në listë; null për titullin, profilin, një aftësi të re
    fusha: string | null,        // "roli" | "vendi" | "periudha" | "pershkrimi" | "titulli" | "linku" | ...
    para: string,                // teksti i saktë në CV ("" për "shto")
    pas: string,                 // teksti i ri, me "[placeholder]" për faktet që mungojnë
    arsyeja: string,
    placeholders: string[],      // llogariten nga serveri prej `pas`
  }[],
}
```

- Kontrata në app: `SugjerimCV`, `AnalizaCV` dhe `lexoAnalizen()` te `src/lib/cv.ts`. Analizat e vjetra
  (pa `cv`/`sugjerimet`) hapen si më parë, me ftesën "Analizo përsëri"; një sugjerim i dëmtuar hiqet vetëm ai.
- Zbatimi: `src/lib/rindertimi.ts` (`rindertoCV`), deterministik, pa rrjet. Kur indeksi i AI-së është
  gabim, `para` kërkohet në të njëjtin seksion; kur s'gjendet, sugjerimi mbetet këshillë (s'hamendësohet).
  "gabim" zëvendëson kudo në fushë, "rishkrim" herën e parë, një fjalë s'gjendet brenda një tjetre.
- Serveri: `_shared/cv-ai.ts` (`AnalizaCVSchema` me `cv` të parin, `AnalizaPaCVSchema`, `pergatitAnalizen`),
  `_shared/sugjerimet.ts` (id-të, placeholder-at, `rishkrimet`, kontrolli i shqipes).
- Shqipja e AI-së: prompt-i kërkon "ë"/"ç", pa shkronja të dyfishta, "CV-ja" femërore ("e saj");
  pastaj `rregulloShqipen()` rregullon "ppak" → "pak" dhe fjalët e njohura pa "ë" ("i sakte" → "i saktë")
  vetëm te teksti i AI-së, kurrë te CV-ja. Log-u shënon vetëm numrin e korrigjimeve.

## Çka duhet për go-live (vetëm me OK-në e Gentit)

Pa migrim SQL. Rendi:

1. **App-i** (ky branch) mund të dalë i pari: punon me `cv-review`-n e tanishme. Analizat e vjetra tregojnë
   rishkrimet si më parë dhe "Analizo përsëri"; "Analizo këtë version" për një CV të krijuar kthen gabimin
   e qartë të funksionit të vjetër ("Analizohen vetëm CV-të e ngarkuara si PDF.").
2. **Deploy `cv-review`** (merr `_shared/cv-ai.ts` dhe `_shared/sugjerimet.ts` bashkë):
   `supabase functions deploy cv-review --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`
3. **`cv-create`** përdor `_shared/cv-ai.ts`, por s'ka ndryshuar sjellja e tij. Një redeploy s'është i
   nevojshëm; nëse bëhet, merr skemat e reja pa efekt në `cv-create`.
4. **Prova** me llogarinë demo të kërkuesit: ngarko PDF → analiza ka "Përmirësoje me një prekje" →
   pranoje një drejtshkrim, plotëso një placeholder, "Rregullo të gjitha gabimet", Zhbëj → Rindërto →
   ndrysho një rresht → Ruaje → PDF → "Analizo këtë version" (nota e re). Kontrollo light dhe dark.

Analiza e re është më e gjatë (CV-ja + deri në 30 sugjerime): `max_tokens` 20 000, effort "medium".
Duhet parë koha reale në telefon (afati i Edge Function ~150 s; SDK-ja 140 s).
