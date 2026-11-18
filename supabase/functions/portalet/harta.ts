// Harta: nga një shpallje e portalit te një rresht i tabelës "punet". Vetëm rregulla, pa AI.
// Pa API të Deno-s: e njëjta skedë punon edhe te prova lokale me Node (scripts/provo-portalet.ts).

export type Portali = "kosovajob" | "portalpune" | "ofertapune";
export type Roli = "SWE" | "Asistent/PR";

export const EMRI_I_PORTALIT: Record<Portali, string> = {
  kosovajob: "KosovaJob",
  portalpune: "PortalPune",
  ofertapune: "OfertaPune",
};

/**
 * Çka nxjerr AI-ja nga shpallja (supabase/functions/portalet/kerkesat.ts), me fjalët tona dhe në shqip.
 * Ruhet te punet.kerkesat (jsonb); i njëjti tip është te src/lib/punet.ts. Mungesa = null ose [], kurrë e sajuar.
 */
export type Kerkesat = {
  permbledhja: string; // 1–2 fjali: çfarë pune është
  detyrat: string[]; // ≤ 5
  kerkesat: string[]; // ≤ 6, të detyrueshmet
  perparesi: string[]; // ≤ 4, të mirëseardhurat
  arsimi: string | null;
  pervoja: string | null; // p.sh. "2+ vjet"
  gjuhet: string[];
  orari: string | null;
  paga: string | null;
  perfitimet: string[]; // ≤ 4
  aplikimi: string | null; // si aplikohet, pa email e telefon
};

/**
 * Ajo që lexojmë nga portali. "teksti" (përshkrimi i shkurtër) dhe "trupi" (teksti i plotë i shpalljes)
 * përdoren vetëm për aftësitë dhe për nxjerrjen e kërkesave: s'ruhen kurrë (MODELI.md).
 */
export type ShpalljaBruto = {
  portali: Portali;
  id_e_jashtme: string;
  linku: string;
  titulli: string;
  kompania: string | null;
  qyteti: string | null;
  afati: string | null; // YYYY-MM-DD
  kategoria: string | null;
  orari: string | null; // p.sh. "Full Time"
  teksti: string | null;
  /** Teksti i plotë i shpalljes, i përkohshëm: shkon te AI-ja dhe harrohet. */
  trupi: string | null;
};

/** Rreshti që shkon te public.punet (fushat e migrimit 20261114120000_punet_portalet.sql). */
export type RreshtiPunes = {
  id: string;
  titulli: string;
  kompania: string;
  qyteti: string;
  roli: Roli;
  pershkrimi: string;
  aftesite: string[];
  burimi: "portal";
  linku: string;
  portali: Portali;
  id_e_jashtme: string;
  gjurma: string;
  afati: string | null;
  aktive: true;
  pare_me: string;
  kerkesat: Kerkesat | null; // null derisa AI-ja ta nxjerrë (index.ts)
};

/** Pa shkronja të mëdha, pa shenja (ë → e, ç → c), vetëm shkronja dhe numra. */
export function normalizo(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.net\b/g, " dotnet ")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------- Roli
// HARTA: në kurs vetëm SWE dhe Asistent/PR. Çdo gjë tjetër filtrohet (null).

const SWE_PO =
  /\b(developer|developers|zhvillues\w*|programer\w*|programues\w*|programmer\w*|software|softuer\w*|frontend|front end|backend|back end|full stack|fullstack|devops|android|ios|flutter|react|angular|vue|node|java|php|python|laravel|dotnet|c#|qa|quality assurance|tester|test automation|data engineer|machine learning|web dev\w*)\b/;
const SWE_PRAKTIKE = /\b(praktik\w*|intern|internship|trainee)\b/;
const SWE_IT = /\b(it|programim\w*|ict|tik)\b/;
const SWE_JO =
  /\b(shitj\w*|shites\w*|sales|agjent\w*|call center|marketing|recruit\w*|rekrut\w*|business developer|business development|mesimdhen\w*|teacher|trainer|instruktor\w*|ligjerues\w*|profesor\w*)\b/;

const ASISTENT_PO =
  /\b(asistent\w*|assistant\w*|administrat\w*|zyre|zyres|zyren|office|recepsion\w*|reception\w*|front desk|sekretar(?!iat)\w*|secretary|protokoll\w*|arkiv\w*|pr|public relations|marredhenie me publik\w*|komunikim\w*|communication\w*|social media|rrjete sociale|rrjeteve sociale|media sociale|community manager|copywriter)\b/;
const ASISTENT_JO =
  /\b(dentar\w*|dental|stomatolog\w*|mjek\w*|medical|medicin\w*|farmac\w*|pharma\w*|infermier\w*|nurse|kuzhin\w*|kitchen|chef|kamarier\w*|shitj\w*|shites\w*|sales|laborator\w*|veterin\w*|ndertim\w*|construction|teknik\w*|mesimdhen\w*|teaching|kopsht\w*|edukator\w*|fizioterap\w*|magazin\w*|depo\w*|shofer\w*|driver|mekanik\w*|elektri\w*|spa|teacher\w*|mirembajt\w*|assistant manager|mall|dyqan\w*|store|arkatar\w*|cashier)\b/;
// HARTA: punë e parë. Pozitat drejtuese (shef zyre, sekretar i përgjithshëm) s'janë "asistent".
const ASISTENT_DREJTUES =
  /\b(sekretar i pergjithshem|udheheqes\w*|pergjegjes\w*|drejtor\w*|head of|director|chief)\b/;
// "Administrator i rrjetit / sistemeve / databazës" është punë IT-je, jo zyre.
const ADMIN_IT = /\b(rrjet\w*|network\w*|sistem\w*|system\w*|server\w*|databaz\w*|database\w*|it)\b/;

// Shpallje që s'janë vende pune: tenderë, thirrje për oferta, konsulencë e jashtme, qira.
const JO_PUNE =
  /\b(procurement|tender|notice|request for (proposals|quotations)|rfp|rfq|thirrje per (propozime|oferta)|shpallje per oferte|ftese per oferte|qiramarrj\w*|terms of reference|ekspert i jashtem)\b/;

export function gjejRolin(titulli: string, kategoria: string | null = null): Roli | null {
  const t = normalizo(titulli);
  if (JO_PUNE.test(t)) return null;
  const k = kategoria ? normalizo(kategoria) : "";
  if (!SWE_JO.test(t)) {
    if (SWE_PO.test(t)) return "SWE";
    if (SWE_PRAKTIKE.test(t) && SWE_IT.test(t)) return "SWE";
    if (/\b(engineer|inxhinier\w*)\b/.test(t) && /teknologji e informacionit|\bit\b|software/.test(k)) return "SWE";
  }
  if (ASISTENT_PO.test(t) && !ASISTENT_JO.test(t) && !(ASISTENT_DREJTUES.test(t) && !/\b(asistent\w*|assistant)\b/.test(t))) {
    if (/\badministrator\w*\b/.test(t) && ADMIN_IT.test(t)) return null;
    return "Asistent/PR";
  }
  return null;
}

// ---------------------------------------------------------------- Aftësitë
// Fjalë që shpallja i përmend. Fjalori varet nga roli (p.sh. "SWIFT" te banka s'është gjuhë programimi).

const AFTESITE: Record<Roli, [string, RegExp][]> = {
  SWE: [
    ["React Native", /react[\s-]?native/i],
    ["React", /\breact(\.?js)?\b(?![\s-]?native)/i],
    ["TypeScript", /\btypescript\b/i],
    ["JavaScript", /\bjavascript\b/i],
    ["Node.js", /\bnode(\.?js)?\b/i],
    ["Java", /\bjava\b(?!script)/i],
    ["Kotlin", /\bkotlin\b/i],
    ["Swift", /\bswift(ui)?\b/i],
    ["Python", /\bpython\b/i],
    ["PHP", /\bphp\b/i],
    ["Laravel", /\blaravel\b/i],
    ["C#", /\bc#/i],
    [".NET", /\.net\b|\bdotnet\b/i],
    ["SQL", /\bsql\b|mysql|postgres|sql server/i],
    ["Git", /\bgit\b|github|gitlab/i],
    ["Docker", /\bdocker\b/i],
    ["AWS", /\baws\b/i],
    ["Azure", /\bazure\b/i],
    ["Angular", /\bangular\b/i],
    ["Vue", /\bvue(\.?js)?\b/i],
    ["HTML/CSS", /\bhtml5?\b|\bcss3?\b/i],
    ["Flutter", /\bflutter\b/i],
    ["REST API", /\brest(ful)?\b[\s-]*api|\bapi(s)?\b/i],
    ["Linux", /\blinux\b/i],
    ["QA", /\bqa\b|\btesting\b|selenium|cypress/i],
    ["Anglisht", /anglisht|\benglish\b/i],
  ],
  "Asistent/PR": [
    ["Excel", /\bexcel\b/i],
    ["MS Office", /ms office|microsoft office|\bword\b|powerpoint|office 365/i],
    ["Anglisht", /anglisht|\benglish\b/i],
    ["Gjermanisht", /gjermanisht|\bgerman\b|deutsch/i],
    ["Komunikim", /komunikim|communication/i],
    ["Organizim", /organizim|organizativ|organization(al)? skills|organisational/i],
    ["Rrjete sociale", /rrjete(t)? sociale|rrjeteve sociale|social media|instagram|tiktok/i],
    ["Canva", /\bcanva\b/i],
    ["Adobe", /photoshop|illustrator|adobe/i],
    ["Shërbim ndaj klientit", /customer service|sh[eë]rbim\w* ndaj klient/i],
  ],
};

export function gjejAftesite(roli: Roli, ...tekste: (string | null)[]): string[] {
  const teksti = tekste.filter(Boolean).join("\n");
  const gjetur: string[] = [];
  for (const [emri, rregulli] of AFTESITE[roli]) {
    if (rregulli.test(teksti)) gjetur.push(emri);
    if (gjetur.length === 10) break; // kufiri i tabelës (cardinality <= 10)
  }
  return gjetur;
}

// ---------------------------------------------------------------- Qyteti

const QYTETET: [RegExp, string][] = [
  [/^(prishtin\w*|pristin\w*|pristhin\w*)$/, "Prishtinë"],
  [/^prizren\w*$/, "Prizren"],
  [/^(pej\w*|pec)$/, "Pejë"],
  [/^gjakov\w*$/, "Gjakovë"],
  [/^mitrovic\w*$/, "Mitrovicë"],
  [/^ferizaj\w*$/, "Ferizaj"],
  [/^gjilan\w*$/, "Gjilan"],
  [/^fushe kosov\w*$/, "Fushë Kosovë"],
  [/^podujev\w*$/, "Podujevë"],
  [/^vushtrri\w*$/, "Vushtrri"],
  [/^suharek\w*$/, "Suharekë"],
  [/^rahovec\w*$/, "Rahovec"],
  [/^(drenas\w*|gllogoc\w*)$/, "Drenas"],
  [/^lipjan\w*$/, "Lipjan"],
  [/^malishev\w*$/, "Malishevë"],
  [/^kamenic\w*$/, "Kamenicë"],
  [/^decan\w*$/, "Deçan"],
  [/^istog\w*$/, "Istog"],
  [/^klin\w*$/, "Klinë"],
  [/^obiliq\w*$/, "Obiliq"],
  [/^skenderaj\w*$/, "Skenderaj"],
  [/^viti\w*$/, "Viti"],
  [/^shtime\w*$/, "Shtime"],
  [/^kacanik\w*$/, "Kaçanik"],
  [/^dragash\w*$/, "Dragash"],
  [/^(remote|online|nga shtepia|work from home|home office)$/, "Remote"],
  [/^(kosov\w*|(e )?gjithe kosov\w*|te gjitha qytetet)$/, "Kosovë"],
];

export function normalizoQytetin(qyteti: string | null): string {
  if (!qyteti) return "Kosovë";
  const pjeset = qyteti
    .split(/[,/;]| dhe | - /)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const n = normalizo(p);
      for (const [rregulli, emri] of QYTETET) if (rregulli.test(n)) return emri;
      return p.replace(/\s+/g, " ");
    });
  const unike = [...new Set(pjeset)];
  const teksti = unike.join(", ").slice(0, 60).trim();
  return teksti.length >= 2 ? teksti : "Kosovë";
}

// ---------------------------------------------------------------- Gjurma (dublikatat)

const PRAPASHTESAT_E_FIRMES = /\b(l l c|llc|sh p k|shpk|sh a|sha|ltd|gmbh|inc|d o o|doo)\b/g;

/** E njëjta punë në dy portale: titulli + kompania, të normalizuar. */
export function gjurma(titulli: string, kompania: string): string {
  const t = normalizo(titulli).replace(/#/g, "");
  const k = normalizo(kompania).replace(/#/g, " ").replace(PRAPASHTESAT_E_FIRMES, "").replace(/\s+/g, " ").trim();
  return `${t}|${k}`.slice(0, 220);
}

// ---------------------------------------------------------------- Përmbledhja (me fjalët tona)

function dataShqip(iso: string): string {
  const [v, m, d] = iso.split("-");
  return `${d}.${m}.${v}`;
}

/** Përmbledhja e rezervës (pa AI): 1–2 fjali me faktet që kemi. Ekrani i detajeve e përdor vetëm kur s'ka "kerkesat". */
export function permbledhja(roli: Roli, kompania: string, qyteti: string, s: ShpalljaBruto): string {
  const fjalia1 = `${roli === "SWE" ? "Punë në zhvillim softueri" : "Punë asistence ose PR"} te ${kompania}, ${qyteti}.`;
  const pjeset: string[] = [];
  if (s.orari) pjeset.push(`orari ${s.orari}`);
  if (s.afati) pjeset.push(`afati i aplikimit ${dataShqip(s.afati)}`);
  const fjalia2 = pjeset.length ? ` ${pjeset.join(", ").replace(/^./, (c) => c.toUpperCase())}.` : "";
  return `${fjalia1}${fjalia2}`.slice(0, 1000);
}

/**
 * Përshkrimi (kolona "pershkrimi", ≤ 1000) kur AI-ja i nxori kërkesat: përmbledhja, kërkesat dhe përparësitë.
 * Kështu edhe "A jam gati?" (që lexon "pershkrimi") merr kërkesat e vërteta, jo një frazë të përgjithshme.
 */
export function pershkrimiNgaKerkesat(k: Kerkesat): string {
  const pjeset = [k.permbledhja];
  if (k.kerkesat.length) pjeset.push(`Kërkohet: ${k.kerkesat.join("; ")}.`);
  if (k.pervoja) pjeset.push(`Përvoja: ${k.pervoja}.`);
  if (k.arsimi) pjeset.push(`Arsimi: ${k.arsimi}.`);
  if (k.perparesi.length) pjeset.push(`Përparësi: ${k.perparesi.join("; ")}.`);
  let teksti = "";
  for (const p of pjeset) {
    const pas = teksti ? `${teksti} ${p}` : p;
    if (pas.length > 1000) break;
    teksti = pas;
  }
  return teksti;
}

/** Aftësitë nga rregullat + ato që dalin nga kërkesat e AI-së (pa dublikata, ≤ 10 si kufiri i tabelës). */
export function bashkoAftesite(roli: Roli, ekzistuese: string[], k: Kerkesat): string[] {
  const teksti = [...k.kerkesat, ...k.perparesi, ...k.gjuhet, k.pervoja, k.arsimi].filter(Boolean).join("\n");
  const pare = new Set<string>();
  const dalja: string[] = [];
  for (const a of [...ekzistuese, ...gjejAftesite(roli, teksti)]) {
    const g = normalizo(a);
    if (pare.has(g)) continue;
    pare.add(g);
    dalja.push(a);
  }
  return dalja.slice(0, 10);
}

// ---------------------------------------------------------------- Shpallja → rresht

function prej(s: string, min: number, max: number, rezerve: string): string {
  const t = s.replace(/\s+/g, " ").trim().slice(0, max).trim();
  return t.length >= min ? t : rezerve;
}

/** Data e sotme në Kosovë (YYYY-MM-DD). */
export function sot(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());
}

/** null = jashtë HARTA-s (roli tjetër), ose e skaduar. */
export function neRresht(s: ShpalljaBruto, tani = new Date().toISOString(), dita = sot()): RreshtiPunes | null {
  const roli = gjejRolin(s.titulli, s.kategoria);
  if (!roli) return null;
  if (s.afati && s.afati < dita) return null;
  // HARTA: moduli "jashtë vendit" pret pas Demo Day-t.
  if (/\b(jashte vendit|abroad|on site libya)\b/.test(normalizo(`${s.qyteti ?? ""} ${s.titulli}`))) return null;
  const titulli = prej(s.titulli, 3, 120, "Pozitë pune");
  const kompania = prej(s.kompania ?? "", 2, 80, "Kompani e pa emërtuar");
  const qyteti = normalizoQytetin(s.qyteti);
  const aftesite = gjejAftesite(roli, s.titulli, s.teksti, s.trupi);
  return {
    id: `${s.portali}-${s.id_e_jashtme}`,
    titulli,
    kompania,
    qyteti,
    roli,
    pershkrimi: permbledhja(roli, kompania, qyteti, s),
    aftesite,
    burimi: "portal",
    linku: s.linku,
    portali: s.portali,
    id_e_jashtme: s.id_e_jashtme,
    gjurma: gjurma(titulli, kompania),
    afati: s.afati,
    aktive: true,
    pare_me: tani,
    kerkesat: null,
  };
}

const FJALE_BOSHE = new Set(["and", "dhe", "e", "i", "te", "the", "of", "per", "ne", "group", "kosova", "kosovo", "kosove"]);
const fjaletEFirmes = (k: string) =>
  new Set(k.split(" ").filter((f) => f.length > 1 && !FJALE_BOSHE.has(f) && !QYTETET.some(([r]) => r.test(f))));

/**
 * E njëjta shpallje në dy portale? Gjurma e njëjtë, ose: i njëjti titull, i njëjti qytet dhe emrat e
 * firmës ndajnë shumicën e fjalëve ("Innovation & Training Park Prizren" = "Innovation and Training Park").
 */
export function eshteENjejta(a: { gjurma: string; qyteti: string }, b: { gjurma: string; qyteti: string }): boolean {
  if (a.gjurma === b.gjurma) return true;
  const [ta, ka] = a.gjurma.split("|");
  const [tb, kb] = b.gjurma.split("|");
  if (ta !== tb || a.qyteti !== b.qyteti) return false;
  const fa = fjaletEFirmes(ka ?? "");
  const fb = fjaletEFirmes(kb ?? "");
  const tePerbashketa = [...fa].filter((f) => fb.has(f)).length;
  return Math.min(fa.size, fb.size) > 0 && tePerbashketa / Math.min(fa.size, fb.size) >= 0.75;
}

/** Heq dublikatat brenda një importi: e mban të parin (radha e portaleve ka rëndësi). */
export function hiqDublikatat(rreshtat: RreshtiPunes[]): { unike: RreshtiPunes[]; dublikata: { mbajtur: string; hequr: string }[] } {
  const pare = new Map<string, RreshtiPunes>();
  const unike: RreshtiPunes[] = [];
  const dublikata: { mbajtur: string; hequr: string }[] = [];
  for (const r of rreshtat) {
    const ekziston = pare.get(r.gjurma) ?? unike.find((u) => u.id === r.id || eshteENjejta(u, r));
    if (ekziston) {
      dublikata.push({ mbajtur: ekziston.id, hequr: r.id });
      continue;
    }
    pare.set(r.gjurma, r);
    unike.push(r);
  }
  return { unike, dublikata };
}
