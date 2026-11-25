// A flet shqip modeli rezervë (Flash-Lite, ose 3.1 preview)? Docs e listojnë shqipen vetëm te 3.8 Flash TTS. Dy mostra (Arta, Arbër) me kodin e vërtetë të
// përshtatësit, që Genti t'i dëgjojë. 2 kërkesa TTS për modelin e dhënë (pa të: Flash-Lite). Ende s'është ekzekutuar.
// Nëse tingëllojnë keq: Flash-Lite hiqet me GEMINI_LITE_SQ=0; 3.1 fiket me TTS_RPM_LIMITS=gemini-3.1-flash-tts-preview=0.
// Për 3.1 kjo tregon edhe nëse punon me Interactions API (një gabim HTTP 400 / 404 = jo).
//
//   deno run --node-modules-dir=none --env-file=<.env> --allow-env=GEMINI_API_KEY,GEMINI_LITE_SQ \
//     --allow-net=generativelanguage.googleapis.com --allow-write=<dosja> supabase/functions/_provat/zeri-lite-mostra.ts <dosja> [modeli]
import { gemini, MODELI_TTS_LITE } from "../_shared/zeri-gemini.ts";

const [dosja, modeli = MODELI_TTS_LITE] = Deno.args;
if (!Deno.env.get("GEMINI_API_KEY") || !dosja) {
  console.log("Duhen GEMINI_API_KEY në mjedis dhe dosja: zeri-lite-mostra.ts <dosja> [modeli]. Asnjë kërkesë s'u bë.");
  Deno.exit(1);
}
const FJALIA = "Mirëdita, sot do të bisedojmë për përvojën tuaj me testimin dhe punën në ekip.";
await Deno.mkdir(dosja, { recursive: true });
const folesi = gemini(modeli, { riprovo: false });
for (const intervistuesi of ["arta", "arber"] as const) {
  const a = await folesi.fol(FJALIA, "sq", intervistuesi);
  const rruga = `${dosja}/${modeli}-${intervistuesi}.wav`;
  await Deno.writeFile(rruga, a.audio);
  console.log(`${rruga} · ${a.sekonda.toFixed(1)} s`);
}
