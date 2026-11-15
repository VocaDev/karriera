// Shenjat "e bëra" të hapave të "A jam gati?": vetëm në këtë telefon (AsyncStorage), sipas punës.
// Janë të jotat: s'shkojnë në server dhe s'e ndryshojnë përqindjen (ajo ndryshon vetëm kur AI-ja e llogarit përsëri).
// Janë të lidhura me llogaritjen: kur vjen rezultat i ri, hapat janë të tjerë dhe shenjat nisin bosh.
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIKSI = "karriera.gati.hapat.";

type Ruajtja = { rezultati: string; bere: number[] };

/** Cilët hapa (indeksi 0, 1, 2) i ka shënuar përdoruesi për këtë rezultat. Bosh nëse s'ka ose është e dëmtuar. */
export async function lexoShenjat(punaId: string, rezultatiId: string): Promise<number[]> {
  try {
    const teksti = await AsyncStorage.getItem(PREFIKSI + punaId);
    const v: unknown = teksti ? JSON.parse(teksti) : null;
    if (typeof v !== "object" || v === null) return [];
    const r = v as Partial<Ruajtja>;
    if (r.rezultati !== rezultatiId || !Array.isArray(r.bere)) return [];
    return r.bere.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 20);
  } catch {
    return [];
  }
}

/** Ruan shenjat. Dështimi s'e prish ekranin: shenja mbetet në memorie derisa të mbyllet app-i. */
export function ruajShenjat(punaId: string, rezultatiId: string, bere: number[]): void {
  const vlera: Ruajtja = { rezultati: rezultatiId, bere };
  AsyncStorage.setItem(PREFIKSI + punaId, JSON.stringify(vlera)).catch(() => {
    // pa hapësirë ose pa akses: e pranojmë, s'është e dhënë e rëndësishme
  });
}
