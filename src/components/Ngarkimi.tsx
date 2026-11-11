import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { T } from "@/components/ui";
import Unaza from "@/components/Unaza";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { useTema } from "@/lib/tema";

// Hapja e app-it, i vetmi moment i planifikuar me lëvizje. Fillon njësoj si splash-i i telefonit
// (pllaka e ikonës në mes, harku në 78%), pastaj harku mbushet deri në 100%: "gati". ✓ ngrihet lehtë
// dhe ekrani zbehet te app-i. Gjithsej rreth gjysmë sekonde; me "Reduce Motion" vetëm zbehet.
export const PLLAKA = 104; // = imageWidth i splash-it në app.json, që kalimi të mos kërcejë

type Props = {
  gati: boolean; // app-i është gati poshtë (sot: fontet; pas J6 edhe sesioni)
  kurShfaqet: () => void; // ekrani u vizatua: splash-i i telefonit mund të fshihet
  kurMbaron: () => void;
};

const DALJA = FadeOut.duration(220).easing(LEHTESIMI.dalje);

export default function Ngarkimi({ gati, kurShfaqet, kurMbaron }: Props) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const progresi = useSharedValue(0.78);
  const ngritja = useSharedValue(1);
  const [harkuPlot, setHarkuPlot] = useState(false);
  const plot = qetesi || harkuPlot;

  useEffect(() => {
    if (qetesi) {
      progresi.set(1);
      return;
    }
    progresi.set(
      withTiming(1, { duration: KOHA.ngadale, easing: LEHTESIMI.levizje }, (mbaroi) => {
        if (mbaroi) scheduleOnRN(setHarkuPlot, true);
      }),
    );
  }, [qetesi, progresi]);

  useEffect(() => {
    if (!plot || !gati) return;
    if (qetesi) {
      kurMbaron();
      return;
    }
    ngritja.set(
      withSequence(
        withTiming(1.06, { duration: KOHA.shpejt, easing: LEHTESIMI.hyrje }),
        withTiming(1, { duration: 140, easing: LEHTESIMI.levizje }, (mbaroi) => {
          if (mbaroi) scheduleOnRN(kurMbaron);
        }),
      ),
    );
  }, [plot, gati, qetesi, ngritja, kurMbaron]);

  const stiliIPllakes = useAnimatedStyle(() => ({ transform: [{ scale: ngritja.get() }] }));

  return (
    <Animated.View
      exiting={qetesi ? FadeOut.duration(150) : DALJA}
      onLayout={() => kurShfaqet()}
      style={[StyleSheet.absoluteFill, styles.qendra, { backgroundColor: t.sfondi }]}
      accessible
      accessibilityLabel="Karriera po hapet"
    >
      <Animated.View
        style={[
          styles.pllaka,
          t.errët
            ? { backgroundColor: t.karta, borderColor: t.vija, borderWidth: StyleSheet.hairlineWidth }
            : { backgroundColor: "#FFFFFF" },
          stiliIPllakes,
        ]}
      >
        <Unaza
          madhesia={PLLAKA}
          progresi={progresi}
          ngjyrat={{ gjurma: t.errët ? "#2A2A2D" : "#EDEDED", harku: t.theksi, shenja: t.teksti }}
        />
      </Animated.View>
      <View style={styles.emri} pointerEvents="none">
        <Animated.View entering={qetesi ? undefined : FadeIn.duration(KOHA.mesme).delay(80)}>
          <T pesha="shumeTrashe" madhesia={28} style={styles.emriTeksti}>
            Karriera
          </T>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  qendra: { alignItems: "center", justifyContent: "center", zIndex: 10 },
  pllaka: { width: PLLAKA, height: PLLAKA, borderRadius: 24, overflow: "hidden" },
  emri: { position: "absolute", left: 0, right: 0, top: "50%", marginTop: PLLAKA / 2 + 22, alignItems: "center" },
  emriTeksti: { letterSpacing: -0.8 },
});
