// Prova e dëgjimit (15.11): 4 mostra zëri (Arta sq, Arbër sq, Arta en, Arbër en) me Gemini TTS dhe një transkriptim
// i mostrës "Arta sq" me Groq Whisper, me TË NJËJTIN kod që përdor intervista-zeri (_shared/zeri-gemini.ts, zeri-groq.ts).
// Gjithsej 5 thirrje. Mostrat ruhen te docs/zeri-mostra/ (s'futen në git).
//
// Çelësat lexohen nga mjedisi (GEMINI_API_KEY, GROQ_API_KEY) dhe s'shtypen kurrë. Nisja:
//   deno run --env-file=<rruga te .env> --allow-env=GEMINI_API_KEY,GROQ_API_KEY \
//     --allow-net=generativelanguage.googleapis.com,api.groq.com \
//     --allow-write=docs/zeri-mostra --allow-read=docs/zeri-mostra \
//     supabase/functions/_provat/zeri-mostra.ts
// (Dosjet me "_" te supabase/functions s'janë funksione dhe s'bëhen deploy.)
import type { Gjuha, Intervistuesi } from "../_shared/intervista-ai.ts";
import { GabimIZerit, lexoWav, rimostro } from "../_shared/zeri.ts";
import { gemini, MODELI_TTS, ZERAT } from "../_shared/zeri-gemini.ts";
import { groq, MODELI_STT } from "../_shared/zeri-groq.ts";

const DOSJA = "docs/zeri-mostra";
const TEKSTI: Record<"sq" | "en", string> = {
  sq: "Mirë se erdhe. Më trego pak për veten dhe pse të intereson kjo punë.",
  en: "Welcome. Tell me a little about yourself and why this job interests you.",
};
const MOSTRAT: { emri: string; intervistuesi: Intervistuesi; gjuha: Gjuha & ("sq" | "en") }[] = [
  { emri: "arta-sq", intervistuesi: "arta", gjuha: "sq" },
  { emri: "arber-sq", intervistuesi: "arber", gjuha: "sq" },
  { emri: "arta-en", intervistuesi: "arta", gjuha: "en" },
  { emri: "arber-en", intervistuesi: "arber", gjuha: "en" },
];

function raportoGabimin(cka: string, e: unknown) {
  if (e instanceof GabimIZerit) {
    console.log(`${cka}: GABIM ${e.message}`);
    if (e.detaje) console.log(`  status ${e.detaje.status} · kufijtë ${JSON.stringify(e.detaje.kufijte)}\n  trupi: ${e.detaje.trupi}`);
  } else {
    console.log(`${cka}: GABIM ${e instanceof Error ? e.message : String(e)}`);
  }
}

const mungojne = ["GEMINI_API_KEY", "GROQ_API_KEY"].filter((k) => !Deno.env.get(k));
if (mungojne.length) {
  console.log(`Mungon në mjedis: ${mungojne.join(", ")}. Asnjë thirrje s'u bë.`);
  Deno.exit(1);
}

await Deno.mkdir(DOSJA, { recursive: true });
const folesi = gemini();
console.log(`TTS: ${MODELI_TTS} · zërat ${JSON.stringify(ZERAT)}`);
for (const m of MOSTRAT) {
  const t0 = performance.now();
  try {
    const a = await folesi.fol(TEKSTI[m.gjuha], m.gjuha, m.intervistuesi);
    const rruga = `${DOSJA}/${m.emri}.wav`;
    await Deno.writeFile(rruga, a.audio);
    console.log(
      `${m.emri}: ${rruga} · ${a.sekonda.toFixed(2)} s audio · ${Math.round(performance.now() - t0)} ms · kufijtë ${JSON.stringify(a.kufijte ?? {})}`,
    );
  } catch (e) {
    raportoGabimin(m.emri, e);
  }
}

// Një transkriptim: Arta sq → tekst (Whisper), që të shihet cilësia e STT-së në shqip.
try {
  const wav = lexoWav(await Deno.readFile(`${DOSJA}/arta-sq.wav`));
  if (!wav) throw new Error("arta-sq.wav mungon ose s'lexohet");
  const t0 = performance.now();
  const teksti = await groq().degjo(rimostro(wav), "sq");
  console.log(`STT (${MODELI_STT}, sq) · ${Math.round(performance.now() - t0)} ms\n  origjinali: ${TEKSTI.sq}\n  Whisper:    ${teksti}`);
} catch (e) {
  raportoGabimin("STT arta-sq", e);
}
