// Kush të interviston (Arta ose Arbër): zgjedhja e fundit dhe intervistuesi i çdo interviste, vetëm në këtë telefon.
//
// Serveri e ruan zgjedhjen te intervistat.konteksti, por app-i s'e lexon dot atë kolonë (lejet e kolonave). Prandaj:
//   - "zgjedhja e fundit" kujtohet këtu dhe parazgjidhet herës tjetër (ekrani i nisjes dhe Cilësimet);
//   - kur nis një intervistë, id-ja e saj ruhet këtu me intervistuesin që ktheu serveri, që chat-i të tregojë emrin e
//     duhur edhe kur intervista hapet më vonë; raporti e mban vetë emrin (raporti.intervistuesi).
// Intervistat pa shënim këtu (të vjetra, ose pas pastrimit të të dhënave të app-it) shfaqen me "Arta".
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { eshteIntervistues, INTERVISTUESI_FILLESTAR, type Intervistuesi } from "./tipet";

const CELESI_I_FUNDIT = "karriera.intervista.intervistuesi";
const PREFIKSI_ID = "karriera.intervista.intervistuesi.";

let zgjedhur: Intervistuesi = INTERVISTUESI_FILLESTAR;
let lexuar = false;
let dukeLexuar = false;
let ndryshuarPaLexuar = false; // përdoruesi zgjodhi para se të mbaronte leximi: zgjedhja e tij fiton
const degjuesit = new Set<() => void>();

function njofto() {
  for (const d of degjuesit) d();
}

async function lexo() {
  if (lexuar || dukeLexuar) return;
  dukeLexuar = true;
  try {
    const v = await AsyncStorage.getItem(CELESI_I_FUNDIT);
    if (!ndryshuarPaLexuar && eshteIntervistues(v)) zgjedhur = v;
  } catch {
    // E palexueshme: mbetet "Arta" (s'humbet asgjë, është vetëm parazgjedhje).
  }
  dukeLexuar = false;
  lexuar = true;
  njofto();
}

const merr = () => zgjedhur;
const abonohu = (d: () => void) => {
  degjuesit.add(d);
  return () => {
    degjuesit.delete(d);
  };
};

/** Zgjedhja e fundit e kandidatit (parazgjedhja e ekranit të nisjes). Ndahet mes ekraneve që e përdorin. */
export function useIntervistuesiIZgjedhur() {
  const intervistuesi = useSyncExternalStore(abonohu, merr, merr);
  useEffect(() => {
    lexo();
  }, []);
  const zgjidh = useCallback((i: Intervistuesi) => {
    zgjedhur = i;
    ndryshuarPaLexuar = true;
    njofto();
    AsyncStorage.setItem(CELESI_I_FUNDIT, i).catch(() => {
      // Ruajtja dështoi: vlen derisa të mbyllet app-i.
    });
  }, []);
  return { intervistuesi, zgjidh };
}

/** Ruan intervistuesin e një interviste (thirret kur serveri e nis ose e rifillon). Dështimi s'e prish intervistën. */
export async function ruajIntervistuesinPer(intervistaId: string, i: Intervistuesi): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIKSI_ID + intervistaId, i);
  } catch {
    // Chat-i do të tregojë "Arta" nëse s'u ruajt; intervista vetë s'preket.
  }
}

/** Intervistuesi i ruajtur për këtë intervistë, ose null nëse s'ka shënim. */
export async function lexoIntervistuesinPer(intervistaId: string): Promise<Intervistuesi | null> {
  try {
    const v = await AsyncStorage.getItem(PREFIKSI_ID + intervistaId);
    return eshteIntervistues(v) ? v : null;
  } catch {
    return null;
  }
}
