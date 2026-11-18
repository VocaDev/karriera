// Profili im (roli, gjuha, emri) i ruajtur në këtë telefon, një për përdorues (kesh:profili:<uid>).
// Pa të, kush hap app-in pa internet (ose me lidhje që varet) përfundon te "S'u lexua profili yt", edhe pse
// sesioni është ende brenda. Përdoret vetëm kur leximi i ri dështon (pa internet / s'mbaroi në kohë); kur kthehet
// interneti, profili rilexohet në heshtje dhe e zëvendëson (sesioni.tsx). Dalja e fshin (hyrja.ts → dil).
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Profili } from "@/lib/hyrja";

const PREFIKSI = "kesh:profili:";
const LLOJET = ["kerkues", "punedhenes", "qender"];
const GJUHET = ["sq", "en", "de"];

const eshteProfil = (v: unknown, uid: string): v is Profili => {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    p.id === uid &&
    typeof p.lloji === "string" &&
    LLOJET.includes(p.lloji) &&
    typeof p.emri === "string" &&
    (p.organizata === null || typeof p.organizata === "string") &&
    typeof p.gjuha === "string" &&
    GJUHET.includes(p.gjuha) &&
    (p.roli_synuar === null || typeof p.roli_synuar === "string")
  );
};

export async function ruajProfilin(profili: Profili): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIKSI + profili.id, JSON.stringify(profili));
  } catch (e) {
    // Pa hapësirë ose pa akses: s'është e rëndësishme, profili i gjallë mbetet në memorie.
    if (__DEV__) console.warn("[profili-kesh] s'u ruajt", e);
  }
}

/** Profili i ruajtur i kësaj llogarie, ose null nëse s'ka ose është i dëmtuar. */
export async function lexoProfilinERuajtur(uid: string): Promise<Profili | null> {
  try {
    const teksti = await AsyncStorage.getItem(PREFIKSI + uid);
    const v: unknown = teksti ? JSON.parse(teksti) : null;
    return eshteProfil(v, uid) ? v : null;
  } catch {
    return null;
  }
}

/** Fshin profilet e ruajtura të të gjitha llogarive në këtë telefon (thirret kur dilet nga llogaria). */
export async function pastroProfilinERuajtur(): Promise<void> {
  try {
    const celesat = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIKSI));
    if (celesat.length > 0) await AsyncStorage.multiRemove(celesat);
  } catch (e) {
    if (__DEV__) console.warn("[profili-kesh] s'u pastrua", e);
  }
}
