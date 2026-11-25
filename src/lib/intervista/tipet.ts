// KONTRATA E INTERVISTËS (WP4) · tipet që ndajnë app-i dhe Edge Functions intervista-nis / -kthesa / -raporti.
// Çdo përgjigje nga serveri kontrollohet me funksionet "eshte…" para se të përdoret (AI-ja s'merret e mirëqenë).

export type Gjuha = "sq" | "en" | "de";
export type Gjatesia = "shkurter" | "plote";
export type Roli = "SWE" | "Asistent/PR" | "Tjetër";
export type GjendjaDB = "aktive" | "mbaroi" | "po_vleresohet" | "perfunduar";
export type Shprehja = "neutrale" | "buzeqeshje" | "interesim" | "empati";
/** Kush të interviston (zgjedhja te ekrani i nisjes): Arta (grua) ose Arbër (burrë). */
export type Intervistuesi = "arta" | "arber";

export const GJUHET: readonly Gjuha[] = ["sq", "en", "de"];
export const EMRAT_E_GJUHEVE: Record<Gjuha, string> = { sq: "Shqip", en: "English", de: "Deutsch" };

/** E njëjta tabelë si GJATESITE te supabase/functions/_shared/intervista-ai.ts (pyetje kryesore, pa vazhdimet). */
export const GJATESITE: Record<Gjatesia, { min: number; max: number; emri: string }> = {
  shkurter: { min: 3, max: 4, emri: "E shkurtër" },
  plote: { min: 5, max: 7, emri: "E plotë" },
};

export const MAKS_PERGJIGJJA = 4000;

export const INTERVISTUESI_FILLESTAR: Intervistuesi = "arta";
export const INTERVISTUESIT: readonly Intervistuesi[] = ["arta", "arber"];

/** Emri dhe format e tij në shqip; i vetmi vend në app ku shkruhen emrat e intervistuesve. */
export const PAMJA_E_INTERVISTUESIT: Record<
  Intervistuesi,
  { emri: string; gjenitivi: string; roli: string; inicialja: string }
> = {
  arta: { emri: "Arta", gjenitivi: "Artës", roli: "intervistuesja", inicialja: "A" },
  arber: { emri: "Arbër", gjenitivi: "Arbërit", roli: "intervistuesi", inicialja: "A" },
};

/** Një pyetje e intervistuesit (Arta ose Arbër), siç e kthen serveri. */
export type Kthesa = {
  nr: number;
  lloji: "pyetje" | "vazhdim";
  reagimi: string | null;
  pyetja: string;
  shprehja: Shprehja; // për avatarin më vonë; teksti s'e përdor
};

export type IntervistaInfo = {
  id: string;
  gjuha: Gjuha;
  roli: Roli;
  gjatesia: Gjatesia;
  gjendja: GjendjaDB;
  nr_pyetjeve: number;
  min: number;
  max: number;
  puna: { id: string; titulli: string; kompania: string } | null;
  /** Intervistat e vjetra s'e kanë fushën: mbeten "arta". */
  intervistuesi: Intervistuesi;
};

export type VleresimiIPergjigjes = {
  cka_ishte_mire: string;
  cka_te_permiresosh: string;
  shembull_me_i_mire: string;
};

export type Raporti = {
  versioni: number;
  nota: number; // 0–100, vlerësim praktik i AI-së (jo parashikim punësimi)
  permbledhja: string;
  tri_hapat_e_radhes: string[];
  /** Si e përballoi presionin (pyetjet me sfidë ose provokim); null nëse s'pati, mungon te raportet e vjetra. */
  presioni?: {
    momentet: { nr: number; qasja: "sfide" | "provokim"; pyetja: string; si_u_pergjigj: string }[];
    permbledhja: string;
    keshilla: string;
  } | null;
  pergjigjet: ({ nr: number; lloji: "pyetje" | "vazhdim"; pyetja: string } & VleresimiIPergjigjes)[];
  gatishmeria: {
    id: string | null;
    para: number | null;
    pas: number | null;
    ke: { aftesia: string; deshmia: string }[];
    mungon: { aftesia: string; pse: string; si: string }[];
    arsyeja: string;
  };
  puna: { id: string; titulli: string; kompania: string };
  gjuha: Gjuha;
  /** Mungon te raportet e vjetra. */
  intervistuesi?: Intervistuesi;
  modeli: string;
};

/** Një rresht i bisedës në ekran (pyetjet dhe përgjigjet e ruajtura në DB). */
export type RreshtiIBisedes = {
  nr: number;
  lloji: "pyetje" | "vazhdim";
  reagimi: string | null;
  pyetja: string;
  pergjigja: string | null;
};

// ---------- Kontrolli i përgjigjeve ----------
const eshteTekst = (v: unknown): v is string => typeof v === "string";
const eshteNumer = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const eshteObjekt = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const listeMe = (v: unknown, k: (x: unknown) => boolean) => Array.isArray(v) && v.every(k);

export const eshteGjuhe = (v: unknown): v is Gjuha => v === "sq" || v === "en" || v === "de";
export const eshteIntervistues = (v: unknown): v is Intervistuesi => v === "arta" || v === "arber";
export const eshteGjatesi = (v: unknown): v is Gjatesia => v === "shkurter" || v === "plote";
const eshteRol = (v: unknown): v is Roli => v === "SWE" || v === "Asistent/PR" || v === "Tjetër";
const eshteGjendje = (v: unknown): v is GjendjaDB =>
  v === "aktive" || v === "mbaroi" || v === "po_vleresohet" || v === "perfunduar";
const eshteLloj = (v: unknown): v is "pyetje" | "vazhdim" => v === "pyetje" || v === "vazhdim";
const SHPREHJET: readonly string[] = ["neutrale", "buzeqeshje", "interesim", "empati"];

export function lexoKthesen(v: unknown): Kthesa | null {
  if (!eshteObjekt(v)) return null;
  if (!eshteNumer(v.nr) || !eshteLloj(v.lloji) || !eshteTekst(v.pyetja)) return null;
  if (v.reagimi !== null && v.reagimi !== undefined && !eshteTekst(v.reagimi)) return null;
  return {
    nr: v.nr,
    lloji: v.lloji,
    reagimi: eshteTekst(v.reagimi) ? v.reagimi : null,
    pyetja: v.pyetja,
    shprehja: eshteTekst(v.shprehja) && SHPREHJET.includes(v.shprehja) ? (v.shprehja as Shprehja) : "neutrale",
  };
}

export function lexoInfon(v: unknown): IntervistaInfo | null {
  if (!eshteObjekt(v)) return null;
  if (!eshteTekst(v.id) || !eshteGjuhe(v.gjuha) || !eshteRol(v.roli) || !eshteGjatesi(v.gjatesia)) return null;
  if (!eshteGjendje(v.gjendja) || !eshteNumer(v.nr_pyetjeve)) return null;
  const p = v.puna;
  const puna =
    eshteObjekt(p) && eshteTekst(p.id) && eshteTekst(p.titulli) && eshteTekst(p.kompania)
      ? { id: p.id, titulli: p.titulli, kompania: p.kompania }
      : null;
  const g = GJATESITE[v.gjatesia];
  return {
    id: v.id,
    gjuha: v.gjuha,
    roli: v.roli,
    gjatesia: v.gjatesia,
    gjendja: v.gjendja,
    nr_pyetjeve: v.nr_pyetjeve,
    min: eshteNumer(v.min) ? v.min : g.min,
    max: eshteNumer(v.max) ? v.max : g.max,
    puna,
    intervistuesi: eshteIntervistues(v.intervistuesi) ? v.intervistuesi : INTERVISTUESI_FILLESTAR,
  };
}

const eshteVleresim = (v: unknown): v is VleresimiIPergjigjes =>
  eshteObjekt(v) &&
  eshteTekst(v.cka_ishte_mire) &&
  eshteTekst(v.cka_te_permiresosh) &&
  eshteTekst(v.shembull_me_i_mire);

export function eshteRaport(v: unknown): v is Raporti {
  if (!eshteObjekt(v)) return false;
  const g = v.gatishmeria;
  const p = v.puna;
  return (
    eshteNumer(v.nota) &&
    eshteTekst(v.permbledhja) &&
    listeMe(v.tri_hapat_e_radhes, eshteTekst) &&
    listeMe(v.pergjigjet, (x) => eshteObjekt(x) && eshteNumer(x.nr) && eshteTekst(x.pyetja) && eshteVleresim(x)) &&
    eshteObjekt(g) &&
    (g.para === null || eshteNumer(g.para)) &&
    (g.pas === null || eshteNumer(g.pas)) &&
    listeMe(g.ke, (x) => eshteObjekt(x) && eshteTekst(x.aftesia) && eshteTekst(x.deshmia)) &&
    listeMe(g.mungon, (x) => eshteObjekt(x) && eshteTekst(x.aftesia) && eshteTekst(x.pse) && eshteTekst(x.si)) &&
    eshteTekst(g.arsyeja) &&
    eshteObjekt(p) &&
    eshteTekst(p.titulli) &&
    eshteTekst(p.kompania) &&
    eshteGjuhe(v.gjuha)
  );
}
