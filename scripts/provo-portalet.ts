// Prova lokale e importit nga portalet: i njëjti kod si Edge Function "portalet" (burimet + harta),
// por pa databazë: s'shkruan asgjë në Supabase. Rezultati shkon në një JSON jashtë Git-it.
//
//   node scripts/provo-portalet.ts <dalja.json> [maks_detaje] [portalet me presje]
//   p.sh. node scripts/provo-portalet.ts "$env:TEMP\portalet.json" 40 kosovajob,portalpune
//
// Node 22.18+ i lexon skedat .ts vetë (type stripping). Kërkesat janë të ngadalta me qëllim
// (robots.txt: 2 s mes kërkesave, 10 s te OfertaPune), kështu që një provë e plotë zgjat disa minuta.
import { writeFileSync } from "node:fs";
import { BURIMET, RADHA, type RezultatiIBurimit } from "../supabase/functions/portalet/burimet.ts";
import { gjejRolin, gjurma, hiqDublikatat, neRresht, sot, type Portali, type RreshtiPunes } from "../supabase/functions/portalet/harta.ts";
import { Shfletuesi } from "../supabase/functions/portalet/shfletuesi.ts";

const [dalja, maksArg, portaletArg] = process.argv.slice(2);
if (!dalja) {
  console.error("Përdorimi: node scripts/provo-portalet.ts <dalja.json> [maks_detaje] [portalet]");
  process.exit(1);
}
const maksDetaje = Number(maksArg ?? 40);
const portalet = portaletArg ? RADHA.filter((p) => portaletArg.split(",").includes(p)) : RADHA;

const log = (m: string) => console.log(`  · ${m}`);
const shf = new Shfletuesi(log);
const rezultatet: RezultatiIBurimit[] = [];
const deshtuan: { portali: Portali; gabimi: string }[] = [];
const fillimi = Date.now();

for (const portali of portalet) {
  console.log(`\n▶ ${portali}`);
  try {
    const r = await BURIMET[portali](shf, {
      eshteERe: () => true,
      maksDetaje,
      log,
      eshteDublikate: (titulli, kompania) => {
        const g = gjurma(titulli, kompania);
        return rezultatet.some((x) => x.shpalljet.some((s) => s.kompania && gjurma(s.titulli, s.kompania) === g));
      },
    });
    rezultatet.push(r);
    console.log(`  ${r.neListe} në listë · ${r.kandidate} kandidatë · ${r.shpalljet.length} të lexuara · ${r.gabime.length} gabime`);
  } catch (e) {
    deshtuan.push({ portali, gabimi: (e as Error).message });
    console.log(`  DËSHTOI: ${(e as Error).message}`);
  }
}

const tani = new Date().toISOString();
const dita = sot();
const teGjitha = rezultatet.flatMap((r) => r.shpalljet);
const rreshtat = teGjitha.map((s) => neRresht(s, tani, dita)).filter((r): r is RreshtiPunes => r !== null);
const { unike, dublikata } = hiqDublikatat(rreshtat);
const dublikataNgaLista = rezultatet.flatMap((r) => r.dublikataNgaLista);
// Kandidatë që faqja e plotë (kategoria / titulli i vërtetë) i nxori jashtë HARTA-s, ose që kishin skaduar.
const teRefuzuara = teGjitha
  .filter((s) => !rreshtat.some((r) => r.id === `${s.portali}-${s.id_e_jashtme}`))
  .map((s) => ({ portali: s.portali, titulli: s.titulli, kategoria: s.kategoria, afati: s.afati, roli: gjejRolin(s.titulli, s.kategoria) }));

const sipasPortalit = Object.fromEntries(
  rezultatet.map((r) => [
    r.portali,
    {
      ne_liste: r.neListe,
      kandidate: r.kandidate,
      te_lexuara: r.shpalljet.length,
      ne_harta: rreshtat.filter((x) => x.portali === r.portali).length,
      unike: unike.filter((x) => x.portali === r.portali).length,
      SWE: unike.filter((x) => x.portali === r.portali && x.roli === "SWE").length,
      "Asistent/PR": unike.filter((x) => x.portali === r.portali && x.roli === "Asistent/PR").length,
      dublikata_nga_lista: r.dublikataNgaLista.length,
      gabime: r.gabime,
    },
  ]),
);

const raporti = {
  dita,
  kohezgjatja_s: Math.round((Date.now() - fillimi) / 1000),
  kerkesa_http: shf.kerkesat,
  sipas_portalit: sipasPortalit,
  sipas_rolit: {
    SWE: unike.filter((x) => x.roli === "SWE").length,
    "Asistent/PR": unike.filter((x) => x.roli === "Asistent/PR").length,
  },
  totali_unike: unike.length,
  dublikata,
  dublikata_nga_lista: dublikataNgaLista,
  deshtuan,
  te_refuzuara_pas_faqes: teRefuzuara,
  rreshtat: unike,
};
writeFileSync(dalja, JSON.stringify(raporti, null, 2), "utf8");

console.log("\n══ Raporti");
console.table(sipasPortalit);
console.log("Sipas rolit:", raporti.sipas_rolit, "· gjithsej unike:", unike.length);
console.log(`Dublikata: ${dublikata.length} pas leximit + ${dublikataNgaLista.length} që nga lista`);
for (const d of dublikata) console.log(`  ${d.hequr} = ${d.mbajtur}`);
for (const d of dublikataNgaLista) console.log(`  ${d} (njihej nga lista)`);
console.log(`Kërkesa HTTP: ${shf.kerkesat} · ${raporti.kohezgjatja_s} s · Dalja: ${dalja}`);
