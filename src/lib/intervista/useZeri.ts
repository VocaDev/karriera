// Fol: lidh makinën e gjendjeve (useIntervista), avatarin (WebView) dhe mikrofonin (useRegjistruesi).
// Përdoret vetëm nga PaneliIZerit, që vizatohet vetëm në Fol: kur kandidati kalon te Shkruaj, paneli hiqet dhe
// avatari, mikrofoni dhe gjendja e zërit mbyllen bashkë me të.
//
//   faza "pyet"           → "Arta po mendon…" ndërsa vjen zëri; reagimi dhe pyetja kërkohen PARALELISHT,
//                           reagimi (i shkurtër) nis sapo vjen dhe pyetja radhitet pas tij ("Po flet Arta")
//   faqja mbaron të dyja  → uPyet() → "pret_pergjigjen": radha e kandidatit
//   prek mikrofonin       → "Po të dëgjoj" (AudioStream → WAV)
//   prek përsëri / 90 s   → një pranim i shkurtër ("Mirë, e kuptoj.") luhet menjëherë, pastaj "Arta po mendon…":
//                           dergoZerin() → transkripti + teksti i pyetjes tjetër në ekran → zëri i saj si më lart
//   "Ndalo"               → avatari hesht, radha jote; "Përsërit pyetjen" → e njëjta audio, pa thirrje të re
//
// Çdo dështim i zërit e lë intervistën të paprekur: pyetja është në ekran si tekst dhe kandidati mund të provojë sërish
// ose të kalojë te Shkruaj. Leja e mikrofonit kërkohet vetëm kur fillon Fol, pasi shpjegohet pse.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Alert, Linking } from "react-native";

import { paInternet, tekstiIPlote, VONON } from "@/lib/mesazhet";
import { prekja } from "@/lib/prekja";

import type { AvatariRef } from "./Avatari";
import type { Gjendja } from "./gjendja";
import { GabimIIntervistes, zeriIPyetjes } from "./klienti";
import type { FjaliaMeZe } from "./mesazhet";
import { PAMJA_E_INTERVISTUESIT, type Intervistuesi, type Shprehja } from "./tipet";
import type { CelesiIZerit, RezultatiIZerit } from "./useIntervista";
import { fshiRegjistrimin, kerkoLejen, lexoLejen, useRegjistruesi } from "./useRegjistruesi";

const PRITJA_E_AVATARIT_MS = 25_000;
/** Pranimi luhet vetëm pas një përgjigjeje të vërtetë, jo pas një prekjeje të shkurtër. */
const MBUSHESI_PAS_SEKONDAVE = 1.5;
const ID_E_MBUSHESIT = "mbushesi";

const PA_INTERNET_ZERI = paInternet("pyetja mbetet në ekran dhe përgjigjja me zë s'mund të niset tani", false);

type Njofto = (teksti: string, lloji?: "sukses" | "info" | "gabim") => void;

/** Çka po thotë avatari: një kthesë (reagimi + pyetja si dy pjesë) ose mbyllja. */
type Thenia = { celesi: CelesiIZerit; pjeset: number; mbaruan: number; ndalur: boolean };

/** Kohëzgjatja e përafërt nga madhësia e base64 (WAV 24 kHz 16 bit ≈ 64 KB/s base64; MP3 48 kbps ≈ 8 KB/s). */
const sekondaTe = (f: FjaliaMeZe[]) =>
  f.reduce((s, x) => s + x.audio_base64.length / (x.mime.includes("wav") ? 64_000 : 8_000), 0);

export function useZeri(opts: {
  avatari: RefObject<AvatariRef | null>;
  intervistaId: string;
  gjendja: Gjendja;
  intervistuesi: Intervistuesi;
  kaInternet: boolean;
  dergoZerin: (uri: string) => Promise<RezultatiIZerit>;
  merrZerin: (celesi: CelesiIZerit) => FjaliaMeZe[] | null;
  uPyet: () => void;
  /** Kalon te Shkruaj pa e humbur intervistën; mesazhi (nëse ka) i thotë pse. */
  kaloTeShkruaj: (mesazhi: string | null) => void;
  njofto: Njofto;
  /** Raporti erdhi dhe intervistuesi mbaroi së foluri: ekrani hap rezultatet. */
  onRaportiGati: () => void;
}) {
  const {
    avatari,
    intervistaId,
    gjendja,
    intervistuesi,
    kaInternet,
    dergoZerin,
    merrZerin,
    uPyet,
    kaloTeShkruaj,
    njofto,
    onRaportiGati,
  } = opts;
  const pamja = PAMJA_E_INTERVISTUESIT[intervistuesi];

  const [faqjaGati, setFaqjaGati] = useState(false);
  const [flet, setFlet] = useState(false);
  const [mbaroiHerë, setMbaroiHerë] = useState(0); // rritet sa herë avatari mbaron (për efektin e rezultateve)
  const [duhetPrekje, setDuhetPrekje] = useState(false);
  const [dergon, setDergon] = useState(false);
  const thenia = useRef<Thenia | null>(null); // çka po thotë avatari tani
  const thenePer = useRef<CelesiIZerit | null>(null); // çka është kërkuar ose thënë (kundër dyfishimit)
  const pyetjaMeZe = useRef<{ nr: number; fjalite: FjaliaMeZe[] } | null>(null); // për "Përsërit pyetjen"
  const mbushesi = useRef<FjaliaMeZe[] | null>(null);
  const mbushesiUKerkua = useRef(false);
  const sigurimi = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (sigurimi.current) clearTimeout(sigurimi.current);
    };
  }, []);

  // ---------- Mikrofoni ----------
  const dergoTaniRef = useRef<() => void>(() => {});
  const regjistruesi = useRegjistruesi(() => dergoTaniRef.current());

  // ---------- Avatari flet ----------
  /** Thënia mbaroi (të gjitha pjesët u thanë, dështuan ose u ndalën): radha e kandidatit. */
  const mbaroiThenia = useCallback(
    (celesi: CelesiIZerit) => {
      if (thenia.current?.celesi !== celesi) return;
      thenia.current = null;
      if (sigurimi.current) clearTimeout(sigurimi.current);
      sigurimi.current = null;
      setFlet(false);
      setDuhetPrekje(false);
      setMbaroiHerë((n) => n + 1);
      if (celesi !== "mbyllja") uPyet(); // vepron vetëm nëse faza është ende "pyet"
    },
    [uPyet],
  );

  /** Një pjesë mbaroi (u tha, doli bosh ose dështoi). */
  const pjesaMbaroi = useCallback(
    (celesi: CelesiIZerit) => {
      const th = thenia.current;
      if (!th || th.celesi !== celesi) return;
      th.mbaruan += 1;
      if (th.mbaruan >= th.pjeset) mbaroiThenia(celesi);
    },
    [mbaroiThenia],
  );

  /** Siguria: nëse faqja s'thotë kurrë "foli_mbaroi", radha s'ngec. */
  const vendosSigurine = useCallback(
    (celesi: CelesiIZerit, sekonda: number) => {
      if (sigurimi.current) clearTimeout(sigurimi.current);
      sigurimi.current = setTimeout(() => mbaroiThenia(celesi), (sekonda + 20) * 1000);
    },
    [mbaroiThenia],
  );

  /** I dërgon faqes një pjesë; `shto` = radhitet pas asaj që po thuhet. */
  const dergoPjesen = useCallback(
    (celesi: CelesiIZerit, i: number, fjalite: FjaliaMeZe[], shprehja: Shprehja, pershendetje: boolean, shto: boolean) => {
      const th = thenia.current;
      if (!th || th.celesi !== celesi || th.ndalur) return;
      if (fjalite.length === 0) {
        pjesaMbaroi(celesi);
        return;
      }
      avatari.current?.fol(`${celesi}:${i}`, fjalite, shprehja, pershendetje, shto);
      vendosSigurine(celesi, sekondaTe(fjalite));
    },
    [avatari, pjesaMbaroi, vendosSigurine],
  );

  // Pyetja (ose mbyllja) thuhet sapo faqja është gati. Ref-i "thenePer" e mban një herë edhe në Strict Mode.
  useEffect(() => {
    if (!faqjaGati) return;
    if (gjendja.faza === "pyet" && gjendja.seanca.kthesa) {
      const k = gjendja.seanca.kthesa;
      const celesi: CelesiIZerit = `a${k.nr}`;
      if (thenePer.current === celesi) return;
      thenePer.current = celesi;
      const pershendetje = !gjendja.seanca.biseda.some((m) => m.kush === "ti");
      const gati = merrZerin(celesi);
      if (gati) {
        thenia.current = { celesi, pjeset: 1, mbaruan: 0, ndalur: false };
        pyetjaMeZe.current = { nr: k.nr, fjalite: gati };
        dergoPjesen(celesi, 0, gati, k.shprehja, pershendetje, false);
        return;
      }
      // Dy pjesë paralelisht: reagimi i shkurtër nis i pari; pyetja radhitet pas tij. Gjatë pritjes (~4–5 s te
      // Gemini) avatari "mendon" dhe teksti i pyetjes është tashmë në ekran: asgjë s'duket e ngrirë.
      thenia.current = { celesi, pjeset: 2, mbaruan: 0, ndalur: false };
      avatari.current?.mendon();
      const reagimi = k.reagimi ? zeriIPyetjes(intervistaId, k.nr, "reagimi") : Promise.resolve<FjaliaMeZe[]>([]);
      const pyetja = zeriIPyetjes(intervistaId, k.nr, "pyetja");
      pyetja.catch(() => {}); // trajtohet më poshtë, pas reagimit; kjo vetëm e shënon si të trajtuar
      let deshtuan = 0;
      const deshtoi = (e: unknown) => {
        deshtuan += 1;
        if (!mounted.current) return;
        pjesaMbaroi(celesi);
        if (deshtuan === 1) {
          const g = e instanceof GabimIIntervistes ? e : null;
          if (g && (g.kodi === "zeri_pa_konfigurim" || g.kodi === "kufiri_zerit")) kaloTeShkruaj(g.message);
          else if (g?.kodi === "rrjeti") njofto(tekstiIPlote(PA_INTERNET_ZERI), "info");
          else if (g?.kodi === "vonese") njofto(`${VONON.titulli}. Pyetja është në ekran: përgjigju me zë ose me shkrim.`, "info");
          else njofto(`Zëri i ${pamja.gjenitivi} s'erdhi. Lexoje pyetjen dhe përgjigju me zë.`, "info");
        }
      };
      reagimi
        .then(
          (f) => {
            if (mounted.current) dergoPjesen(celesi, 0, f, k.shprehja, pershendetje, false);
          },
          deshtoi,
        )
        .then(() => pyetja)
        .then(
          (f) => {
            if (!mounted.current) return;
            pyetjaMeZe.current = { nr: k.nr, fjalite: f };
            dergoPjesen(celesi, 1, f, k.shprehja, false, true);
          },
          deshtoi,
        );
      return;
    }
    if ((gjendja.faza === "perfundon" || gjendja.faza === "raporti") && thenePer.current !== "mbyllja") {
      thenePer.current = "mbyllja";
      const mbyllja = merrZerin("mbyllja");
      if (mbyllja) {
        thenia.current = { celesi: "mbyllja", pjeset: 1, mbaruan: 0, ndalur: false };
        dergoPjesen("mbyllja", 0, mbyllja, "buzeqeshje", false, false);
      }
    }
  }, [avatari, dergoPjesen, faqjaGati, gjendja, intervistaId, kaloTeShkruaj, merrZerin, njofto, pamja.gjenitivi, pjesaMbaroi]);

  // Pranimi i shkurtër merret një herë për intervistë, sapo dihet pyetja aktuale (një thirrje e vetme).
  const nrAktual = gjendja.faza === "pyet" || gjendja.faza === "pret_pergjigjen" ? (gjendja.seanca.kthesa?.nr ?? null) : null;
  useEffect(() => {
    if (!faqjaGati || nrAktual === null || mbushesiUKerkua.current) return;
    mbushesiUKerkua.current = true;
    zeriIPyetjes(intervistaId, nrAktual, "mbushesi")
      .then((f) => {
        if (f.length) mbushesi.current = f;
      })
      .catch(() => {
        // Pa pranim: kandidati sheh vetëm "po mendon"; asgjë s'prishet.
      });
  }, [faqjaGati, intervistaId, nrAktual]);

  // Rezultatet hapen kur raporti erdhi dhe intervistuesi s'po flet më (mbyllja dëgjohet deri në fund).
  useEffect(() => {
    if (gjendja.faza === "raporti" && !flet && thenia.current === null) onRaportiGati();
  }, [flet, gjendja.faza, mbaroiHerë, onRaportiGati]);

  // Avatari s'u hap brenda kohës (internet i dobët për CDN-në): vazhdo me shkrim.
  useEffect(() => {
    if (faqjaGati) return;
    const ora = setTimeout(
      () => kaloTeShkruaj(`${pamja.emri} s'u hap. Vazhdo me shkrim; mund ta provosh sërish me Fol.`),
      PRITJA_E_AVATARIT_MS,
    );
    return () => clearTimeout(ora);
  }, [faqjaGati, kaloTeShkruaj, pamja.emri]);

  // ---------- Leja e mikrofonit: vetëm kur fillon Fol, me arsyen ----------
  const sigurohuPerLejen = useCallback(async (): Promise<boolean> => {
    const leja = await lexoLejen();
    if (leja === "lejuar") return true;
    if (leja === "bllokuar") {
      Alert.alert(
        "Mikrofoni është i bllokuar",
        "Për t'u përgjigjur me zë, lejoje mikrofonin për Karrierën te Cilësimet e telefonit. Deri atëherë vazhdon me shkrim.",
        [
          { text: "Vazhdo me shkrim", style: "cancel", onPress: () => kaloTeShkruaj(null) },
          {
            text: "Hap Cilësimet",
            onPress: () => {
              kaloTeShkruaj(null);
              Linking.openSettings().catch(() => {});
            },
          },
        ],
        { cancelable: true, onDismiss: () => kaloTeShkruaj(null) },
      );
      return false;
    }
    return await new Promise<boolean>((resolve) => {
      const jo = () => {
        kaloTeShkruaj(null);
        resolve(false);
      };
      Alert.alert(
        "Përgjigju me zë",
        `${pamja.emri} të pyet me zë dhe ti përgjigjesh duke folur. Mikrofoni hapet vetëm kur prek butonin e tij; zëri kthehet në tekst dhe nuk ruhet.`,
        [
          { text: "Jo, me shkrim", style: "cancel", onPress: jo },
          {
            text: "Lejo mikrofonin",
            onPress: () => {
              kerkoLejen()
                .then((ok) => {
                  if (!ok) kaloTeShkruaj("Pa mikrofon, intervista vazhdon me shkrim.");
                  resolve(ok);
                })
                .catch(jo);
            },
          },
        ],
        { cancelable: true, onDismiss: jo },
      );
    });
  }, [kaloTeShkruaj, pamja.emri]);

  const lejaUKerkua = useRef(false);
  useEffect(() => {
    if (lejaUKerkua.current) return;
    lejaUKerkua.current = true;
    sigurohuPerLejen();
  }, [sigurohuPerLejen]);

  // ---------- Përgjigjja me zë ----------
  const dergoTani = useCallback(async () => {
    if (!regjistruesi.regjistron) return;
    const r = await regjistruesi.ndalo().catch(() => null);
    avatari.current?.degjon(false);
    if (!r) {
      njofto("Shumë shkurt. Prek mikrofonin, fol, pastaj prek përsëri.", "info");
      return;
    }
    setDergon(true);
    // Pranimi luhet menjëherë: kandidati dëgjon një përgjigje brenda sekondës, ndërsa serveri punon.
    if (mbushesi.current && r.sekonda >= MBUSHESI_PAS_SEKONDAVE) {
      avatari.current?.fol(ID_E_MBUSHESIT, mbushesi.current, "neutrale", false, false);
    } else {
      avatari.current?.mendon();
    }
    try {
      const rez = await dergoZerin(r.uri);
      if (!mounted.current) return;
      if (rez.lloji === "s_degjova") {
        prekja.gabim();
        njofto("Nuk të dëgjova mirë. Provo përsëri, pak më afër telefonit.", "info");
      } else if (rez.lloji === "gabim_zeri") {
        const k = rez.gabimi.kodi;
        if (k === "zeri_pa_konfigurim" || k === "kufiri_zerit") kaloTeShkruaj(rez.gabimi.message);
        else njofto(rez.gabimi.message, "gabim");
      } else if (rez.lloji === "u_degjua" && rez.gabimiZerit) {
        njofto(rez.gabimiZerit, "info");
      }
    } finally {
      fshiRegjistrimin(r.uri);
      if (mounted.current) setDergon(false);
    }
  }, [avatari, dergoZerin, kaloTeShkruaj, njofto, regjistruesi]);
  useEffect(() => {
    dergoTaniRef.current = () => {
      dergoTani();
    };
  }, [dergoTani]);

  const radhaJote = gjendja.faza === "pret_pergjigjen" && !flet && !dergon;

  async function prekMikrofonin() {
    if (regjistruesi.regjistron) {
      prekja.zgjedhje();
      await dergoTani();
      return;
    }
    if (!radhaJote) {
      prekja.lehte();
      return;
    }
    if (!kaInternet) {
      prekja.gabim();
      njofto(tekstiIPlote(PA_INTERNET_ZERI), "gabim");
      return;
    }
    if (!(await sigurohuPerLejen())) return;
    try {
      await regjistruesi.nis();
      prekja.zgjedhje();
      avatari.current?.degjon(true);
    } catch {
      prekja.gabim();
      njofto("Mikrofoni s'u hap. Provo përsëri ose shkruaje përgjigjen.", "gabim");
    }
  }

  /** "Ndalo": avatari hesht menjëherë dhe radha kalon te kandidati (pyetja është në ekran). */
  function ndaloFolesin() {
    const th = thenia.current;
    if (!th) return;
    prekja.zgjedhje();
    th.ndalur = true;
    avatari.current?.ndalo();
    mbaroiThenia(th.celesi);
  }

  /** "Përsërit pyetjen": e njëjta audio, pa thirrje të re; nëse s'është ende, kërkohet një herë. */
  function perseritPyetjen() {
    if (!radhaJote || gjendja.faza !== "pret_pergjigjen" || !gjendja.seanca.kthesa) return;
    const nr = gjendja.seanca.kthesa.nr;
    const celesi: CelesiIZerit = `a${nr}`;
    prekja.zgjedhje();
    const luaj = (f: FjaliaMeZe[]) => {
      if (!mounted.current || f.length === 0) return;
      thenia.current = { celesi, pjeset: 1, mbaruan: 0, ndalur: false };
      dergoPjesen(celesi, 0, f, "neutrale", false, false);
    };
    if (pyetjaMeZe.current?.nr === nr && pyetjaMeZe.current.fjalite.length) {
      luaj(pyetjaMeZe.current.fjalite);
      return;
    }
    zeriIPyetjes(intervistaId, nr, "pyetja")
      .then((f) => {
        pyetjaMeZe.current = { nr, fjalite: f };
        luaj(f);
      })
      .catch(() => njofto(`Zëri i ${pamja.gjenitivi} s'erdhi. Pyetja është në ekran.`, "info"));
  }

  // ---------- Statusi: kush e ka radhën, me fjalë ----------
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  let statusi: string;
  let radha: "ai" | "ti" | "askush" = "askush";
  let mendon = false;
  if (gjendja.faza === "gati") statusi = "Po hapet intervista…";
  else if (gjendja.faza === "gabim") statusi = "U ndal: shiko mesazhin poshtë";
  else if (gjendja.faza === "perfundon" || gjendja.faza === "raporti") {
    statusi = flet ? `Po flet ${pamja.emri}` : "Intervista mbaroi";
    radha = flet ? "ai" : "askush";
  } else if (!faqjaGati) {
    statusi = `${pamja.emri} po vjen…`;
    radha = "ai";
    mendon = true;
  } else if (regjistruesi.regjistron) {
    statusi = `Po të dëgjoj · ${mmss(regjistruesi.sekonda)}`;
    radha = "ti";
  } else if (duhetPrekje) {
    statusi = "Prek “Prek për ta dëgjuar” mbi avatar";
    radha = "ai";
  } else if (flet) {
    statusi = `Po flet ${pamja.emri}`;
    radha = "ai";
  } else if (dergon || gjendja.faza === "vlereson" || gjendja.faza === "pyet") {
    statusi = `${pamja.emri} po mendon…`;
    radha = "ai";
    mendon = true;
  } else if (!kaInternet) {
    statusi = `${PA_INTERNET_ZERI.titulli}: pyetja mbetet në ekran`;
  } else {
    statusi = "Radha jote: prek mikrofonin dhe fol";
    radha = "ti";
  }

  const onFoliMbaroi = useCallback(
    (id: string) => {
      const celesi = id.split(":")[0];
      if (celesi === "mbyllja" || /^a\d+$/.test(celesi)) pjesaMbaroi(celesi as CelesiIZerit);
    },
    [pjesaMbaroi],
  );
  const onFoliFilloi = useCallback((id: string) => {
    // Pranimi s'e ndryshon statusin ("po mendon" mbetet); vetëm pjesët e thënies aktuale e bëjnë "Po flet".
    if (!thenia.current || id.split(":")[0] !== thenia.current.celesi) return;
    setDuhetPrekje(false);
    setFlet(true);
  }, []);
  const onGabim = useCallback(() => kaloTeShkruaj(`${pamja.emri} s'u hap. Vazhdo me shkrim.`), [kaloTeShkruaj, pamja.emri]);

  return {
    onGati: () => setFaqjaGati(true), // edhe kur avatari s'u ngarkua: unaza flet njësoj
    onFoliFilloi,
    onFoliMbaroi,
    onPrek: () => setDuhetPrekje(true),
    onGabim,
    regjistron: regjistruesi.regjistron,
    niveli: regjistruesi.niveli,
    radhaJote,
    flet,
    mendon,
    statusi,
    radha,
    kaInternet,
    prekMikrofonin,
    ndaloFolesin,
    perseritPyetjen,
  };
}
