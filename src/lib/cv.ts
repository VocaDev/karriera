// KONTRATA E CV-SË · pronar: Genti (databaza, Storage, thirrjet e funksioneve).
// Edoniku: ekranet e CV-së thërrasin VETËM këto funksione. Mos e ndrysho këtë fajll;
// nëse të duhet diçka tjetër, kërkoje te Genti.
// Tani funksionet kthejnë të dhëna të rreme (MOCK). Genti i zëvendëson me Supabase
// pa i ndryshuar emrat apo tipet, kështu që ekranet nuk ndryshojnë.

// ---------- Tipet ----------

/** Rezultati i Edge Function `cv-review` (AI-ja e lexon PDF-në). */
export type AnalizaCV = {
  nota: number; // 0–100
  permbledhja: string; // 1 fjali, p.sh. "2 gjëra e ngrenë mbi 75"
  seksionet: {
    emri: string; // "Profili", "Përvoja", "Projektet", "Formati", "Aftësitë", "Arsimi"
    gjendja: "mire" | "permiresim";
    komenti: string; // këshillë e qartë, konkrete
    roast: string; // e njëjta pikë me humor, e ashpër por e drejtë, pa ofendime personale
  }[];
  rishkrimet: { para: string; pas: string }[]; // rreshta nga CV-ja, të rishkruar me rezultate
  pikat_e_forta: string[];
  fjalia_roast: string; // një fjali për kartën "Ndaje", pa emër dhe pa të dhëna personale
};

export type FormatiCV = "ks" | "europass" | "eu" | "us" | "uk" | "ats";
export type GjuhaCV = "sq" | "en";

/** CV-ja si të dhëna (rezultati i `cv-create`), që app-i e vizaton në çdo format. */
export type CvStrukturuar = {
  emri: string;
  titulli: string; // p.sh. "Student i Inxhinierisë Kompjuterike"
  qyteti: string;
  email: string;
  telefoni: string | null;
  datelindja: string | null; // vetëm për ks / europass / eu; null për us / uk / ats
  profili: string;
  arsimi: { programi: string; institucioni: string; periudha: string }[];
  pervoja: { roli: string; vendi: string; periudha: string; pershkrimi: string; nga_ai: boolean }[];
  projektet: { titulli: string; pershkrimi: string; linku: string | null; nga_ai: boolean }[];
  aftesite: string[];
  gjuhet: { gjuha: string; niveli: string }[]; // niveli në CEFR (A1–C2) ose "amtare"
};

/** Një CV e ruajtur (e ngarkuar ose e krijuar). */
export type CvRresht = {
  id: string;
  burimi: "ngarkuar" | "krijuar";
  emri_skedarit: string | null; // për CV-të e ngarkuara
  versioni: number; // v1, v2, …
  nota: number | null; // nota e analizës së fundit, nëse ka
  krijuar_me: string; // ISO
};

/** Skedari që kthen expo-document-picker (vetëm fushat që na duhen). */
export type SkedariPDF = { uri: string; name: string; size: number | null; mimeType: string | null };

// ---------- Funksionet ----------

const prit = (ms: number) => new Promise((r) => setTimeout(r, ms));
let versionet: CvRresht[] = [];

/** Ruan PDF-në në Storage (privat) dhe krijon rreshtin. Hedh Error me mesazh në shqip nëse dështon. */
export async function ngarkoCV(skedari: SkedariPDF): Promise<CvRresht> {
  if (skedari.size !== null && skedari.size > 5 * 1024 * 1024) {
    throw new Error("CV-ja duhet të jetë deri në 5 MB.");
  }
  await prit(600); // MOCK
  const cv: CvRresht = {
    id: `mock-${versionet.length + 1}`,
    burimi: "ngarkuar",
    emri_skedarit: skedari.name,
    versioni: versionet.length + 1,
    nota: null,
    krijuar_me: new Date().toISOString(),
  };
  versionet = [cv, ...versionet];
  return cv;
}

/** Thërret `cv-review` me PDF-në dhe e ruan analizën. Zgjat 10–20 sekonda në realitet. */
export async function analizoCV(cvId: string): Promise<AnalizaCV> {
  await prit(2500); // MOCK
  versionet = versionet.map((v) => (v.id === cvId ? { ...v, nota: SHEMBULL_ANALIZE.nota } : v));
  return SHEMBULL_ANALIZE;
}

/** Analiza e fundit e përdoruesit, ose null nëse s'ka ende. */
export async function analizaEFundit(): Promise<{ cv: CvRresht; analiza: AnalizaCV } | null> {
  await prit(300); // MOCK
  const cv = versionet.find((v) => v.nota !== null);
  return cv ? { cv, analiza: SHEMBULL_ANALIZE } : null;
}

/** Thërret `cv-create`: nga 5 përgjigjet, ose rishkruan një CV ekzistuese për një format/gjuhë tjetër. */
export async function krijoCV(
  burimi: { pergjigjet: string[] } | { cv: CvStrukturuar },
  formati: FormatiCV,
  gjuha: GjuhaCV,
): Promise<CvStrukturuar> {
  await prit(2000); // MOCK
  void burimi;
  const skaTeDhenaPersonale = formati === "us" || formati === "uk" || formati === "ats";
  return { ...SHEMBULL_CV, datelindja: skaTeDhenaPersonale ? null : SHEMBULL_CV.datelindja, ...(gjuha === "en" ? { titulli: "Computer Engineering student" } : {}) };
}

/** Ruan një CV të krijuar si version i ri. */
export async function ruajCV(cv: CvStrukturuar, formati: FormatiCV): Promise<CvRresht> {
  await prit(400); // MOCK
  void cv; void formati;
  const rresht: CvRresht = {
    id: `mock-${versionet.length + 1}`,
    burimi: "krijuar",
    emri_skedarit: null,
    versioni: versionet.length + 1,
    nota: null,
    krijuar_me: new Date().toISOString(),
  };
  versionet = [rresht, ...versionet];
  return rresht;
}

/** Të gjitha versionet e CV-së, më e reja e para. */
export async function listoVersionet(): Promise<CvRresht[]> {
  await prit(200); // MOCK
  return versionet;
}

// ---------- Të dhëna të rreme (MOCK) ----------

const SHEMBULL_ANALIZE: AnalizaCV = {
  nota: 64,
  permbledhja: "2 gjëra e ngrenë mbi 75: rezultate te përvoja dhe linqe te projektet.",
  seksionet: [
    { emri: "Profili", gjendja: "mire", komenti: "I qartë dhe i shkurtër.", roast: "Ok, të paktën dihet si quhesh." },
    { emri: "Përvoja", gjendja: "permiresim", komenti: "Shkruaj rezultate, jo vetëm detyra.", roast: "\"Kam punuar me React.\" Edhe kalkulatori im ka punuar me React. Çka ndërtove?" },
    { emri: "Projektet", gjendja: "permiresim", komenti: "Shto linkun e GitHub-it për çdo projekt.", roast: "Projekt pa link në GitHub = projekt imagjinar." },
    { emri: "Formati", gjendja: "mire", komenti: "Një faqe, lexohet lehtë.", roast: "Tri fonte në një faqe. Zgjidh njërin, s'je në dasmë." },
  ],
  rishkrimet: [
    { para: "Kam punuar me React.", pas: "Ndërtova 3 ekrane në React Native për aplikacionin e klasës, me navigim dhe të dhëna nga Supabase." },
  ],
  pikat_e_forta: ["Projekte reale me React Native", "Anglisht C1"],
  fjalia_roast: "Projekt pa link në GitHub = projekt imagjinar.",
};

const SHEMBULL_CV: CvStrukturuar = {
  emri: "Student Shembull",
  titulli: "Student i Inxhinierisë Kompjuterike",
  qyteti: "Mitrovicë",
  email: "student@example.com",
  telefoni: null,
  datelindja: "2004",
  profili: "Student në vitin e tretë në UMIB, ndërtoj aplikacione mobile me React Native dhe Supabase.",
  arsimi: [{ programi: "Inxhinieri Kompjuterike", institucioni: "UMIB", periudha: "2023–sot" }],
  pervoja: [{ roli: "Asistent për procese biznesi", vendi: "Kompani private", periudha: "2025–sot", pershkrimi: "Digjitalizim i proceseve të brendshme.", nga_ai: true }],
  projektet: [{ titulli: "Karriera", pershkrimi: "App për përgatitjen për tregun e punës (React Native, Supabase, AI).", linku: "https://github.com/VocaDev/karriera", nga_ai: true }],
  aftesite: ["React Native", "TypeScript", "Git", "SQL"],
  gjuhet: [{ gjuha: "Shqip", niveli: "amtare" }, { gjuha: "Anglisht", niveli: "C1" }],
};
