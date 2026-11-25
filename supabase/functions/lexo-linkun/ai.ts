// Haiku lexon tekstin e përkohshëm të faqes dhe kthen (1) a është kjo një shpallje pune, (2) titullin, kompaninë dhe
// qytetin, (3) kërkesat në të njëjtën formë që ruan `portalet`. Skema, prompt-i dhe validimi (pa kontakt, pa kopjim mbi
// 10 fjalë) janë ato të portalet/kerkesat.ts: këtu vetëm shtohen katër fusha. Teksti i faqes s'regjistrohet kurrë.
import { z } from "npm:zod@4.6.7";

import { gjeneroJSON } from "../_shared/cv-ai.ts";
import { pastroKerkesat, SkemaAI, SYSTEM } from "../portalet/kerkesat.ts";
import type { Kerkesat } from "../portalet/harta.ts";

const MAKS_TEKSTI = 12_000; // si MAKS_TRUPI te portalet

export const SkemaELinkut = SkemaAI.extend({
  eshte_shpallje: z
    .boolean()
    .describe("true only if the page is ONE concrete job or internship posting; false for login walls, lists, errors, articles"),
  titulli: z.string().nullable().describe("Job title as the posting writes it (keep its language), or null"),
  kompania: z.string().nullable().describe("Name of the hiring company as written, or null if the page does not say"),
  qyteti: z.string().nullable().describe('City of the job ("Prishtinë", "Remote"), or null if the page does not say'),
});
export type PergjigjjaELinkut = z.infer<typeof SkemaELinkut>;

const SYSTEM_I_LINKUT = `${SYSTEM}

THIS PAGE
- The text comes from a web page a student pasted a link to. It may be a job posting from any site, or something else
  (a login wall, a list of many jobs, a cookie notice, an error page, a news article).
- "eshte_shpallje": true only if the text describes ONE concrete job or internship. Otherwise false, and leave every
  other field null or [] (still return "permbledhja" as one short sentence saying what the page is).
- "titulli", "kompania", "qyteti": copy them as the posting states them (do not translate the title). Null if not stated.
  Never guess a company from the website name alone unless the page says it is the employer.`;

export type FaktetEAI = {
  eshteShpallje: boolean;
  titulli: string | null;
  kompania: string | null;
  qyteti: string | null;
  kerkesat: Kerkesat | null;
};

const EMAIL_OSE_LINK = /[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\/|www\./i;

/** Një tekst i shkurtër i pastër (min–maks shkronja, pa email/link), ose null. */
export function fushe(s: string | null | undefined, min: number, maks: number): string | null {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (t.length < min || t.length > maks || EMAIL_OSE_LINK.test(t)) return null;
  return t;
}

/** Nga përgjigjja e AI-së te faktet që i kthehen app-it. E ndarë nga thirrja, që të testohet pa AI. */
export function pastroPergjigjen(ai: PergjigjjaELinkut, teksti: string): FaktetEAI {
  if (!ai.eshte_shpallje) return { eshteShpallje: false, titulli: null, kompania: null, qyteti: null, kerkesat: null };
  return {
    eshteShpallje: true,
    titulli: fushe(ai.titulli, 3, 120),
    kompania: fushe(ai.kompania, 2, 80),
    qyteti: fushe(ai.qyteti, 2, 60),
    kerkesat: pastroKerkesat(ai, teksti),
  };
}

export type Konteksti = { linku: string; titulliIFaqes: string | null; titulli: string | null; kompania: string | null };

/** Një thirrje te Haiku (effort "low": ekstraktim). Hedh GabimIAI nëse AI-ja dështon. */
export async function lexoMeAI(k: Konteksti, tekstiIPlote: string): Promise<FaktetEAI> {
  const teksti = tekstiIPlote.slice(0, MAKS_TEKSTI);
  const prompt = [
    `Site: ${new URL(k.linku).hostname}`,
    k.titulliIFaqes ? `Page title: ${k.titulliIFaqes}` : "",
    k.titulli ? `Title (from the page's structured data): ${k.titulli}` : "",
    k.kompania ? `Company (from the page's structured data): ${k.kompania}` : "",
    "",
    "<posting>",
    teksti,
    "</posting>",
  ]
    .filter((r, i) => r || i > 3)
    .join("\n");
  const ai = await gjeneroJSON(SkemaELinkut, SYSTEM_I_LINKUT, prompt, "low", 4000);
  return pastroPergjigjen(ai, teksti);
}
