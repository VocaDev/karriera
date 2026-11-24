// Prova e vonesës (24.11): sa kohë kalon nga "kandidati mbaroi së foluri" deri te BYTE-I I PARË i audios së pyetjes.
// Përdor KODIN E VËRTETË të serverit (Groq STT, Claude për kthesën, Gemini TTS me rrjedhë) dhe i ndjek hapat e
// `intervista-zeri` në rrjedhën e re: STT → kthesa (pa pritur vlerësimin) → TTS me rrjedhë → copa e parë.
// Mat edhe rrjedhën e vjetër për krahasim: STT → kthesa + vlerësimi (më e ngadalta) → TTS pa rrjedhë (reagimi i pari).
//
// Çka NUK përfshihet: ngarkimi i WAV-it nga telefoni (varet nga rrjeti, ~0,2–1 s), një start i ftohtë i funksionit dhe
// leximet/shkrimet në DB (~50 ms secila). Hapat e AI-ve janë të vërtetë, ndaj koha është kufiri i poshtëm i asaj që sheh telefoni.
//
// Thirrjet e AI-ve për një ekzekutim: 1 STT, 1–2 Claude, 1–2 TTS (+ 1 TTS herën e parë, për të bërë një "përgjigje" me zë).
// Audio e përgjigjes ruhet në një skedar të përkohshëm (jashtë repo-s) dhe ripërdoret.
//
//   deno run --node-modules-dir=none --env-file=<rruga te .env> \
//     --allow-env --allow-net=generativelanguage.googleapis.com,api.groq.com,api.anthropic.com \
//     --allow-read=<dosja e përkohshme> --allow-write=<dosja e përkohshme> \
//     supabase/functions/_provat/zeri-vonesa.ts <skedari-wav-i-pergjigjes.wav> [rrjedhe|vjeter|te-dyja]
import {
  gjeneroKthesen,
  type Konteksti,
  type KthesaDB,
  vleresoPergjigjen,
  vendosMenyren,
} from "../_shared/intervista-ai.ts";
import { lexoWav, MBUSHESIT, rimostro, SHKALLA_STT } from "../_shared/zeri.ts";
import { gemini } from "../_shared/zeri-gemini.ts";
import { groq } from "../_shared/zeri-groq.ts";

for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY", "ANTHROPIC_API_KEY"]) {
  if (!Deno.env.get(k)) {
    console.log(`Mungon ${k} në mjedis. Asnjë thirrje s'u bë.`);
    Deno.exit(1);
  }
}
const rruga = Deno.args[0];
const modi = Deno.args[1] ?? "te-dyja";
if (!rruga) {
  console.log("Përdorimi: zeri-vonesa.ts <skedari.wav> [rrjedhe|vjeter|te-dyja]");
  Deno.exit(1);
}

const PERGJIGJJA =
  "Kam punuar në një projekt universitar për një aplikacion mobil, ku unë merrresha me pjesën e hyrjes dhe me bazën e të dhënave. " +
  "Kishim vetëm tre javë, prandaj e ndamë punën me ekipin në detyra të vogla dhe takoheshim çdo të hënë për të parë ku ishim.";

const ms = (t0: number) => Math.round(performance.now() - t0);
const folesi = gemini();
const degjuesi = groq();

// ---------- Audio e "kandidatit" (një herë; ripërdoret) ----------
let wavBajte: Uint8Array;
try {
  wavBajte = await Deno.readFile(rruga);
} catch {
  const a = await folesi.fol(PERGJIGJJA, "sq", "arber");
  wavBajte = a.audio;
  await Deno.writeFile(rruga, wavBajte);
  console.log(`Audio e përgjigjes u krijua (${a.sekonda.toFixed(1)} s) dhe u ruajt te ${rruga}`);
}
const wav = lexoWav(wavBajte);
if (!wav) throw new Error("Skedari s'është WAV.");
const pcm = rimostro(wav, SHKALLA_STT);
console.log(`Përgjigjja: ${(pcm.length / SHKALLA_STT).toFixed(1)} s audio`);

const konteksti: Konteksti = {
  puna: {
    id: "prova",
    titulli: "Junior React Native Developer",
    kompania: "Dardania Soft",
    qyteti: "Prishtinë",
    roli: "SWE",
    pershkrimi: "Zhvillim i aplikacioneve mobile me React Native dhe TypeScript, punë në ekip, integrim me API.",
    aftesite: ["React Native", "TypeScript", "Git", "Punë në ekip"],
  },
  cv: "Student i vitit të tretë i inxhinierisë kompjuterike; projekte universitare me React Native dhe Supabase.",
  gatishmeria: null,
  intervistuesi: "arta",
};
const pyetjaEPare = "Më trego për një projekt ku ke punuar me ekip dhe çfarë ishte roli yt.";
const kthesat = (pergjigja: string): KthesaDB[] => [
  { id: "k1", nr: 1, lloji: "pyetje", reagimi: null, pyetja: pyetjaEPare, pergjigja, vleresimi: null, pergjigjur_me: null },
];

type Matja = { stt: number; kthesa: number; audio: number; fundi: number; tekstiGjatesia: number };

async function stt(t0: number): Promise<{ transkripti: string; koha: number }> {
  const transkripti = (await degjuesi.degjo(pcm, "sq")).trim();
  return { transkripti, koha: ms(t0) };
}

/** Rrjedha e re: kthesa pa pritur vlerësimin, pastaj TTS me rrjedhë; koha deri te copa e parë. */
async function rrjedhaERe(): Promise<Matja> {
  const t0 = performance.now();
  const { transkripti, koha: kStt } = await stt(t0);
  const menyra = vendosMenyren({ nrPyetjeve: 1, gjatesia: "shkurter", lejohetVazhdim: true, pergjigja: transkripti });
  const vleresimiNeSfond = vleresoPergjigjen({
    konteksti,
    intervistuesi: "arta",
    roli: "SWE",
    gjuha: "sq",
    meZe: true,
    kthesa: { reagimi: null, pyetja: pyetjaEPare, pergjigja: transkripti },
  }).catch(() => null);
  const ai = await gjeneroKthesen({
    konteksti,
    intervistuesi: "arta",
    roli: "SWE",
    gjuha: "sq",
    gjatesia: "shkurter",
    kthesat: kthesat(transkripti),
    nrPyetjeve: 1,
    menyra,
    lejohetVazhdim: true,
    meZe: true,
  });
  const kKthesa = ms(t0);
  const teksti = [ai.reagimi, ai.pyetja].filter((x) => x && x.trim()).join(" ");
  let kAudio = -1;
  let bajt = 0;
  let shkalla = 24_000;
  for await (const c of folesi.rrjedhe!(teksti, "sq", "arta")) {
    if (kAudio < 0) kAudio = ms(t0);
    bajt += c.pcm.length;
    shkalla = c.shkalla;
  }
  const fundi = ms(t0);
  await vleresimiNeSfond;
  console.log(`  transkripti: "${transkripti.slice(0, 90)}…"`);
  console.log(`  teksti i zërit (${teksti.length} shkronja, ${(bajt / 2 / shkalla).toFixed(1)} s audio): "${teksti.slice(0, 110)}…"`);
  return { stt: kStt, kthesa: kKthesa, audio: kAudio, fundi, tekstiGjatesia: teksti.length };
}

/** Rrjedha e vjetër: kthesa pret vlerësimin; pastaj reagimi dhe pyetja si dy thirrje TTS të plota, paralelisht. */
async function rrjedhaEVjeter(): Promise<Matja> {
  const t0 = performance.now();
  const { transkripti, koha: kStt } = await stt(t0);
  const menyra = vendosMenyren({ nrPyetjeve: 1, gjatesia: "shkurter", lejohetVazhdim: true, pergjigja: transkripti });
  const [, ai] = await Promise.all([
    vleresoPergjigjen({
      konteksti,
      intervistuesi: "arta",
      roli: "SWE",
      gjuha: "sq",
      meZe: true,
      kthesa: { reagimi: null, pyetja: pyetjaEPare, pergjigja: transkripti },
    }).catch(() => null),
    gjeneroKthesen({
      konteksti,
      intervistuesi: "arta",
      roli: "SWE",
      gjuha: "sq",
      gjatesia: "shkurter",
      kthesat: kthesat(transkripti),
      nrPyetjeve: 1,
      menyra,
      lejohetVazhdim: true,
      meZe: true,
    }),
  ]);
  const kKthesa = ms(t0);
  // Në rrjedhën e vjetër app-i kthehet te serveri me dy kërkesa të reja; këtu vetëm TTS-ja (pa ~0,3 s të rrugës).
  const pjeset = [ai.reagimi, ai.pyetja].filter((x): x is string => !!x && !!x.trim());
  const audioT: number[] = [];
  await Promise.all(pjeset.map(async (p) => { await folesi.fol(p, "sq", "arta"); audioT.push(ms(t0)); }));
  return { stt: kStt, kthesa: kKthesa, audio: Math.min(...audioT), fundi: Math.max(...audioT), tekstiGjatesia: pjeset.join(" ").length };
}

function shtyp(emri: string, m: Matja) {
  console.log(
    `${emri}: STT ${m.stt} ms · teksti i kthesës ${m.kthesa} ms · AUDIO E PARË ${m.audio} ms (${(m.audio / 1000).toFixed(2)} s) · fundi ${m.fundi} ms`,
  );
}

console.log(`Pranimi nga kesh-i luhet në ~0 ms (${JSON.stringify(MBUSHESIT.sq)}); matjet më poshtë janë për pyetjen.`);
if (modi === "rrjedhe" || modi === "te-dyja") {
  console.log("— rrjedha e re —");
  shtyp("RRJEDHA E RE", await rrjedhaERe());
}
if (modi === "vjeter" || modi === "te-dyja") {
  console.log("— rrjedha e vjetër (për krahasim) —");
  shtyp("RRJEDHA E VJETËR", await rrjedhaEVjeter());
}
