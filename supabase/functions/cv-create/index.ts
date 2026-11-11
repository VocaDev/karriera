
import {
  CvStrukturuarSchema,
  gjeneroJSON,
  type CvStrukturuar,
  type FormatiCV,
  type GjuhaCV,
} from "../_shared/cv-ai.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const FORMATET: FormatiCV[] = [
  "ks", "europass", "eu", "us", "uk", "ats",
];

const GJUHET: GjuhaCV[] = ["sq", "en"];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

const SYSTEM_PROMPT = `
You are a professional CV writer and career advisor.

Create or rewrite a structured CV using only facts supplied by the user.

IMPORTANT RULES:
- Never invent names, employers, degrees, dates, achievements,
  skills, certifications, language levels or contact details.
- If information is missing, use an empty string, null or an empty array.
- Improve clarity, grammar, structure and professional wording.
- Do not turn responsibilities into achievements unless evidence
  supports the achievement.
- Preserve all factual details and links.
- Never invent a GitHub, LinkedIn or portfolio URL.
- Keep the candidate's original meaning.
- Return every text field in the requested language.
- Every experience or project description written or rewritten
  by AI must have nga_ai set to true.
- Do not include personal data that the user did not provide.

The output must follow the supplied structured schema exactly.
`;

function formatInstructions(formati: FormatiCV): string {
  const udhezimet: Record<FormatiCV, string> = {
    ks: "Use a clean, modern Kosovo-style CV. Personal details may include date of birth.",
    europass: "Use the Europass structure: clear sections, chronological education and experience, language skills using CEFR levels.",
    eu: "Use a professional European CV layout. Date of birth may be included.",
    us: "Use a concise US resume format. Do not include date of birth, age, photograph or unnecessary personal details.",
    uk: "Use a professional UK CV format. Do not include date of birth, age, photograph or unnecessary personal details.",
    ats: "Use an ATS-friendly format: simple headings, standard wording, relevant keywords, no tables or decorative elements. Do not include date of birth, age or photograph.",
  };

  return udhezimet[formati];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Metoda nuk lejohet." }, 405);
  }

  try {
    const body = await req.json();

    const formati = body?.formati;
    const gjuha = body?.gjuha;
    const burimi = body?.burimi;

    if (!FORMATET.includes(formati) || !GJUHET.includes(gjuha)) {
      return json({
        error: "Formati ose gjuha e CV-së nuk është e vlefshme.",
      }, 400);
    }

    if (!burimi || typeof burimi !== "object") {
      return json({ error: "Mungon burimi i CV-së." }, 400);
    }

    let udhezimiBurimit: string;

    if ("pergjigjet" in burimi) {
      if (
        !Array.isArray(burimi.pergjigjet) ||
        burimi.pergjigjet.length !== 5 ||
        burimi.pergjigjet.some(
          (p: unknown) => typeof p !== "string" || !p.trim(),
        )
      ) {
        return json({
          error: "Duhet të dërgohen saktësisht 5 përgjigje jo të zbrazëta.",
        }, 400);
      }

      udhezimiBurimit = `
Create a new CV using these five answers from the candidate:

${burimi.pergjigjet
  .map((p: string, i: number) => `${i + 1}. ${p.trim()}`)
  .join("\n")}

Use only facts found in these answers.
Do not assume that missing information exists.
`;
    } else if ("cv" in burimi) {
      const rezultati = CvStrukturuarSchema.safeParse(burimi.cv);

      if (!rezultati.success) {
        return json({
          error: "Të dhënat e CV-së ekzistuese nuk janë të vlefshme.",
        }, 400);
      }

      const cvEkzistuese: CvStrukturuar = rezultati.data;

      udhezimiBurimit = `
Rewrite the following existing CV for the requested format and language.

Existing CV:
${JSON.stringify(cvEkzistuese)}

Preserve all facts, dates, names, contact information and links.
Improve wording and structure without inventing information.
`;
    } else {
      return json({ error: "Burimi i CV-së nuk është i vlefshëm." }, 400);
    }

    const prompt = `
Requested language: ${gjuha === "sq" ? "Albanian" : "English"}.

Requested CV format: ${formati}.

FORMAT REQUIREMENTS:
${formatInstructions(formati)}

${udhezimiBurimit}

Return the complete structured CV.
Use null for missing phone number, date of birth or project link.
For US, UK and ATS formats, date of birth must be null.
`;

    const cv = await gjeneroJSON(
      CvStrukturuarSchema,
      SYSTEM_PROMPT,
      prompt,
      6000,
    );

    const cvFinal: CvStrukturuar = {
      ...cv,
      datelindja:
        ["us", "uk", "ats"].includes(formati)
          ? null
          : cv.datelindja,
      pervoja: cv.pervoja.map((p) => ({
        ...p,
        nga_ai: true,
      })),
      projektet: cv.projektet.map((p) => ({
        ...p,
        nga_ai: true,
      })),
    };

    return json(cvFinal);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Mungon çelësi i AI-së."
    ) {
      return json({ error: error.message }, 500);
    }

    console.error("[cv-create] Gabim gjatë krijimit të CV-së.");

    return json({
      error: "Krijimi i CV-së dështoi. Provo përsëri.",
    }, 500);
  }
});
