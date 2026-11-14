// Hook-u që e lidh makinën e gjendjeve (gjendja.ts) me serverin (klienti.ts).
// Thirrjet e rrjetit bëhen në veprime (dergo, perfundo, riprovo), jo në efekte: kështu një efekt që ekzekutohet
// dy herë (React Strict Mode) s'e dërgon dy herë përgjigjen. Përveç kësaj, një ref e bllokon prekjen e dyfishtë
// para se ekrani të rivizatohet, dhe serveri e refuzon gjithsesi (409 "po_perpunohet").
import { useCallback, useEffect, useReducer, useRef } from "react";

import { prekja } from "@/lib/prekja";

import { gjendjaFillestare, intervistaReducer, type Paraqitja, type Veprimi } from "./gjendja";
import {
  dergoPergjigjen,
  GabimIIntervistes,
  krijoRaportin,
  lexoIntervisten,
  perfundoIntervisten,
  type PasPergjigjes,
} from "./klienti";

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

  /** Për avatarin (09.12): faqja e njofton që pyetja u tha. Me tekst s'nevojitet. */
  const uPyet = useCallback(() => dispatch({ lloji: "u_pyet" }), []);

  const kaPergjigje = gjendja.faza !== "gati" && !!gjendja.seanca?.biseda.some((m) => m.kush === "ti");

  return { gjendja, dergo, perfundo, riprovo, uPyet, kaPergjigje };
}
