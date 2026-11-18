// Profili im (roli, gjuha, emri) i ruajtur në këtë telefon, një për përdorues (kesh:profili:<uid>).
// Pa të, kush hap app-in pa internet (ose me lidhje që varet) përfundon te "S'u lexua profili yt", edhe pse
// sesioni është ende brenda. Përdoret vetëm kur leximi i ri dështon (pa internet / s'mbaroi në kohë); kur kthehet
// interneti, profili rilexohet në heshtje dhe e zëvendëson (sesioni.tsx). Dalja e fshin (hyrja.ts → dil).
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Session } from "@supabase/supabase-js";

import type { Profili } from "@/lib/hyrja";
import { VONON } from "@/lib/mesazhet";
import { KOHA_E_SESIONIT, meKohe } from "@/lib/rrjeti";
import { supabase } from "@/lib/supabase";

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

/**
 * Sesioni siç e ka shkruar supabase-js në telefon (`sb-<projekti>-auth-token`). Kur `getSession()` varet pa internet
 * (token i skaduar që s'rifreskohet dot), e lexojmë vetë: `user.id` është identiteti pa internet. null = s'ka sesion.
 */
export async function lexoSesioninERuajtur(): Promise<Session | null> {
  try {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    const projekti = new URL(url).hostname.split(".")[0];
    const teksti = await AsyncStorage.getItem(`sb-${projekti}-auth-token`);
    const v: unknown = teksti ? JSON.parse(teksti) : null;
    if (typeof v !== "object" || v === null) return null;
    const s = v as Partial<Session>;
    const uid = (s.user as { id?: unknown } | undefined)?.id;
    return typeof uid === "string" && typeof s.access_token === "string" && typeof s.refresh_token === "string"
      ? (s as Session)
      : null;
  } catch {
    return null;
  }
}

/** Vetëm id-ja e përdoruesit nga sesioni i ruajtur në telefon (pa rrjet), ose null. */
export async function lexoUidTeRuajtur(): Promise<string | null> {
  const s = await lexoSesioninERuajtur();
  return s ? s.user.id : null;
}

/**
 * Id-ja e përdoruesit për çelësat lokalë (snapshot, lista e punëve): `getSession()` me kufi kohe; nëse varet
 * (pa internet, token i skaduar që s'rifreskohet dot) merret nga sesioni i ruajtur. null = s'ka sesion.
 * Është i vetmi vend ku të dhënat lokale pyesin për id-në: asnjë `getSession()` i pambrojtur te leximet pa internet.
 */
export async function merrUidLokal(): Promise<string | null> {
  try {
    const { data } = await meKohe(supabase.auth.getSession(), KOHA_E_SESIONIT, VONON.profili);
    return data.session?.user.id ?? null;
  } catch {
    return lexoUidTeRuajtur();
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
