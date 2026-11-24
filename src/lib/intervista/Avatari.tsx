// Avatari i intervistës me zë: WebView me faqen e TalkingHead (AGENTS.md: qëllimisht në WebView, mos e bëj native).
// Faqja vetëm flet; ky komponent i bart mesazhet (mesazhet.ts) dhe i kontrollon para se t'i përdorë.
import { useImperativeHandle, useRef, type Ref } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { useTema } from "@/lib/tema";

import { FAQJA_E_AVATARIT } from "./avatari-faqja";
import { koduoPerFaqen, lexoMesazhinNgaFaqja, type FjaliaMeZe, type MesazhPerFaqen } from "./mesazhet";
import { PAMJA_E_INTERVISTUESIT, type Intervistuesi, type Shprehja } from "./tipet";

export type AvatariRef = {
  fol: (id: string, fjalite: FjaliaMeZe[], shprehja: Shprehja, pershendetje: boolean, shto?: boolean) => void;
  /** Zëri në rrjedhë: fillo (ndalon çdo gjë tjetër), copa PCM base64 (16 bit mono, shkalla `s`), mbaroi (s'vjen më). */
  rrjedheFillo: (id: string, shprehja: Shprehja, pershendetje: boolean) => void;
  rrjedhePcm: (id: string, b: string, s: number) => void;
  rrjedheMbaroi: (id: string) => void;
  ndalo: () => void;
  degjon: (po: boolean) => void;
  mendon: () => void;
};

export function Avatari({
  ref,
  intervistuesi,
  onGati,
  onFoliFilloi,
  onFoliMbaroi,
  onPrek,
  onGabim,
  style,
}: {
  ref: Ref<AvatariRef>;
  intervistuesi: Intervistuesi;
  onGati: (meAvatar: boolean) => void;
  onFoliFilloi: (id: string) => void;
  onFoliMbaroi: (id: string) => void;
  onPrek: () => void;
  /** Faqja s'u hap fare (pa internet, WebView dështoi): ekrani kalon te Shkruaj. */
  onGabim: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTema();
  const webview = useRef<WebView<object>>(null);
  const dergo = (m: MesazhPerFaqen) => webview.current?.postMessage(koduoPerFaqen(m));

  useImperativeHandle(ref, () => ({
    fol: (id, fjalite, shprehja, pershendetje, shto = false) => dergo({ lloji: "fol", id, fjalite, shprehja, pershendetje, shto }),
    rrjedheFillo: (id, shprehja, pershendetje) => dergo({ lloji: "rrjedhe_fillo", id, shprehja, pershendetje }),
    rrjedhePcm: (id, b, s) => dergo({ lloji: "rrjedhe_pcm", id, b, s }),
    rrjedheMbaroi: (id) => dergo({ lloji: "rrjedhe_mbaroi", id }),
    ndalo: () => dergo({ lloji: "ndalo" }),
    degjon: (po) => dergo({ lloji: "degjon", po }),
    mendon: () => dergo({ lloji: "mendon" }),
  }));

  function merr(e: WebViewMessageEvent) {
    const m = lexoMesazhinNgaFaqja(e.nativeEvent.data);
    if (!m) return;
    switch (m.lloji) {
      case "ngarkuar":
        dergo({
          lloji: "nis",
          intervistuesi,
          emri: PAMJA_E_INTERVISTUESIT[intervistuesi].emri,
          ngjyrat: { sfondi: t.karta, teksti: t.teksti, unaza: t.zbehur },
        });
        break;
      case "gati":
        onGati(m.avatari);
        break;
      case "foli_filloi":
        onFoliFilloi(m.id);
        break;
      case "foli_mbaroi":
        onFoliMbaroi(m.id);
        break;
      case "prek":
        onPrek();
        break;
      case "gabim":
        // Gabimet e faqes s'e ndalin intervistën (zëri ose unaza vazhdojnë); pa tekst të intervistës në log.
        if (__DEV__) console.log("[avatari]", m.kodi, m.mesazhi);
        break;
    }
  }

  return (
    <View
      style={[styles.korniza, { backgroundColor: t.karta, borderColor: t.vija }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <WebView<object>
        ref={webview}
        source={{ html: FAQJA_E_AVATARIT, baseUrl: "https://karriera.local/" }}
        originWhitelist={["*"]}
        onMessage={merr}
        onError={onGabim}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={[styles.webview, { backgroundColor: t.karta }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  korniza: { borderRadius: 24, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  webview: { flex: 1 },
});
