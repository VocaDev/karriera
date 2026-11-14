// Rindërtimi i CV-së: sugjerimet e pranuara zbatohen te CV-ja origjinale KËTU, në telefon, pa AI.
// I njëjti hyrje → i njëjti rezultat (pa rastësi, pa rrjet), prandaj mund të zhbëhet çdo hap.
//
//   origjinali (AnalizaCV.cv)  +  sugjerimet  +  zgjedhjet (pranuar/kaluar, vlerat e [placeholder-ave],
//   rreshtat e ndryshuar me dorë)  →  rindertoCV()  →  CV-ja e re, gati për ruajCV().
//
// Rregullat:
// - "gabim": `para` zëvendësohet me `pas` kudo në atë fushë; "rishkrim": vetëm herën e parë.
// - "shto": `pas` shtohet në fund të fushës (ose bëhet aftësi e re); "hiq": hiqet teksti ose i gjithë rreshti.
// - Shenja (seksioni + indeksi + fusha) kontrollohet; nëse AI-ja ka gabuar indeksin, kërkohet `para`-ja
//   në atë seksion. Kur `para` s'gjendet, sugjerimi s'zbatohet (mbetet këshillë, kurrë s'hamendësohet).
// - Fshirjet bëhen në fund, që indekset e sugjerimeve të tjera të mbeten të sakta.
// Vetëm importe tipesh: provohet edhe me Node, pa React Native.
import type { CvStrukturuar, SeksioniCV, SugjerimCV } from "@/lib/cv";

// ---------- Zgjedhjet e kandidatit ----------

export type Vendimi = "pranuar" | "kaluar";

export type Zgjedhjet = {
  vendimet: Record<string, Vendimi>; // id e sugjerimit → vendimi
  vlerat: Record<string, string>; // celesiVleres(id, "[placeholder]") → vlera që shkroi kandidati
  ndryshimet: Record<string, string>; // celesiFushes(shenja) → teksti i shkruar me dorë te "Rindërto"
};

export const ZGJEDHJE_BOSH: Zgjedhjet = { vendimet: {}, vlerat: {}, ndryshimet: {} };

// ---------- Fushat e CV-së ----------

export type SeksioniListe = "pervoja" | "projektet" | "arsimi" | "gjuhet";
export type SeksioniTekst = "emri" | "email" | "telefoni" | "qyteti" | "titulli" | "profili";

/** Një fushë e CV-së: seksioni, pozita në listë (null për tekstet e vetme) dhe fusha e elementit. */
export type Shenja = {
  seksioni: SeksioniTekst | "aftesite" | SeksioniListe;
  indeksi: number | null;
  fusha: string | null;
};

export const FUSHAT: Record<SeksioniListe, readonly string[]> = {
  pervoja: ["roli", "vendi", "periudha", "pershkrimi"],
  projektet: ["titulli", "pershkrimi", "linku"],
  arsimi: ["programi", "institucioni", "periudha"],
  gjuhet: ["gjuha", "niveli"],
};

const SEKSIONET_LISTE: readonly SeksioniListe[] = ["pervoja", "projektet", "arsimi", "gjuhet"];
const TEKSTET_E_GJATA = new Set(["profili", "pershkrimi"]); // këtu "shto" shton një fjali në fund

export const RENDI_I_SEKSIONEVE: readonly SeksioniCV[] = [
  "titulli",
  "profili",
  "pervoja",
  "projektet",
  "arsimi",
  "aftesite",
  "gjuhet",
];

export const EMRAT_E_SEKSIONEVE: Record<SeksioniCV, string> = {
  titulli: "Titulli",
  profili: "Profili",
  pervoja: "Përvoja",
  projektet: "Projektet",
  arsimi: "Arsimi",
  aftesite: "Aftësitë",
  gjuhet: "Gjuhët",
};

const eshteListe = (s: string): s is SeksioniListe => (SEKSIONET_LISTE as readonly string[]).includes(s);

export function celesiFushes(sh: Shenja): string {
  return `${sh.seksioni}/${sh.indeksi ?? "-"}/${sh.fusha ?? "-"}`;
}

/** Çelësi i një aftësie të re nga sugjerimi `id` (për ndryshimin me dorë te "Rindërto"). */
export const celesiAftesiseSeRe = (id: string) => `aftesite/+${id}/-`;

type Element = Record<string, unknown>;

function elementi(cv: CvStrukturuar, seksioni: SeksioniListe, indeksi: number): Element | null {
  const lista = cv[seksioni] as unknown as Element[];
  return lista[indeksi] ?? null;
}

/** Teksti i një fushe, ose null nëse fusha s'ekziston. */
export function lexo(cv: CvStrukturuar, sh: Shenja): string | null {
  const { seksioni, indeksi, fusha } = sh;
  if (seksioni === "telefoni") return cv.telefoni ?? "";
  if (seksioni === "emri" || seksioni === "email" || seksioni === "qyteti" || seksioni === "titulli" || seksioni === "profili") {
    return cv[seksioni];
  }
  if (indeksi === null) return null;
  if (seksioni === "aftesite") return cv.aftesite[indeksi] ?? null;
  if (!eshteListe(seksioni) || !fusha || !FUSHAT[seksioni].includes(fusha)) return null;
  const el = elementi(cv, seksioni, indeksi);
  if (!el) return null;
  const v = el[fusha];
  return typeof v === "string" ? v : "";
}

function shkruaj(cv: CvStrukturuar, sh: Shenja, teksti: string): void {
  const { seksioni, indeksi, fusha } = sh;
  if (seksioni === "telefoni") {
    cv.telefoni = teksti.trim() ? teksti : null;
  } else if (seksioni === "emri" || seksioni === "email" || seksioni === "qyteti" || seksioni === "titulli" || seksioni === "profili") {
    cv[seksioni] = teksti;
  } else if (seksioni === "aftesite" && indeksi !== null) {
    cv.aftesite[indeksi] = teksti;
  } else if (eshteListe(seksioni) && indeksi !== null && fusha) {
    const el = elementi(cv, seksioni, indeksi);
    if (el) el[fusha] = fusha === "linku" && !teksti.trim() ? null : teksti;
  }
}

const klono = (cv: CvStrukturuar): CvStrukturuar => JSON.parse(JSON.stringify(cv)) as CvStrukturuar;

// ---------- Kërkimi i tekstit ----------

// Shkronjat latine (edhe ë, ç, ü…). Pa \p{L}, që shprehja të punojë njësoj në çdo motor JS.
const SHKRONJAT = "A-Za-z\u00C0-\u024F";
const eshteShkronje = (c: string | undefined) => !!c && /[A-Za-zÀ-ɏ]/.test(c);
const shmang = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Shprehja që gjen `para` në një tekst: hapësirat (edhe rreshtat e rinj) llogariten njësoj, dhe një fjalë
 * s'gjendet brenda një fjale tjetër ("te" s'gjendet te "teknologji").
 */
function shprehja(para: string, global: boolean): RegExp | null {
  const copat = para.trim().split(/\s+/).filter(Boolean).map(shmang);
  if (copat.length === 0) return null;
  const p = para.trim();
  const fillimi = eshteShkronje(p[0]) ? `(?<![${SHKRONJAT}])` : "";
  const fundi = eshteShkronje(p[p.length - 1]) ? `(?![${SHKRONJAT}])` : "";
  return new RegExp(`${fillimi}${copat.join("\\s+")}${fundi}`, global ? "g" : "");
}

export function permban(teksti: string, para: string): boolean {
  const re = shprehja(para, false);
  return !!re && re.test(teksti);
}

function zevendeso(teksti: string, para: string, pas: string, kudo: boolean): string | null {
  const re = shprehja(para, kudo);
  if (!re || !re.test(teksti)) return null;
  re.lastIndex = 0;
  return teksti.replace(re, () => pas);
}

// Pas heqjes: pa hapësira të dyfishta, pa hapësirë para pikësimit, pa rreshta bosh.
function pastro(teksti: string): string {
  return teksti
    .split("\n")
    .map((r) => r.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").replace(/^[\s,;:]+/, "").trimEnd())
    .filter((r) => r.trim().length > 0)
    .join("\n");
}

// "shto": rresht i ri kur fusha është listë me rreshta; përndryshe një fjali e re pas pikës.
function bashko(teksti: string, pas: string): string {
  const baza = teksti.trimEnd();
  if (baza.includes("\n")) return `${baza}\n${pas}`;
  return /[.!?…:]$/.test(baza) ? `${baza} ${pas}` : `${baza}. ${pas}`;
}

// ---------- Shenja e sugjerimit ----------

/**
 * Ku bie sugjerimi në CV. Indeksi dhe fusha e AI-së provohen të parat; nëse `para` s'është aty,
 * kërkohet në elementet e tjera të të njëjtit seksion. Null = s'ka ku të zbatohet.
 */
export function zgjidhShenjen(cv: CvStrukturuar, s: SugjerimCV): Shenja | null {
  const { seksioni, para } = s;

  if (seksioni === "titulli" || seksioni === "profili") {
    const sh: Shenja = { seksioni, indeksi: null, fusha: null };
    return !para || permban(lexo(cv, sh) ?? "", para) ? sh : null;
  }

  if (seksioni === "aftesite") {
    const i = s.indeksi;
    if (i !== null && i < cv.aftesite.length && (!para || permban(cv.aftesite[i], para))) {
      return { seksioni, indeksi: i, fusha: null };
    }
    if (!para) return null;
    const gjetur = cv.aftesite.findIndex((a) => permban(a, para));
    return gjetur >= 0 ? { seksioni, indeksi: gjetur, fusha: null } : null;
  }

  const lista = cv[seksioni] as unknown[];
  const fushat = FUSHAT[seksioni];
  const fushaEDhene = s.fusha && fushat.includes(s.fusha) ? s.fusha : null;
  const indeksiIVlefshem = s.indeksi !== null && s.indeksi < lista.length ? s.indeksi : null;

  if (!para) {
    if (indeksiIVlefshem === null) return null;
    const fusha = fushaEDhene ?? (s.lloji === "shto" && fushat.includes("pershkrimi") ? "pershkrimi" : null);
    return fusha ? { seksioni, indeksi: indeksiIVlefshem, fusha } : null;
  }

  const indekset = [
    ...(indeksiIVlefshem !== null ? [indeksiIVlefshem] : []),
    ...lista.map((_, i) => i).filter((i) => i !== indeksiIVlefshem),
  ];
  const fushatERradhes = fushaEDhene ? [fushaEDhene, ...fushat.filter((f) => f !== fushaEDhene)] : [...fushat];
  for (const indeksi of indekset) {
    for (const fusha of fushatERradhes) {
      const sh: Shenja = { seksioni, indeksi, fusha };
      if (permban(lexo(cv, sh) ?? "", para)) return sh;
    }
  }
  return null;
}

// ---------- Placeholder-at ----------

// E njëjta shprehje si te supabase/functions/_shared/sugjerimet.ts.
const PLACEHOLDER = /\[[^[\]\n]{1,80}\]/g;

export const celesiVleres = (id: string, placeholder: string) => `${id}|${placeholder}`;

/** "[numri i përdoruesve]" → "numri i përdoruesve" (etiketa e fushës që plotëson kandidati). */
export const etiketaEPlaceholderit = (p: string) => p.slice(1, -1).trim();

/** Placeholder-at e një sugjerimi: ata në `pas` (lista e AI-së s'merret e mirëqenë). */
export function placeholderat(s: SugjerimCV): string[] {
  return [...new Set(s.pas.match(PLACEHOLDER) ?? [])];
}

/** `pas` me vlerat e kandidatit në vend të placeholder-ave (ata pa vlerë mbeten si janë). */
export function mbushPas(s: SugjerimCV, vlerat: Record<string, string>): string {
  let teksti = s.pas;
  for (const p of placeholderat(s)) {
    const vlera = vlerat[celesiVleres(s.id, p)]?.trim();
    if (vlera) teksti = teksti.split(p).join(vlera);
  }
  return teksti;
}

export function vleratQeMungojne(s: SugjerimCV, vlerat: Record<string, string>): string[] {
  return placeholderat(s).filter((p) => !vlerat[celesiVleres(s.id, p)]?.trim());
}

// ---------- Zbatimi ----------

export type Rezultati = {
  /** CV-ja e re: pa elementet e hequra, me aftësitë e reja. Kjo ruhet. */
  cv: CvStrukturuar;
  /** E njëjta CV me indekset e origjinalit (të hequrat ende brenda), për pamjen para/pas. */
  pune: CvStrukturuar;
  /** Elementet e hequra: "aftesite/2", "pervoja/0". */
  fshire: Set<string>;
  /** Aftësitë e reja, me id-në e sugjerimit. */
  shtuara: { id: string; teksti: string }[];
  /** Fushat e ndryshuara nga sugjerimet: celesiFushes → id-të. */
  ndryshuar: Map<string, string[]>;
  /** Sugjerimet e pranuara që s'u zbatuan (teksti s'gjendet më, p.sh. e ndryshoi një sugjerim tjetër). */
  deshtuan: string[];
};

type Gjurmet = Pick<Rezultati, "fshire" | "shtuara" | "ndryshuar">;

function shenoNdryshimin(g: Gjurmet, sh: Shenja, id: string) {
  const celesi = celesiFushes(sh);
  g.ndryshuar.set(celesi, [...(g.ndryshuar.get(celesi) ?? []), id]);
}

const iNjejti = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

function zbato(pune: CvStrukturuar, s: SugjerimCV, pas: string, g: Gjurmet): boolean {
  // Aftësi e re.
  if (s.lloji === "shto" && s.seksioni === "aftesite" && (s.indeksi === null || s.indeksi >= pune.aftesite.length)) {
    if (!pas.trim()) return false;
    const ekziston = pune.aftesite.some((a) => iNjejti(a, pas)) || g.shtuara.some((a) => iNjejti(a.teksti, pas));
    if (!ekziston) g.shtuara.push({ id: s.id, teksti: pas.trim() });
    return true;
  }

  // Heqja e një elementi të tërë (një aftësi, një përvojë…).
  if (s.lloji === "hiq" && s.fusha === null && s.seksioni !== "titulli" && s.seksioni !== "profili") {
    if (s.seksioni === "aftesite") {
      const sh = zgjidhShenjen(pune, s);
      if (!sh || sh.indeksi === null) return false;
      // Vetëm kur `para` është e gjithë aftësia; një pjesë e saj hiqet si tekst më poshtë.
      if (!s.para || iNjejti(pune.aftesite[sh.indeksi], s.para)) {
        g.fshire.add(`aftesite/${sh.indeksi}`);
        return true;
      }
    } else if (!s.para) {
      if (s.indeksi === null || s.indeksi >= (pune[s.seksioni] as unknown[]).length) return false;
      g.fshire.add(`${s.seksioni}/${s.indeksi}`);
      return true;
    } else {
      // `para` = një fushë e tërë e elementit (p.sh. roli) → hiqet i gjithë elementi.
      const sh = zgjidhShenjen(pune, s);
      if (sh && sh.indeksi !== null && iNjejti(lexo(pune, sh) ?? "", s.para)) {
        g.fshire.add(`${s.seksioni}/${sh.indeksi}`);
        return true;
      }
    }
  }

  const sh = zgjidhShenjen(pune, s);
  if (!sh) return false;
  const teksti = lexo(pune, sh) ?? "";
  let iRi: string | null;

  switch (s.lloji) {
    case "gabim":
      iRi = s.para ? zevendeso(teksti, s.para, pas, true) : null;
      break;
    case "rishkrim":
      iRi = s.para ? zevendeso(teksti, s.para, pas, false) : pas;
      break;
    case "shto": {
      const iGjate = TEKSTET_E_GJATA.has(sh.fusha ?? sh.seksioni);
      if (!pas.trim()) iRi = null;
      else if (!teksti.trim()) iRi = pas;
      else iRi = iGjate ? bashko(teksti, pas) : null; // një fushë e shkurtër e plotë s'merr tekst shtesë
      break;
    }
    case "hiq": {
      const pa = s.para ? zevendeso(teksti, s.para, "", false) : null;
      iRi = pa === null ? null : pastro(pa);
      break;
    }
  }

  if (iRi === null) return false;
  shkruaj(pune, sh, iRi);
  shenoNdryshimin(g, sh, s.id);
  return true;
}

function ngaCelesi(celesi: string): Shenja | null {
  const [seksioni, indeksi, fusha] = celesi.split("/");
  if (!seksioni || indeksi === undefined || fusha === undefined) return null;
  return {
    seksioni: seksioni as Shenja["seksioni"],
    indeksi: indeksi === "-" ? null : Number(indeksi),
    fusha: fusha === "-" ? null : fusha,
  };
}

/** CV-ja me sugjerimet e pranuara (me radhën e analizës) dhe me rreshtat e ndryshuar me dorë. */
export function rindertoCV(origjinali: CvStrukturuar, sugjerimet: SugjerimCV[], z: Zgjedhjet): Rezultati {
  const pune = klono(origjinali);
  const g: Gjurmet = { fshire: new Set(), shtuara: [], ndryshuar: new Map() };
  const deshtuan: string[] = [];

  for (const s of sugjerimet) {
    if (z.vendimet[s.id] !== "pranuar") continue;
    if (!zbato(pune, s, mbushPas(s, z.vlerat), g)) deshtuan.push(s.id);
  }

  // Rreshtat që kandidati i shkroi vetë kanë fjalën e fundit.
  for (const [celesi, teksti] of Object.entries(z.ndryshimet)) {
    if (celesi.startsWith("aftesite/+")) {
      const e = g.shtuara.find((a) => celesiAftesiseSeRe(a.id) === celesi);
      if (e) e.teksti = teksti;
      continue;
    }
    const sh = ngaCelesi(celesi);
    if (sh && lexo(pune, sh) !== null) shkruaj(pune, sh, teksti);
  }

  // Rreshtat e përvojës/projekteve që i ndryshoi AI-ja shënohen (dokumenti tregon "AI" pranë tyre).
  const ndryshuarNga = (seksioni: string, i: number) =>
    [...g.ndryshuar.keys()].some((k) => k.startsWith(`${seksioni}/${i}/`));
  pune.pervoja.forEach((el, i) => {
    if (ndryshuarNga("pervoja", i)) el.nga_ai = true;
  });
  pune.projektet.forEach((el, i) => {
    if (ndryshuarNga("projektet", i)) el.nga_ai = true;
  });

  const cv = klono(pune);
  const pambetur = <T,>(lista: T[], seksioni: string) => lista.filter((_, i) => !g.fshire.has(`${seksioni}/${i}`));
  cv.pervoja = pambetur(cv.pervoja, "pervoja");
  cv.projektet = pambetur(cv.projektet, "projektet");
  cv.arsimi = pambetur(cv.arsimi, "arsimi");
  cv.gjuhet = pambetur(cv.gjuhet, "gjuhet");
  const aftesite: string[] = [];
  for (const a of [...cv.aftesite.filter((_, i) => !g.fshire.has(`aftesite/${i}`)), ...g.shtuara.map((x) => x.teksti)]) {
    if (a.trim() && !aftesite.some((b) => iNjejti(a, b))) aftesite.push(a.trim());
  }
  cv.aftesite = aftesite;

  return { cv, pune, fshire: g.fshire, shtuara: g.shtuara, ndryshuar: g.ndryshuar, deshtuan };
}

/** A mund të zbatohet ky sugjerim mbi zgjedhjet e tanishme (pa u përplasur me të tjerët)? */
export function mundTeZbatohet(origjinali: CvStrukturuar, sugjerimet: SugjerimCV[], z: Zgjedhjet, id: string): boolean {
  const provo: Zgjedhjet = { ...z, vendimet: { ...z.vendimet, [id]: "pranuar" } };
  return !rindertoCV(origjinali, sugjerimet, provo).deshtuan.includes(id);
}

/** A zbatohet ky sugjerim te CV-ja origjinale, i vetëm? Jo = tregohet si këshillë, pa "Shtoje në CV". */
export function zbatohetVete(origjinali: CvStrukturuar, s: SugjerimCV): boolean {
  return rindertoCV(origjinali, [s], { ...ZGJEDHJE_BOSH, vendimet: { [s.id]: "pranuar" } }).deshtuan.length === 0;
}

// ---------- Për ekranet ----------

export function numerimi(sugjerimet: SugjerimCV[], z: Zgjedhjet) {
  let pranuar = 0;
  let kaluar = 0;
  for (const s of sugjerimet) {
    if (z.vendimet[s.id] === "pranuar") pranuar += 1;
    else if (z.vendimet[s.id] === "kaluar") kaluar += 1;
  }
  return { pranuar, kaluar, mbeten: sugjerimet.length - pranuar - kaluar, gjithsej: sugjerimet.length };
}

/** "Përvoja · Asistent në IT", "Aftësitë · Excel", "Profili": ku bie sugjerimi, me fjalë. */
export function ku(origjinali: CvStrukturuar, s: SugjerimCV): string {
  const emri = EMRAT_E_SEKSIONEVE[s.seksioni];
  const sh = zgjidhShenjen(origjinali, s);
  const i = sh?.indeksi ?? s.indeksi;
  if (i === null) return emri;
  if (s.seksioni === "aftesite") return origjinali.aftesite[i] ? `${emri} · ${origjinali.aftesite[i]}` : emri;
  if (s.seksioni === "titulli" || s.seksioni === "profili") return emri;
  const el = elementi(origjinali, s.seksioni, i);
  const etiketa = el ? [el.roli, el.titulli, el.programi, el.gjuha].find((v) => typeof v === "string" && v.trim()) : null;
  return typeof etiketa === "string" ? `${emri} · ${etiketa}` : emri;
}
