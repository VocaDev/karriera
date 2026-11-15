// Përbërës të vegjël që i ndajnë vetëm tri ekranet e intervistës (src/app/intervista/*).
// Jetojnë këtu sepse çdo fajll te src/app bëhet rrugë (route).
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import Prekshme from "@/components/Prekshme";
import { IKONAT, Ikona, Karta, T } from "@/components/ui";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

import { INTERVISTUESIT, PAMJA_E_INTERVISTUESIT, type Intervistuesi } from "./tipet";

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

/** Rrethi me inicialen e intervistuesit (pa figura: avatari 3D vjen më 09.12). Dekorativ: emri lexohet gjetkë. */
export function AvatariIntervistuesit({ intervistuesi, madhesia = 24 }: { intervistuesi: Intervistuesi; madhesia?: number }) {
  const t = useTema();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatari,
        { width: madhesia, height: madhesia, borderRadius: madhesia / 2, backgroundColor: t.karta2, borderColor: t.vija },
      ]}
    >
      <T pesha="trashe" madhesia={Math.round(madhesia * 0.5)} maxFontSizeMultiplier={1.2}>
        {PAMJA_E_INTERVISTUESIT[intervistuesi].inicialja}
      </T>
    </View>
  );
}

/** Segmenti "Arta · Arbër" (kontrolli i sistemit). Ekrani i nisjes dhe Cilësimet e përdorin të njëjtin. */
export function ZgjidhIntervistuesin({
  vlera,
  onZgjidh,
  style,
}: {
  vlera: Intervistuesi;
  onZgjidh: (i: Intervistuesi) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTema();
  return (
    <SegmentedControl
      values={INTERVISTUESIT.map((i) => PAMJA_E_INTERVISTUESIT[i].emri)}
      selectedIndex={INTERVISTUESIT.indexOf(vlera)}
      onChange={(e) => {
        const i = INTERVISTUESIT[e.nativeEvent.selectedSegmentIndex];
        if (i && i !== vlera) {
          prekja.zgjedhje();
          onZgjidh(i);
        }
      }}
      appearance={t.errët ? "dark" : "light"}
      accessibilityLabel="Kush të interviston"
      style={style}
    />
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
  avatari: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  gabimi: { gap: 8 },
  rresht: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  riprovo: { marginTop: 4, alignSelf: "flex-start", paddingVertical: 12 },
});
