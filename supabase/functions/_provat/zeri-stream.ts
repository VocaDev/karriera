// Sondë (18.11): a e shkurton streaming-u (Interactions API, "stream": true) kohën deri te audio e parë?
// 1 thirrje Gemini TTS. Shtyp vetëm kohët, llojin e përgjigjes dhe 300 shenjat e para të ngjarjes së parë me audio
// (pa audio të plotë, pa çelës).
//
//   deno run --env-file=<rruga te .env> --allow-env=GEMINI_API_KEY \
//     --allow-net=generativelanguage.googleapis.com supabase/functions/_provat/zeri-stream.ts
import { MODELI_TTS, ZERAT } from "../_shared/zeri-gemini.ts";

const celesi = Deno.env.get("GEMINI_API_KEY");
if (!celesi) {
  console.log("Mungon GEMINI_API_KEY në mjedis. Asnjë thirrje s'u bë.");
  Deno.exit(1);
}
const teksti = "Si e keni ndarë punën me ekipin kur afati ishte shumë i shkurtër, dhe çfarë do të bënit ndryshe sot?";
const t0 = performance.now();
const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
  method: "POST",
  headers: { "x-goog-api-key": celesi, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODELI_TTS,
    stream: true,
    input: [{ type: "user_input", content: [{ type: "text", text: teksti }] }],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: ZERAT.arta }] },
  }),
});
console.log(`status ${r.status} · content-type ${r.headers.get("content-type")} · header-at pas ${Math.round(performance.now() - t0)} ms`);
if (!r.ok || !r.body) {
  console.log((await r.text()).slice(0, 600));
  Deno.exit(0);
}
const lexuesi = r.body.getReader();
const dek = new TextDecoder();
let bajt = 0;
let copa = 0;
let ePara: number | null = null;
let paraAudios: number | null = null;
let mostra = "";
for (;;) {
  const { value, done } = await lexuesi.read();
  if (done) break;
  copa++;
  bajt += value.length;
  if (ePara === null) ePara = performance.now() - t0;
  const tekst = dek.decode(value, { stream: true });
  if (paraAudios === null && /"data"\s*:\s*"/.test(tekst)) {
    paraAudios = performance.now() - t0;
    mostra = tekst.replace(/("data"\s*:\s*")[A-Za-z0-9+/=]{20,}/g, '$1<base64…>').slice(0, 300);
  }
}
console.log(`copa e parë pas ${Math.round(ePara ?? -1)} ms · audio e parë pas ${Math.round(paraAudios ?? -1)} ms · fundi pas ${Math.round(performance.now() - t0)} ms · ${copa} copa · ${bajt} bajt`);
console.log(`ngjarja e parë me audio (e shkurtuar): ${mostra}`);
