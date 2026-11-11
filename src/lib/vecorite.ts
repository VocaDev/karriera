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
    pershkrimi: "Shpallje nga Supabase; shto edhe vetë",
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

export function tekstiIGjendjes(g: Gjendja): string {
  if (g.lloji === "gati") return "Gati";
  if (g.lloji === "ndertim") return `Në ndërtim · ${g.kush}`;
  return `Vjen më ${g.kur}`;
}
