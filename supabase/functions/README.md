# CV Edge Functions

Këto funksione përdorin Anthropic API për analizimin dhe krijimin e CV-ve.

## 1. cv-review

Analizon një CV në format PDF.

**Request:** `POST /functions/v1/cv-review`

Body:

```json
{
  "pdf_base64": "BASE64_PDF_CONTENT",
  "emri_skedarit": "cv.pdf"
}
```

Kthen analizën e CV-së sipas skemës `AnalizaCVSchema`.

## 2. cv-create

Krijon ose rishkruan një CV të strukturuar.

**Request:** `POST /functions/v1/cv-create`

Shembull me përgjigjet e përdoruesit:

```json
{
  "formati": "ks",
  "gjuha": "sq",
  "burimi": {
    "pergjigjet": [
      "Emri dhe mbiemri",
      "Pozita e dëshiruar",
      "Arsimimi",
      "Përvoja e punës",
      "Aftësitë"
    ]
  }
}
```

Formatet: `ks`, `europass`, `eu`, `us`, `uk`, `ats`.

Gjuhët: `sq`, `en`.

Mund të dërgohet edhe një CV ekzistuese e strukturuar për rishkrim, në vend të përgjigjeve.

## 3. Konfigurimi

Funksionet përdorin variablën e ambientit:

`ANTHROPIC_API_KEY`

Mos e vendosni API key në kod, README ose Git.

## 4. Testimi lokal i AI

Testimi bëhet me Deno dhe një PDF lokal:

```powershell
$env:ANTHROPIC_API_KEY="YOUR_API_KEY"
deno run --node-modules-dir=auto --allow-env=ANTHROPIC_API_KEY --allow-read="C:\PATH\TO\cv.pdf" .\scripts\test-cv-ai.ts "C:\PATH\TO\cv.pdf"
```

Ky skript teston funksionet e përbashkëta të AI-së dhe validimin e skemave. Nuk deploy-on Edge Functions.

## 5. Siguria

- Mos ruani API keys në Git.
- Mos publikoni të dhëna personale të CV-ve.
- Migrimi SQL duhet të shqyrtohet dhe të aplikohet nga personi përgjegjës.
- Këto funksione nuk janë deploy-uar nga ky projekt.
