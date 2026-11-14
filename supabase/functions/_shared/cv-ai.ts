import Anthropic from "npm:@anthropic-ai/sdk@1.7.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@1.7.0/helpers/zod";
import { z } from "npm:zod@4.6.7";

import {
  normalizoSugjerimet,
  rishkrimetNga,
  rregulloShqipen,
  type Sugjerimi,
} from "./sugjerimet.ts";

// ---------- Modelet e të dhënave ----------
// Të njëjtat fusha si tipet në src/lib/cv.ts (kontrata me app-in).

export const CvStrukturuarSchema = z.object({
  emri: z.string(),
  titulli: z.string(),
  qyteti: z.string(),
  email: z.string(),
  telefoni: z.string().nullable(),
  datelindja: z.string().nullable(),
  profili: z.string(),
  arsimi: z.array(
    z.object({
      programi: z.string(),
      institucioni: z.string(),
      periudha: z.string(),
    }),
  ),
  pervoja: z.array(
    z.object({
      roli: z.string(),
      vendi: z.string(),
      periudha: z.string(),
      pershkrimi: z.string(),
      nga_ai: z.boolean(),
    }),
  ),
  projektet: z.array(
    z.object({
      titulli: z.string(),
      pershkrimi: z.string(),
      linku: z.string().nullable(),
      nga_ai: z.boolean(),
    }),
  ),
  aftesite: z.array(z.string()),
  gjuhet: z.array(
    z.object({
      gjuha: z.string(),
      niveli: z.string(),
    }),
  ),
});

// Një sugjerim = një ndryshim që kandidati e pranon me një prekje. App-i e zbaton vetë (pa AI) te `cv`,
// prandaj shenja duhet të jetë e saktë: seksioni + indeksi + fusha, dhe `para` = teksti i saktë që ndryshon.
export const SEKSIONET_E_CV = ["titulli", "profili", "pervoja", "projektet", "arsimi", "aftesite", "gjuhet"] as const;
export const FUSHAT_E_CV = [
  "roli",
  "vendi",
  "periudha",
  "pershkrimi",
  "titulli",
  "linku",
  "programi",
  "institucioni",
  "gjuha",
  "niveli",
] as const;

export const SugjerimiSchema = z.object({
  lloji: z
    .enum(["rishkrim", "gabim", "shto", "hiq"])
    .describe("rishkrim = stronger line; gabim = spelling/grammar fix; shto = add missing; hiq = remove"),
  seksioni: z.enum(SEKSIONET_E_CV),
  indeksi: z
    .number()
    .int()
    .nullable()
    .describe("0-based position of the item in that list of `cv`; null for titulli, profili and a new skill"),
  fusha: z
    .enum(FUSHAT_E_CV)
    .nullable()
    .describe("Field of that item; null for titulli, profili and aftesite"),
  para: z.string().describe("Exact text copied from that field of `cv`; empty only for shto"),
  pas: z.string().describe("New text in the CV's language; facts the CV lacks become [Albanian placeholders]"),
  arsyeja: z.string().describe("One short Albanian sentence: why this helps"),
  placeholders: z.array(z.string()).describe("Every [placeholder] in pas, exactly as written"),
});

// Fushat e analizës (pa CV-në). Renditja ka rëndësi: AI-ja i shkruan fushat me këtë radhë.
const fushatEAnalizes = {
  gjuha_e_cv: z.enum(["sq", "en", "de", "tjeter"]).describe("Main language of the CV text"),
  nota: z.number().int().min(0).max(100),
  permbledhja: z.string(),
  seksionet: z.array(
    z.object({
      emri: z.string(),
      gjendja: z.enum(["mire", "permiresim"]),
      komenti: z.string(),
      roast: z.string(),
    }),
  ),
  sugjerimet: z.array(SugjerimiSchema),
  pikat_e_forta: z.array(z.string()),
  fjalia_roast: z.string(),
};

/** Analiza e një PDF-je: AI-ja e kthen edhe CV-në si të dhëna (`cv`, e para), që sugjerimet të kenë ku zbatohen. */
export const AnalizaCVSchema = z.object({ cv: CvStrukturuarSchema, ...fushatEAnalizes });

/** Analiza e një CV-je të krijuar në app: CV-ja e strukturuar ekziston, AI-ja s'e rishkruan. */
export const AnalizaPaCVSchema = z.object(fushatEAnalizes);

export type AnalizaPaCV = z.infer<typeof AnalizaPaCVSchema>;
export type CvStrukturuar = z.infer<typeof CvStrukturuarSchema>;

/** Çka ruhet te cv_reviews.analiza dhe çka merr app-i (versioni 2 i kontratës, src/lib/cv.ts). */
export type AnalizaRuajtur = Omit<AnalizaPaCV, "sugjerimet"> & {
  versioni: 2;
  cv: CvStrukturuar;
  sugjerimet: Sugjerimi[];
  rishkrimet: { para: string; pas: string }[]; // për app-in e vjetër
};

/**
 * Nga përgjigjja e AI-së te analiza që ruhet: id-të dhe placeholder-at nga serveri, shqipja e kontrolluar,
 * `rishkrimet` për app-in e vjetër. `cv` = CV-ja që sugjerimet e kanë për shenjë.
 */
export function pergatitAnalizen(ai: AnalizaPaCV, cv: CvStrukturuar): { analiza: AnalizaRuajtur; korrigjime: number } {
  let korrigjime = 0;
  const shqip = (teksti: string) => {
    const r = rregulloShqipen(teksti);
    korrigjime += r.ndryshime;
    return r.teksti;
  };

  const sugjerimet = normalizoSugjerimet(ai.sugjerimet).map((s) => ({ ...s, arsyeja: shqip(s.arsyeja) }));

  return {
    analiza: {
      versioni: 2,
      gjuha_e_cv: ai.gjuha_e_cv,
      nota: ai.nota,
      permbledhja: shqip(ai.permbledhja),
      seksionet: ai.seksionet.map((s) => ({
        emri: shqip(s.emri),
        gjendja: s.gjendja,
        komenti: shqip(s.komenti),
        roast: shqip(s.roast),
      })),
      pikat_e_forta: ai.pikat_e_forta.map(shqip),
      fjalia_roast: shqip(ai.fjalia_roast),
      cv,
      sugjerimet,
      rishkrimet: rishkrimetNga(sugjerimet),
    },
    korrigjime,
  };
}

export type FormatiCV = "ks" | "europass" | "eu" | "us" | "uk" | "ats";
export type GjuhaCV = "sq" | "en";

// ---------- Konfigurimi i AI-së ----------

// Model i lehtë dhe i lirë (vendimi i Gentit, 11.11). Haiku 5.5: mendim adaptiv (pa budget_tokens),
// effort low–max (default medium), pa temperature/top_p/top_k, pa "fallback" në server kur refuzon.
export const MODELI = "claude-haiku-5-5";

/** Sa thellë mendon AI-ja: cv-review "medium" (vlerëson), cv-create "low" (rishkruan fakte të dhëna). */
export type Perpjekja = "low" | "medium";

/** Gabim që funksioni ia kthen app-it me këtë status dhe këtë mesazh (shqip, pa detaje teknike). */
export class GabimIAI extends Error {
  readonly status: number;

  constructor(mesazhi: string, status: number) {
    super(mesazhi);
    this.name = "GabimIAI";
    this.status = status;
  }
}

function merrKlientin(): Anthropic {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!apiKey) {
    throw new GabimIAI("Shërbimi i AI-së s'është konfiguruar ende.", 500);
  }

  // Edge Function ka afat (~150 s): një përpjekje me afat të gjatë, pa riprovime automatike.
  // Riprovimin e bën përdoruesi me butonin "Provo përsëri".
  return new Anthropic({ apiKey, timeout: 140_000, maxRetries: 0 });
}

// Gabimet e SDK-së sipas tipit (jo sipas tekstit të mesazhit), nga më i veçanti te më i përgjithshmi.
function perktheGabimin(e: unknown): GabimIAI {
  if (e instanceof Anthropic.RateLimitError) {
    return new GabimIAI("AI-ja është shumë e zënë tani. Provo pas një minute.", 429);
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    console.error("[cv-ai] Çelësi i AI-së u refuzua.");
    return new GabimIAI("Shërbimi i AI-së s'është konfiguruar mirë.", 500);
  }
  if (e instanceof Anthropic.BadRequestError) {
    // P.sh. PDF me fjalëkalim, e dëmtuar ose me shumë faqe.
    return new GabimIAI("AI-ja s'e lexoi dot këtë PDF. Provo një PDF tjetër (pa fjalëkalim).", 422);
  }
  if (e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.InternalServerError) {
    return new GabimIAI("AI-ja s'u përgjigj. Provo përsëri pas pak.", 503);
  }
  if (e instanceof Anthropic.APIError) {
    return new GabimIAI("AI-ja ktheu gabim. Provo përsëri.", 502);
  }
  return new GabimIAI("Diçka shkoi keq me AI-në. Provo përsëri.", 500);
}

// ---------- Gjenerimi i përgjigjeve JSON ----------

export async function gjeneroJSON<T extends z.ZodType>(
  schema: T,
  system: string,
  prompt: string | Anthropic.Messages.ContentBlockParam[],
  perpjekja: Perpjekja = "medium",
  maxTokens = 16000,
): Promise<z.infer<T>> {
  const klienti = merrKlientin();

  let response;
  try {
    response = await klienti.messages.parse({
      model: MODELI,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
      // effort vendoset gjithmonë qartë; asnjë temperature / top_p / top_k (Haiku 5.5 i refuzon).
      output_config: {
        effort: perpjekja,
        format: zodOutputFormat(schema),
      },
    });
  } catch (e) {
    throw perktheGabimin(e);
  }

  if (response.stop_reason === "max_tokens") {
    throw new GabimIAI("Përgjigjja e AI-së ishte tepër e gjatë. Provo përsëri.", 502);
  }

  // Haiku 5.5 s'ka model rezervë në server: refuzimi kthehet te përdoruesi si mesazh i qartë.
  if (response.stop_reason === "refusal") {
    throw new GabimIAI(
      "AI-ja refuzoi ta përpunojë këtë kërkesë. Provo me një dokument ose me përgjigje të tjera.",
      422,
    );
  }

  if (!response.parsed_output) {
    throw new GabimIAI("AI-ja nuk ktheu përgjigje në formatin e kërkuar. Provo përsëri.", 502);
  }

  return response.parsed_output as z.infer<T>;
}
