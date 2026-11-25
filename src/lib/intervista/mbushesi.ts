// Pranimi i shkurtër ("Mirë, e kuptoj.") që luhet sa pret kthesën. Ruhet në telefon për çdo zë dhe gjuhë, që të mos
// kushtojë një kërkesë TTS për çdo intervistë (kufiri i kërkesave të Gemini TTS, 429 në prodhim, 25.11).
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FjaliaMeZe } from "./mesazhet";
import type { Gjuha, Intervistuesi } from "./tipet";

/** Veç për çdo ofrues zëri (Azure, Gemini), që pranimi të ketë të njëjtin zë si pyetja. Rrit versionin kur ndryshon
 * zëri ose teksti i pranimit në server. */
const celesi = (ofruesi: string, intervistuesi: Intervistuesi, gjuha: Gjuha) =>
  `karriera.mbushesi.v2.${ofruesi}.${intervistuesi}.${gjuha}`;

const eshteFjali = (v: unknown): v is FjaliaMeZe =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as FjaliaMeZe).audio_base64 === "string" &&
  typeof (v as FjaliaMeZe).teksti === "string" &&
  typeof (v as FjaliaMeZe).mime === "string";

export async function merrMbushesin(
  ofruesi: string,
  intervistuesi: Intervistuesi,
  gjuha: Gjuha,
  kerko: () => Promise<{ fjalite: FjaliaMeZe[]; ofruesi: string | null }>,
): Promise<FjaliaMeZe[]> {
  const k = celesi(ofruesi, intervistuesi, gjuha);
  try {
    const v: unknown = JSON.parse((await AsyncStorage.getItem(k)) ?? "null");
    if (Array.isArray(v) && v.length > 0 && v.every(eshteFjali)) return v;
  } catch {
    // cache i dëmtuar: kërkohet sërish
  }
  const e = await kerko();
  // Ruhet nën ofruesin që e bëri vërtet; nëse u kthye te një zë tjetër, s'përdoret me zërin e tanishëm.
  if (e.fjalite.length > 0 && e.ofruesi) {
    await AsyncStorage.setItem(celesi(e.ofruesi, intervistuesi, gjuha), JSON.stringify(e.fjalite)).catch(() => {});
  }
  return e.ofruesi === ofruesi || e.ofruesi === null ? e.fjalite : [];
}
