// Lista e fundit e punëve që u lexua me sukses, e ruajtur në këtë telefon (AsyncStorage).
// Përdoret vetëm kur leximi i ri dështon (pa internet): atëherë shfaqet kjo listë me shiritin "Pa internet".
// Kur ndryshon forma e `Puna`, rrit VERSIONI: lista e vjetër s'lexohet më dhe lexohet nga serveri.
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Puna } from "@/lib/punet";

const VERSIONI = 1;
const CELESI = `karriera.punet.kesh.v${VERSIONI}`;

type Ruajtja = { v: number; punet: Puna[] };

const eshtePune = (v: unknown): v is Puna =>
  typeof v === "object" && v !== null && typeof (v as Puna).id === "string" && typeof (v as Puna).titulli === "string";

export function ruajListenEPunes(punet: Puna[]): void {
  const ruajtja: Ruajtja = { v: VERSIONI, punet };
  AsyncStorage.setItem(CELESI, JSON.stringify(ruajtja)).catch((e: unknown) => {
    // Pa hapësirë ose pa akses: s'është e rëndësishme, lista e gjallë mbetet në memorie.
    if (__DEV__) console.warn("[punet-kesh] s'u ruajt", e);
  });
}

/** Lista e ruajtur, ose null nëse s'ka ose është e dëmtuar. */
export async function lexoListenEPunes(): Promise<Puna[] | null> {
  try {
    const teksti = await AsyncStorage.getItem(CELESI);
    const v: unknown = teksti ? JSON.parse(teksti) : null;
    if (typeof v !== "object" || v === null) return null;
    const r = v as Partial<Ruajtja>;
    if (r.v !== VERSIONI || !Array.isArray(r.punet) || !r.punet.every(eshtePune)) return null;
    return r.punet;
  } catch {
    return null;
  }
}
