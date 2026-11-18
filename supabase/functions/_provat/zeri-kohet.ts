// Prova e kohës (18.11): sa pret kandidati para se të dëgjojë diçka, me rrjedhën e re "reagimi i pari".
// 3 thirrje Gemini TTS me kodin e vërtetë (_shared/zeri-gemini.ts): pranimi ("Mirë, e kuptoj."), pastaj reagimi dhe
// pyetja PARALELISHT, siç i kërkon app-i. Shtyp kohët; s'ruan audio.
//
//   deno run --env-file=<rruga te .env> --allow-env=GEMINI_API_KEY \
//     --allow-net=generativelanguage.googleapis.com supabase/functions/_provat/zeri-kohet.ts
import { GabimIZerit, MBUSHESIT } from "../_shared/zeri.ts";
import { gemini } from "../_shared/zeri-gemini.ts";

const REAGIMI = "Faleminderit, ky ishte një shembull i qartë nga projekti juaj.";
const PYETJA = "Si e keni ndarë punën me ekipin kur afati ishte shumë i shkurtër, dhe çfarë do të bënit ndryshe sot?";

if (!Deno.env.get("GEMINI_API_KEY")) {
  console.log("Mungon GEMINI_API_KEY në mjedis. Asnjë thirrje s'u bë.");
  Deno.exit(1);
}
const folesi = gemini();
const ms = (t0: number) => Math.round(performance.now() - t0);

async function mat(emri: string, teksti: string, t0: number) {
  try {
    const a = await folesi.fol(teksti, "sq", "arta");
    console.log(`${emri}: gati pas ${ms(t0)} ms · ${a.sekonda.toFixed(2)} s audio · ${teksti.length} shkronja`);
    return a.sekonda;
  } catch (e) {
    console.log(`${emri}: GABIM ${e instanceof GabimIZerit ? `${e.message} ${JSON.stringify(e.detaje)}` : String(e)}`);
    return null;
  }
}

let t0 = performance.now();
await mat("pranimi", MBUSHESIT.sq, t0);

t0 = performance.now();
const [r, p] = await Promise.all([mat("reagimi (paralel)", REAGIMI, t0), mat("pyetja (paralel)", PYETJA, t0)]);
if (r !== null) console.log(`Pyetja duhet të jetë gati para ${Math.round(r * 1000)} ms pas fillimit të reagimit, që të mos ketë pushim.`);
if (r !== null && p !== null) console.log("(krahaso: 'pyetja gati pas' − 'reagimi gati pas' ≤ kohëzgjatja e reagimit)");
