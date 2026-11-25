// Mostra për veshin e Gentit: 3 fjali shqip për secilin zë (Arta = sq-AL-AnilaNeural, Arbër = sq-AL-IlirNeural), me kodin
// e vërtetë të përshtatësit. Ruhen si WAV në dosjen që i jep (jashtë repo-s). Punon VETËM kur sekretet janë në mjedis;
// pa to s'bën asnjë kërkesë. Çelësi s'shtypet dhe s'ruhet askund. ~6 kërkesa, ~450 shkronja nga kufiri mujor falas
// (këtu pa numëruesin e DB-së).
//
//   deno run --node-modules-dir=none --env-file=<.env me AZURE_SPEECH_KEY dhe AZURE_SPEECH_REGION> \
//     --allow-env --allow-net --allow-write=<dosja> supabase/functions/_provat/zeri-azure-mostra.ts <dosja>
import { azure, ssmlPer, ZERAT_AZURE } from "../_shared/zeri-azure.ts";

const dosja = Deno.args[0];
if (!Deno.env.get("AZURE_SPEECH_KEY") || !Deno.env.get("AZURE_SPEECH_REGION")) {
  console.log("Mungojnë AZURE_SPEECH_KEY / AZURE_SPEECH_REGION në mjedis. Asnjë kërkesë s'u bë.");
  Deno.exit(1);
}
if (!dosja) {
  console.log("Jep dosjen ku të ruhen mostrat: zeri-azure-mostra.ts <dosja>");
  Deno.exit(1);
}

const FJALITE = [
  "Mirëdita, unë do t'ju intervistoj sot për pozitën e zhvilluesit të ri.",
  "Te projekti juaj Karriera, çfarë bëtë ju vetë me React Native dhe Supabase?",
  "Faleminderit. Më tregoni një rast kur një test në Playwright dështoi dhe si e zgjidhët.",
];
const folesi = azure(() => Promise.resolve(true));
let shkronja = 0;
await Deno.mkdir(dosja, { recursive: true });
for (const intervistuesi of ["arta", "arber"] as const) {
  for (const [i, fjalia] of FJALITE.entries()) {
    shkronja += ssmlPer(fjalia, "sq", intervistuesi).shkronja;
    const t0 = performance.now();
    const a = await folesi.fol(fjalia, "sq", intervistuesi);
    const rruga = `${dosja}/${intervistuesi}-${i + 1}-${ZERAT_AZURE[intervistuesi].sq}.wav`;
    await Deno.writeFile(rruga, a.audio);
    console.log(`${rruga} · ${a.sekonda.toFixed(1)} s audio · ${Math.round(performance.now() - t0)} ms`);
  }
}
console.log(`Gati. Shkronja të dërguara: ${shkronja}.`);
