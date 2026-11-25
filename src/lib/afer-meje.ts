// "Afër meje" te Punët (J10, lokacioni): qyteti yt, vetëm në këtë telefon.
//
// Privatësia: vendndodhja lexohet një herë, me saktësinë më të ulët (~3 km), vetëm kur prek "Afër meje" ose
// "Përdor vendndodhjen time". Qyteti më i afërt gjendet në telefon (src/lib/qytetet.ts); koordinatat s'ruhen dhe
// s'dërgohen askund. Ruhet vetëm emri i qytetit (AsyncStorage), edhe për mysafirin.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useEffect, useSyncExternalStore } from "react";

import { eshteKomune, qytetiMeIAfert } from "@/lib/qytetet";

const CELESI = "karriera.punet.qyteti";

let qyteti: string | null = null;
let lexuar = false;
let dukeLexuar = false;
const degjuesit = new Set<() => void>();

function njofto() {
  for (const d of degjuesit) d();
}

async function lexo() {
  if (lexuar || dukeLexuar) return;
  dukeLexuar = true;
  try {
    const v = await AsyncStorage.getItem(CELESI);
    // Përdoruesi zgjodhi ndërkohë: zgjedhja e tij fiton.
    if (!lexuar && eshteKomune(v)) qyteti = v;
  } catch {
    // E palexueshme: si të mos ishte zgjedhur ende.
  }
  dukeLexuar = false;
  lexuar = true;
  njofto();
}

const merr = () => qyteti;
const abonohu = (d: () => void) => {
  degjuesit.add(d);
  return () => {
    degjuesit.delete(d);
  };
};

/** Qyteti i ruajtur (null = ende pa zgjedhur). Ndahet mes listës së punëve dhe fletës së qytetit. */
export function useQytetiIm(): string | null {
  const v = useSyncExternalStore(abonohu, merr, merr);
  useEffect(() => {
    lexo();
  }, []);
  return v;
}

/** Ruan qytetin (zgjedhur me dorë ose nga vendndodhja). Vlen menjëherë; ruajtja në telefon ndodh pas. */
export function vendosQytetin(emri: string) {
  if (!eshteKomune(emri)) return;
  qyteti = emri;
  lexuar = true;
  njofto();
  AsyncStorage.setItem(CELESI, emri).catch(() => {
    // Ruajtja dështoi: vlen derisa të mbyllet app-i.
  });
}

// "Afër meje" ndezur apo jo: vlen derisa të mbyllet app-i (filtri s'mbetet i fshehur nga një hapje në tjetrën).
let aktiv = false;
const degjuesitEFiltrit = new Set<() => void>();
const merrFiltrin = () => aktiv;
const abonohuTeFiltri = (d: () => void) => {
  degjuesitEFiltrit.add(d);
  return () => {
    degjuesitEFiltrit.delete(d);
  };
};

export function useAferMejeAktiv(): boolean {
  return useSyncExternalStore(abonohuTeFiltri, merrFiltrin, merrFiltrin);
}

export function vendosAferMeje(vlera: boolean) {
  if (aktiv === vlera) return;
  aktiv = vlera;
  for (const d of degjuesitEFiltrit) d();
}

export type LejaEVendndodhjes = "dhene" | "pyet" | "refuzuar";

/** Gjendja e lejes pa e pyetur përdoruesin. */
export async function lejaEVendndodhjes(): Promise<LejaEVendndodhjes> {
  try {
    const leja = await Location.getForegroundPermissionsAsync();
    if (leja.granted) return "dhene";
    return leja.canAskAgain ? "pyet" : "refuzuar";
  } catch {
    return "refuzuar";
  }
}

export type GjetjaEQytetit =
  | { lloji: "gjetur"; qyteti: string }
  | { lloji: "refuzuar" } // leja s'u dha: zgjidhet me dorë
  | { lloji: "jashte" } // pika s'është në Kosovë
  | { lloji: "gabim" }; // GPS i fikur, pa sinjal, ose s'u përgjigj në kohë

const KOHA_MAKS_MS = 12_000;

/**
 * Kërkon lejen (nëse duhet; sistemi e pyet vetëm një herë), lexon vendndodhjen një herë me saktësi të ulët,
 * dhe e kthen në qytet në telefon. Kur gjendet, qyteti ruhet. Koordinatat harrohen menjëherë.
 */
export async function gjejQytetinTim(): Promise<GjetjaEQytetit> {
  try {
    const leja = await Location.requestForegroundPermissionsAsync();
    if (!leja.granted) return { lloji: "refuzuar" };
    // E fundit e njohur (deri 30 min e vjetër) mjafton për një qytet dhe s'e ndez GPS-in; përndryshe një lexim i ri.
    const eFundit = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000, requiredAccuracy: 5_000 }).catch(
      () => null,
    );
    const pika =
      eFundit ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
        new Promise<null>((zgjidh) => setTimeout(() => zgjidh(null), KOHA_MAKS_MS)),
      ]));
    if (!pika) return { lloji: "gabim" };
    const emri = qytetiMeIAfert(pika.coords.latitude, pika.coords.longitude);
    if (!emri) return { lloji: "jashte" };
    vendosQytetin(emri);
    return { lloji: "gjetur", qyteti: emri };
  } catch {
    return { lloji: "gabim" };
  }
}
