// Pastrimi i analizës së AI-së para se të ruhet (pa importe: provohet edhe me Node, pa Deno).
//
// 1. Sugjerimet marrin id nga serveri (s1, s2, …), jo nga AI-ja, dhe placeholder-at llogariten nga `pas`.
// 2. `rishkrimet` (forma e vjetër {para, pas}) nxirren nga sugjerimet, që app-i i vjetër të punojë ende.
// 3. Teksti shqip që shkruan AI-ja kalon një kontroll të vogël: shkronja të dyfishta në fillim të fjalës
//    ("ppak" → "pak") dhe fjalë të njohura pa "ë" ("i sakte" → "i saktë"). Përmbajtja e CV-së (para/pas,
//    cv) s'preket kurrë: mund të jetë në anglisht dhe është teksti i kandidatit.

export type LlojiSugjerimit = "rishkrim" | "gabim" | "shto" | "hiq";

export type SugjerimiNgaAI = {
  lloji: LlojiSugjerimit;
  seksioni: string;
  indeksi: number | null;
  fusha: string | null;
  para: string;
  pas: string;
  arsyeja: string;
  placeholders: string[];
};

export type Sugjerimi = SugjerimiNgaAI & { id: string };

export const MAKS_SUGJERIME = 30;

// E njëjta shprehje si te src/lib/rindertimi.ts: "[çka duhet plotësuar]", pa kllapa brenda, 1–80 shkronja.
const PLACEHOLDER = /\[[^[\]\n]{1,80}\]/g;

export function gjejPlaceholderat(teksti: string): string[] {
  return [...new Set(teksti.match(PLACEHOLDER) ?? [])];
}

export function normalizoSugjerimet(lista: SugjerimiNgaAI[]): Sugjerimi[] {
  const dalja: Sugjerimi[] = [];
  const pare = new Set<string>();

  for (const s of lista) {
    const para = s.para.trim();
    const pas = s.pas.trim();
    if (s.lloji !== "hiq" && !pas) continue; // s'ka çka të shtohet
    if ((s.lloji === "gabim" || s.lloji === "hiq") && !para) continue; // s'dihet çka ndryshon
    if (para && para === pas) continue;

    const celesi = `${s.lloji}|${s.seksioni}|${s.indeksi}|${s.fusha}|${para}|${pas}`;
    if (pare.has(celesi)) continue; // i njëjti ndryshim dy herë
    pare.add(celesi);

    dalja.push({
      id: `s${dalja.length + 1}`,
      lloji: s.lloji,
      seksioni: s.seksioni,
      indeksi: typeof s.indeksi === "number" && Number.isInteger(s.indeksi) && s.indeksi >= 0 ? s.indeksi : null,
      fusha: s.fusha,
      para,
      pas,
      arsyeja: s.arsyeja.trim(),
      placeholders: gjejPlaceholderat(pas),
    });
    if (dalja.length >= MAKS_SUGJERIME) break;
  }
  return dalja;
}

/** Forma e vjetër e rishkrimeve, për app-in para këtij ndryshimi. */
export function rishkrimetNga(sugjerimet: Sugjerimi[]): { para: string; pas: string }[] {
  return sugjerimet
    .filter((s) => s.lloji === "rishkrim" && s.para)
    .slice(0, 8)
    .map((s) => ({ para: s.para, pas: s.pas }));
}

// ---------- Kontrolli i shqipes së AI-së ----------

const PA_SHKRONJE_PARA = "(?<!\\p{L})";
const PA_SHKRONJE_PAS = "(?!\\p{L})";

// Fjalë të plota pa "ë"/"ç" që AI-ja i shkruan herë pas here. Vetëm fjalë që s'kanë kuptim tjetër në shqip.
const FJALET: [string, string][] = [
  ["eshte", "është"],
  ["nje", "një"],
  ["sakte", "saktë"],
  ["permiresim", "përmirësim"],
  ["permiresime", "përmirësime"],
  ["permiresoje", "përmirësoje"],
  ["permireso", "përmirëso"],
  ["pershkrim", "përshkrim"],
  ["pershkrimi", "përshkrimi"],
  ["pervoje", "përvojë"],
  ["pervoja", "përvoja"],
  ["pervojen", "përvojën"],
  ["aftesi", "aftësi"],
  ["aftesite", "aftësitë"],
  ["teper", "tepër"],
  ["shume", "shumë"],
  ["gjate", "gjatë"],
  ["qarte", "qartë"],
  ["mire", "mirë"],
  ["vetem", "vetëm"],
  ["ketu", "këtu"],
  ["kete", "këtë"],
  ["dhene", "dhënë"],
  ["dhenat", "dhënat"],
];

const RREGULLAT: [RegExp, (m: string) => string][] = [
  // Shkronjë bashkëtingëllore e dyfishtë në fillim të fjalës, para zanores: "ppak" → "pak".
  // (ll, rr, dh, gj, nj, sh, th, xh, zh janë shkronja shqipe dhe s'preken; "ssh", "pptx" s'preken.)
  [new RegExp(`${PA_SHKRONJE_PARA}([bcdfgjkmnpqstvxz])\\1(?=[aeiouyë])`, "gu"), (m) => m[0]],
  ...FJALET.flatMap(([gabim, sakte]): [RegExp, (m: string) => string][] => [
    [new RegExp(`${PA_SHKRONJE_PARA}${gabim}${PA_SHKRONJE_PAS}`, "gu"), () => sakte],
    [
      new RegExp(`${PA_SHKRONJE_PARA}${gabim[0].toUpperCase()}${gabim.slice(1)}${PA_SHKRONJE_PAS}`, "gu"),
      () => sakte[0].toUpperCase() + sakte.slice(1),
    ],
  ]),
];

/** Rregullon gabimet e njohura në tekstin shqip të AI-së. Kthen tekstin dhe sa ndryshime u bënë. */
export function rregulloShqipen(teksti: string): { teksti: string; ndryshime: number } {
  let ndryshime = 0;
  let dalja = teksti;
  for (const [shprehja, zevendeso] of RREGULLAT) {
    dalja = dalja.replace(shprehja, (m) => {
      ndryshime += 1;
      return zevendeso(m);
    });
  }
  return { teksti: dalja, ndryshime };
}
