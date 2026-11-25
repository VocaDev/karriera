// Fol: lidh makinën e gjendjeve (useIntervista), avatarin (WebView) dhe mikrofonin (useRegjistruesi).
// Përdoret vetëm nga PaneliIZerit, që vizatohet vetëm në Fol: kur kandidati kalon te Shkruaj, paneli hiqet dhe
// avatari, mikrofoni dhe gjendja e zërit mbyllen bashkë me të.
//
//   faza "pyet"           → zëri vjen në rrjedhë (PCM) dhe luhet nga copa e parë: reagimi + pyetja në një audio, pa pritur
//                           fundin ("Po flet Arta"). Pas përgjigjes me zë, rrjedha vjen bashkë me kthesën (shih dergoTani);
//                           pyetja e parë ose një intervistë e rihapur e kërkon vetë (zeriIPyetjesMeRrjedhe)
//   faqja mbaron          → uPyet() → "pret_pergjigjen": radha e kandidatit
//   prek mikrofonin       → "Po të dëgjoj" (AudioStream → WAV)
//   prek përsëri / 90 s   → një pranim i shkurtër ("Mirë, e kuptoj.") luhet menjëherë, pastaj "Arta po mendon…":
//                           dergoZerin() → transkripti + teksti i pyetjes tjetër në ekran → zëri i saj si më lart
//   "Ndalo"               → avatari hesht, radha jote; "Përsërit pyetjen" → e njëjta audio, pa thirrje të re
//
// Çdo dështim i zërit e lë intervistën të paprekur: pyetja është në ekran si tekst dhe kandidati mund të provojë sërish
// ose të kalojë te Shkruaj. Leja e mikrofonit kërkohet vetëm kur fillon Fol, pasi shpjegohet pse.
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Linking } from "react-native";

import { paInternet, tekstiIPlote, VONON } from "@/lib/mesazhet";
import { prekja } from "@/lib/prekja";

import type { AvatariRef } from "./Avatari";
import type { Gjendja } from "./gjendja";
import type { FazaELejes } from "./LejaModal";
import { merrMbushesin } from "./mbushesi";
import { GabimIIntervistes, zeriIPyetjes, zeriIPyetjesMeRrjedhe, zeriMeOfruesin, ZERI_NGA_KUFIRI } from "./klienti";
import type { FjaliaMeZe } from "./mesazhet";
import { PAMJA_E_INTERVISTUESIT, type Intervistuesi, type Shprehja } from "./tipet";
import type { CelesiIZerit, RezultatiIZerit, ZeriRrjedhe } from "./useIntervista";
import { fshiRegjistrimin, kerkoLejen, lexoLejen, useRegjistruesi } from "./useRegjistruesi";

const PRITJA_E_AVATARIT_MS = 25_000;
/** Pranimi luhet vetëm pas një përgjigjeje të vërtetë, jo pas një prekjeje të shkurtër. */
const MBUSHESI_PAS_SEKONDAVE = 1.5;
const ID_E_MBUSHESIT = "mbushesi";
/** Pritja para zërit rezervë: kufiri i kërkesave të TTS-së (429) zakonisht lirohet pas pak sekondash. */
const PRITJA_E_REZERVES_MS = 2_500;

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
  dergoZerin: (uri: string, zeri: ZeriRrjedhe) => Promise<RezultatiIZerit>;
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
  const pyetjaMeZe = useRef<{ nr: number; fjalite: FjaliaMeZe[] } | null>(null); // për "Përsërit pyetjen" (një herë e kërkuar)
  // Rrjedha e zërit që po vjen: faqes i thuhet "fillo" vetëm kur vjen copa e parë (që përshëndetja të bjerë me zërin).
  const rrjedha = useRef<{
    celesi: CelesiIZerit;
    id: string;
    filloi: boolean;
    deshtoi: boolean;
    kuota: boolean;
    shprehja: Shprehja;
    pershendetje: boolean;
  } | null>(null);
  /** Audio e plotë e thënies së fundit me rrjedhë: "Përsërit pyetjen" e luan pa asnjë kërkesë të re TTS. */
  const eThena = useRef<{ celesi: CelesiIZerit; copat: [string, number][]; prishur: boolean; plote: boolean } | null>(null);
  // Kopja mbahet pavarësisht nga luajtja: edhe pas "Ndalo", copat që vazhdojnë të vijnë hyjnë te kopja.
  const mbajCopen = useCallback((celesi: CelesiIZerit, b: string, shkalla: number) => {
    const e = eThena.current;
    if (e?.celesi === celesi && !e.plote) e.copat.push([b, shkalla]);
  }, []);
  const mbyllKopjen = useCallback((celesi: CelesiIZerit, plote: boolean) => {
    const e = eThena.current;
    if (e?.celesi !== celesi) return;
    if (!plote) e.prishur = true;
    else if (!e.prishur && e.copat.length > 0) e.plote = true;
  }, []);
  /** Rrjedha u ndërpre: kur faqja e mbaron pjesën që erdhi, luhet zëri rezervë i pyetjes. */
  const rezerva = useRef<CelesiIZerit | null>(null);
  /**
   * Kufiri i shërbimit të zërit (kodi "kuota"): fjalia e sinqertë, pa zë rezervë (do të godiste të njëjtin kufi). Te kufiri
   * ditor s'kërkohet më zë: pyetjet dalin në ekran dhe përgjigjet vazhdojnë me zë.
   */
  const paZeSot = useRef(false);
  const shenoKuoten = useCallback(
    (ditor: boolean) => {
      if (paZeSot.current) return;
      if (ditor) paZeSot.current = true;
      njofto(ZERI_NGA_KUFIRI, "info");
    },
    [njofto],
  );
  /** Cili ofrues po flet (Azure, Gemini): pranimi i shkurtër merret me të njëjtin zë. */
  const [ofruesi, setOfruesi] = useState<string | null>(null);
  const mbushesi = useRef<FjaliaMeZe[] | null>(null);
  const mbushesiPer = useRef<string | null>(null); // ofruesi për të cilin u kërkua pranimi
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
      rrjedha.current = null;
      rezerva.current = null;
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

  // ---------- Zëri në rrjedhë ----------
  /** Një thënie e re po vjen me rrjedhë (pas përgjigjes me zë, ose pyetja e parë). Para copës së parë s'dërgohet asgjë. */
  const nisRrjedhen = useCallback(
    (celesi: CelesiIZerit, shprehja: Shprehja, pershendetje: boolean) => {
      thenePer.current = celesi;
      thenia.current = { celesi, pjeset: 1, mbaruan: 0, ndalur: false };
      rrjedha.current = { celesi, id: `${celesi}:0`, filloi: false, deshtoi: false, kuota: false, shprehja, pershendetje };
      eThena.current = { celesi, copat: [], prishur: false, plote: false };
      vendosSigurine(celesi, 40);
    },
    [vendosSigurine],
  );
  const rrjedhaPcm = useCallback(
    (celesi: CelesiIZerit, b: string, shkalla: number) => {
      const r = rrjedha.current;
      if (!r || r.celesi !== celesi || thenia.current?.ndalur) return;
      if (!r.filloi) {
        r.filloi = true;
        avatari.current?.rrjedheFillo(r.id, r.shprehja, r.pershendetje);
      }
      avatari.current?.rrjedhePcm(r.id, b, shkalla);
    },
    [avatari],
  );
  /**
   * Zëri rezervë pa rrjedhë për pyetjen (kur rrjedha dështon ose pritet në mes): luhet pas pjesës që erdhi, që fjalia të
   * mos mbetet përgjysmë. Nëse dështon edhe kjo, pyetja mbetet në ekran dhe radha kalon te kandidati.
   */
  const luajRezerven = useCallback(
    (celesi: CelesiIZerit) => {
      const nr = Number(celesi.slice(1));
      setFlet(false);
      vendosSigurine(celesi, 35);
      setTimeout(() => {
        const th = thenia.current;
        if (!mounted.current || th?.celesi !== celesi || th.ndalur) return;
        zeriIPyetjes(intervistaId, nr, "pyetja").then(
          (f) => {
            if (!mounted.current) return;
            pyetjaMeZe.current = { nr, fjalite: f };
            dergoPjesen(celesi, 1, f, "neutrale", false, true);
          },
          (e: unknown) => {
            if (!mounted.current) return;
            pjesaMbaroi(celesi);
            if (e instanceof GabimIIntervistes && e.kodi === "kuota") shenoKuoten(e.kufiriDitor);
            else njofto(`Zëri i ${pamja.gjenitivi} u ndërpre. Lexoje pyetjen në ekran.`, "info");
          },
        );
      }, PRITJA_E_REZERVES_MS);
    },
    [dergoPjesen, intervistaId, njofto, pamja.gjenitivi, pjesaMbaroi, shenoKuoten, vendosSigurine],
  );
  const rrjedhaMbaroi = useCallback(
    (celesi: CelesiIZerit) => {
      const r = rrjedha.current;
      if (!r || r.celesi !== celesi) return;
      const duhetRezerva =
        r.deshtoi && !r.kuota && !paZeSot.current && celesi !== "mbyllja" && !!thenia.current && !thenia.current.ndalur;
      if (duhetRezerva && thenia.current) thenia.current.pjeset = 2;
      else if (r.deshtoi && !r.kuota && !paZeSot.current) njofto("Zëri u ndërpre. Teksti është në ekran.", "info");
      if (!r.filloi) {
        // Pa asnjë copë zëri: pjesa e rrjedhës numërohet menjëherë.
        pjesaMbaroi(celesi);
        if (duhetRezerva) luajRezerven(celesi);
        return;
      }
      if (duhetRezerva) rezerva.current = celesi;
      avatari.current?.rrjedheMbaroi(r.id);
    },
    [avatari, luajRezerven, njofto, pjesaMbaroi],
  );
  const zeriRrjedhe = useMemo<ZeriRrjedhe>(
    () => ({
      fillon: (celesi, shprehja) => nisRrjedhen(celesi, shprehja, false),
      pcm: (b, shkalla) => {
        if (eThena.current) mbajCopen(eThena.current.celesi, b, shkalla);
        const th = thenia.current;
        if (th) rrjedhaPcm(th.celesi, b, shkalla);
      },
      ofruesi: setOfruesi,
      deshtoi: (kuota) => {
        if (eThena.current) mbyllKopjen(eThena.current.celesi, false);
        if (kuota) shenoKuoten(kuota.ditor);
        if (rrjedha.current) {
          rrjedha.current.deshtoi = true;
          rrjedha.current.kuota = !!kuota;
        }
      },
      mbaroi: () => {
        if (eThena.current) mbyllKopjen(eThena.current.celesi, true);
        const th = thenia.current;
        if (th) rrjedhaMbaroi(th.celesi);
      },
    }),
    [mbajCopen, mbyllKopjen, nisRrjedhen, rrjedhaMbaroi, rrjedhaPcm, shenoKuoten],
  );

  // Pyetja thuhet sapo faqja është gati. Pas një përgjigjeje me zë, rrjedha e saj është nisur tashmë (thenePer e di): s'kërkohet dy herë.
  useEffect(() => {
    if (!faqjaGati) return;
    if (gjendja.faza !== "pyet" || !gjendja.seanca.kthesa) return;
    const k = gjendja.seanca.kthesa;
    const celesi: CelesiIZerit = `a${k.nr}`;
    if (thenePer.current === celesi) return;
    const pershendetje = !gjendja.seanca.biseda.some((m) => m.kush === "ti");
    nisRrjedhen(celesi, k.shprehja, pershendetje);
    if (paZeSot.current) {
      pjesaMbaroi(celesi); // pa zë sot: pyetja është në ekran, radha kalon menjëherë te kandidati
      return;
    }
    // Gjatë pritjes (~2 s te byte-i i parë) avatari "mendon" dhe teksti i pyetjes është tashmë në ekran.
    avatari.current?.mendon();
    let deshtoi = false;
    zeriIPyetjesMeRrjedhe(intervistaId, k.nr, {
      onPcm: (b, shkalla) => {
        if (!mounted.current) return;
        mbajCopen(celesi, b, shkalla);
        rrjedhaPcm(celesi, b, shkalla);
      },
      onOfruesi: (emri) => {
        if (mounted.current) setOfruesi(emri);
      },
      onGabimZerit: (_mesazhi, kuota) => {
        deshtoi = true;
        if (!kuota) return;
        shenoKuoten(kuota.ditor);
        if (rrjedha.current?.celesi === celesi) rrjedha.current.kuota = true;
      },
    }).then(
      () => {
        if (!mounted.current) return;
        mbyllKopjen(celesi, !deshtoi);
        if (deshtoi && rrjedha.current?.celesi === celesi) rrjedha.current.deshtoi = true;
        rrjedhaMbaroi(celesi);
      },
      (e: unknown) => {
        if (!mounted.current) return;
        const g = e instanceof GabimIIntervistes ? e : null;
        if (g?.kodi === "kuota") {
          shenoKuoten(g.kufiriDitor);
          pjesaMbaroi(celesi);
          return;
        }
        // Dështim i ofruesit të zërit para copës së parë (p.sh. 429): provohet zëri rezervë pa rrjedhë.
        if (g?.kodi === "zeri" && thenia.current?.celesi === celesi) {
          thenia.current.pjeset = 2;
          pjesaMbaroi(celesi);
          luajRezerven(celesi);
          return;
        }
        pjesaMbaroi(celesi);
        if (g && (g.kodi === "zeri_pa_konfigurim" || g.kodi === "kufiri_zerit")) kaloTeShkruaj(g.message);
        else if (g?.kodi === "rrjeti") njofto(tekstiIPlote(PA_INTERNET_ZERI), "info");
        else if (g?.kodi === "vonese") njofto(`${VONON.titulli}. Pyetja është në ekran: përgjigju me zë ose me shkrim.`, "info");
        else njofto(`Zëri i ${pamja.gjenitivi} s'erdhi. Lexoje pyetjen dhe përgjigju me zë.`, "info");
      },
    );
  }, [
    avatari,
    faqjaGati,
    gjendja,
    intervistaId,
    kaloTeShkruaj,
    luajRezerven,
    mbajCopen,
    mbyllKopjen,
    njofto,
    nisRrjedhen,
    pamja.gjenitivi,
    pjesaMbaroi,
    rrjedhaMbaroi,
    rrjedhaPcm,
    shenoKuoten,
  ]);

  // Pranimi i shkurtër: nga cache-i i telefonit; përndryshe kërkohet vetëm pasi pyetja e parë u tha (jo njëkohësisht me
  // të, që kërkesat e TTS-së të mos grumbullohen).
  const nrAktual = gjendja.faza === "pret_pergjigjen" ? (gjendja.seanca.kthesa?.nr ?? null) : null;
  const gjuha = gjendja.faza === "pret_pergjigjen" ? gjendja.seanca.info.gjuha : null;
  useEffect(() => {
    // Pranimi merret me zërin që po flet tani; nëse ofruesi ndryshon (p.sh. Azure → Gemini), merret sërish.
    if (!faqjaGati || nrAktual === null || !gjuha || !ofruesi || mbushesiPer.current === ofruesi || paZeSot.current) return;
    mbushesiPer.current = ofruesi;
    mbushesi.current = null;
    merrMbushesin(ofruesi, intervistuesi, gjuha, () => zeriMeOfruesin(intervistaId, nrAktual, "mbushesi"))
      .then((f) => {
        if (f.length && mbushesiPer.current === ofruesi) mbushesi.current = f;
      })
      .catch(() => {
        // Pa pranim: kandidati sheh vetëm "po mendon"; asgjë s'prishet.
      });
  }, [faqjaGati, gjuha, intervistaId, intervistuesi, nrAktual, ofruesi]);

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
  // Fletë që shpjegon pse (bordi 38) para dritares së sistemit; nëse refuzohet ose është e bllokuar, ekrani "leja u refuzua"
  // (bordi 39) me "Hap Cilësimet" dhe "Vazhdo me shkrim". Vendimi kthehet te sigurohuPerLejen përmes një premtimi.
  const [leja, setLeja] = useState<FazaELejes | null>(null);
  const lejaPremtimi = useRef<((ok: boolean) => void) | null>(null);
  const zgjidhLejen = useCallback((ok: boolean) => {
    lejaPremtimi.current?.(ok);
    lejaPremtimi.current = null;
  }, []);

  const sigurohuPerLejen = useCallback(async (): Promise<boolean> => {
    const l = await lexoLejen();
    if (l === "lejuar") return true;
    if (l === "bllokuar") {
      setLeja("refuzuar");
      return false;
    }
    return await new Promise<boolean>((resolve) => {
      lejaPremtimi.current = resolve;
      setLeja("shpjegim");
    });
  }, []);

  /** "Vazhdo" në fletë: dritarja e sistemit; pritet vetëm pasi fleta e ka shpjeguar. */
  const lejaVazhdo = useCallback(async () => {
    let ok = false;
    try {
      ok = await kerkoLejen();
    } catch {
      ok = false;
    }
    setLeja(ok ? null : "refuzuar");
    zgjidhLejen(ok);
  }, [zgjidhLejen]);
  const lejaJo = useCallback(() => {
    setLeja("refuzuar");
    zgjidhLejen(false);
  }, [zgjidhLejen]);
  const lejaHapCilesimet = useCallback(() => {
    // Kandidati mbetet në Fol: kur kthehet dhe prek mikrofonin, leja kontrollohet sërish.
    setLeja(null);
    Linking.openSettings().catch(() => {});
  }, []);
  const lejaVazhdoMeShkrim = useCallback(() => {
    setLeja(null);
    kaloTeShkruaj(null);
  }, [kaloTeShkruaj]);

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
      const rez = await dergoZerin(r.uri, zeriRrjedhe);
      if (!mounted.current) return;
      if (rez.lloji === "s_degjova") {
        prekja.gabim();
        njofto("Nuk të dëgjova mirë. Provo përsëri, pak më afër telefonit.", "info");
      } else if (rez.lloji === "gabim_zeri") {
        const k = rez.gabimi.kodi;
        if (k === "zeri_pa_konfigurim" || k === "kufiri_zerit") kaloTeShkruaj(rez.gabimi.message);
        else njofto(rez.gabimi.message, "gabim");
      }
      // "u_degjua" me zë të dështuar: zëri rezervë e merr përsipër (rrjedhaMbaroi); njoftim vetëm nëse dështon edhe ai.
    } finally {
      fshiRegjistrimin(r.uri);
      if (mounted.current) setDergon(false);
    }
  }, [avatari, dergoZerin, kaloTeShkruaj, njofto, regjistruesi, zeriRrjedhe]);
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

  /** "Anulo": regjistrimi hidhet poshtë pa u dërguar (skedari fshihet), radha mbetet e jotja. */
  function anuloRegjistrimin() {
    if (!regjistruesi.regjistron) return;
    prekja.zgjedhje();
    regjistruesi.anulo();
    avatari.current?.degjon(false);
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
    const ruajtur = eThena.current;
    if (ruajtur?.celesi === celesi && ruajtur.plote) {
      // E njëjta audio që u tha (reagimi + pyetja), nga telefoni.
      const id = `${celesi}:r`;
      thenia.current = { celesi, pjeset: 1, mbaruan: 0, ndalur: false };
      avatari.current?.rrjedheFillo(id, "neutrale", false);
      for (const [b, shkalla] of ruajtur.copat) avatari.current?.rrjedhePcm(id, b, shkalla);
      avatari.current?.rrjedheMbaroi(id);
      vendosSigurine(celesi, 40);
      return;
    }
    if (pyetjaMeZe.current?.nr === nr && pyetjaMeZe.current.fjalite.length) {
      luaj(pyetjaMeZe.current.fjalite);
      return;
    }
    zeriIPyetjes(intervistaId, nr, "pyetja")
      .then((f) => {
        pyetjaMeZe.current = { nr, fjalite: f };
        luaj(f);
      })
      .catch((e: unknown) => {
        if (e instanceof GabimIIntervistes && e.kodi === "kuota") shenoKuoten(e.kufiriDitor);
        else njofto(`Zëri i ${pamja.gjenitivi} s'erdhi. Pyetja është në ekran.`, "info");
      });
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
      const [celesi, pjesa] = id.split(":");
      if (celesi !== "mbyllja" && !/^a\d+$/.test(celesi)) return;
      pjesaMbaroi(celesi as CelesiIZerit);
      if (pjesa === "0" && rezerva.current === celesi) {
        rezerva.current = null;
        luajRezerven(celesi as CelesiIZerit);
      }
    },
    [luajRezerven, pjesaMbaroi],
  );
  const onFoliFilloi = useCallback((id: string) => {
    // Pranimi s'e ndryshon statusin ("po mendon" mbetet); vetëm pjesët e thënies aktuale e bëjnë "Po flet".
    if (!thenia.current || id.split(":")[0] !== thenia.current.celesi) return;
    setDuhetPrekje(false);
    setFlet(true);
  }, []);
  const onGabim = useCallback(() => kaloTeShkruaj(`${pamja.emri} s'u hap. Vazhdo me shkrim.`), [kaloTeShkruaj, pamja.emri]);

  return {
    faqjaGati,
    onGati: () => setFaqjaGati(true), // edhe kur avatari s'u ngarkua: unaza flet njësoj
    // Faqja po rihapet (sistemi e mbylli procesin): çka po thuhej s'do të mbarojë kurrë, radha kalon te kandidati.
    onRinisje: () => {
      const th = thenia.current;
      setFaqjaGati(false);
      if (th) mbaroiThenia(th.celesi);
    },
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
    leja,
    lejaVazhdo,
    lejaJo,
    lejaHapCilesimet,
    lejaVazhdoMeShkrim,
    prekMikrofonin,
    anuloRegjistrimin,
    ndaloFolesin,
    perseritPyetjen,
  };
}
