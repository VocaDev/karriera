// Kamera në Fol: një buton "Kamera" ndez ose fik pamjen e kandidatit (opsionale; intervista punon pa të).
//
//   ndez → leja (fleta shpjegon pse, pastaj dritarja e sistemit; refuzimi → ekrani "Kamera është e fikur")
//        → faqja e avatarit hap kamerën (getUserMedia) dhe MediaPipe: pamja + matja e kontaktit me sy
//        → nëse getUserMedia s'funksionon në këtë WebView: kamera native (expo-camera), vetëm pasqyrë, PA analizë
//   numrat e matjes ruhen në telefon (kamera.ts) dhe dalin te Rezultatet vetëm kur janë të mjaftueshëm.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Linking } from "react-native";

import type { AvatariRef } from "./Avatari";
import { kerkoLejenKameres, lexoLejenKameres, ruajStatistiken } from "./kamera";
import type { FazaELejes } from "./LejaModal";
import type { MesazhNgaFaqja } from "./mesazhet";

/** Pas kësaj kohe pa asnjë përgjigje nga faqja (getUserMedia varet), kalojmë te kamera native. */
const PRITJA_E_FAQES_MS = 15_000;

export type MenyraEKameres = "faqja" | "native";

type NjoftoFn = (teksti: string, lloji?: "sukses" | "info" | "gabim") => void;

export function useKamera(opts: {
  avatari: RefObject<AvatariRef | null>;
  intervistaId: string;
  faqjaGati: boolean;
  njofto: NjoftoFn;
}) {
  const { avatari, intervistaId, faqjaGati, njofto } = opts;
  const [aktive, setAktive] = useState(false);
  const [menyra, setMenyra] = useState<MenyraEKameres | null>(null);
  /** true kur MediaPipe punon: vetëm atëherë ka matje. */
  const [analiza, setAnaliza] = useState(false);
  const [leja, setLeja] = useState<FazaELejes | null>(null);
  const pergjigjaEFaqes = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fik = useCallback(() => {
    setAktive(false);
    setMenyra(null);
    setAnaliza(false);
    avatari.current?.kamera(false);
  }, [avatari]);

  const ndiz = useCallback(() => {
    pergjigjaEFaqes.current = false;
    setAnaliza(false);
    setMenyra("faqja");
    setAktive(true);
  }, []);

  // Faqja e hap kamerën vetëm pasi është gati dhe leja u dha.
  useEffect(() => {
    if (aktive && menyra === "faqja" && faqjaGati) avatari.current?.kamera(true);
  }, [aktive, avatari, faqjaGati, menyra]);

  // Rezerva: faqja s'u përgjigj fare.
  useEffect(() => {
    if (!aktive || menyra !== "faqja" || !faqjaGati) return;
    const ora = setTimeout(() => {
      if (pergjigjaEFaqes.current || !mounted.current) return;
      avatari.current?.kamera(false);
      setMenyra("native");
      njofto("Kamera po të tregon veten. Matja e kontaktit me sy s'është e disponueshme në këtë pajisje.", "info");
    }, PRITJA_E_FAQES_MS);
    return () => clearTimeout(ora);
  }, [aktive, avatari, faqjaGati, menyra, njofto]);

  /** Prekja e butonit "Kamera". */
  const ndrysho = useCallback(async () => {
    if (aktive) {
      fik();
      return;
    }
    const l = await lexoLejenKameres().catch(() => "bllokuar" as const);
    if (!mounted.current) return;
    if (l === "lejuar") ndiz();
    else setLeja(l === "bllokuar" ? "refuzuar" : "shpjegim");
  }, [aktive, fik, ndiz]);

  const lejaVazhdo = useCallback(async () => {
    let ok = false;
    try {
      ok = await kerkoLejenKameres();
    } catch {
      ok = false;
    }
    if (!mounted.current) return;
    setLeja(ok ? null : "refuzuar");
    if (ok) ndiz();
  }, [ndiz]);
  const lejaJo = useCallback(() => setLeja("refuzuar"), []);
  const lejaHapCilesimet = useCallback(() => {
    setLeja(null);
    Linking.openSettings().catch(() => {});
  }, []);
  /** "Vazhdo vetëm me zë": kamera mbetet e fikur, intervista vazhdon pa të. */
  const lejaVazhdoPaKamere = useCallback(() => setLeja(null), []);

  /** Mesazhet e kamerës nga faqja e avatarit. */
  const onKamera = useCallback(
    (m: Extract<MesazhNgaFaqja, { lloji: "kamera_gati" | "kamera_gabim" | "kamera_statistika" }>) => {
      if (m.lloji === "kamera_gati") {
        pergjigjaEFaqes.current = true;
        setAnaliza(m.analiza);
      } else if (m.lloji === "kamera_gabim") {
        pergjigjaEFaqes.current = true;
        // getUserMedia s'funksionon në këtë WebView: kamera native, vetëm pasqyrë.
        avatari.current?.kamera(false);
        setMenyra("native");
        setAnaliza(false);
        njofto("Kamera po të tregon veten. Matja e kontaktit me sy s'është e disponueshme në këtë pajisje.", "info");
      } else {
        void ruajStatistiken(intervistaId, { kornizat: m.kornizat, fytyra: m.fytyra, sy: m.sy });
      }
    },
    [avatari, intervistaId, njofto],
  );

  return { aktive, menyra, analiza, leja, ndrysho, lejaVazhdo, lejaJo, lejaHapCilesimet, lejaVazhdoPaKamere, onKamera };
}
