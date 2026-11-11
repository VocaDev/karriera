import { useState } from "react";
import { StyleSheet, View, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import Prekshme from "@/components/Prekshme";
import { Chip, Rruga, T } from "@/components/ui";
import { LEHTESIMI } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import type { Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

// Karta e punës në stilin D (bordi, ekrani 09): shirit "E RE", roli, titulli, kompania,
// burimi dhe rruga drejt "gati". Pa CV ende, çdo punë është te hapi i parë (CV).
// ⭐ ruhet në Supabase (punet_e_ruajtura): lista mban gjendjen dhe e jep këtu me `ruajtur`.
type Props = {
  puna: Puna;
  ruajtur?: boolean;
  kurNdryshonRuajtja?: (ruaje: boolean) => void; // pa këtë, ylli s'shfaqet (p.sh. te punëdhënësi)
} & Omit<PressableProps, "style">;

const TRE_DITE_MS = 3 * 24 * 60 * 60 * 1000;

export default function KartaPunes({ puna, ruajtur = false, kurNdryshonRuajtja, ...pressableProps }: Props) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const [tani] = useState(() => Date.now()); // koha merret një herë, jo në çdo render
  const ylli = useSharedValue(1);
  const stiliIYllit = useAnimatedStyle(() => ({ transform: [{ scale: ylli.get() }] }));
  const eRe = tani - new Date(puna.krijuar_me).getTime() < TRE_DITE_MS;
  const roli = puna.roli === "Asistent/PR" ? "ZYRË" : puna.roli === "Tjetër" ? "TJETËR" : "SWE";

  function ndryshoRuajtjen() {
    prekja.zgjedhje();
    kurNdryshonRuajtja?.(!ruajtur);
    // ylli "kërcen" një herë: momenti i vogël i kënaqësisë, i vetmi vend ku lejohet pak tepri
    if (!qetesi) {
      ylli.set(
        withSequence(
          withTiming(1.3, { duration: 110, easing: LEHTESIMI.hyrje }),
          withTiming(1, { duration: 160, easing: LEHTESIMI.levizje }),
        ),
      );
    }
  }

  return (
    <Prekshme {...pressableProps} style={[styles.karta, { backgroundColor: t.karta, shadowColor: t.hija }]}>
      {eRe && (
        <View style={[styles.shiriti, { backgroundColor: t.theksi }]}>
          <T pesha="shumeTrashe" madhesia={9} ngjyra="#fff" style={styles.shiritiTekst}>
            E RE
          </T>
        </View>
      )}

      <View style={styles.koka}>
        <Chip teksti={roli} />
        {kurNdryshonRuajtja && (
          <Prekshme
            hitSlop={12}
            shkalla={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: ruajtur }}
            accessibilityLabel={ruajtur ? "Hiqe nga të ruajturat" : "Ruaje punën"}
            onPress={(event) => {
              event.stopPropagation();
              ndryshoRuajtjen();
            }}
          >
            <Animated.View style={stiliIYllit}>
              <T madhesia={20} ngjyra={ruajtur ? t.theksi : t.zbehur}>
                {ruajtur ? "★" : "☆"}
              </T>
            </Animated.View>
          </Prekshme>
        )}
      </View>

      <T pesha="trashe" madhesia={16.5} style={styles.titulli}>
        {puna.titulli}
      </T>
      <T zbehur madhesia={14}>
        {puna.kompania}, {puna.qyteti}
      </T>
      <T zbehur madhesia={12.5} style={styles.burimi}>
        {puna.burimi === "perdoruesi" ? "Nga një punëdhënës në Karriera" : "Karriera"}
      </T>

      <Rruga hapi={0} />
      <T zbehur madhesia={12.5} style={styles.tani}>
        Tani:{" "}
        <T pesha="trashe" madhesia={12.5}>
          CV
        </T>{" "}
        · ngarko CV-në për të parë sa je gati
      </T>
    </Prekshme>
  );
}

const styles = StyleSheet.create({
  karta: {
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    overflow: "hidden",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  shiriti: {
    position: "absolute",
    top: 12,
    right: -30,
    width: 110,
    paddingVertical: 3,
    transform: [{ rotate: "35deg" }],
    alignItems: "center",
  },
  shiritiTekst: { letterSpacing: 0.8 },
  koka: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 40 },
  titulli: { marginTop: 6, lineHeight: 21 },
  burimi: { marginTop: 4 },
  tani: { marginTop: 6 },
});
