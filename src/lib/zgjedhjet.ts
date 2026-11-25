// Zgjedhjet "Shtoje në CV" për një analizë: ruhen vetëm në këtë telefon (AsyncStorage), sipas id-së së
// analizës. Analiza dhe "Rindërto CV-në" lexojnë të njëjtën gjendje, dhe ajo mbetet edhe pas mbylljes
// së app-it. Asgjë nga këtu s'shkon në server derisa kandidati të shtypë "Ruaje si version të ri".
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { ZGJEDHJE_BOSH, type Zgjedhjet } from "@/lib/rindertimi";

const PREFIKSI = "karriera.cv.zgjedhjet.";

const gjendjet = new Map<string, Zgjedhjet>();
const dukeLexuar = new Set<string>();
const degjuesit = new Set<() => void>();

function njofto() {
  for (const d of degjuesit) d();
}

function eshteZgjedhje(v: unknown): v is Zgjedhjet {
  if (typeof v !== "object" || v === null) return false;
  const z = v as Record<string, unknown>;
  const objekt = (x: unknown) => typeof x === "object" && x !== null && !Array.isArray(x);
  return objekt(z.vendimet) && objekt(z.vlerat) && objekt(z.ndryshimet);
}

async function lexo(reviewId: string) {
  if (gjendjet.has(reviewId) || dukeLexuar.has(reviewId)) return;
  dukeLexuar.add(reviewId);
  let z: Zgjedhjet = ZGJEDHJE_BOSH;
  try {
    const teksti = await AsyncStorage.getItem(PREFIKSI + reviewId);
    const v: unknown = teksti ? JSON.parse(teksti) : null;
    if (eshteZgjedhje(v)) z = v;
  } catch {
    // E dëmtuar ose e palexueshme: nis nga e para (s'humbet asgjë në server).
  }
  dukeLexuar.delete(reviewId);
  if (!gjendjet.has(reviewId)) gjendjet.set(reviewId, z);
  njofto();
}

function ruaj(reviewId: string, z: Zgjedhjet) {
  AsyncStorage.setItem(PREFIKSI + reviewId, JSON.stringify(z)).catch(() => {
    // Ruajtja në telefon dështoi: gjendja mbetet në memorie derisa të mbyllet app-i.
  });
}

/**
 * Zgjedhjet e një analize. `gati` = u lexuan nga telefoni (para kësaj, butonat presin).
 * `ndrysho` merr gjendjen e fundit, kështu dy prekje të shpejta s'e fshijnë njëra-tjetrën.
 */
export function useZgjedhjet(reviewId: string | null) {
  const merr = useCallback(() => (reviewId ? gjendjet.get(reviewId) : undefined), [reviewId]);
  const abonohu = useCallback((d: () => void) => {
    degjuesit.add(d);
    return () => {
      degjuesit.delete(d);
    };
  }, []);
  const z = useSyncExternalStore(abonohu, merr, merr);

  useEffect(() => {
    if (reviewId) lexo(reviewId);
  }, [reviewId]);

  const ndrysho = useCallback(
    (f: (z: Zgjedhjet) => Zgjedhjet) => {
      if (!reviewId) return;
      const iRi = f(gjendjet.get(reviewId) ?? ZGJEDHJE_BOSH);
      gjendjet.set(reviewId, iRi);
      ruaj(reviewId, iRi);
      njofto();
    },
    [reviewId],
  );

  return { zgjedhjet: z ?? ZGJEDHJE_BOSH, gati: z !== undefined, ndrysho };
}
