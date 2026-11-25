// Para / pas me modelin e vërtetë (25.11): e njëjta bisedë kalon te prompt-i i vjetër dhe te i riu, me të njëjtin model dhe
// logjikën e vjetër e të re të vendosjes. 2 skenarë × 2 versione = 4 thirrje Claude.
// Versioni i vjetër kopjohet përkohësisht: git show <commit-i para>:supabase/functions/_shared/{intervista-ai,thirresi}.ts
//   deno run --node-modules-dir=none --env-file=<.env> --allow-env --allow-net=api.anthropic.com --allow-read \
//     supabase/functions/_provat/intervista-para-pas.ts <rruga-relative-te-intervista-ai-e-vjeter>
import * as pas from "../_shared/intervista-ai.ts";

const para = (await import(new URL(Deno.args[0], import.meta.url).href)) as typeof pas;

const puna = {
  id: "prova",
  titulli: "Junior QA Engineer",
  kompania: "Dardania Soft",
  qyteti: "Prishtinë",
  roli: "SWE" as const,
  pershkrimi: "Testim i një aplikacioni web për biznese të vogla.",
  aftesite: ["Playwright", "SQL", "Testim manual"],
  kerkesat: [
    "Shkrim i testeve automatike e2e me Playwright",
    "Raportim i qartë i gabimeve me hapat për riprodhim",
    "Njohuri bazë të SQL për të kontrolluar të dhënat",
  ],
};
const cv =
  "Titulli: Student i vitit të tretë\nProjektet:\n- Karriera: aplikacion mobil me React Native dhe Supabase (projekt universitar me një shok)\nAftësitë: React Native, Git, testim manual";

const qasjet = [
  { nr: 1, qasja: "ngrohje" as const, arsyeja: "Hapja." },
  { nr: 2, qasja: "ngrohje" as const, arsyeja: "Njohja." },
];
const kt = (nr: number, pyetja: string, pergjigja: string) => ({
  id: `k${nr}`, nr, lloji: "pyetje" as const, reagimi: null, pyetja, pergjigja, vleresimi: null, pergjigjur_me: null,
});
const fillimi = [
  kt(1, "Për të filluar: më tregoni pak për veten dhe pse ju intereson kjo punë?", "Jam student i inxhinierisë kompjuterike në Mitrovicë. Më intereson testimi sepse më pëlqen të gjej gabimet para përdoruesve."),
  kt(2, "Çfarë roli patët te projekti Karriera?", "Unë bëra pjesën e hyrjes dhe bazën e të dhënave, kurse shoku bëri ekranet."),
];
const skenaret = [
  {
    emri: "Përgjigje e paqartë",
    kthesat: [...fillimi, kt(3, "Si e siguroheshit që aplikacioni punonte mirë?", "E kemi testuar shumë mirë, kemi bërë shumë gjëra dhe gjithmonë ka shkuar mirë, jemi kujdesur për cilësinë.")],
  },
  {
    emri: "Pretendim i fryrë",
    kthesat: [...fillimi, kt(3, "Sa e njihni testimin automatik me Playwright?", "Jam ekspert në Playwright, e di gjithçka, i kam shkruar të gjitha testet vetëm dhe kurrë s'kemi pasur asnjë gabim.")],
  },
];

for (const s of skenaret) {
  console.log(`\n=== ${s.emri} ===\nKandidati: "${s.kthesat.at(-1)!.pergjigja}"`);
  for (const [emri, m] of [["PARA", para], ["PAS", pas]] as const) {
    const konteksti = { puna, cv, gatishmeria: null, qasjet, intervistuesi: "arta" as const };
    const hyrja = { konteksti, intervistuesi: "arta" as const, roli: "SWE" as const, gjuha: "sq" as const, gjatesia: "shkurter" as const, kthesat: s.kthesat, nrPyetjeve: 3, menyra: "zgjedh" as const, lejohetVazhdim: true, meZe: true };
    const ai = await m.gjeneroKthesen(hyrja);
    const v = m.vendosKthesen({ ai, menyra: "zgjedh", lejohetVazhdim: true, konteksti, gjuha: "sq", roli: "SWE", nrPyetjeve: 3, nrAktual: 3, pyetjetEMeparshme: s.kthesat.map((k) => k.pyetja) });
    console.log(`${emri} [${v.lloji}, qasja ${v.qasja?.qasja ?? "-"}]: ${v.reagimi ?? ""} ${v.vazhdon ? v.pyetja : "(mbyllet)"}`);
  }
}
