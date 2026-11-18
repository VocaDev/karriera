// Lista e fundit e punëve që u lexua me sukses, e ruajtur në këtë telefon (AsyncStorage).
// Përdoret vetëm kur leximi i ri dështon (pa internet): atëherë shfaqet kjo listë me shiritin "Pa internet".
// Çelësi është për përdorues (kesh:punet:<uid>): punët private të njërit s'duken kurrë te tjetri në të njëjtin
// telefon. Dalja e fshin (hyrja.ts → dil). Pa sesion s'lexohet dhe s'shkruhet asgjë.
// Kur ndryshon forma e `Puna`, rrit VERSIONI: lista e vjetër s'lexohet më dhe lexohet nga serveri.
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Puna } from "@/lib/punet";
import { merrUidLokal } from "@/lib/profili-kesh";

const VERSIONI = 1;
const PREFIKSI = "kesh:punet:";

type Ruajtja = { v: number; punet: Puna[] };

const eshtePune = (v: unknown): v is Puna =>
  typeof v === "object" && v !== null && typeof (v as Puna).id === "string" && typeof (v as Puna).titulli === "string";

/** Çelësi i këtij përdoruesi, ose null pa sesion (merrUidLokal: me kufi kohe, pa pritur rifreskimin pa internet). */
async function celesi(): Promise<string | null> {
  const uid = await merrUidLokal();
  return uid ? `${PREFIKSI}${uid}` : null;
}

export async function ruajListenEPunes(punet: Puna[]): Promise<void> {
  try {
    const k = await celesi();
    if (!k) return;
    const ruajtja: Ruajtja = { v: VERSIONI, punet };
    await AsyncStorage.setItem(k, JSON.stringify(ruajtja));
  } catch (e) {
    // Pa hapësirë ose pa akses: s'është e rëndësishme, lista e gjallë mbetet në memorie.
    if (__DEV__) console.warn("[punet-kesh] s'u ruajt", e);
  }
}

/** Lista e ruajtur e këtij përdoruesi, ose null nëse s'ka ose është e dëmtuar. */
export async function lexoListenEPunes(): Promise<Puna[] | null> {
  try {
    const k = await celesi();
    if (!k) return null;
    const teksti = await AsyncStorage.getItem(k);
    const v: unknown = teksti ? JSON.parse(teksti) : null;
    if (typeof v !== "object" || v === null) return null;
    const r = v as Partial<Ruajtja>;
    if (r.v !== VERSIONI || !Array.isArray(r.punet) || !r.punet.every(eshtePune)) return null;
    return r.punet;
  } catch {
    return null;
  }
}

/** Fshin listat e ruajtura të të gjithë përdoruesve në këtë telefon (thirret kur dilet nga llogaria). */
export async function pastroKeshinEPuneve(): Promise<void> {
  try {
    const celesat = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIKSI));
    if (celesat.length > 0) await AsyncStorage.multiRemove(celesat);
  } catch (e) {
    if (__DEV__) console.warn("[punet-kesh] s'u pastrua", e);
  }
}
