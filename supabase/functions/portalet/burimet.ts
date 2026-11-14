// Tri portalet: si lexohet lista dhe, vetëm për punët që hyjnë në HARTA, faqja e shpalljes.
// Pa API të Deno-s (punon edhe me Node). Parsimi bazohet në klasat HTML të 14.11.2026:
// nëse një portal e ndryshon faqen, ky portal kthen 0 shpallje dhe raporti e tregon (s'prish të tjerët).
//
// Kontrolli ligjor (14.11.2026, hollësitë te README):
//   KosovaJob   robots.txt lejon gjithçka përveç /*?*drop=; s'ka faqe "Kushtet" (vetëm privatësia).
//   PortalPune  robots.txt lejon /jobs dhe jep sitemap; kushtet: të drejtat e autorit, pa përfitim
//               për palë të treta pa pëlqim me shkrim → ruajmë vetëm faktet + linkun; i kërkojmë pëlqimin.
//   OfertaPune  robots.txt: Crawl-delay 10; pjesë e KosovaJob (që nga 2019). I ktheu botit tonë 403 → s'përdoret.
//   DuaPune     kushtet (9.3, 9.4) ndalojnë scraper-ët dhe agregatorët → NUK përdoret.
import { gjejRolin, type Portali, type ShpalljaBruto } from "./harta.ts";
import type { Shfletuesi } from "./shfletuesi.ts";

export type OpsionetEBurimit = {
  /** Faqja e shpalljes merret vetëm për shpalljet e reja (që s'janë ende në databazë). */
  eshteERe: (portali: Portali, idEJashtme: string) => boolean;
  /** Sa faqe shpalljesh lejohen për një portal në një ekzekutim (koha e Edge Function është e kufizuar). */
  maksDetaje: number;
  /** E njëjta punë (titulli + kompania) është tashmë aktive nga një portal tjetër: s'e hapim faqen. */
  eshteDublikate?: (titulli: string, kompania: string) => boolean;
  log: (m: string) => void;
};

export type RezultatiIBurimit = {
  portali: Portali;
  neListe: number; // sa shpallje pa te lista / sitemap
  kandidate: number; // sa i ngjanin SWE ose Asistent/PR nga titulli
  shpalljet: ShpalljaBruto[];
  /** Shpallje që janë tashmë në databazë: vetëm i rifreskojmë (pare_me, afati), pa i shkruar fushat e tjera. */
  teNjohura: { id: string; afati: string | null }[];
  /** Kandidatë që u njohën si dublikatë që nga lista (pa e hapur faqen). */
  dublikataNgaLista: string[];
  gabime: string[];
};

// ---------------------------------------------------------------- ndihmës

const ENTITETET: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  euml: "ë", Euml: "Ë", ccedil: "ç", Ccedil: "Ç", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—",
};

export function dekodo(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTITETET[e] ?? m);
}

export function tekstNgaHtml(html: string): string {
  return dekodo(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function kap(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? tekstNgaHtml(m[1]) || null : null;
}

function metaPershkrimi(html: string): string | null {
  return kap(html, /<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i);
}

/** Copat e listës: çdo kartë fillon me `<div class="jobListCnts` (jo `jobListCntsInner`, që është brenda kartës). */
function kartat(html: string): string[] {
  return html.split(/<div class="jobListCnts(?!Inner)/).slice(1).map((c) => c.slice(0, 4000));
}

function titullNgaSlug(slug: string): string {
  return slug.replace(/-\d+$/, "").replace(/-/g, " ");
}

async function meDetaje(
  shf: Shfletuesi,
  op: OpsionetEBurimit,
  rez: RezultatiIBurimit,
  kandidatet: ShpalljaBruto[],
  ploteso: (s: ShpalljaBruto, html: string) => ShpalljaBruto | null,
): Promise<void> {
  let marre = 0;
  for (const s of kandidatet) {
    if (!op.eshteERe(s.portali, s.id_e_jashtme)) {
      rez.teNjohura.push({ id: `${s.portali}-${s.id_e_jashtme}`, afati: s.afati });
      continue;
    }
    if (s.kompania && op.eshteDublikate?.(s.titulli, s.kompania)) {
      rez.dublikataNgaLista.push(`${s.portali}-${s.id_e_jashtme}`);
      continue;
    }
    if (marre >= op.maksDetaje) {
      rez.gabime.push(`${s.portali}: u arrit kufiri ${op.maksDetaje} faqe; ${s.id_e_jashtme} mbetet për herën tjetër`);
      continue;
    }
    marre++;
    try {
      const plote = ploteso(s, await shf.merr(s.linku));
      if (plote) rez.shpalljet.push(plote);
    } catch (e) {
      rez.gabime.push(`${s.portali} ${s.id_e_jashtme}: ${(e as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------- KosovaJob

export async function kosovajob(shf: Shfletuesi, op: OpsionetEBurimit): Promise<RezultatiIBurimit> {
  const rez: RezultatiIBurimit = { portali: "kosovajob", neListe: 0, kandidate: 0, shpalljet: [], teNjohura: [], dublikataNgaLista: [], gabime: [] };
  const html = await shf.merr("https://kosovajob.com/");
  const kandidatet: ShpalljaBruto[] = [];
  const pare = new Set<string>();
  for (const k of kartat(html)) {
    const id = k.match(/jobID="(\d+)"/)?.[1];
    const linku = k.match(/class="kj-jc__hit" href="(https:\/\/kosovajob\.com\/[a-z0-9-]+\/[a-z0-9-]+)"/)?.[1];
    const titulli = kap(k, /class="[^"]*kj-jc__title"[^>]*>([^<]+)</);
    if (!id || !linku || !titulli || pare.has(id)) continue;
    pare.add(id);
    rez.neListe++;
    if (!gjejRolin(titulli)) continue;
    const kompaniaNgaSlug = linku.split("/")[3].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    kandidatet.push({
      portali: "kosovajob",
      id_e_jashtme: id,
      linku,
      titulli,
      kompania: kompaniaNgaSlug,
      qyteti: kap(k, /jobListCity[\s\S]*?<span>([^<]*)<\/span>/),
      afati: k.match(/kj-jc__title"[^>]*date="(\d{4}-\d{2}-\d{2})/)?.[1] ?? k.match(/date="(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
      kategoria: null,
      orari: null,
      teksti: null,
    });
  }
  rez.kandidate = kandidatet.length;
  await meDetaje(shf, op, rez, kandidatet, (s, faqja) => {
    const kategoria = kap(faqja, /id="mobile_industry">([^<]+)</);
    if (!gjejRolin(s.titulli, kategoria)) return null;
    return {
      ...s,
      // Dy variante: <b class="...TitleComp"> dhe <span class="...TitleComp ...TitleCompT"> (me link te kompania).
      kompania: kap(faqja, /class="containerLeftAreaTopAreaRightTitleComp[^"]*">([^<]+)</) ?? s.kompania,
      qyteti: kap(faqja, /class="inbJobCityName"[^>]*>([^<]+)</) ?? s.qyteti,
      kategoria,
      orari: kap(faqja, /id="mobile_orar">([^<]+)</),
      teksti: metaPershkrimi(faqja),
    };
  });
  return rez;
}

// ---------------------------------------------------------------- PortalPune (sitemap + JSON-LD)

type JobPosting = {
  "@type"?: string;
  title?: string;
  description?: string;
  validThrough?: string;
  employmentType?: string | string[];
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string } } | { address?: { addressLocality?: string } }[];
};

export async function portalpune(shf: Shfletuesi, op: OpsionetEBurimit): Promise<RezultatiIBurimit> {
  const rez: RezultatiIBurimit = { portali: "portalpune", neListe: 0, kandidate: 0, shpalljet: [], teNjohura: [], dublikataNgaLista: [], gabime: [] };
  const indeksi = await shf.merr("https://portalpune.com/sitemap.xml");
  const sitemapet = [...indeksi.matchAll(/<loc>([^<]*active_jobs_sitemap_\d+\.xml)<\/loc>/g)].map((m) => m[1]);
  const kandidatet: ShpalljaBruto[] = [];
  for (const sm of sitemapet) {
    const xml = await shf.merr(sm);
    for (const m of xml.matchAll(/<loc>(https:\/\/portalpune\.com\/jobs\/(\d+)-([a-z0-9-]+))<\/loc>/g)) {
      rez.neListe++;
      const [, linku, id, slug] = m;
      // Sitemap-i s'ka titull me shkronja shqipe; slug-u mjafton për filtrin e parë.
      if (!gjejRolin(titullNgaSlug(slug))) continue;
      kandidatet.push({
        portali: "portalpune",
        id_e_jashtme: id,
        linku,
        titulli: titullNgaSlug(slug),
        kompania: null,
        qyteti: null,
        afati: null,
        kategoria: null,
        orari: null,
        teksti: null,
      });
    }
  }
  rez.kandidate = kandidatet.length;
  await meDetaje(shf, op, rez, kandidatet, (s, faqja) => {
    let jp: JobPosting | null = null;
    for (const m of faqja.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const j = JSON.parse(m[1]) as JobPosting;
        if (j["@type"] === "JobPosting") jp = j;
      } catch {
        // JSON-LD i prishur: provojmë bllokun tjetër
      }
    }
    if (!jp?.title) return null;
    const vendi = Array.isArray(jp.jobLocation) ? jp.jobLocation[0] : jp.jobLocation;
    const lloji = Array.isArray(jp.employmentType) ? jp.employmentType[0] : jp.employmentType;
    return {
      ...s,
      titulli: dekodo(jp.title),
      kompania: jp.hiringOrganization?.name ? dekodo(jp.hiringOrganization.name) : null,
      qyteti: vendi?.address?.addressLocality ?? null,
      afati: jp.validThrough?.slice(0, 10) ?? null,
      orari: lloji ? lloji.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : null,
      teksti: jp.description ? tekstNgaHtml(jp.description) : null,
    };
  });
  return rez;
}

// ---------------------------------------------------------------- OfertaPune

function dataNgaPikat(d: string | null): string | null {
  const m = d?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export async function ofertapune(shf: Shfletuesi, op: OpsionetEBurimit): Promise<RezultatiIBurimit> {
  const rez: RezultatiIBurimit = { portali: "ofertapune", neListe: 0, kandidate: 0, shpalljet: [], teNjohura: [], dublikataNgaLista: [], gabime: [] };
  const html = await shf.merr("https://ofertapune.net/");
  const kandidatet: ShpalljaBruto[] = [];
  const pare = new Set<string>();
  for (const k of kartat(html)) {
    const linku = k.match(/href="(https:\/\/ofertapune\.net\/jobs\/[a-z0-9-]+)"/)?.[1];
    const id = k.match(/class="saveToFavBtn" ids="(\d+)"/)?.[1];
    const titulli = kap(k, /class="jobListTitle"[^>]*>([^<]+)</);
    if (!id || !linku || !titulli || pare.has(id)) continue;
    pare.add(id);
    rez.neListe++;
    if (!gjejRolin(titulli)) continue;
    kandidatet.push({
      portali: "ofertapune",
      id_e_jashtme: id,
      linku,
      titulli,
      kompania: kap(k, /class="jobListTitleComp"\s*>([^<]+)</),
      qyteti: kap(k, /class="jobListCity">([^<]+)</),
      afati: dataNgaPikat(kap(k, /class="jobListExpires">([^<]+)</)),
      kategoria: null,
      orari: null,
      teksti: null,
    });
  }
  rez.kandidate = kandidatet.length;
  await meDetaje(shf, op, rez, kandidatet, (s, faqja) => {
    const kategoria = kap(faqja, /href="https:\/\/ofertapune\.net\/kategori-pune\/[^"]+"[^>]*>([^<]+)</);
    if (!gjejRolin(s.titulli, kategoria)) return null;
    return { ...s, kategoria, teksti: metaPershkrimi(faqja) };
  });
  return rez;
}

export const BURIMET: Record<Portali, (shf: Shfletuesi, op: OpsionetEBurimit) => Promise<RezultatiIBurimit>> = {
  kosovajob,
  portalpune,
  ofertapune,
};
/**
 * Portalet që lexohen, me radhë (për dublikatat mbahet shpallja e portalit të parë).
 * OfertaPune s'është këtu: më 14.11 i ktheu botit tonë "403 Forbidden". E respektojmë dhe s'provojmë
 * ta anashkalojmë; parseri mbetet vetëm nëse na e lejojnë me shkrim. Shpalljet e saj janë kryesisht
 * edhe te KosovaJob (e njëjta firmë).
 */
export const RADHA: Portali[] = ["kosovajob", "portalpune"];
