// Rezultatet e fundit, të lexueshme PA internet ("Përmbledhja ime"): analiza e CV-së, intervista e fundit dhe "A jam gati?"
// për çdo punë. Ruhen në këtë telefon (AsyncStorage), vetëm sa duhet për t'u shfaqur, çdo gjë me datën kur u ruajt.
//
// Privatësia (CV-ja është e dhënë personale):
//   · Çelësi është për përdorues: snapshot:<uid>:cv | :intervista | :gati:<punaId>. Pa sesion s'lexohet dhe s'shkruhet asgjë.
//   · Dalja e fshin gjithçka (pastroSnapshot, thirret nga dil() dhe kur sesioni mbyllet nga serveri).
//   · S'ruhen tokena, email-i, as teksti i CV-së (fusha `cv` dhe `para`/`pas` të analizës lihen jashtë), as PDF-ja.
//     Ajo që ruhet është vetëm ajo që shfaqet: nota, këshillat, pyetjet, përgjigjet e tua dhe feedback-u.
// Kur ndryshon forma e një hyrjeje, rrit VERSIONI: hyrja e vjetër s'lexohet më (null) dhe zëvendësohet herën tjetër.
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AnalizaCV } from "@/lib/cv";
import type { AftesiaQeKe, AftesiaQeMungon, Gatishmeria } from "@/lib/gati";
import type { Gjuha, Raporti, RreshtiIBisedes } from "@/lib/intervista/tipet";
import { merrUidLokal } from "@/lib/profili-kesh";

const VERSIONI = 1;
const PREFIKSI = "snapshot:";
const MAKS_GATI = 20; // sa punë mbahen; më e vjetra del jashtë (AsyncStorage s'është për arkiv)
const MAKS_KESHILLA_CV = 5;

// ---------- Format e të dhënave të ruajtura ----------

export type PunaShkurt = { id: string; titulli: string; kompania: string };

export type SnapshotCv = {
  emri_skedarit: string | null; // emri që e ka dhënë vetë përdoruesi; null te CV-të e krijuara me AI pa emër
  versioni: number | null;
  nota: number; // 0–100, vlerësim i AI-së
  permbledhja: string;
  pikat_e_forta: string[];
  /** Seksionet që duan përmirësim: emri i seksionit dhe këshilla e AI-së (e njëjta si te analiza). */
  keshillat: { seksioni: string; keshilla: string }[];
};

export type PergjigjaIntervistes = {
  nr: number;
  lloji: "pyetje" | "vazhdim";
  pyetja: string;
  pergjigja: string | null; // ajo që shkroi përdoruesi; null nëse s'u gjet
  cka_ishte_mire: string;
  cka_te_permiresosh: string;
  shembull_me_i_mire: string;
};

export type SnapshotIntervista = {
  intervista_id: string;
  puna: PunaShkurt;
  gjuha: Gjuha;
  nota: number; // 0–100, vlerësim praktik i AI-së
  permbledhja: string;
  hapat: string[]; // tri_hapat_e_radhes
  pergjigjet: PergjigjaIntervistes[];
};

export type SnapshotGati = {
  puna: PunaShkurt;
  perqindja: number; // 0–100, vlerësim i AI-së, jo garanci punësimi
  ke: AftesiaQeKe[];
  mungon: AftesiaQeMungon[];
  hapat: string[];
  arsyeja: string;
  llogaritur_me: string; // ISO: kur u llogarit te serveri
};

/** Një hyrje e ruajtur: `ruajtur_me` është koha kur u ruajt në telefon (ISO), ajo që shfaqet si "Përditësuar më …". */
export type Hyrja<D> = { v: number; ruajtur_me: string; te_dhenat: D };

// ---------- Kontrolli i leximit (ajo që lexohet nga disku s'merret e mirëqenë) ----------

const eshteTekst = (v: unknown): v is string => typeof v === "string";
const eshteObjekt = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const eshteNumer = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const listeMe = (v: unknown, k: (x: unknown) => boolean) => Array.isArray(v) && v.every(k);
const tekstOseNull = (v: unknown) => v === null || eshteTekst(v);

const eshtePune = (v: unknown): v is PunaShkurt =>
  eshteObjekt(v) && eshteTekst(v.id) && eshteTekst(v.titulli) && eshteTekst(v.kompania);

const eshteCv = (v: unknown): v is SnapshotCv =>
  eshteObjekt(v) &&
  tekstOseNull(v.emri_skedarit) &&
  (v.versioni === null || eshteNumer(v.versioni)) &&
  eshteNumer(v.nota) &&
  eshteTekst(v.permbledhja) &&
  listeMe(v.pikat_e_forta, eshteTekst) &&
  listeMe(v.keshillat, (k) => eshteObjekt(k) && eshteTekst(k.seksioni) && eshteTekst(k.keshilla));

const eshtePergjigje = (v: unknown): v is PergjigjaIntervistes =>
  eshteObjekt(v) &&
  eshteNumer(v.nr) &&
  (v.lloji === "pyetje" || v.lloji === "vazhdim") &&
  eshteTekst(v.pyetja) &&
  tekstOseNull(v.pergjigja) &&
  eshteTekst(v.cka_ishte_mire) &&
  eshteTekst(v.cka_te_permiresosh) &&
  eshteTekst(v.shembull_me_i_mire);

const eshteIntervista = (v: unknown): v is SnapshotIntervista =>
  eshteObjekt(v) &&
  eshteTekst(v.intervista_id) &&
  eshtePune(v.puna) &&
  (v.gjuha === "sq" || v.gjuha === "en" || v.gjuha === "de") &&
  eshteNumer(v.nota) &&
  eshteTekst(v.permbledhja) &&
  listeMe(v.hapat, eshteTekst) &&
  listeMe(v.pergjigjet, eshtePergjigje);

const eshteGati = (v: unknown): v is SnapshotGati =>
  eshteObjekt(v) &&
  eshtePune(v.puna) &&
  eshteNumer(v.perqindja) &&
  listeMe(v.ke, (k) => eshteObjekt(k) && eshteTekst(k.aftesia) && eshteTekst(k.deshmia)) &&
  listeMe(v.mungon, (m) => eshteObjekt(m) && eshteTekst(m.aftesia) && eshteTekst(m.pse) && eshteTekst(m.si)) &&
  listeMe(v.hapat, eshteTekst) &&
  eshteTekst(v.arsyeja) &&
  eshteTekst(v.llogaritur_me);

// ---------- Ruajtja dhe leximi i një hyrjeje ----------

/** Id-ja e përdoruesit për çelësat lokalë (me kufi kohe; pa internet nga sesioni i ruajtur), ose null pa sesion. */
const uid = merrUidLokal;

async function shkruaj<D>(pjesa: string, te_dhenat: D): Promise<boolean> {
  try {
    const u = await uid();
    if (!u) return false;
    const hyrja: Hyrja<D> = { v: VERSIONI, ruajtur_me: new Date().toISOString(), te_dhenat };
    await AsyncStorage.setItem(`${PREFIKSI}${u}:${pjesa}`, JSON.stringify(hyrja));
    return true;
  } catch (e) {
    // Pa hapësirë ose pa akses: rezultati i gjallë mbetet në ekran, snapshot-i i vjetër mbetet i pacenuar.
    if (__DEV__) console.warn("[snapshot] s'u ruajt", pjesa, e);
    return false;
  }
}

function analizo<D>(teksti: string | null, eshteDhene: (v: unknown) => v is D): Hyrja<D> | null {
  try {
    const v: unknown = teksti ? JSON.parse(teksti) : null;
    if (!eshteObjekt(v) || v.v !== VERSIONI || !eshteTekst(v.ruajtur_me) || Number.isNaN(Date.parse(v.ruajtur_me))) return null;
    return eshteDhene(v.te_dhenat) ? { v: VERSIONI, ruajtur_me: v.ruajtur_me, te_dhenat: v.te_dhenat } : null;
  } catch {
    return null;
  }
}

async function lexo<D>(pjesa: string, eshteDhene: (v: unknown) => v is D): Promise<Hyrja<D> | null> {
  try {
    const u = await uid();
    if (!u) return null;
    return analizo(await AsyncStorage.getItem(`${PREFIKSI}${u}:${pjesa}`), eshteDhene);
  } catch {
    return null;
  }
}

// ---------- CV ----------

/** Pas një analize të lexuar me sukses (cv/analiza). `cv`: rreshti i CV-së (emri i skedarit dhe versioni), nëse dihet. */
export async function ruajCv(analiza: AnalizaCV, cv?: { emri_skedarit: string | null; versioni: number | null }) {
  const te_dhenat: SnapshotCv = {
    emri_skedarit: cv?.emri_skedarit ?? null,
    versioni: cv?.versioni ?? null,
    nota: analiza.nota,
    permbledhja: analiza.permbledhja,
    pikat_e_forta: analiza.pikat_e_forta,
    keshillat: analiza.seksionet
      .filter((s) => s.gjendja === "permiresim")
      .slice(0, MAKS_KESHILLA_CV)
      .map((s) => ({ seksioni: s.emri, keshilla: s.komenti })),
  };
  return shkruaj("cv", te_dhenat);
}

export const lexoCv = () => lexo("cv", eshteCv);

// ---------- Intervista ----------

/** Pas një raporti të lexuar me sukses (intervista/rezultatet). `biseda`: pyetjet dhe përgjigjet e tua nga lexoIntervisten. */
export async function ruajIntervisten(intervistaId: string, raporti: Raporti, biseda: RreshtiIBisedes[]) {
  const tePerdoruesit = new Map(biseda.map((k) => [k.nr, k.pergjigja]));
  const te_dhenat: SnapshotIntervista = {
    intervista_id: intervistaId,
    puna: { id: raporti.puna.id, titulli: raporti.puna.titulli, kompania: raporti.puna.kompania },
    gjuha: raporti.gjuha,
    nota: raporti.nota,
    permbledhja: raporti.permbledhja,
    hapat: raporti.tri_hapat_e_radhes,
    pergjigjet: raporti.pergjigjet.map((p) => ({
      nr: p.nr,
      lloji: p.lloji,
      pyetja: p.pyetja,
      pergjigja: tePerdoruesit.get(p.nr) ?? null,
      cka_ishte_mire: p.cka_ishte_mire,
      cka_te_permiresosh: p.cka_te_permiresosh,
      shembull_me_i_mire: p.shembull_me_i_mire,
    })),
  };
  return shkruaj("intervista", te_dhenat);
}

export const lexoIntervistenEFundit = () => lexo("intervista", eshteIntervista);

// ---------- A jam gati? (një hyrje për punë) ----------

/** Pas një leximi (ose llogaritjeje) të suksesshme të "A jam gati?" për një punë (gati/[id]). */
export async function ruajGatin(rezultati: Gatishmeria, puna: PunaShkurt) {
  const te_dhenat: SnapshotGati = {
    puna: { id: puna.id, titulli: puna.titulli, kompania: puna.kompania },
    perqindja: rezultati.perqindja,
    ke: rezultati.ke,
    mungon: rezultati.mungon,
    hapat: rezultati.hapat,
    arsyeja: rezultati.arsyeja,
    llogaritur_me: rezultati.krijuar_me,
  };
  const ok = await shkruaj(`gati:${puna.id}`, te_dhenat);
  if (ok) await shkurtoGatite();
  return ok;
}

/** Të gjitha "A jam gati?" e ruajtura të këtij përdoruesi, më e reja e para (sipas kohës së ruajtjes). */
export async function lexoGatite(): Promise<Hyrja<SnapshotGati>[]> {
  try {
    const u = await uid();
    if (!u) return [];
    const parashtesa = `${PREFIKSI}${u}:gati:`;
    const celesat = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(parashtesa));
    const palet = await AsyncStorage.multiGet(celesat);
    return palet
      .map(([, teksti]) => analizo(teksti, eshteGati))
      .filter((h): h is Hyrja<SnapshotGati> => h !== null)
      .sort((a, b) => Date.parse(b.ruajtur_me) - Date.parse(a.ruajtur_me));
  } catch {
    return [];
  }
}

/** Mbaj vetëm MAKS_GATI punët më të reja (gjithashtu heq hyrjet e dëmtuara ose të versionit të vjetër). */
async function shkurtoGatite(): Promise<void> {
  try {
    const u = await uid();
    if (!u) return;
    const parashtesa = `${PREFIKSI}${u}:gati:`;
    const celesat = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(parashtesa));
    if (celesat.length <= MAKS_GATI) return;
    const palet = await AsyncStorage.multiGet(celesat);
    const radhitur = palet
      .map(([k, teksti]) => ({ k, h: analizo(teksti, eshteGati) }))
      .sort((a, b) => (b.h ? Date.parse(b.h.ruajtur_me) : 0) - (a.h ? Date.parse(a.h.ruajtur_me) : 0));
    await AsyncStorage.multiRemove(radhitur.slice(MAKS_GATI).map((x) => x.k));
  } catch (e) {
    if (__DEV__) console.warn("[snapshot] s'u shkurtua", e);
  }
}

// ---------- Të gjitha, dhe dalja ----------

export type Snapshot = {
  cv: Hyrja<SnapshotCv> | null;
  intervista: Hyrja<SnapshotIntervista> | null;
  gati: Hyrja<SnapshotGati>[];
};

/** Gjithçka që ka ekrani "Përmbledhja ime" (një leximi lokal, pa rrjet). */
export async function lexoSnapshotin(): Promise<Snapshot> {
  const [cv, intervista, gati] = await Promise.all([lexoCv(), lexoIntervistenEFundit(), lexoGatite()]);
  return { cv, intervista, gati };
}

/** Fshin snapshot-in e TË GJITHË përdoruesve në këtë telefon (thirret kur dilet nga llogaria). Nuk hedh kurrë gabim. */
export async function pastroSnapshot(): Promise<void> {
  try {
    const celesat = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIKSI));
    if (celesat.length > 0) await AsyncStorage.multiRemove(celesat);
  } catch (e) {
    if (__DEV__) console.warn("[snapshot] s'u pastrua", e);
  }
}
