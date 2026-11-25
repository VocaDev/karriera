// A flet shqip Flash-Lite? Docs e listojnë shqipen vetëm te 3.8 Flash TTS. Dy mostra (Arta, Arbër) me kodin e vërtetë të
// përshtatësit, që Genti t'i dëgjojë. 2 kërkesa TTS te gemini-3.8-flash-lite-tts. Ende s'është ekzekutuar.
// Nëse tingëllojnë keq: vendos sekretin GEMINI_LITE_SQ=0.
//
//   deno run --node-modules-dir=none --env-file=<.env> --allow-env=GEMINI_API_KEY,GEMINI_LITE_SQ \
//     --allow-net=generativelanguage.googleapis.com --allow-write=<dosja> supabase/functions/_provat/zeri-lite-mostra.ts <dosja>
import { gemini, MODELI_TTS_LITE } from "../_shared/zeri-gemini.ts";

const dosja = Deno.args[0];
if (!Deno.env.get("GEMINI_API_KEY") || !dosja) {
  console.log("Duhen GEMINI_API_KEY në mjedis dhe dosja: zeri-lite-mostra.ts <dosja>. Asnjë kërkesë s'u bë.");
  Deno.exit(1);
}
const FJALIA = "Mirëdita, sot do të bisedojmë për përvojën tuaj me testimin dhe punën në ekip.";
await Deno.mkdir(dosja, { recursive: true });
const folesi = gemini(MODELI_TTS_LITE);
for (const intervistuesi of ["arta", "arber"] as const) {
  const a = await folesi.fol(FJALIA, "sq", intervistuesi);
  const rruga = `${dosja}/lite-${intervistuesi}.wav`;
  await Deno.writeFile(rruga, a.audio);
  console.log(`${rruga} · ${a.sekonda.toFixed(1)} s`);
}
