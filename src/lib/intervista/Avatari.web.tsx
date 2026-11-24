// Web: react-native-webview s'ka web dhe Fol s'ofrohet atje (useRegjistruesi.web.ts). Kjo kopje mban emrat
// që ekrani të përpilohet; s'vizatohet kurrë sepse ekrani s'e hap Fol-in në web.
import type { Ref } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { FjaliaMeZe } from "./mesazhet";
import type { Intervistuesi, Shprehja } from "./tipet";

export type AvatariRef = {
  fol: (id: string, fjalite: FjaliaMeZe[], shprehja: Shprehja, pershendetje: boolean, shto?: boolean) => void;
  rrjedheFillo: (id: string, shprehja: Shprehja, pershendetje: boolean) => void;
  rrjedhePcm: (id: string, b: string, s: number) => void;
  rrjedheMbaroi: (id: string) => void;
  ndalo: () => void;
  degjon: (po: boolean) => void;
  mendon: () => void;
  kamera: (po: boolean) => void;
};

export function Avatari(_props: {
  ref: Ref<AvatariRef>;
  intervistuesi: Intervistuesi;
  onGati: (meAvatar: boolean) => void;
  onFoliFilloi: (id: string) => void;
  onFoliMbaroi: (id: string) => void;
  onPrek: () => void;
  onGabim: () => void;
  onKamera?: (m: { lloji: string }) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return null;
}
