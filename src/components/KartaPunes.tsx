import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Chip, Rruga, T } from "@/components/ui";
import type { Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

// Karta e punës në stilin D (bordi, ekrani 09): shirit "E RE", roli, titulli, kompania,
// burimi dhe rruga drejt "gati". Pa CV ende, çdo punë është te hapi i parë (CV).
type Props = { puna: Puna } & React.ComponentProps<typeof Pressable>;

const TRE_DITE_MS = 3 * 24 * 60 * 60 * 1000;

export default function KartaPunes({ puna, style, ...pressableProps }: Props) {
  const t = useTema();
  const [ruajtur, setRuajtur] = useState(false);
  const [tani] = useState(() => Date.now()); // koha merret një herë, jo në çdo render
  const eRe = tani - new Date(puna.krijuar_me).getTime() < TRE_DITE_MS;
  const roli = puna.roli === "Asistent/PR" ? "ZYRË" : puna.roli === "Tjetër" ? "TJETËR" : "SWE";

  return (
    <Pressable
      {...pressableProps}
      style={(state) => [
        styles.karta,
        { backgroundColor: t.karta, shadowColor: t.hija, opacity: state.pressed ? 0.85 : 1 },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {eRe && (
        <View style={[styles.shiriti, { backgroundColor: t.theksi }]}>
          <T pesha="shumeTrashe" madhesia={9} ngjyra="#fff" style={styles.shiritiTekst}>
            E RE
          </T>
        </View>
      )}

      <View style={styles.koka}>
        <Chip teksti={roli} />
        <Pressable
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={ruajtur ? "Hiqe nga të ruajturat" : "Ruaje punën"}
          onPress={(event) => {
            event.stopPropagation();
            setRuajtur(!ruajtur);
          }}
        >
          <T madhesia={20} ngjyra={ruajtur ? t.theksi : t.zbehur}>
            {ruajtur ? "★" : "☆"}
          </T>
        </Pressable>
      </View>

      <T pesha="trashe" madhesia={16.5} style={styles.titulli}>
        {puna.titulli}
      </T>
      <T zbehur madhesia={14}>
        {puna.kompania}, {puna.qyteti}
      </T>
      <T zbehur madhesia={12.5} style={styles.burimi}>
        {puna.burimi === "perdoruesi" ? "Shtuar nga një përdorues" : "Karriera"}
      </T>

      <Rruga hapi={0} />
      <T zbehur madhesia={12.5} style={styles.tani}>
        Tani: <T pesha="trashe" madhesia={12.5}>CV</T> · ngarko CV-në për të parë sa je gati
      </T>
    </Pressable>
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
