// Në web, Fol s'ofrohet: AudioStream s'shkruan skedar WAV atje dhe avatari (WebView) s'ka web.
// Kjo kopje mban të njëjtat emra që ekrani të përpilohet; ekrani s'e hap Fol-in kur mbeshtetetZeri është false.
import { useSharedValue, type SharedValue } from "react-native-reanimated";

export const MAKS_SEKONDA_ZERI = 90;

export type Leja = "lejuar" | "pa_pyetur" | "bllokuar";
export type Regjistrimi = { uri: string; sekonda: number };
export type Regjistruesi = {
  regjistron: boolean;
  sekonda: number;
  niveli: SharedValue<number>;
  nis: () => Promise<void>;
  ndalo: () => Promise<Regjistrimi | null>;
  anulo: () => void;
};

export const mbeshtetetZeri = false;

export async function lexoLejen(): Promise<Leja> {
  return "bllokuar";
}

export async function kerkoLejen(): Promise<boolean> {
  return false;
}

export function fshiRegjistrimin(_uri: string) {}

export function useRegjistruesi(_kurMbaronKoha: () => void): Regjistruesi {
  const niveli = useSharedValue(0);
  return {
    regjistron: false,
    sekonda: 0,
    niveli,
    nis: async () => {
      throw new Error("Fol është vetëm në telefon.");
    },
    ndalo: async () => null,
    anulo: () => {},
  };
}
