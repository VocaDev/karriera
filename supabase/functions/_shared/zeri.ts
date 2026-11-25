// Zëri i intervistës: dy përshtatës (adapter) të ndarë mes intervistës dhe ofruesve, plus puna me WAV.
//
// Intervista s'di asgjë për ofruesit: i kërkon Degjuesit tekstin nga audio (STT) dhe Folesit audio nga teksti (TTS).
// Sot: Groq Whisper për dëgjimin (zeri-groq.ts) dhe Gemini TTS për zërin (zeri-gemini.ts). Për ta ndërruar njërin
// (p.sh. Azure, nëse Kosova pranohet atje) mjafton një implementim tjetër i Degjuesit ose Folesit, pa prekur intervista-zeri.
//
// Audio s'ruhet kurrë: jeton vetëm në memorie gjatë kërkesës. Asnjë log me audio ose transkript.
import type { Gjuha, Intervistuesi } from "./intervista-ai.ts";

// ---------- Kufijtë ----------
export const SHKALLA_STT = 16_000; // Hz: Whisper punon në 16 kHz; më pak bajtë për ngarkim
export const MAKS_SEKONDA_PERGJIGJE = 95; // app-i ndalon në 90 s; pak hapësirë për header-at
export const MIN_SEKONDA_PERGJIGJE = 0.4; // më pak se kaq: s'ka çka të dëgjohet
export const MAKS_BAJT_AUDIO = 20 * 1024 * 1024; // 90 s edhe në 48 kHz float32 (≈ 17 MB)
/** Minutat e zërit për përdorues në 24 orë: sekondat e regjistruara + kohëzgjatja e zërit të intervistuesit. */
export const KUFIRI_DITOR_MINUTA_ZERI = 30;

// ---------- Kontratat e ofruesve ----------
export type AudioIFolur = {
  /** WAV (PCM 16 bit mono). */
  audio: Uint8Array;
  mime: string;
  sekonda: number;
  /** Header-at e kufijve që kthen ofruesi (p.sh. "x-ratelimit-*"), për prova; kurrë sekrete. */
  kufijte?: Record<string, string>;
};

/** Një copë e rrjedhës së TTS: PCM 16 bit mono little-endian (numër çift bajtesh) me shkallën e mostrimit. */
export type CopaAudio = { pcm: Uint8Array; shkalla: number };

/** STT: tekst nga audio. */
export interface Degjuesi {
  /** Emri për log-et (pa sekrete). */
  readonly emri: string;
  /** Tekst nga PCM 16 kHz mono int16. "" kur s'u dëgjua asgjë. Hedh GabimIZerit kur ofruesi dështon. */
  degjo(pcm: Int16Array, gjuha: Gjuha): Promise<string>;
}

/** TTS: zëri i intervistuesit. */
export interface Folesi {
  readonly emri: string;
  /** Audio nga teksti i një kthese (një ose disa fjali). Hedh GabimIZerit kur ofruesi dështon. */
  fol(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): Promise<AudioIFolur>;
  /**
   * Njëlloj, por audio vjen në copa sapo ofruesi i krijon (byte-i i parë pas ~2 s te Gemini, në vend të ~4,5 s për
   * gjithë audion). Hedh GabimIZerit para copës së parë ose mes rrjedhës.
   */
  rrjedhe?(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): AsyncGenerator<CopaAudio>;
}

/** Gabim i ofruesit të zërit: mesazhi është për app-in (shqip), pa detaje teknike. */
export class GabimIZerit extends Error {
  readonly konfigurim: boolean;
  /** Kufiri ditor i ofruesit të zërit mbaroi: s'ka kuptim të provohet sërish sot. */
  kufiriDitor = false;
  /** Vetëm për skriptet e provës: statusi, header-at e kufijve dhe fillimi i trupit të gabimit. Funksionet s'e shkruajnë në log. */
  readonly detaje: { status: number; kufijte: Record<string, string>; trupi: string } | null;
  constructor(
    mesazhi: string,
    konfigurim = false,
    detaje: { status: number; kufijte: Record<string, string>; trupi: string } | null = null,
  ) {
    super(mesazhi);
    this.name = "GabimIZerit";
    this.konfigurim = konfigurim;
    this.detaje = detaje;
  }
}

/** Header-at e kufijve (vetëm emrat që flasin për kufij; asnjëherë autorizim). */
export function headerAtEKufijve(h: Headers): Record<string, string> {
  const r: Record<string, string> = {};
  h.forEach((v, k) => {
    if (/ratelimit|quota|retry-after/i.test(k)) r[k] = v;
  });
  return r;
}

/** Thirrje HTTP me afat; gabimet bëhen GabimIZerit me fjali shqip. Në log vetëm statusi. */
export async function thirrOfruesin(url: string, init: RequestInit, cka: string, emri: string, afatiMs = 30_000): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(url, { ...init, signal: AbortSignal.timeout(afatiMs) });
  } catch {
    throw new GabimIZerit(`${cka} s'u përgjigj. Provo përsëri.`);
  }
  if (r.ok) return r;
  const detaje = { status: r.status, kufijte: headerAtEKufijve(r.headers), trupi: (await r.text().catch(() => "")).slice(0, 3000) };
  console.error(`[${emri}] ${cka}: HTTP ${r.status}`);
  if (r.status === 401 || r.status === 403) {
    throw new GabimIZerit("Zëri s'është konfiguruar mirë. Vazhdo me shkrim.", true, detaje);
  }
  if (r.status === 429) {
    throw new GabimIZerit("Shërbimi i zërit është i zënë tani. Provo pas pak ose vazhdo me shkrim.", false, detaje);
  }
  throw new GabimIZerit(`${cka} dështoi. Provo përsëri.`, false, detaje);
}

/**
 * Çka thotë ofruesi për një 429: sa të presim (retry-after ose "retryDelay": "7s" te trupi i gabimit të Google-it) dhe cili
 * kufi u godit (quotaId / quotaMetric: emra kufijsh, jo të dhëna përdoruesi). null kur s'e thotë.
 */
export function lexoKufirin(
  d: { kufijte: Record<string, string>; trupi: string } | null,
): { vonesaMs: number | null; kufiri: string | null } {
  if (!d) return { vonesaMs: null, kufiri: null };
  const header = d.kufijte["retry-after"];
  const ngaHeaderi = header && /^\d+(\.\d+)?$/.test(header.trim()) ? Number(header) * 1000 : null;
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(d.trupi);
  const vonesaMs = ngaHeaderi ?? (m ? Number(m[1]) * 1000 : null);
  // Interactions API e thotë kufirin vetëm me fjalë: "(limit: 10 requests per day on Free Tier)" (parë 25.11).
  const kufiri =
    /"quota(?:Id|Metric)"\s*:\s*"([^"]{1,120})"/.exec(d.trupi)?.[1] ?? /\(limit: ([^)]{1,80})\)/.exec(d.trupi)?.[1] ?? null;
  return { vonesaMs: vonesaMs === null ? null : Math.round(vonesaMs), kufiri };
}

// ---------- WAV ----------
export type Pcm = { mostrat: Int16Array; shkalla: number };

const ascii = (b: Uint8Array, nga: number) => String.fromCharCode(b[nga], b[nga + 1], b[nga + 2], b[nga + 3]);

/**
 * Lexon një WAV (PCM 16/24/32 bit ose float32, mono ose stereo) dhe e kthen në mono int16.
 * Pranon edhe header-in "WAVE_FORMAT_EXTENSIBLE". Nëse madhësia e "data" s'është shkruar (regjistrim i ndërprerë),
 * merret gjithçka deri në fund. null = s'është WAV i njohur.
 */
export function lexoWav(bajtet: Uint8Array): Pcm | null {
  if (bajtet.length < 44 || ascii(bajtet, 0) !== "RIFF" || ascii(bajtet, 8) !== "WAVE") return null;
  const v = new DataView(bajtet.buffer, bajtet.byteOffset, bajtet.byteLength);
  let formati = 0;
  let kanalet = 0;
  let shkalla = 0;
  let bitet = 0;
  let i = 12;
  while (i + 8 <= bajtet.length) {
    const id = ascii(bajtet, i);
    let madhesia = v.getUint32(i + 4, true);
    const fillimi = i + 8;
    if (id === "fmt ") {
      if (fillimi + 16 > bajtet.length) return null;
      formati = v.getUint16(fillimi, true);
      kanalet = v.getUint16(fillimi + 2, true);
      shkalla = v.getUint32(fillimi + 4, true);
      bitet = v.getUint16(fillimi + 14, true);
      if (formati === 0xfffe && madhesia >= 40 && fillimi + 26 <= bajtet.length) {
        formati = v.getUint16(fillimi + 24, true); // nënformati: 1 = PCM, 3 = float
      }
    } else if (id === "data") {
      if (!formati || !kanalet || !shkalla) return null;
      if (madhesia === 0 || madhesia === 0xffffffff || fillimi + madhesia > bajtet.length) {
        madhesia = bajtet.length - fillimi;
      }
      return { mostrat: neMonoInt16(v, fillimi, madhesia, formati, kanalet, bitet), shkalla };
    }
    i = fillimi + madhesia + (madhesia % 2);
  }
  return null;
}

function neMonoInt16(v: DataView, nga: number, madhesia: number, formati: number, kanalet: number, bitet: number): Int16Array {
  const bajtPerMoster = bitet / 8;
  if (!(formati === 1 && (bitet === 16 || bitet === 24 || bitet === 32)) && !(formati === 3 && bitet === 32)) {
    return new Int16Array(0);
  }
  const korniza = bajtPerMoster * kanalet;
  const n = Math.floor(madhesia / korniza);
  const dalja = new Int16Array(n);
  for (let k = 0; k < n; k++) {
    let shuma = 0;
    for (let c = 0; c < kanalet; c++) {
      const p = nga + k * korniza + c * bajtPerMoster;
      let x: number;
      if (formati === 3) x = v.getFloat32(p, true);
      else if (bitet === 16) x = v.getInt16(p, true) / 32768;
      else if (bitet === 24) x = ((v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) / 8388608);
      else x = v.getInt32(p, true) / 2147483648;
      shuma += x;
    }
    const m = Math.max(-1, Math.min(1, shuma / kanalet));
    dalja[k] = Math.round(m * 32767);
  }
  return dalja;
}

/** Rimostrim linear në `ne` Hz (zëri i folur s'ka nevojë për filtër më të mirë për STT). */
export function rimostro(pcm: Pcm, ne = SHKALLA_STT): Int16Array {
  if (pcm.shkalla === ne || pcm.mostrat.length === 0) return pcm.mostrat;
  const raporti = pcm.shkalla / ne;
  const n = Math.floor(pcm.mostrat.length / raporti);
  const dalja = new Int16Array(n);
  for (let k = 0; k < n; k++) {
    const x = k * raporti;
    const i = Math.floor(x);
    const f = x - i;
    const a = pcm.mostrat[i];
    const b = pcm.mostrat[Math.min(i + 1, pcm.mostrat.length - 1)];
    dalja[k] = Math.round(a + (b - a) * f);
  }
  return dalja;
}

/** WAV PCM 16 bit mono, si e kërkon STT REST. */
export function shkruajWav(mostrat: Int16Array, shkalla = SHKALLA_STT): Uint8Array<ArrayBuffer> {
  const bajtet = new Uint8Array(new ArrayBuffer(44 + mostrat.length * 2));
  const v = new DataView(bajtet.buffer);
  const shkruaj = (i: number, s: string) => {
    for (let k = 0; k < 4; k++) bajtet[i + k] = s.charCodeAt(k);
  };
  shkruaj(0, "RIFF");
  v.setUint32(4, 36 + mostrat.length * 2, true);
  shkruaj(8, "WAVE");
  shkruaj(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, shkalla, true);
  v.setUint32(28, shkalla * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  shkruaj(36, "data");
  v.setUint32(40, mostrat.length * 2, true);
  for (let k = 0; k < mostrat.length; k++) v.setInt16(44 + k * 2, mostrat[k], true);
  return bajtet;
}

/** Pranimi i shkurtër që luhet sapo kandidati mbaron së foluri, ndërsa pret kthesën (një për intervistë). */
export const MBUSHESIT: Record<Gjuha, string> = {
  sq: "Mirë, e kuptoj.",
  en: "Okay, I see.",
  de: "Gut, verstehe.",
};

/** Mbyllja që thuhet pas reagimit të fundit (e njëjta si në ekranin e intervistës). */
export const MBYLLJA: Record<Gjuha, string> = {
  sq: "Kaq ishte nga ana ime, ju faleminderit për kohën.",
  en: "That's all from my side, thank you for your time.",
  de: "Das war's von meiner Seite, vielen Dank für Ihre Zeit.",
};

// ---------- base64 (pa varësi) ----------
export function neBase64(bajtet: Uint8Array): string {
  let s = "";
  const COPA = 0x8000;
  for (let i = 0; i < bajtet.length; i += COPA) {
    s += String.fromCharCode(...bajtet.subarray(i, i + COPA));
  }
  return btoa(s);
}
