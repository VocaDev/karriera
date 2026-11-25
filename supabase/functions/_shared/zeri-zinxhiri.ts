// Zinxhiri i zërit: Azure → Gemini 3.8 Flash TTS → Gemini 3.8 Flash-Lite TTS → teksti në ekran me një fjali të sinqertë.
// Ofruesi i radhës provohet vetëm kur i pari dështon PARA copës së parë të audios (ose para se të kthejë audion): pasi
// zëri ka filluar, s'ndërrohet në mes të fjalisë (app-i ka rrugën e vet rezervë për pjesën që mbeti).
// Ofruesit e pakonfiguruar dhe ata pa gjuhën e intervistës kapërcehen pa zhurmë.
import type { Gjuha, Intervistuesi } from "./intervista-ai.ts";
import { type AudioIFolur, type CopaAudio, type Folesi, GabimIZerit, gabimIKuotes } from "./zeri.ts";

/** Gabimi që i shkon app-it kur asnjë ofrues s'dha zë. */
export function gabimiPerfundimtar(deshtimet: GabimIZerit[]): GabimIZerit {
  const teProvuar = deshtimet.filter((e) => !e.konfigurim);
  if (teProvuar.length === 0) return new GabimIZerit("Zëri s'është konfiguruar ende. Vazhdo me shkrim.", true);
  const meKuote = teProvuar.filter((e) => e.kuota);
  if (meKuote.length) {
    // "Ditor" vetëm kur ÇDO ofrues i provuar ka mbaruar kufirin afatgjatë: përndryshe pyetja tjetër mund të ketë zë.
    return gabimIKuotes(meKuote[0].detaje, teProvuar.every((e) => e.kufiriDitor));
  }
  return teProvuar[teProvuar.length - 1];
}

const siGabimZeri = (e: unknown) => (e instanceof GabimIZerit ? e : new GabimIZerit("Zëri dështoi. Provo përsëri."));

export function zinxhiriIZerit(ofruesit: Folesi[]): Folesi {
  const perGjuhen = (gjuha: Gjuha) =>
    ofruesit.filter((o) => o.iGatshem?.() !== false && (!o.gjuhet || o.gjuhet.includes(gjuha)));

  async function* rrjedhe(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): AsyncGenerator<CopaAudio> {
    const deshtimet: GabimIZerit[] = [];
    for (const o of perGjuhen(gjuha)) {
      if (!o.rrjedhe) continue;
      const copat = o.rrjedhe(teksti, gjuha, intervistuesi);
      let ePara: IteratorResult<CopaAudio>;
      try {
        ePara = await copat.next();
        if (ePara.done) throw new GabimIZerit("Zëri doli bosh. Provo përsëri.");
      } catch (e) {
        deshtimet.push(siGabimZeri(e));
        continue;
      }
      yield { ...ePara.value, ofruesi: o.emri };
      for await (const c of copat) yield { ...c, ofruesi: o.emri };
      return;
    }
    throw gabimiPerfundimtar(deshtimet);
  }

  return {
    emri: "zinxhiri",
    rrjedhe,
    async fol(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): Promise<AudioIFolur> {
      const deshtimet: GabimIZerit[] = [];
      for (const o of perGjuhen(gjuha)) {
        try {
          return { ...(await o.fol(teksti, gjuha, intervistuesi)), ofruesi: o.emri };
        } catch (e) {
          deshtimet.push(siGabimZeri(e));
        }
      }
      throw gabimiPerfundimtar(deshtimet);
    },
  };
}
