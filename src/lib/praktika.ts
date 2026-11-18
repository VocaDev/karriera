// Praktika pa internet: progresi dhe zgjedhjet ruhen vetëm në këtë telefon (AsyncStorage), asnjë thirrje rrjeti.
// Çelësat janë për përdorues: praktika:<uid>:<çka>. Dalja e fshin gjithçka (pastroPraktiken), si te punet-kesh.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import {
  GJUHET_E_PRAKTIKES,
  ROLET_E_PRAKTIKES,
  type GjuhaPraktikes,
  type RoliPraktikes,
} from "@/data/pyetjet";
import type { Gjuha, RoliSynuar } from "@/lib/hyrja";

const PREFIKSI = "praktika:";
const BOSH: Progresi = {};

/** Rruga e ekraneve të praktikës; s'janë ende te tipet e rrugëve (typedRoutes) derisa të rigjenerohen. */
export const rrugaPraktikes = (rruga: string) => rruga as unknown as Href;

/** "E di" ose "Përsërite": dy kovat e kartave. Karta pa shenjë = ende e pa parë. */
export type Kuta = "di" | "perserit";
export type Progresi = Record<string, Kuta>;

export type ZgjedhjaPraktikes = { roli: RoliPraktikes; gjuha: GjuhaPraktikes };
/** Koha për një përgjigje: 0 = pa kohë. */
export type KohaPraktikes = 0 | 60 | 90;
export const KOHAT: readonly KohaPraktikes[] = [0, 60, 90];

const celesiProgresit = (uid: string, roli: RoliPraktikes) => `${PREFIKSI}${uid}:progresi:${roli}`;
const celesiZgjedhjes = (uid: string) => `${PREFIKSI}${uid}:zgjedhja`;
const celesiKohes = (uid: string) => `${PREFIKSI}${uid}:koha`;

export const eshteRol = (v: unknown): v is RoliPraktikes => ROLET_E_PRAKTIKES.includes(v as RoliPraktikes);
export const eshteGjuhe = (v: unknown): v is GjuhaPraktikes => GJUHET_E_PRAKTIKES.includes(v as GjuhaPraktikes);

/** Roli i profilit (SWE / Asistent/PR) te roli i bankës. */
export function roliNgaProfili(roli: RoliSynuar | null | undefined): RoliPraktikes | null {
  if (roli === "SWE") return "swe";
  if (roli === "Asistent/PR") return "zyre";
  return null;
}

export function gjuhaNgaProfili(gjuha: Gjuha | null | undefined): GjuhaPraktikes | null {
  return eshteGjuhe(gjuha) ? gjuha : null;
}

async function lexoJson(celesi: string): Promise<unknown> {
  try {
    const teksti = await AsyncStorage.getItem(celesi);
    return teksti ? (JSON.parse(teksti) as unknown) : null;
  } catch {
    // Pa akses ose JSON i dëmtuar: sillemi sikur s'ka asgjë të ruajtur.
    return null;
  }
}

async function shkruajJson(celesi: string, vlera: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(celesi, JSON.stringify(vlera));
  } catch (e) {
    // Pa hapësirë: progresi mbetet në memorie për këtë hapje; s'e ndalojmë praktikën.
    if (__DEV__) console.warn("[praktika] s'u ruajt", e);
  }
}

export async function lexoProgresin(uid: string, roli: RoliPraktikes): Promise<Progresi> {
  const v = await lexoJson(celesiProgresit(uid, roli));
  if (typeof v !== "object" || v === null) return {};
  const rezultati: Progresi = {};
  for (const [id, kuta] of Object.entries(v)) {
    if (kuta === "di" || kuta === "perserit") rezultati[id] = kuta;
  }
  return rezultati;
}

export async function lexoZgjedhjen(uid: string): Promise<ZgjedhjaPraktikes | null> {
  const v = await lexoJson(celesiZgjedhjes(uid));
  if (typeof v !== "object" || v === null) return null;
  const { roli, gjuha } = v as Partial<ZgjedhjaPraktikes>;
  return eshteRol(roli) && eshteGjuhe(gjuha) ? { roli, gjuha } : null;
}

export function ruajZgjedhjen(uid: string, zgjedhja: ZgjedhjaPraktikes): Promise<void> {
  return shkruajJson(celesiZgjedhjes(uid), zgjedhja);
}

export async function lexoKohen(uid: string): Promise<KohaPraktikes> {
  const v = await lexoJson(celesiKohes(uid));
  return v === 60 || v === 90 ? v : 0;
}

export function ruajKohen(uid: string, koha: KohaPraktikes): Promise<void> {
  return shkruajJson(celesiKohes(uid), koha);
}

/**
 * Progresi i një roli, i ngarkuar nga telefoni. `shenjo` e ndryshon menjëherë në ekran dhe e ruan;
 * `null` e heq shenjën. Pa `uid` (pa sesion) s'ruhet asgjë.
 */
export function useProgresin(uid: string | null, roli: RoliPraktikes) {
  const [gjendja, setGjendja] = useState<{ celesi: string; progresi: Progresi } | null>(null);
  const celesi = uid ? `${uid}:${roli}` : null;

  useEffect(() => {
    if (!uid || !celesi) return;
    let aktiv = true;
    lexoProgresin(uid, roli).then((p) => {
      if (aktiv) setGjendja({ celesi, progresi: p });
    });
    return () => {
      aktiv = false;
    };
  }, [uid, roli, celesi]);

  // Kur ndërrohet roli, deri sa të vijë leximi i ri nuk tregojmë progresin e rolit tjetër.
  const lexuar = gjendja !== null && gjendja.celesi === celesi;
  const progresi: Progresi = lexuar && gjendja ? gjendja.progresi : BOSH;
  // Pa sesion s'ka çfarë të lexohet: gati menjëherë (me progres bosh).
  const gati = uid === null || lexuar;

  const shenjo = useCallback(
    (id: string, kuta: Kuta | null) => {
      if (!uid || !celesi) return;
      const i_ri: Progresi = { ...progresi };
      if (kuta === null) delete i_ri[id];
      else i_ri[id] = kuta;
      setGjendja({ celesi, progresi: i_ri });
      shkruajJson(celesiProgresit(uid, roli), i_ri);
    },
    [uid, roli, celesi, progresi],
  );

  const fshij = useCallback(() => {
    if (!uid || !celesi) return;
    setGjendja({ celesi, progresi: {} });
    AsyncStorage.removeItem(celesiProgresit(uid, roli)).catch(() => {});
  }, [uid, roli, celesi]);

  return { progresi, gati, shenjo, fshij };
}

/** Sa karta janë "E di" dhe sa "Përsërite" brenda listës së id-ve të një roli. */
export function numro(progresi: Progresi, idte: readonly string[]): { di: number; perserit: number } {
  let di = 0;
  let perserit = 0;
  for (const id of idte) {
    if (progresi[id] === "di") di += 1;
    else if (progresi[id] === "perserit") perserit += 1;
  }
  return { di, perserit };
}

/** Fshin progresin dhe zgjedhjet e praktikës të të gjithë përdoruesve në këtë telefon (thirret kur dilet nga llogaria). */
export async function pastroPraktiken(): Promise<void> {
  try {
    const celesat = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIKSI));
    if (celesat.length > 0) await AsyncStorage.multiRemove(celesat);
  } catch (e) {
    if (__DEV__) console.warn("[praktika] s'u pastrua", e);
  }
}
