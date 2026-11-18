// Mikrofoni i intervistës me zë: prek për të folur, prek për të ndaluar (expo-audio, AudioStream → WAV).
//
// Pse AudioStream dhe jo useAudioRecorder: WAV PCM i pastër, që serveri e lexon, e mat dhe e rimostron vetë në 16 kHz
// pa dekoder (Groq pranon edhe M4A, por atëherë serveri s'e di kohëzgjatjen pa e dekoduar). AudioStream shkruan WAV
// në Android dhe iOS (docs v58).
// Kërkojmë 16 kHz mono int16 (iOS e konverton vetë); nëse pajisja jep tjetër shkallë, serveri e rimostron.
//
// iOS: AudioStream e vendos sesionin në "record"; pas ndalimit e kthejmë te "playback", ndryshe avatari s'dëgjohet.
// Skedari WAV fshihet pasi dërgohet (ose kur anulohet): audio s'mbetet në telefon.
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from "expo-audio";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

export const MAKS_SEKONDA_ZERI = 90;
const MIN_SEKONDA_ZERI = 0.6;

export type Leja = "lejuar" | "pa_pyetur" | "bllokuar";

/** Leja e mikrofonit pa e pyetur përdoruesin. */
export async function lexoLejen(): Promise<Leja> {
  const r = await getRecordingPermissionsAsync();
  if (r.granted) return "lejuar";
  return r.canAskAgain ? "pa_pyetur" : "bllokuar";
}

/** Dritarja e sistemit; thirret vetëm pasi ekrani e ka shpjeguar pse. */
export async function kerkoLejen(): Promise<boolean> {
  const r = await requestRecordingPermissionsAsync();
  return r.granted;
}

export const mbeshtetetZeri = true;

/** Fshin WAV-in e dërguar; dështimi s'ka rëndësi (cache-i pastrohet nga sistemi). */
export function fshiRegjistrimin(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // s'ka gjë
  }
}

async function kthePlayback() {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
}

export type Regjistrimi = { uri: string; sekonda: number };

export type Regjistruesi = {
  regjistron: boolean;
  /** Sekondat që nga fillimi (për numëruesin në ekran). */
  sekonda: number;
  /** 0–1, sa fort po flet (për unazën e mikrofonit). */
  niveli: SharedValue<number>;
  nis: () => Promise<void>;
  /** null kur regjistrimi ishte shumë i shkurtër (prekje aksidentale): skedari fshihet. */
  ndalo: () => Promise<Regjistrimi | null>;
  anulo: () => void;
};

export function useRegjistruesi(kurMbaronKoha: () => void): Regjistruesi {
  const niveli = useSharedValue(0);
  const { stream } = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: "int16",
    onBuffer: (b: AudioStreamBuffer) => {
      const m = new Int16Array(b.data);
      let s = 0;
      for (let i = 0; i < m.length; i += 4) s += (m[i] / 32768) ** 2;
      const rms = Math.sqrt(s / Math.max(1, m.length / 4));
      niveli.set(Math.min(1, rms * 6));
    },
  });
  const [regjistron, setRegjistron] = useState(false);
  const [sekonda, setSekonda] = useState(0);
  const fillimi = useRef(0);
  const ora = useRef<ReturnType<typeof setInterval> | null>(null);
  const kurMbaron = useRef(kurMbaronKoha);
  useEffect(() => {
    kurMbaron.current = kurMbaronKoha;
  }, [kurMbaronKoha]);

  const ndalOren = useCallback(() => {
    if (ora.current) clearInterval(ora.current);
    ora.current = null;
  }, []);

  const nis = useCallback(async () => {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await stream.start();
    try {
      await stream.startFileRecordingAsync({ format: "wav", directory: "cache" });
    } catch (e) {
      stream.stop();
      await kthePlayback();
      throw e;
    }
    fillimi.current = Date.now();
    setSekonda(0);
    setRegjistron(true);
    ndalOren();
    ora.current = setInterval(() => {
      const s = (Date.now() - fillimi.current) / 1000;
      setSekonda(Math.floor(s));
      if (s >= MAKS_SEKONDA_ZERI) {
        ndalOren();
        kurMbaron.current();
      }
    }, 250);
  }, [ndalOren, stream]);

  const ndalo = useCallback(async (): Promise<Regjistrimi | null> => {
    ndalOren();
    setRegjistron(false);
    niveli.set(0);
    let r: { uri: string; duration: number } | null = null;
    try {
      r = await stream.stopFileRecordingAsync();
    } finally {
      stream.stop();
      await kthePlayback();
    }
    if (!r) return null;
    if (r.duration < MIN_SEKONDA_ZERI) {
      fshiRegjistrimin(r.uri);
      return null;
    }
    return { uri: r.uri, sekonda: r.duration };
  }, [ndalOren, niveli, stream]);

  const anulo = useCallback(() => {
    ndalOren();
    setRegjistron(false);
    niveli.set(0);
    stream
      .stopFileRecordingAsync()
      .then((r) => fshiRegjistrimin(r.uri))
      .catch(() => {})
      .finally(() => {
        stream.stop();
        kthePlayback();
      });
  }, [ndalOren, niveli, stream]);

  // Del nga ekrani gjatë regjistrimit: mikrofoni mbyllet.
  useEffect(
    () => () => {
      ndalOren();
      try {
        stream.stop();
      } catch {
        // tashmë i ndalur
      }
      kthePlayback();
    },
    [ndalOren, stream],
  );

  return { regjistron, sekonda, niveli, nis, ndalo, anulo };
}
