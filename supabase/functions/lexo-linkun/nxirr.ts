// Nga HTML-ja e faqes te faktet e shpalljes, pa AI. Së pari schema.org JobPosting (JSON-LD), përndryshe teksti i
// lexueshëm i faqes. Teksti është i përkohshëm: shkon te AI-ja dhe harrohet, s'ruhet kurrë (si te portalet, MODELI.md).
import { dekodo, tekstMeRreshta, tekstNgaHtml } from "../portalet/burimet.ts";
import { normalizoQytetin } from "../portalet/harta.ts";

export type Nxjerrja = {
  /** Nga JobPosting; null = s'e thotë faqja (AI-ja provon nga teksti). */
  titulli: string | null;
  kompania: string | null;
  qyteti: string | null;
  /** Teksti që i jepet AI-së (përshkrimi i JobPosting, ose teksti i faqes). */
  teksti: string;
  /** Titulli i faqes (<title> / og:title), ndihmë për AI-në kur s'ka JobPosting. */
  titulliIFaqes: string | null;
  burimi: "jsonld" | "faqja";
};

type Obj = Record<string, unknown>;
const eshteObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const tekst = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = tekstNgaHtml(v).trim();
  return t ? t : null;
};

function eshteJobPosting(o: Obj): boolean {
  const lloji = o["@type"];
  return lloji === "JobPosting" || (Array.isArray(lloji) && lloji.includes("JobPosting"));
}

/** Kërkon JobPosting brenda një vlere JSON-LD: objekt, listë, ose "@graph". */
function gjejNe(v: unknown, thellesia = 0): Obj | null {
  if (thellesia > 4) return null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const g = gjejNe(x, thellesia + 1);
      if (g) return g;
    }
    return null;
  }
  if (!eshteObj(v)) return null;
  if (eshteJobPosting(v)) return v;
  return gjejNe(v["@graph"], thellesia + 1);
}

/** Objekti i parë schema.org JobPosting në faqe, ose null. JSON-LD i prishur kapërcehet. */
export function gjejJobPosting(html: string): Obj | null {
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    const burimi = m[1].trim().replace(/^<!--|-->$/g, "");
    try {
      const g = gjejNe(JSON.parse(burimi));
      if (g) return g;
    } catch {
      // disa faqe vënë karaktere kontrolli brenda vargjeve: provojmë edhe një herë pa to
      try {
        // deno-lint-ignore no-control-regex
        const g = gjejNe(JSON.parse(burimi.replace(/[\u0000-\u001f]+/g, " ")));
        if (g) return g;
      } catch {
        // vazhdon te blloku tjetër
      }
    }
  }
  return null;
}

function emri(v: unknown): string | null {
  if (typeof v === "string") return tekst(v);
  if (Array.isArray(v)) return emri(v[0]);
  return eshteObj(v) ? tekst(v.name) : null;
}

/** Qyteti nga jobLocation (objekt ose listë) dhe jobLocationType "TELECOMMUTE" (= Remote). */
function qytetiNga(jp: Obj): string | null {
  const vendet = Array.isArray(jp.jobLocation) ? jp.jobLocation : jp.jobLocation ? [jp.jobLocation] : [];
  const emrat: string[] = [];
  for (const v of vendet.slice(0, 3)) {
    if (!eshteObj(v)) continue;
    const a = v.address;
    const q = eshteObj(a) ? (emri(a.addressLocality) ?? emri(a.addressRegion) ?? emri(a.addressCountry)) : emri(a);
    if (q) emrat.push(q);
  }
  const remote = /telecommute/i.test(JSON.stringify(jp.jobLocationType ?? ""));
  if (emrat.length === 0) return remote ? "Remote" : null;
  const qyteti = normalizoQytetin([...new Set(emrat)].join(", "));
  return remote && !qyteti.includes("Remote") ? `${qyteti}, Remote`.slice(0, 60) : qyteti;
}

/** Teksti i JobPosting për AI-në: përshkrimi + fushat e kërkesave që disa faqe i japin veç. */
function tekstiIJobPosting(jp: Obj): string {
  const pjeset: string[] = [];
  if (typeof jp.description === "string") pjeset.push(tekstMeRreshta(dekodo(jp.description)));
  for (const [celesi, etiketa] of [
    ["responsibilities", "Responsibilities"],
    ["qualifications", "Qualifications"],
    ["skills", "Skills"],
    ["experienceRequirements", "Experience"],
    ["educationRequirements", "Education"],
    ["employmentType", "Employment type"],
  ] as const) {
    const v = jp[celesi];
    const t = typeof v === "string" ? tekstMeRreshta(v) : Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : emri(v);
    if (t) pjeset.push(`${etiketa}: ${t}`);
  }
  return pjeset.join("\n\n").trim();
}

function meta(html: string, prona: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prona}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prona}["']`, "i");
  return tekst(dekodo(re.exec(html)?.[1] ?? re2.exec(html)?.[1] ?? ""));
}

/** Teksti i lexueshëm i faqes: <main> ose <article> nëse ka, përndryshe <body>, pa menu, kokë, fund, formularë e skripte. */
export function tekstiILexueshem(html: string): string {
  const pa = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|nav|header|footer|aside|form|button|select)\b[\s\S]*?<\/\1>/gi, " ");
  const pjesa =
    /<main\b[^>]*>([\s\S]*)<\/main>/i.exec(pa)?.[1] ??
    /<article\b[^>]*>([\s\S]*)<\/article>/i.exec(pa)?.[1] ??
    /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(pa)?.[1] ??
    pa;
  return tekstMeRreshta(pjesa)
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r && r !== "-")
    .join("\n");
}

const shkurto = (s: string | null, maks: number): string | null => {
  const t = s?.replace(/\s+/g, " ").trim() ?? "";
  return t ? t.slice(0, maks).trim() : null;
};

export function nxirrNgaHtml(html: string): Nxjerrja {
  const titulliIFaqes = shkurto(meta(html, "og:title") ?? tekst(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ""), 200);
  const jp = gjejJobPosting(html);
  if (jp) {
    const teksti = tekstiIJobPosting(jp);
    // JobPosting pa përshkrim (ndodh): teksti i faqes është rezerva, por titulli/kompania/qyteti mbeten nga JSON-LD.
    return {
      titulli: shkurto(tekst(jp.title), 120),
      kompania: shkurto(emri(jp.hiringOrganization), 80),
      qyteti: shkurto(qytetiNga(jp), 60),
      teksti: teksti.length >= 200 ? teksti : `${teksti}\n\n${tekstiILexueshem(html)}`.trim(),
      titulliIFaqes,
      burimi: "jsonld",
    };
  }
  return { titulli: null, kompania: null, qyteti: null, teksti: tekstiILexueshem(html), titulliIFaqes, burimi: "faqja" };
}

/** Faqe pa tekst të mjaftueshëm (mur hyrjeje, faqe bosh, aplikacion JS pa HTML): s'thërrasim AI-në fare. */
export const MIN_TEKST = 200;
