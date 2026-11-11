import { useEffect, type ReactNode } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTema } from "@/lib/tema";

// Skeleti (bordi, ekrani 24): ka formën e kartave të vërteta, që ekrani të mos "kërcejë" kur vijnë të dhënat.
// Pulson ngadalë (jo shkëlqim që vrapon), që të duket i qetë; me "Reduce Motion" rri i palëvizur.

/** Pulsi i përbashkët: zbehet butë 1 → 0,55 → 1, pa fund, derisa të vijnë të dhënat. */
export function Pulsi({ children }: { children: ReactNode }) {
  const qetesi = useReducedMotion();
  const dukshmeria = useSharedValue(1);

  useEffect(() => {
    if (qetesi) return;
    dukshmeria.set(withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(dukshmeria);
  }, [qetesi, dukshmeria]);

  const stili = useAnimatedStyle(() => ({ opacity: qetesi ? 0.7 : dukshmeria.get() }));
  return <Animated.View style={stili}>{children}</Animated.View>;
}

/** Një vijë gri në vend të tekstit që vjen. */
export function Vije({ gjeresia, lartesia = 14, rrezja = 7 }: { gjeresia: DimensionValue; lartesia?: number; rrezja?: number }) {
  const t = useTema();
  return <View style={{ width: gjeresia, height: lartesia, borderRadius: rrezja, backgroundColor: t.karta2 }} />;
}

/** Karta e punës gjatë ngarkimit: chip-i, titulli, kompania, rruga. */
export function KartaSkelet() {
  const t = useTema();
  return (
    <View style={[styles.karta, { backgroundColor: t.karta, shadowColor: t.hija }]}>
      <Pulsi>
        <View style={styles.permbajtja}>
          <Vije gjeresia={46} lartesia={20} rrezja={7} />
          <Vije gjeresia="78%" lartesia={17} />
          <Vije gjeresia="52%" lartesia={13} />
          <Vije gjeresia="100%" lartesia={10} rrezja={5} />
        </View>
      </Pulsi>
    </View>
  );
}

const styles = StyleSheet.create({
  karta: {
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  permbajtja: { gap: 11 },
});
