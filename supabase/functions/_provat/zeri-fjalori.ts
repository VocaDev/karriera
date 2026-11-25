// Prova A/B e fjalorit të Whisper-it (25.11), me thirrje të vërteta: 1 TTS (një përgjigje shqipe me emra teknikë anglisht,
// e ruajtur dhe e ripërdorur) + 3 STT: large-v3 pa prompt, large-v3 me prompt, turbo me prompt.
// Kujdes: zëri është i sintetizuar, jo i njeriut: tregon drejtimin, jo saktësinë mbi zërin e Gentit.
//
// Rezultati 25.11 (Gemini TTS ishte pa kuotë, audio e provës u bë me zërin anglisht të Windows-it, "In my project I used
// Playwright that used Claude ...", me language=sq):
//   large-v3 pa prompt                      5/5 emra, por fjalët e tjera të çoroditura ("shqipërim")
//   large-v3 me fjali shqipe + listë        2/5
//   large-v3 vetëm me listë                 ~3,5/5 ("Pleywright", "Tyscript")
//   large-v3-turbo me fjali shqipe + listë  5/5, anglishtja e saktë (turbo s'u provua mbi shqip të vërtetë)
//   shqip e vërtetë (TTS, pa emra teknikë): me listë dhe pa listë, transkript identik.
// Përfundim: mbi audio të sintetizuar dobia s'u provua; vendos zëri i njeriut në telefon.
//
//   deno run --node-modules-dir=none --env-file=<.env> --allow-env --allow-net=generativelanguage.googleapis.com,api.groq.com \
//     --allow-read=<dosje> --allow-write=<dosje> supabase/functions/_provat/zeri-fjalori.ts <skedari.wav>
import type { Konteksti } from "../_shared/intervista-ai.ts";
import { lexoWav, rimostro, shkruajWav, SHKALLA_STT } from "../_shared/zeri.ts";
import { gemini } from "../_shared/zeri-gemini.ts";
import { ndertoPromptinSTT } from "../_shared/zeri-fjalori.ts";

const FJALIA =
  "Në projektin tim kam përdorur Playwright që përdor Claude për testimin automatik, bashkë me TypeScript, Supabase dhe Docker.";
const PRITEN = ["Playwright", "Claude", "TypeScript", "Supabase", "Docker"];
const konteksti: Konteksti = {
  puna: {
    id: "prova", titulli: "QA Engineer", kompania: "Dardania Soft", qyteti: "Prishtinë", roli: "SWE",
    pershkrimi: "Teste automatike të aplikacioneve web.", aftesite: ["Testim automatik", "TypeScript"],
  },
  cv: "Projektet:\n- Teste e2e për një app me React dhe Supabase\nAftësitë: Playwright, Claude, punë në ekip",
  gatishmeria: null,
};

const rruga = Deno.args[0];
let wav: Uint8Array;
try {
  wav = await Deno.readFile(rruga);
} catch {
  wav = (await gemini().fol(FJALIA, "sq", "arber")).audio;
  await Deno.writeFile(rruga, wav);
  console.log("Audio e provës u krijua.");
}
const p = lexoWav(wav);
if (!p) throw new Error("jo WAV");
const pcm = rimostro(p, SHKALLA_STT);
const prompti = ndertoPromptinSTT({ konteksti });
console.log(`Prompti (${prompti.length} shenja): ${prompti}\n`);

async function dego(model: string, meFjalor: boolean) {
  const forma = new FormData();
  forma.append("file", new Blob([shkruajWav(pcm, SHKALLA_STT)], { type: "audio/wav" }), "p.wav");
  forma.append("model", model);
  forma.append("language", "sq");
  forma.append("response_format", "json");
  forma.append("temperature", "0");
  if (meFjalor) forma.append("prompt", prompti);
  const t0 = performance.now();
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}` },
    body: forma,
  });
  const j = (await r.json()) as { text?: string; error?: unknown };
  const tekst = j.text ?? JSON.stringify(j.error);
  const gjetura = PRITEN.filter((f) => tekst.toLowerCase().includes(f.toLowerCase()));
  console.log(`${model} ${meFjalor ? "ME prompt" : "pa prompt"} (${Math.round(performance.now() - t0)} ms): ${gjetura.length}/${PRITEN.length} emra [${gjetura.join(", ")}]\n  "${tekst}"`);
}

await dego("whisper-large-v3", false);
await dego("whisper-large-v3", true);
await dego("whisper-large-v3-turbo", true);
