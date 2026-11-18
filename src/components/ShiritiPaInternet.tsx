import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutUp, useReducedMotion } from "react-native-reanimated";

import { Ikona, T } from "@/components/ui";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { useRrjeti } from "@/lib/rrjeti";
import { useTema } from "@/lib/tema";

// Shiriti "Pa internet": del vetëm kur sistemi thotë se s'ka lidhje (shih useRrjeti), rri në fillim të
// përmbajtjes dhe zhduket vetë kur kthehet interneti. Neutral (drejtimi D): portokallia mbetet vetëm për progresin.
// Lëvizja: rrëshqet nga lart; me "Reduce Motion" vetëm zbehet.
const IKONA = { ios: "wifi.slash", android: "wifi_off" };
const HYRJA = FadeInUp.duration(KOHA.mesme).easing(LEHTESIMI.hyrje).withInitialValues({ transform: [{ translateY: -12 }] });
const DALJA = FadeOutUp.duration(160).easing(LEHTESIMI.dalje);
const HYRJA_E_QETE = FadeIn.duration(KOHA.mesme);
const DALJA_E_QETE = FadeOut.duration(160);

export const TEKSTI_PA_INTERNET = "Pa internet · po shfaqim të dhënat e fundit";

/** Montohet një herë në çdo ekran që shfaq të dhëna (te lista, rezultati, versionet); `teksti` e përshtat fjalinë. */
export default function ShiritiPaInternet({
  teksti = TEKSTI_PA_INTERNET,
  style,
}: {
  teksti?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const { kaInternet } = useRrjeti();
  if (kaInternet) return null;

  return (
    <Animated.View
      entering={qetesi ? HYRJA_E_QETE : HYRJA}
      exiting={qetesi ? DALJA_E_QETE : DALJA}
      style={[styles.vendi, style]}
    >
      <View
        style={[styles.shiriti, { backgroundColor: t.karta2, borderColor: t.vija }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={teksti}
      >
        <Ikona emri={IKONA} madhesia={16} ngjyra={t.zbehur} />
        <T pesha="gjysme" madhesia={13.5} style={styles.teksti}>
          {teksti}
        </T>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vendi: { marginBottom: 12 },
  shiriti: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  teksti: { flex: 1 },
});
