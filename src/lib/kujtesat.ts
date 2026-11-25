// Njoftimet e telefonit (J10): vetëm lokale, të planifikuara në telefon, kështu që punojnë edhe në Expo Go.
//   - "Praktiko sot": një kujtesë në ditë, në orën që zgjedh te Cilësimet. E fikur si parazgjedhje.
//   - "Punë të reja për rolin tënd": kur app-i mëson se ka punë të reja për rolin tënd që nga vizita e fundit te Punët,
//     një njoftim pak pasi e lë app-in. E fikur si parazgjedhje.
// Leja kërkohet vetëm kur ndez njërën prej tyre. Prekja e njoftimit hap Punët ose nisjen e intervistës.
// Push nga serveri (njoftime kur app-i s'është hapur fare) kërkon development build: src/lib/push.ts, docs/njoftimet.md.
// Zgjedhjet ruhen vetëm në këtë telefon; kur del nga llogaria, të gjitha fiken.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

import type { RoliSynuar } from "@/lib/hyrja";
import { degjoPunetERe, numroPunetERe } from "@/lib/punet";

/** Njoftimet lokale janë vetëm në telefon (iOS dhe Android); në web s'ka asgjë për të planifikuar. */
export const MBESHTETEN_NJOFTIMET = Platform.OS === "ios" || Platform.OS === "android";

const KANALI = "kujtesat"; // Android 8+: çdo njoftim i përket një kanali; përdoruesi e fik veç te cilësimet e telefonit
const ID_DITORE = "praktiko-sot";
const ID_PUNET = "punet-e-reja";
const CELESI = "karriera.kujtesat";
const CELESI_VIZITA = "karriera.punet.vizita"; // ISO: herën e fundit që e hape listën e Punëve
const CELESI_NJOFTUAR = "karriera.punet.njoftuar"; // ISO: herën e fundit që të njoftuam për punë të reja
// Sa pasi e lë app-in del njoftimi për punët e reja. Nëse kthehesh para kësaj, anulohet (e sheh vetë te Punët).
export const VONESA_E_PUNEVE_TE_REJA_S = 120;

/** Rrugët që mund t'i hapë një njoftim: vetëm këto, asgjë nga jashtë. */
const RRUGET = { pune: "/pune", intervista: "/intervista" } as const satisfies Record<string, Href>;
type Rruga = (typeof RRUGET)[keyof typeof RRUGET];

if (MBESHTETEN_NJOFTIMET) {
  // Edhe kur app-i është i hapur, njoftimi del lart (kujtesa ditore mund të vijë ndërsa je brenda).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// ---------- Zgjedhjet (vetëm në telefon) ----------

export type CilesimetEKujtesave = { ditore: boolean; ora: number; minuta: number; punetERe: boolean };
const FILLESTARE: CilesimetEKujtesave = { ditore: false, ora: 18, minuta: 0, punetERe: false };

let cilesimet: CilesimetEKujtesave = FILLESTARE;
let lexuar = false;
let dukeLexuar = false;
const degjuesit = new Set<() => void>();

function lexoNgaTeksti(v: string | null): CilesimetEKujtesave {
  try {
    const o: unknown = JSON.parse(v ?? "null");
    if (!o || typeof o !== "object") return FILLESTARE;
    const r = o as Record<string, unknown>;
    const ora = typeof r.ora === "number" && r.ora >= 0 && r.ora <= 23 ? Math.floor(r.ora) : FILLESTARE.ora;
    const minuta = typeof r.minuta === "number" && r.minuta >= 0 && r.minuta <= 59 ? Math.floor(r.minuta) : FILLESTARE.minuta;
    return { ditore: r.ditore === true, ora, minuta, punetERe: r.punetERe === true };
  } catch {
    return FILLESTARE;
  }
}

async function lexo() {
  if (lexuar || dukeLexuar) return;
  dukeLexuar = true;
  try {
    const v = lexoNgaTeksti(await AsyncStorage.getItem(CELESI));
    if (!lexuar) cilesimet = v;
  } catch {
    // E palexueshme: të fikura (parazgjedhja).
  }
  dukeLexuar = false;
  lexuar = true;
  for (const d of degjuesit) d();
}

function ruaj(ndryshimi: Partial<CilesimetEKujtesave>) {
  cilesimet = { ...cilesimet, ...ndryshimi };
  lexuar = true;
  for (const d of degjuesit) d();
  AsyncStorage.setItem(CELESI, JSON.stringify(cilesimet)).catch(() => {
    // Ruajtja dështoi: vlen derisa të mbyllet app-i (njoftimi i planifikuar mbetet te sistemi).
  });
}

const merr = () => cilesimet;
const abonohu = (d: () => void) => {
  degjuesit.add(d);
  return () => {
    degjuesit.delete(d);
  };
};

export function useCilesimetEKujtesave(): CilesimetEKujtesave {
  const c = useSyncExternalStore(abonohu, merr, merr);
  useEffect(() => {
    lexo();
  }, []);
  return c;
}

// ---------- Leja ----------

async function krijoKanalin() {
  if (Platform.OS !== "android") return;
  // Android 13+: dritarja e lejes s'del pa të paktën një kanal.
  await Notifications.setNotificationChannelAsync(KANALI, {
    name: "Kujtesat dhe punët e reja",
    description: "Praktiko sot dhe punë të reja për rolin tënd",
    importance: AndroidImportance.DEFAULT,
  });
}

export type LejaENjoftimeve = "dhene" | "refuzuar" | "gabim";

/** Pyet sistemin vetëm nëse leja s'është dhënë ende. "refuzuar" = vetëm cilësimet e telefonit e ndryshojnë. */
export async function kerkoLejen(): Promise<LejaENjoftimeve> {
  if (!MBESHTETEN_NJOFTIMET) return "gabim";
  try {
    await krijoKanalin();
    const tani = await Notifications.getPermissionsAsync();
    if (tani.granted) return "dhene";
    if (!tani.canAskAgain) return "refuzuar";
    const pergjigja = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return pergjigja.granted ? "dhene" : "refuzuar";
  } catch {
    return "gabim";
  }
}

/** A është dhënë leja tani (pa pyetur). Për shënimin "të fikura te telefoni" te Cilësimet. */
export async function lejaEshteDhene(): Promise<boolean> {
  if (!MBESHTETEN_NJOFTIMET) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

function anulo(id: string) {
  return Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

// ---------- "Praktiko sot" ----------

async function planifikoDitoren(ora: number, minuta: number) {
  await anulo(ID_DITORE);
  await Notifications.scheduleNotificationAsync({
    identifier: ID_DITORE,
    content: {
      title: "Praktiko sot",
      body: "Një intervistë e shkurtër praktike sot të afron te puna që do.",
      data: { rruga: RRUGET.intervista },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: ora, minute: minuta, channelId: KANALI },
  });
}

/** Ndez kujtesën ditore. Kthen leja; vetëm me "dhene" ruhet si e ndezur. */
export async function ndizKujtesenDitore(): Promise<LejaENjoftimeve> {
  const leja = await kerkoLejen();
  if (leja !== "dhene") return leja;
  try {
    await planifikoDitoren(cilesimet.ora, cilesimet.minuta);
    ruaj({ ditore: true });
    return "dhene";
  } catch {
    return "gabim";
  }
}

export async function fikKujtesenDitore() {
  ruaj({ ditore: false });
  if (MBESHTETEN_NJOFTIMET) await anulo(ID_DITORE);
}

/** Ndryshon orën; nëse kujtesa është e ndezur, planifikohet sërish për orën e re. */
export async function ndryshoOrenEKujteses(ora: number, minuta: number): Promise<boolean> {
  ruaj({ ora, minuta });
  if (!cilesimet.ditore || !MBESHTETEN_NJOFTIMET) return true;
  try {
    await planifikoDitoren(ora, minuta);
    return true;
  } catch {
    return false;
  }
}

// ---------- "Punë të reja për rolin tënd" ----------

export async function ndizPunetERe(): Promise<LejaENjoftimeve> {
  const leja = await kerkoLejen();
  if (leja !== "dhene") return leja;
  // Numërimi nis nga tani: s'të njoftojmë për punë që i kishe pasur para se ta ndizje.
  await AsyncStorage.setItem(CELESI_NJOFTUAR, new Date().toISOString()).catch(() => {});
  ruaj({ punetERe: true });
  return "dhene";
}

export async function fikPunetERe() {
  ruaj({ punetERe: false });
  if (MBESHTETEN_NJOFTIMET) await anulo(ID_PUNET);
}

/** Dalja nga llogaria: kujtesat i takojnë llogarisë, prandaj fiken dhe anulohen në telefon. */
export async function fikTeGjitha() {
  await lexo();
  if (cilesimet.ditore || cilesimet.punetERe) ruaj({ ditore: false, punetERe: false });
  if (MBESHTETEN_NJOFTIMET) await Promise.all([anulo(ID_DITORE), anulo(ID_PUNET)]);
}

const sot = () => new Date().toISOString();

/**
 * Për tab-at e kërkuesit. Mëson sa punë të reja për rolin tënd ka që nga vizita e fundit te Punët: nga serveri kur
 * app-i vjen në plan të parë, dhe nga Realtime ndërsa është hapur. Kur e lë app-in (background) dhe numri > 0,
 * planifikon një njoftim pas VONESA_E_PUNEVE_TE_REJA_S; kur kthehesh para kësaj, anulohet. Hapja e Punëve e zeron.
 * Pa leje (ose leja u hoq te telefoni) s'planifikon asgjë dhe s'pyet: leja kërkohet vetëm te Cilësimet.
 */
export function useNjoftimiIPuneveTeReja({ aktiv, roli, neListe }: { aktiv: boolean; roli: RoliSynuar | null; neListe: boolean }) {
  const { punetERe } = useCilesimetEKujtesave();
  const ndezur = MBESHTETEN_NJOFTIMET && aktiv && punetERe && roli !== null;
  const numri = useRef(0);
  const neListeRef = useRef(neListe);

  // Hape listën: i ke parë. Numri zerohet dhe njoftimi që priste anulohet.
  useEffect(() => {
    neListeRef.current = neListe;
    if (!ndezur || !neListe) return;
    numri.current = 0;
    AsyncStorage.setItem(CELESI_VIZITA, sot()).catch(() => {});
    anulo(ID_PUNET);
  }, [neListe, ndezur]);

  useEffect(() => {
    if (!ndezur || roli === null) return;
    const roliIm = roli;
    let aktivi = true;

    async function numero() {
      anulo(ID_PUNET); // u ktheve: e sheh vetë shenjën te Punët
      if (neListeRef.current) return;
      try {
        const [vizita, njoftuar] = await Promise.all([
          AsyncStorage.getItem(CELESI_VIZITA),
          AsyncStorage.getItem(CELESI_NJOFTUAR),
        ]);
        const pas = [vizita, njoftuar].filter((v): v is string => v !== null).sort().at(-1);
        if (!pas) {
          await AsyncStorage.setItem(CELESI_VIZITA, sot());
          return;
        }
        const n = await numroPunetERe(roliIm, pas);
        if (aktivi) numri.current = n;
      } catch {
        // Pa internet ose gabim: numri mbetet ai që erdhi nga Realtime.
      }
    }

    async function neSfond() {
      const n = numri.current;
      if (n === 0 || neListeRef.current) return;
      try {
        if (!(await Notifications.getPermissionsAsync()).granted) return;
        await Notifications.scheduleNotificationAsync({
          identifier: ID_PUNET,
          content: {
            title: n === 1 ? "Një punë e re për rolin tënd" : `${n} punë të reja për rolin tënd`,
            body: "Shiko sa je gati para se të aplikosh.",
            data: { rruga: RRUGET.pune },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: VONESA_E_PUNEVE_TE_REJA_S,
            channelId: KANALI,
          },
        });
        numri.current = 0;
        await AsyncStorage.setItem(CELESI_NJOFTUAR, sot());
      } catch {
        // S'u planifikua: provohet herën tjetër që e lë app-in.
      }
    }

    numero();
    const gjendja = AppState.addEventListener("change", (g) => {
      if (g === "active") numero();
      else if (g === "background") neSfond();
    });
    const hiqRealtime = degjoPunetERe("njoftimi-per-rolin", (puna) => {
      if (puna.roli === roliIm && !puna.private && !neListeRef.current) numri.current += 1;
    });
    return () => {
      aktivi = false;
      gjendja.remove();
      hiqRealtime();
    };
  }, [ndezur, roli]);
}

// ---------- Prekja e njoftimit ----------

function rrugaNgaTeDhenat(data: unknown): Rruga | null {
  if (!data || typeof data !== "object") return null;
  const r = (data as Record<string, unknown>).rruga;
  return Object.values(RRUGET).find((x) => x === r) ?? null;
}

function useHapjaNgaNjoftimiNative(gati: boolean) {
  const router = useRouter();
  const pergjigja = Notifications.useLastNotificationResponse();
  const eTrajtuara = useRef(new Set<string>());

  useEffect(() => {
    if (!gati || !pergjigja) return;
    if (pergjigja.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const n = pergjigja.notification;
    const celesi = `${n.request.identifier}:${n.date}`;
    if (eTrajtuara.current.has(celesi)) return;
    eTrajtuara.current.add(celesi);
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
    const rruga = rrugaNgaTeDhenat(n.request.content.data);
    // Rojet te _layout.tsx vendosin nëse ekrani hapet (p.sh. intervista kërkon llogari).
    if (rruga) router.navigate(rruga);
  }, [gati, pergjigja, router]);
}

/** Prekja e një njoftimi hap ekranin e vet (Punët ose nisjen e intervistës), edhe kur app-i hapet nga njoftimi. */
export const useHapjaNgaNjoftimi: (gati: boolean) => void = MBESHTETEN_NJOFTIMET ? useHapjaNgaNjoftimiNative : () => {};
