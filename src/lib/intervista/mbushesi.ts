// Pranimi i shkurtër ("Mirë, e kuptoj.") që luhet sa pret kthesën. Ruhet në telefon për çdo zë dhe gjuhë, që të mos
// kushtojë një kërkesë TTS për çdo intervistë (kufiri i kërkesave të Gemini TTS, 429 në prodhim, 25.11).
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FjaliaMeZe } from "./mesazhet";
import type { Gjuha, Intervistuesi } from "./tipet";

/** Rrit versionin kur ndryshon zëri ose teksti i pranimit në server. */
const celesi = (intervistuesi: Intervistuesi, gjuha: Gjuha) => `karriera.mbushesi.v1.${intervistuesi}.${gjuha}`;

const eshteFjali = (v: unknown): v is FjaliaMeZe =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as FjaliaMeZe).audio_base64 === "string" &&
  typeof (v as FjaliaMeZe).teksti === "string" &&
  typeof (v as FjaliaMeZe).mime === "string";

export async function merrMbushesin(
  intervistuesi: Intervistuesi,
  gjuha: Gjuha,
  kerko: () => Promise<FjaliaMeZe[]>,
): Promise<FjaliaMeZe[]> {
  const k = celesi(intervistuesi, gjuha);
  try {
    const v: unknown = JSON.parse((await AsyncStorage.getItem(k)) ?? "null");
    if (Array.isArray(v) && v.length > 0 && v.every(eshteFjali)) return v;
  } catch {
    // cache i dëmtuar: kërkohet sërish
  }
  const e = await kerko();
  if (e.length > 0) await AsyncStorage.setItem(k, JSON.stringify(e)).catch(() => {});
  return e;
}
