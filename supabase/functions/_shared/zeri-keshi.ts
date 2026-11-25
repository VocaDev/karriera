// Kesh-i i zërit për tekstet FIKSE (25.11): i njëjti tekst me të njëjtin zë s'kushton kërkesë TTS për herë të dytë.
// Ruhen VETËM tekste të shkruara nga kodi: përshëndetja me pyetjen e parë (e njëjta për çdo intervistë të së njëjtës punë)
// dhe pranimi i shkurtër. Pyetjet e AI-së dhe reagimet NUK ruhen: mund të përmbajnë hollësi nga përgjigjet e kandidatit.
// Dy shtresa: kujtesa e instancës (punon edhe pa migrim) dhe tabela zeri_kesh (migrimi 20261125121000; pa të vetëm kujtesa).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

import type { Gjuha, Intervistuesi } from "./intervista-ai.ts";
import { type AudioIFolur, type CopaAudio, type Folesi, lexoWav, neBase64, shkruajWav } from "./zeri.ts";

export type ZeriIRuajtur = { pcm: Uint8Array; shkalla: number };
export interface DepoEZerit {
  lexo(celesi: string): Promise<ZeriIRuajtur | null>;
  shkruaj(celesi: string, z: ZeriIRuajtur): Promise<void>;
}

const COPA = 9_600; // si te transmetoZerin: mesazhe të vogla për urën e telefonit
const MAKS_NE_KUJTESE = 24;
const kujtesa = new Map<string, ZeriIRuajtur>();
export const zbrazKujtesen = () => kujtesa.clear(); // për testet

function mbajNeKujtese(celesi: string, z: ZeriIRuajtur) {
  kujtesa.delete(celesi);
  kujtesa.set(celesi, z);
  if (kujtesa.size > MAKS_NE_KUJTESE) kujtesa.delete(kujtesa.keys().next().value as string);
}

/** Hash i ofruesit të parapëlqyer, gjuhës, zërit dhe tekstit: ndërrimi i ofruesit (p.sh. Azure) s'e përzien zërin. */
export async function celesiIKeshit(ofruesi: string, gjuha: Gjuha, intervistuesi: Intervistuesi, teksti: string): Promise<string> {
  const bajtet = new TextEncoder().encode(JSON.stringify([1, ofruesi, gjuha, intervistuesi, teksti]));
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bajtet));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ngaBase64(s: string): Uint8Array {
  const t = atob(s);
  const a = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i);
  return a;
}

/** Depoja te tabela zeri_kesh (vetëm çelësi sekret). Pa tabelë ose me gabim: sikur s'ka kesh. */
export function depoNeDB(admin: SupabaseClient): DepoEZerit {
  return {
    async lexo(celesi) {
      const { data, error } = await admin.from("zeri_kesh").select("audio_base64, shkalla").eq("celesi", celesi).maybeSingle();
      if (error || !data) return null;
      return { pcm: ngaBase64(data.audio_base64 as string), shkalla: data.shkalla as number };
    },
    async shkruaj(celesi, z) {
      const { error } = await admin
        .from("zeri_kesh")
        .upsert({ celesi, shkalla: z.shkalla, audio_base64: neBase64(z.pcm) }, { onConflict: "celesi", ignoreDuplicates: true });
      if (error) console.error("[zeri-keshi] Audio fikse s'u ruajt (a është aplikuar migrimi zeri_kesh?).");
    },
  };
}

/**
 * Mbështjell zinxhirin me kesh. `ofruesi` = ofruesi i parë i zinxhirit për këtë gjuhë: ruhet vetëm audio që e bëri ai
 * (jo rezerva), dhe vetëm audio e plotë.
 */
export function meKesh(zinxhiri: Folesi, depo: DepoEZerit, ofruesi: string): Folesi {
  async function gjej(celesi: string): Promise<ZeriIRuajtur | null> {
    const k = kujtesa.get(celesi);
    if (k) return k;
    const d = await depo.lexo(celesi).catch(() => null);
    if (d) mbajNeKujtese(celesi, d);
    return d;
  }
  async function ruaj(celesi: string, z: ZeriIRuajtur) {
    mbajNeKujtese(celesi, z);
    await depo.shkruaj(celesi, z).catch(() => {});
  }

  return {
    emri: "zinxhiri-me-kesh",
    async *rrjedhe(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): AsyncGenerator<CopaAudio> {
      const celesi = await celesiIKeshit(ofruesi, gjuha, intervistuesi, teksti);
      const g = await gjej(celesi);
      if (g) {
        for (let i = 0; i < g.pcm.length; i += COPA) {
          yield { pcm: g.pcm.subarray(i, i + COPA), shkalla: g.shkalla, ofruesi };
        }
        return;
      }
      const copat: Uint8Array[] = [];
      let shkalla = 24_000;
      let vetemIPari = true;
      for await (const c of zinxhiri.rrjedhe!(teksti, gjuha, intervistuesi)) {
        copat.push(c.pcm.slice());
        shkalla = c.shkalla;
        if (c.ofruesi !== ofruesi || c.ruaj === false) vetemIPari = false;
        yield c;
      }
      // Arrihet vetëm kur rrjedha përfundoi pa gabim: audio e prerë s'ruhet kurrë.
      if (vetemIPari && copat.length) {
        const pcm = new Uint8Array(copat.reduce((s, c) => s + c.length, 0));
        let i = 0;
        for (const c of copat) {
          pcm.set(c, i);
          i += c.length;
        }
        await ruaj(celesi, { pcm, shkalla });
      }
    },
    async fol(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): Promise<AudioIFolur> {
      const celesi = await celesiIKeshit(ofruesi, gjuha, intervistuesi, teksti);
      const g = await gjej(celesi);
      if (g) {
        const pcm = new Int16Array(g.pcm.slice().buffer, 0, Math.floor(g.pcm.length / 2));
        return { audio: shkruajWav(pcm, g.shkalla), mime: "audio/wav", sekonda: pcm.length / g.shkalla, ofruesi };
      }
      const a = await zinxhiri.fol(teksti, gjuha, intervistuesi);
      const wav = a.ofruesi === ofruesi && a.ruaj !== false ? lexoWav(a.audio) : null;
      if (wav) {
        const pcm = new Uint8Array(wav.mostrat.buffer, wav.mostrat.byteOffset, wav.mostrat.byteLength).slice();
        await ruaj(celesi, { pcm, shkalla: wav.shkalla });
      }
      return a;
    },
  };
}
