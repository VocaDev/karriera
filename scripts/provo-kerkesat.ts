// Prova lokale e nxjerrjes së kërkesave (Haiku): të njëjtat funksione si Edge Function "portalet", pa databazë.
// Lexon listën e një portali, merr faqet e para `maks` shpalljeve, dhe për secilën thërret AI-në një herë.
// S'shkruan asgjë në Supabase. Kërkon Deno dhe ANTHROPIC_API_KEY (nga skeda .env; s'shfaqet kurrë).
//
//   deno run -A --env-file=.env scripts/provo-kerkesat.ts [maks=3] [portali=kosovajob] [dalja.json]
//
// Çdo thirrje te Haiku kushton para: maks është kufizuar në 5.
import { BURIMET } from "../supabase/functions/portalet/burimet.ts";
import { neRresht, type Portali } from "../supabase/functions/portalet/harta.ts";
import { shtoKerkesat } from "../supabase/functions/portalet/kerkesat.ts";
import { Shfletuesi } from "../supabase/functions/portalet/shfletuesi.ts";

const maks = Math.max(1, Math.min(5, Number(Deno.args[0] ?? 3)));
const portali = (Deno.args[1] ?? "kosovajob") as Portali;
const dalja = Deno.args[2];
if (!(portali in BURIMET)) throw new Error(`Portal i panjohur: ${portali}`);

const log = (m: string) => console.log(`  · ${m}`);
const shf = new Shfletuesi(log);
const burimi = await BURIMET[portali](shf, { eshteERe: () => true, maksDetaje: maks, log });
const rreshtat = burimi.shpalljet.map((s) => neRresht(s)).filter((r) => r !== null);
const trupat = new Map(burimi.shpalljet.flatMap((s) => (s.trupi ? [[`${s.portali}-${s.id_e_jashtme}`, s.trupi] as const] : [])));
console.log(`\n${burimi.shpalljet.length} shpallje të lexuara, ${rreshtat.length} në HARTA, ${trupat.size} me tekst të plotë`);

const ai = await shtoKerkesat(rreshtat, trupat, { maksAI: maks, afati: Date.now() + 120_000, log });
console.log("\n══ Raporti AI", JSON.stringify(ai, null, 2));
for (const r of rreshtat) {
  console.log(`\n══ ${r.id} · ${r.titulli} · ${r.kompania}`);
  console.log(JSON.stringify({ kerkesat: r.kerkesat, aftesite: r.aftesite, pershkrimi: r.pershkrimi }, null, 2));
}
if (dalja) Deno.writeTextFileSync(dalja, JSON.stringify({ ai, rreshtat }, null, 2));
console.log(`\nKërkesa HTTP: ${shf.kerkesat} · Thirrje AI: ${ai.thirrje}`);
