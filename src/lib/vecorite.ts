// Veçoritë e rrjedhës kryesore (HARTA.md) dhe gjendja e tyre, për Kreun dhe Stërvitjen.
// Kur një veçori del gati: vendos `href` dhe `gjendja: { lloji: "gati" }`. Ndrysho vetëm rreshtin tënd.
import type { Href } from "expo-router";

export type Gjendja =
  | { lloji: "gati" }
  | { lloji: "ndertim"; kush: "Genti" | "Edoniku" }
  | { lloji: "vjen"; kur: string };

export type Vecoria = {
  celesi: "cv" | "punet" | "gati" | "intervista" | "rezultatet";
  titulli: string;
  pershkrimi: string;
  href: Href | null;
  gjendja: Gjendja;
};

export const VECORITE: Vecoria[] = [
  {
    celesi: "cv",
    titulli: "CV-ja ime",
    pershkrimi: "Ngarko ose ndërto CV-në; AI-ja e analizon",
    href: "/cv", // në ndërtim: hapet vetëm në zhvillim (__DEV__), që ta provojmë në telefon
    gjendja: { lloji: "ndertim", kush: "Edoniku" },
  },
  {
    celesi: "punet",
    titulli: "Punët",
    pershkrimi: "Shpallje nga punëdhënësit; ⭐ i ruan për vete",
    href: "/pune",
    gjendja: { lloji: "gati" },
  },
  {
    celesi: "gati",
    titulli: "A jam gati?",
    pershkrimi: "Sa i përshtatesh një pune dhe çka të mungon",
    href: null,
    gjendja: { lloji: "vjen", kur: "02.12" },
  },
  {
    celesi: "intervista",
    titulli: "Intervista me AI",
    pershkrimi: "Avatari të pyet me zë për atë punë",
    href: null,
    gjendja: { lloji: "ndertim", kush: "Genti" },
  },
  {
    celesi: "rezultatet",
    titulli: "Rezultatet",
    pershkrimi: "Feedback për çdo përgjigje dhe gatishmëria e re",
    href: null,
    gjendja: { lloji: "vjen", kur: "09.12" },
  },
];

// "Ndërto CV-në me AI (pa CV)" del TANI: vendimi i Gentit, 11.11 (HARTA e linte pas Demo Day-t).
// Pas Demo Day-t mbeten: formatet e tjera (Europass, EU, US, UK, ATS), rishkrimi në anglisht dhe
// karta "Ndaje" për rrjetet sociale. Kodi i tyre mbetet; ekranet/butonat s'hapen derisa kjo të bëhet true.
export const CV_PAS_DEMO_DAY_HAPUR = false;
export const TEKSTI_PAS_DEMO_DAY = "Vjen pas Demo Day-t";

export function tekstiIGjendjes(g: Gjendja): string {
  if (g.lloji === "gati") return "Gati";
  if (g.lloji === "ndertim") return `Në ndërtim · ${g.kush}`;
  return `Vjen më ${g.kur}`;
}
