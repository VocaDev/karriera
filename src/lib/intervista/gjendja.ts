// Makina e gjendjeve të intervistës (plani teknik §4), si reducer i pastër me union të diskriminuar.
//
//   gati ──u_ngarkua──► pyet ──u_pyet──► pret_pergjigjen ──dergo──► vlereson ──kthesa_erdhi──► pyet …
//                                              │                        │
//                                              └──perfundo──┐           └──fund──► perfundon ──raporti_erdhi──► raporti
//                                                           └──────────────────────► perfundon
//   çdo hap ──gabim──► gabim ──riprovo──► hapi që dështoi (përgjigjja s'humbet: mbahet këtu dhe në DB)
//
// "pyet" = intervistuesja po e bën pyetjen. Me tekst kalohet menjëherë te "pret_pergjigjen"; me avatarin (09.12)
// mbetet "pyet" derisa faqja e avatarit të dërgojë "foli_mbaroi" (shih mesazhet.ts), pastaj thirret u_pyet.
import type { GabimIIntervistes } from "./klienti";
import type { IntervistaInfo, Kthesa, Raporti, RreshtiIBisedes } from "./tipet";

export type Paraqitja = "tekst" | "avatar";

export type Mesazhi =
  | { id: string; kush: "arta"; nr: number; lloji: "pyetje" | "vazhdim"; reagimi: string | null; pyetja: string }
  | { id: string; kush: "ti"; nr: number; teksti: string }
  | { id: string; kush: "mbyllja"; teksti: string | null };

export type Seanca = {
  info: IntervistaInfo;
  biseda: Mesazhi[];
  /** Pyetja që pret përgjigje (null pasi intervista mbaron). */
  kthesa: Kthesa | null;
  nrPyetjeve: number;
};

export type Veprimi = "ngarko" | "dergo" | "perfundo" | "raporti";

export type Gjendja =
  | { faza: "gati"; paraqitja: Paraqitja }
  | { faza: "pyet"; paraqitja: Paraqitja; seanca: Seanca }
  | { faza: "pret_pergjigjen"; paraqitja: Paraqitja; seanca: Seanca }
  | { faza: "vlereson"; paraqitja: Paraqitja; seanca: Seanca; pergjigja: string }
  | { faza: "perfundon"; paraqitja: Paraqitja; seanca: Seanca; mbyllVete: boolean }
  | { faza: "raporti"; paraqitja: Paraqitja; seanca: Seanca; raporti: Raporti }
  | {
      faza: "gabim";
      paraqitja: Paraqitja;
      seanca: Seanca | null;
      gabimi: GabimIIntervistes;
      veprimi: Veprimi;
      /** Përgjigjja që s'u dërgua: riprovimi e dërgon të njëjtën. */
      pergjigja: string | null;
    };

export type Ngjarja =
  | { lloji: "u_ngarkua"; info: IntervistaInfo; biseda: RreshtiIBisedes[] }
  | { lloji: "u_pyet" }
  | { lloji: "dergo"; pergjigja: string }
  | { lloji: "kthesa_erdhi"; kthesa: Kthesa; nrPyetjeve: number }
  | { lloji: "perfundo" }
  | { lloji: "fund"; reagimi: string | null; nrPyetjeve: number }
  | { lloji: "raporti_erdhi"; raporti: Raporti }
  | { lloji: "gabim"; gabimi: GabimIIntervistes; veprimi: Veprimi; pergjigja?: string | null }
  | { lloji: "riprovo" };

export function gjendjaFillestare(paraqitja: Paraqitja = "tekst"): Gjendja {
  return { faza: "gati", paraqitja };
}

const mesazhIArtes = (k: Pick<Kthesa, "nr" | "lloji" | "reagimi" | "pyetja">): Mesazhi => ({
  id: `a${k.nr}`,
  kush: "arta",
  nr: k.nr,
  lloji: k.lloji,
  reagimi: k.reagimi,
  pyetja: k.pyetja,
});

/** Biseda nga DB → mesazhet e ekranit; pyetja pa përgjigje bëhet pyetja aktuale. */
export function seancaNgaDB(info: IntervistaInfo, rreshtat: RreshtiIBisedes[]): Seanca {
  const biseda: Mesazhi[] = [];
  let kthesa: Kthesa | null = null;
  for (const r of rreshtat) {
    biseda.push(mesazhIArtes(r));
    if (r.pergjigja !== null) biseda.push({ id: `t${r.nr}`, kush: "ti", nr: r.nr, teksti: r.pergjigja });
  }
  const eFundit = rreshtat[rreshtat.length - 1];
  if (info.gjendja === "aktive" && eFundit && eFundit.pergjigja === null) {
    kthesa = { ...eFundit, shprehja: "neutrale" };
  }
  return { info, biseda, kthesa, nrPyetjeve: info.nr_pyetjeve };
}

/** Faza pasi vjen një pyetje: me tekst, radha e kandidatit fillon menjëherë. */
const pasPyetjes = (paraqitja: Paraqitja) => (paraqitja === "tekst" ? "pret_pergjigjen" : "pyet");

export function intervistaReducer(g: Gjendja, n: Ngjarja): Gjendja {
  const { paraqitja } = g;
  switch (n.lloji) {
    case "u_ngarkua": {
      const seanca = seancaNgaDB(n.info, n.biseda);
      if (n.info.gjendja !== "aktive") return { faza: "perfundon", paraqitja, seanca, mbyllVete: false };
      if (!seanca.kthesa) {
        // Përgjigjja e fundit u ruajt, por pyetja tjetër s'erdhi (p.sh. funksioni u ndal): dërgoje sërish.
        const eFundit = n.biseda[n.biseda.length - 1];
        return { faza: "pret_pergjigjen", paraqitja, seanca: { ...seanca, kthesa: eFundit ? { ...eFundit, shprehja: "neutrale" } : null } };
      }
      return { faza: pasPyetjes(paraqitja), paraqitja, seanca };
    }
    case "u_pyet":
      return g.faza === "pyet" ? { faza: "pret_pergjigjen", paraqitja, seanca: g.seanca } : g;
    case "dergo": {
      if (g.faza !== "pret_pergjigjen" || !g.seanca.kthesa) return g;
      const nr = g.seanca.kthesa.nr;
      const biseda = [...g.seanca.biseda.filter((m) => m.id !== `t${nr}`), { id: `t${nr}`, kush: "ti", nr, teksti: n.pergjigja } as const];
      return { faza: "vlereson", paraqitja, seanca: { ...g.seanca, biseda }, pergjigja: n.pergjigja };
    }
    case "kthesa_erdhi": {
      if (g.faza !== "vlereson") return g;
      const seanca: Seanca = {
        ...g.seanca,
        biseda: [...g.seanca.biseda.filter((m) => m.id !== `a${n.kthesa.nr}`), mesazhIArtes(n.kthesa)],
        kthesa: n.kthesa,
        nrPyetjeve: n.nrPyetjeve,
      };
      return { faza: pasPyetjes(paraqitja), paraqitja, seanca };
    }
    case "perfundo":
      return g.faza === "pret_pergjigjen" ? { faza: "perfundon", paraqitja, seanca: g.seanca, mbyllVete: true } : g;
    case "fund": {
      if (g.faza !== "vlereson" && g.faza !== "perfundon") return g;
      const seanca: Seanca = {
        ...g.seanca,
        biseda: [...g.seanca.biseda.filter((m) => m.kush !== "mbyllja"), { id: "mbyllja", kush: "mbyllja", teksti: n.reagimi }],
        kthesa: null,
        nrPyetjeve: n.nrPyetjeve,
      };
      return { faza: "perfundon", paraqitja, seanca, mbyllVete: false };
    }
    case "raporti_erdhi":
      return g.faza === "perfundon" ? { faza: "raporti", paraqitja, seanca: g.seanca, raporti: n.raporti } : g;
    case "gabim": {
      const seanca = g.faza === "gati" ? null : g.seanca;
      const pergjigja = n.pergjigja ?? (g.faza === "vlereson" ? g.pergjigja : g.faza === "gabim" ? g.pergjigja : null);
      return { faza: "gabim", paraqitja, seanca, gabimi: n.gabimi, veprimi: n.veprimi, pergjigja };
    }
    case "riprovo": {
      if (g.faza !== "gabim") return g;
      if (g.veprimi === "ngarko" || !g.seanca) return { faza: "gati", paraqitja };
      if (g.veprimi === "dergo" && g.pergjigja !== null) {
        return { faza: "vlereson", paraqitja, seanca: g.seanca, pergjigja: g.pergjigja };
      }
      if (g.veprimi === "dergo") return { faza: "pret_pergjigjen", paraqitja, seanca: g.seanca };
      return { faza: "perfundon", paraqitja, seanca: g.seanca, mbyllVete: g.veprimi === "perfundo" };
    }
  }
}

/** Kush e ka radhën: për shiritin e statusit dhe për VoiceOver. */
export function kushEkaRadhen(g: Gjendja): "arta" | "ti" | "askush" {
  if (g.faza === "pyet" || g.faza === "vlereson" || g.faza === "perfundon") return "arta";
  if (g.faza === "pret_pergjigjen") return "ti";
  return "askush";
}
