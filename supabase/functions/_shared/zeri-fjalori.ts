// Fjalori për Whisper (STT): emrat e teknologjive dhe të punës që kandidati ka gjasa t'i thotë, si "prompt" i kërkesës.
// Pa të, një fjalë angleze mes shqipes dëgjohet gabim ("Playwright that used Claude" → "... Club", testi i Gentit 25.11).
//
// Burimet, sipas rëndësisë: puna (titulli, kompania, aftësitë dhe kërkesat e shpalljes), CV-ja (rreshti i aftësive dhe emrat
// teknikë te përvoja e projektet) dhe një listë e shkurtër e emrave të zakonshëm. Whisper-i merr vetëm 224 tokenat E FUNDIT
// të prompt-it, ndaj emrat më të rëndësishëm shkojnë në fund dhe gjithçka kufizohet në shenja.
import type { Konteksti } from "./intervista-ai.ts";

export const MAKS_SHENJA_PROMPTI = 520;
const MAKS_GJATESIA_FJALES = 40;

/** Emrat e zakonshëm teknikë që Whisper i ngatërron më shpesh në shqip. */
export const FJALE_TE_ZAKONSHME = [
  "Claude", "Playwright", "ChatGPT", "React", "React Native", "Expo", "TypeScript", "JavaScript", "Node.js", "Next.js",
  "Supabase", "PostgreSQL", "SQL", "Python", "Java", "C#", ".NET", "PHP", "Git", "GitHub", "Docker", "API", "REST",
  "HTML", "CSS", "Tailwind", "Firebase", "AWS", "Figma", "Excel", "CI/CD",
];

/** Fjalë që duken si emra teknikë: me shkronjë të madhe në mes, pikë, shifër, "#" ose "+" (TypeScript, Node.js, C#, SQL). */
const EMER_TEKNIK =
  /(?<![\p{L}\p{N}])(?:\.[A-Z][\w+#]*|[A-Za-z]+[A-Z0-9+#][\w+#]*(?:[./-][\w+#]+)*|[A-Z][a-z]+(?:\.[a-z]{2,})+|[A-Z]{2,}(?:\/[A-Z]{2,})?|C#|C\+\+)(?![\p{L}\p{N}])/gu;

export function emratTekniko(teksti: string): string[] {
  return teksti.match(EMER_TEKNIK) ?? [];
}

const pastro = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s\-–•*:;,.]+|[\s:;,.]+$/g, "").trim();

/** Rreshti "Aftësitë: a, b, c" i CV-së së krijuar (cvNgaPermbajtja te intervista-nis). */
function aftesiteNgaCv(cv: string): string[] {
  const m = /^Aftësitë:\s*(.+)$/m.exec(cv);
  return m ? m[1].split(",") : [];
}

/** Nga kërkesat e shpalljes (fjali shqipe): artikujt e shkurtër si janë, dhe emrat teknikë brenda atyre të gjata. */
function ngaKerkesat(kerkesat: unknown): string[] {
  if (typeof kerkesat !== "object" || kerkesat === null) return [];
  const o = kerkesat as Record<string, unknown>;
  const rreshtat = [o.kerkesat, o.perparesi, o.detyrat]
    .flatMap((v) => (Array.isArray(v) ? v : []))
    .filter((v): v is string => typeof v === "string");
  return rreshtat.flatMap((r) => (r.trim().split(/\s+/).length <= 3 ? [r] : emratTekniko(r)));
}

/** Frazat shqipe ("punë në ekip") s'janë emra që Whisper-i i ngatërron; vetëm sa e shtyjnë drejt shqipes. */
const ESHTE_FRAZE_SHQIPE = /[ëç]/i;

/**
 * Prompt-i i Whisper-it për një intervistë: VETËM një listë fjalësh, pa asnjë fjali hyrëse. Prova me thirrje të vërteta
 * (25.11, _provat/zeri-fjalori.ts): një fjali shqipe në krye e bënte large-v3 ta "shqipëronte" anglishten (2/5 emra kundër
 * 3,5/5 me listë të thjeshtë); mbi shqip të vërtetë lista s'e ndryshon transkriptin. Pa dyfishime, e kufizuar në shenja.
 */
export function ndertoPromptinSTT(opts: { konteksti: Konteksti; kerkesat?: unknown }): string {
  const { puna, cv } = opts.konteksti;
  // Rendi i rëndësisë: e para fitohet kur s'ka vend për të gjitha.
  const sipasRendesise = [
    puna.titulli,
    puna.kompania,
    ...puna.aftesite,
    ...(cv ? aftesiteNgaCv(cv) : []),
    ...ngaKerkesat(opts.kerkesat),
    ...(cv ? emratTekniko(cv) : []),
    ...emratTekniko(puna.pershkrimi),
    ...FJALE_TE_ZAKONSHME,
  ]
    .map(pastro)
    .filter((f) => f.length >= 2 && f.length <= MAKS_GJATESIA_FJALES && !ESHTE_FRAZE_SHQIPE.test(f));

  const teZgjedhura: string[] = [];
  const parë = new Set<string>();
  let gjatesia = 0;
  for (const f of sipasRendesise) {
    const k = f.toLowerCase();
    if (parë.has(k)) continue;
    if (gjatesia + f.length + 2 > MAKS_SHENJA_PROMPTI) continue;
    parë.add(k);
    teZgjedhura.push(f);
    gjatesia += f.length + 2;
  }
  // Më të rëndësishmet në fund (Whisper-i mban tokenat e fundit).
  return `${teZgjedhura.reverse().join(", ")}.`;
}

const normalizo = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Mbi heshtje Whisper-i ndonjëherë e përsërit prompt-in. Një transkript që është thjesht copë e tij = s'u dëgjua gjë. */
export function eshteJehonaEPromptit(transkripti: string, prompti: string): boolean {
  const t = normalizo(transkripti);
  return t.length >= 25 && normalizo(prompti).includes(t);
}
