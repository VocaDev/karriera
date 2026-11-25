// Hook-u që e lidh makinën e gjendjeve (gjendja.ts) me serverin (klienti.ts).
// Thirrjet e rrjetit bëhen në veprime (dergo, perfundo, riprovo), jo në efekte: kështu një efekt që ekzekutohet
// dy herë (React Strict Mode) s'e dërgon dy herë përgjigjen. Përveç kësaj, një ref e bllokon prekjen e dyfishtë
// para se ekrani të rivizatohet, dhe serveri e refuzon gjithsesi (409 "po_perpunohet").
import { useCallback, useEffect, useReducer, useRef } from "react";

import { prekja } from "@/lib/prekja";

import { gjendjaFillestare, intervistaReducer, type Paraqitja, type Veprimi } from "./gjendja";
import {
  dergoPergjigjen,
  dergoZerinMeRrjedhe,
  GabimIIntervistes,
  krijoRaportin,
  lexoIntervisten,
  perfundoIntervisten,
  type KuotaEZerit,
  type PasPergjigjes,
} from "./klienti";
import type { Shprehja } from "./tipet";

/** Si përfundoi një përgjigje me zë (ekrani vendos çka i thotë kandidatit). */
export type RezultatiIZerit =
  | { lloji: "u_degjua"; gabimiZerit: string | null }
  | { lloji: "s_degjova" }
  /** Zëri dështoi para kthesës: pyetja mbetet e njëjta; ekrani tregon mesazhin (dhe për disa kode kalon te Shkruaj). */
  | { lloji: "gabim_zeri"; gabimi: GabimIIntervistes }
  /** Gabim tjetër: makina e gjendjeve e tregon me kartën e gabimit, si me shkrim. */
  | { lloji: "gabim" }
  | { lloji: "zene" };

/** Çelësi i zërit: "a<nr>" për një pyetje, "mbyllja" për fundin. */
export type CelesiIZerit = `a${number}` | "mbyllja";

/** Ku shkon zëri që vjen në rrjedhë me përgjigjen: paneli i zërit e kalon te avatari. */
export type ZeriRrjedhe = {
  /** Teksti i pyetjes së re (ose fundi) erdhi: zëri i saj do të vijë menjëherë pas kësaj. */
  fillon: (celesi: CelesiIZerit, shprehja: Shprehja) => void;
  pcm: (b: string, shkalla: number) => void;
  /** Cili ofrues po e flet pyetjen e re. */
  ofruesi: (emri: string) => void;
  /** Zëri dështoi ose u ndërpre (thirret para "mbaroi"): paneli luan audion pa rrjedhë, përveç kur është kufiri. */
  deshtoi: (kuota: KuotaEZerit | undefined) => void;
  /** Rrjedha mbaroi (me sukses ose pas një ndërprerjeje): s'vjen më zë. */
  mbaroi: () => void;
};

const KODET_E_ZERIT = new Set(["zeri", "zeri_pa_konfigurim", "kufiri_zerit", "kuota"]);

function siGabim(e: unknown): GabimIIntervistes {
  return e instanceof GabimIIntervistes ? e : new GabimIIntervistes("Diçka shkoi keq. Provo përsëri.", "tjeter");
}

export function useIntervista(intervistaId: string, paraqitja: Paraqitja = "tekst") {
  const [gjendja, dispatch] = useReducer(intervistaReducer, paraqitja, gjendjaFillestare);
  const zene = useRef(false); // një thirrje rrjeti njëherësh
  const aktiv = useRef(true);

  useEffect(() => {
    aktiv.current = true;
    return () => {
      aktiv.current = false;
    };
  }, []);

  const ngarko = useCallback(async () => {
    try {
      const lexuar = await lexoIntervisten(intervistaId);
      if (!aktiv.current) return;
      if (!lexuar) {
        dispatch({
          lloji: "gabim",
          gabimi: new GabimIIntervistes("Kjo intervistë nuk u gjet.", "tjeter", 404),
          veprimi: "ngarko",
        });
        return;
      }
      dispatch({ lloji: "u_ngarkua", info: lexuar.info, biseda: lexuar.biseda });
      if (lexuar.raporti) dispatch({ lloji: "raporti_erdhi", raporti: lexuar.raporti });
    } catch (e) {
      if (aktiv.current) dispatch({ lloji: "gabim", gabimi: siGabim(e), veprimi: "ngarko" });
    }
  }, [intervistaId]);

  // Leximi i parë dhe çdo rilexim (pas "riprovo" te gabimi i leximit): vetëm lexim, i sigurt edhe dy herë.
  useEffect(() => {
    if (gjendja.faza === "gati") ngarko();
  }, [gjendja.faza, ngarko]);

  const kerkoRaportin = useCallback(async () => {
    try {
      const r = await krijoRaportin(intervistaId);
      if (!aktiv.current) return;
      prekja.sukses();
      dispatch({ lloji: "raporti_erdhi", raporti: r });
    } catch (e) {
      if (!aktiv.current) return;
      prekja.gabim();
      dispatch({ lloji: "gabim", gabimi: siGabim(e), veprimi: "raporti" });
    }
  }, [intervistaId]);

  const raporti = useCallback(
    async (mbyllVete: boolean, nr: number | null) => {
      if (mbyllVete && nr !== null) {
        try {
          const pas = await perfundoIntervisten(intervistaId, nr);
          if (!aktiv.current) return;
          if (pas.fund) dispatch({ lloji: "fund", reagimi: null, nrPyetjeve: pas.nr_pyetjeve });
        } catch (e) {
          if (!aktiv.current) return;
          const g = siGabim(e);
          // "mbaroi" = intervista u mbyll tashmë (p.sh. nga një pajisje tjetër): vazhdo direkt me raportin.
          if (g.kodi !== "mbaroi") {
            prekja.gabim();
            dispatch({ lloji: "gabim", gabimi: g, veprimi: "perfundo" });
            return;
          }
        }
      }
      await kerkoRaportin();
    },
    [intervistaId, kerkoRaportin],
  );

  // Kur intervista mbaron (nga serveri ose pas leximit të një interviste të mbaruar), raporti kërkohet një herë.
  // Serveri e kthen raportin e ruajtur pa AI nëse ekziston, kështu që një thirrje e dytë s'kushton.
  const raportiUKerkua = useRef(false);
  useEffect(() => {
    if (gjendja.faza !== "perfundon" || gjendja.mbyllVete || raportiUKerkua.current) return;
    raportiUKerkua.current = true;
    kerkoRaportin();
  }, [gjendja, kerkoRaportin]);

  const pasPergjigjes = useCallback((pas: PasPergjigjes) => {
    if (pas.fund) dispatch({ lloji: "fund", reagimi: pas.reagimi, nrPyetjeve: pas.nr_pyetjeve });
    else dispatch({ lloji: "kthesa_erdhi", kthesa: pas.kthesa, nrPyetjeve: pas.nr_pyetjeve });
  }, []);

  const dergoTani = useCallback(
    async (nr: number, pergjigja: string) => {
      zene.current = true;
      try {
        const pas = await dergoPergjigjen(intervistaId, nr, pergjigja);
        if (aktiv.current) pasPergjigjes(pas);
      } catch (e) {
        if (!aktiv.current) return;
        const g = siGabim(e);
        if (g.kodi === "jashte_radhe") {
          // Përgjigjja u përpunua (p.sh. rrjeti ra pas dërgimit): rilexo gjendjen e vërtetë nga serveri.
          await ngarko();
        } else if (g.kodi === "mbaroi") {
          await ngarko();
        } else {
          prekja.gabim();
          // "po_perpunohet": riprovimi rilexon gjendjen në vend që ta dërgojë sërish.
          const veprimi: Veprimi = g.kodi === "po_perpunohet" ? "ngarko" : "dergo";
          dispatch({ lloji: "gabim", gabimi: g, veprimi, pergjigja });
        }
      } finally {
        zene.current = false;
      }
    },
    [intervistaId, ngarko, pasPergjigjes],
  );

  /** Dërgon përgjigjen e pyetjes aktuale. Kthen false nëse s'është radha e kandidatit. */
  const dergo = useCallback(
    (teksti: string): boolean => {
      const pergjigja = teksti.trim();
      if (zene.current || gjendja.faza !== "pret_pergjigjen" || !gjendja.seanca.kthesa || !pergjigja) return false;
      const nr = gjendja.seanca.kthesa.nr;
      zene.current = true;
      dispatch({ lloji: "dergo", pergjigja });
      dergoTani(nr, pergjigja);
      return true;
    },
    [dergoTani, gjendja],
  );

  /** Kandidati e mbyll vetë intervistën dhe kërkon rezultatet (duhet të paktën një përgjigje). */
  const perfundo = useCallback(() => {
    if (zene.current || gjendja.faza !== "pret_pergjigjen") return;
    const nr = gjendja.seanca.kthesa?.nr ?? null;
    raportiUKerkua.current = true;
    dispatch({ lloji: "perfundo" });
    raporti(true, nr);
  }, [gjendja, raporti]);

  const riprovo = useCallback(() => {
    const g = gjendja;
    if (g.faza !== "gabim" || zene.current) return;
    dispatch({ lloji: "riprovo" });
    if (!g.seanca || g.veprimi === "ngarko") return; // efekti i "gati" e rilexon
    if (g.veprimi === "dergo" && g.pergjigja !== null && g.seanca.kthesa) {
      dergoTani(g.seanca.kthesa.nr, g.pergjigja);
    } else if (g.veprimi === "perfundo") {
      raporti(true, g.seanca.kthesa?.nr ?? null);
    } else if (g.veprimi === "raporti") {
      kerkoRaportin();
    }
  }, [dergoTani, gjendja, kerkoRaportin, raporti]);

  /**
   * Përgjigjja me zë: `uri` është WAV-i i regjistruar. Serveri e kthen në tekst dhe e përpunon si përgjigje e shkruar,
   * dhe përgjigjet me rrjedhë: transkripti vjen i pari (del menjëherë në bisedë), pastaj teksti i pyetjes së re, pastaj zëri.
   */
  const dergoZerin = useCallback(
    async (uri: string, zeri: ZeriRrjedhe): Promise<RezultatiIZerit> => {
      if (zene.current || gjendja.faza !== "pret_pergjigjen" || !gjendja.seanca.kthesa) return { lloji: "zene" };
      const nr = gjendja.seanca.kthesa.nr;
      zene.current = true;
      dispatch({ lloji: "dergo_zerin" });
      let zeriFilloi = false;
      // Reagimi flitet para se të vijë teksti i kthesës: copat e para presin këtu derisa zëri të "fillojë" (onKthesa).
      const copatNePritje: [string, number][] = [];
      let gabimiZerit: string | null = null;
      let kuotaEZerit: KuotaEZerit | undefined;
      try {
        const r = await dergoZerinMeRrjedhe(intervistaId, nr, uri, {
          onDegjuar: (teksti) => {
            if (aktiv.current) dispatch({ lloji: "degjova", teksti });
          },
          onKthesa: (pas) => {
            if (!aktiv.current) return;
            // Zëri shënohet para dispatch-it: efekti i panelit e di që kjo pyetje po vjen me rrjedhë dhe s'e kërkon vetë.
            zeriFilloi = true;
            zeri.fillon(pas.fund ? "mbyllja" : `a${pas.kthesa.nr}`, pas.fund ? "buzeqeshje" : pas.kthesa.shprehja);
            for (const [b, shkalla] of copatNePritje.splice(0)) zeri.pcm(b, shkalla);
            pasPergjigjes(pas);
          },
          onPcm: (b, shkalla) => {
            if (!aktiv.current) return;
            if (zeriFilloi) zeri.pcm(b, shkalla);
            else copatNePritje.push([b, shkalla]);
          },
          onOfruesi: (emri) => {
            if (aktiv.current) zeri.ofruesi(emri);
          },
          onGabimZerit: (mesazhi, kuota) => {
            gabimiZerit = mesazhi;
            kuotaEZerit = kuota;
          },
        });
        if (!aktiv.current) return { lloji: "zene" };
        if (!r.degjuar) {
          dispatch({ lloji: "s_degjova" });
          return { lloji: "s_degjova" };
        }
        if (gabimiZerit) zeri.deshtoi(kuotaEZerit);
        zeri.mbaroi();
        return { lloji: "u_degjua", gabimiZerit };
      } catch (e) {
        if (!aktiv.current) return { lloji: "zene" };
        if (zeriFilloi) {
          zeri.deshtoi(undefined);
          zeri.mbaroi();
        }
        const g = siGabim(e);
        if (g.kodi === "jashte_radhe" || g.kodi === "mbaroi") {
          await ngarko();
          return { lloji: "gabim" };
        }
        if (g.transkripti) {
          // U dëgjua, por kthesa dështoi: transkripti mbetet si përgjigje dhe "Provo përsëri" e dërgon si tekst.
          prekja.gabim();
          dispatch({ lloji: "degjova", teksti: g.transkripti });
          dispatch({ lloji: "gabim", gabimi: g, veprimi: g.kodi === "po_perpunohet" ? "ngarko" : "dergo", pergjigja: g.transkripti });
          return { lloji: "gabim" };
        }
        prekja.gabim();
        if (KODET_E_ZERIT.has(g.kodi)) {
          dispatch({ lloji: "s_degjova" });
          return { lloji: "gabim_zeri", gabimi: g };
        }
        dispatch({ lloji: "gabim", gabimi: g, veprimi: g.kodi === "po_perpunohet" ? "ngarko" : "dergo", pergjigja: null });
        return { lloji: "gabim" };
      } finally {
        zene.current = false;
      }
    },
    [gjendja, intervistaId, ngarko, pasPergjigjes],
  );

  /** Shkruaj ↔ Fol, në çdo çast. */
  const ndryshoParaqitjen = useCallback((p: Paraqitja) => dispatch({ lloji: "paraqitja", paraqitja: p }), []);

  /** Faqja e avatarit e njofton që pyetja u tha (ose zëri dështoi): radha e kandidatit. */
  const uPyet = useCallback(() => dispatch({ lloji: "u_pyet" }), []);

  const kaPergjigje = gjendja.faza !== "gati" && !!gjendja.seanca?.biseda.some((m) => m.kush === "ti");

  return { gjendja, dergo, dergoZerin, ndryshoParaqitjen, perfundo, riprovo, uPyet, kaPergjigje };
}
