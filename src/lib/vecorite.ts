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
    href: "/cv",
    gjendja: { lloji: "gati" },
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
    pershkrimi: "Zgjidh një punë dhe shih sa i përshtatesh",
    href: "/pune",
    gjendja: { lloji: "gati" },
  },
  {
    celesi: "intervista",
    titulli: "Intervista me AI",
    pershkrimi: "AI-ja të pyet për punën që zgjedh; me tekst tani, me zë së shpejti",
    href: "/intervista",
    gjendja: { lloji: "gati" },
  },
  {
    celesi: "rezultatet",
    titulli: "Rezultatet",
    pershkrimi: "Shiko notën dhe feedback-un e intervistës së fundit",
    href: "/intervista/rezultatet",
    gjendja: { lloji: "gati" },
  },
];

// "Ndërto CV-në me AI (pa CV)" del TANI: vendimi i Gentit, 11.11 (HARTA e linte pas Demo Day-t).
// Pas Demo Day-t mbeten: formatet e tjera (Europass, EU, US, UK, ATS), rishkrimi në anglisht dhe
// karta "Ndaje" për rrjetet sociale. Kodi i tyre mbetet; ekranet/butonat s'hapen derisa kjo të bëhet true.
export const CV_PAS_DEMO_DAY_HAPUR = false;
export const TEKSTI_PAS_DEMO_DAY = "Vjen pas Demo Day-t";

// Push nga serveri (J10): kërkon development build, tabelën push_tokenat dhe një sender (docs/njoftimet.md).
// Deri atëherë false: njoftimet janë vetëm lokale (src/lib/kujtesat.ts) dhe punojnë edhe në Expo Go.
export const PUSH_NGA_SERVERI = false;

export function tekstiIGjendjes(g: Gjendja): string {
  if (g.lloji === "gati") return "Gati";
  if (g.lloji === "ndertim") return `Në ndërtim · ${g.kush}`;
  return `Vjen më ${g.kur}`;
}
