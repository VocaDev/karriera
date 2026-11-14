// Përbërës të vegjël që i ndajnë vetëm tri ekranet e intervistës (src/app/intervista/*).
// Jetojnë këtu sepse çdo fajll te src/app bëhet rrugë (route).
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import Prekshme from "@/components/Prekshme";
import { IKONAT, Ikona, Karta, T } from "@/components/ui";
import { useTema } from "@/lib/tema";

/** Butoni në formë kapsule (si te detajet e punës): "kryesor" i errët, "dytesor" me kornizë. */
export function Butoni({
  teksti,
  onPress,
  lloji = "kryesor",
  duke_punuar = false,
  joaktiv = false,
  pershkrimi,
  style,
}: {
  teksti: string;
  onPress: () => void;
  lloji?: "kryesor" | "dytesor";
  duke_punuar?: boolean;
  joaktiv?: boolean;
  pershkrimi?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTema();
  const kryesor = lloji === "kryesor";
  const ngjyra = kryesor ? t.sfondi : t.teksti;
  return (
    <Prekshme
      accessibilityRole="button"
      accessibilityLabel={teksti}
      accessibilityHint={pershkrimi}
      accessibilityState={{ disabled: joaktiv || duke_punuar, busy: duke_punuar }}
      disabled={joaktiv || duke_punuar}
      onPress={onPress}
      style={[
        styles.butoni,
        kryesor ? { backgroundColor: t.teksti } : { borderWidth: 1.5, borderColor: t.vija, backgroundColor: t.karta },
        (joaktiv || duke_punuar) && { opacity: 0.45 },
        style,
      ]}
    >
      {duke_punuar && <ActivityIndicator color={ngjyra} />}
      <T pesha="trashe" madhesia={16} ngjyra={ngjyra}>
        {teksti}
      </T>
    </Prekshme>
  );
}

/** Gabim me fjali në shqip dhe (kur ka kuptim) "Provo përsëri". */
export function KartaEGabimit({
  titulli,
  mesazhi,
  riprovo,
}: {
  titulli: string;
  mesazhi: string;
  riprovo?: () => void;
}) {
  const t = useTema();
  return (
    <Karta style={styles.gabimi}>
      <View style={styles.rresht} accessibilityRole="alert">
        <Ikona emri={IKONAT.alarm} madhesia={18} ngjyra={t.keq} />
        <T pesha="trashe" madhesia={15.5} style={styles.flex}>
          {titulli}
        </T>
      </View>
      <T zbehur madhesia={14}>
        {mesazhi}
      </T>
      {riprovo && <Butoni teksti="Provo përsëri" onPress={riprovo} style={styles.riprovo} />}
    </Karta>
  );
}

const styles = StyleSheet.create({
  butoni: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 22,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  gabimi: { gap: 8 },
  rresht: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  riprovo: { marginTop: 4, alignSelf: "flex-start", paddingVertical: 12 },
});
