// Mysafiri (guest mode): kush s'ka hyrë e sheh app-in pa llogari. Punët, praktika pa internet dhe këshillat janë të hapura;
// çka ruan të dhëna personale ose thërret AI-në (CV, "A jam gati?", intervista, ⭐, "Sill linkun", Profili, Përmbledhja)
// kërkon llogari. Prekja e tyre: dridhje + prekje e lehtë, pastaj fleta "Krijo llogari që të …" (src/app/kycja.tsx).
// Ky skedar mban vetëm UI-në; serveri i refuzon vetë thirrjet pa sesion (RLS + _shared/thirresi.ts).
//
// Kthimi: kur mysafiri hap hyrjen, ruhet ku të kthehet pas hyrjes ose regjistrimit (`kthehu`) dhe, opsionalisht, një veprim
// që e kishte nisur (p.sh. ⭐ te një punë). Hyrja e kryen kthimin vetë (hyrja.tsx); rojet te _layout.tsx mbajnë ekranet
// e mëparshme në stack derisa të ndodhë kthimi.
import { useRouter, type Href } from "expo-router";
import { useRef, useSyncExternalStore } from "react";
import { useReducedMotion } from "react-native-reanimated";

import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";

/** Pse kërkohet llogari: një fjali e titullit ("Krijo llogari që të …") dhe një arsye e ndershme. */
export const ARSYET = {
  cv: {
    folja: "ngarkosh CV-në",
    arsyeja: "CV-ja ruhet private në llogarinë tënde dhe e sheh vetëm ti. AI-ja e analizon me një kufi ditor për çdo llogari.",
  },
  gati: {
    folja: "shohësh sa je gati",
    arsyeja: "“A jam gati?” e krahason CV-në tënde me këtë punë. Pa llogari s'kemi CV për ta krahasuar, dhe AI-ja ka kufi ditor për çdo llogari.",
  },
  intervista: {
    folja: "praktikosh intervistën",
    arsyeja: "Intervista me AI ka kufi ditor për çdo llogari, dhe përgjigjet ruhen te llogaria jote që të shohësh si përmirësohesh.",
  },
  ruaj: {
    folja: "ruash punët",
    arsyeja: "Punët me ⭐ ruhen te llogaria jote, që t'i gjesh sërish dhe të shohësh sa je gati për secilën.",
  },
  linku: {
    folja: "shtosh një punë me link",
    arsyeja: "Puna që e shton me link është private: e sheh vetëm ti, prandaj duhet një llogari ku të ruhet.",
  },
  profili: {
    folja: "kesh profilin tënd",
    arsyeja: "Profili mban rolin që synon, gjuhën e intervistës dhe punët që i ke ruajtur.",
  },
  permbledhja: {
    folja: "shohësh përmbledhjen tënde",
    arsyeja: "Përmbledhja tregon rezultatet e tua të fundit. Pa llogari s'ka ende rezultate për t'i treguar.",
  },
} as const;

export type Arsyeja = keyof typeof ARSYET;

export const eshteArsye = (v: unknown): v is Arsyeja => typeof v === "string" && Object.hasOwn(ARSYET, v);

/** Veprimi që mysafiri e nisi dhe që kryhet vetë pas hyrjes (tani: vetëm ⭐ te një punë). */
export type VeprimiPasHyrjes = { lloji: "ruaj"; punaId: string };

export type Kthimi = {
  /** Ku të shkojë pas hyrjes. null = mbrapa te ekrani nga erdhi. */
  kthehu: string | null;
  veprimi: VeprimiPasHyrjes | null;
};

// Vetëm rrugët tona: një `kthehu` nga një link i jashtëm (karriera://hyrja?kthehu=...) s'të çon dot gjetkë.
const RRUGET_E_LEJUARA = /^\/(|pune|pune\/[A-Za-z0-9_-]{1,100}|gati\/[A-Za-z0-9_-]{1,100}|cv|intervista|profili|stervitja|permbledhja|praktika)(\?[A-Za-z0-9=&_-]{0,200})?$/;

/** `kthehu` nga parametrat → rrugë e lejuar, ose null. */
export function kthehuISigurt(v: unknown): string | null {
  return typeof v === "string" && RRUGET_E_LEJUARA.test(v) ? v : null;
}

const VEPRIMI_RUAJ = /^ruaj:([A-Za-z0-9_-]{1,100})$/;

/** "ruaj:<id>" nga parametrat → veprimi, ose null. */
export function veprimiNgaParametri(v: unknown): VeprimiPasHyrjes | null {
  const m = typeof v === "string" ? VEPRIMI_RUAJ.exec(v) : null;
  return m ? { lloji: "ruaj", punaId: m[1] } : null;
}

export function veprimiSiParameter(v: VeprimiPasHyrjes | null): string | undefined {
  return v ? `${v.lloji}:${v.punaId}` : undefined;
}

let kthimi: Kthimi | null = null;
const degjuesit = new Set<() => void>();

/** Thirret nga hyrja kur e hap një mysafir. */
export function filloKthimin(k: Kthimi): void {
  kthimi = k;
  degjuesit.forEach((d) => d());
}

/** Thirret kur mbyllet hyrja (me ose pa hyrje): kthimi s'vlen më. */
export function pastroKthimin(): void {
  if (kthimi === null) return;
  kthimi = null;
  degjuesit.forEach((d) => d());
}

export function useKthimi(): Kthimi | null {
  return useSyncExternalStore(
    (d) => {
      degjuesit.add(d);
      return () => {
        degjuesit.delete(d);
      };
    },
    () => kthimi,
    () => null,
  );
}

type HapjaEHyrjes = { menyra?: "hyr" | "regjistrohu"; kthehu?: string | null; veprimi?: VeprimiPasHyrjes | null };

/** Rruga e hyrjes me parametrat e kthimit. */
export function rrugaEHyrjes({ menyra = "hyr", kthehu = null, veprimi = null }: HapjaEHyrjes = {}): Href {
  const params: Record<string, string> = { menyra };
  if (kthehu) params.kthehu = kthehu;
  const v = veprimiSiParameter(veprimi);
  if (v) params.veprimi = v;
  return { pathname: "/hyrja", params } as Href;
}

/**
 * Modeli i veçorisë së kyçur (AGENTS.md, "Motion and feedback"): prekja e lehtë + dridhja e shkurtër,
 * pastaj fleta që e thotë pse. `stili` vendoset te Animated.View që mbështjell butonin.
 */
export function useKycja() {
  const router = useRouter();
  const qetesi = useReducedMotion();
  const { stili, dridhu } = useDridhja();
  const pritja = useRef<ReturnType<typeof setTimeout> | null>(null);

  function kyc(arsyeja: Arsyeja, kthehu: string | null = null, veprimi: VeprimiPasHyrjes | null = null) {
    prekja.lehte();
    dridhu();
    if (pritja.current) clearTimeout(pritja.current);
    const params: Record<string, string> = { arsyeja };
    if (kthehu) params.kthehu = kthehu;
    const v = veprimiSiParameter(veprimi);
    if (v) params.veprimi = v;
    // Fleta hapet pasi dridhja mbaron (~240 ms), që të shihet se cili buton u prek.
    pritja.current = setTimeout(
      () => {
        pritja.current = null;
        router.push({ pathname: "/kycja", params } as Href);
      },
      qetesi ? 0 : 200,
    );
  }

  return { stili, kyc };
}
