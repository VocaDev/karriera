import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { IKONAT, Ikona, T } from "@/components/ui";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";
import { tekstiIGjendjes, type Vecoria } from "@/lib/vecorite";

type Props = { vecoria: Vecoria; iFundit?: boolean };

// Rresht në listën e bordit (ekrani 41): kutia (e gjelbër kur hapi është gati), titulli,
// përshkrimi + gjendja, dhe shigjeta kur hapi hapet. Si në listat e iPhone-it, rreshti errësohet pak kur shtypet.
// Një hap që s'është gati dridhet lehtë kur e prek: e ndjen që u prek, dhe gjendja ("Vjen më …") e thotë pse.
export default function RreshtiVecorise({ vecoria, iFundit = false }: Props) {
  const t = useTema();
  const { stili, dridhu } = useDridhja();
  const gati = vecoria.gjendja.lloji === "gati" && vecoria.href !== null;
  // Në zhvillim (__DEV__) hapet edhe një hap "në ndërtim" që ka ekran, që ta provojmë në telefon.
  // Në build-in e vërtetë mbetet i kyçur derisa të jetë gati.
  const hapet = vecoria.href !== null && (gati || (__DEV__ && vecoria.gjendja.lloji === "ndertim"));
  const gjendja = tekstiIGjendjes(vecoria.gjendja);

  const permbajtja = (
    <Animated.View style={[styles.rreshti, stili]}>
      <View
        style={[
          styles.kutia,
          gati ? { backgroundColor: t.ok, borderColor: t.ok } : { borderColor: t.vija },
        ]}
      >
        {gati && <Ikona emri={IKONAT.check} madhesia={13} ngjyra="#fff" />}
      </View>
      <View style={styles.info}>
        <T pesha="trashe" madhesia={15.5}>
          {vecoria.titulli}
        </T>
        <T zbehur madhesia={13}>
          {vecoria.pershkrimi} · {gjendja}
        </T>
      </View>
      {hapet ? (
        <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
      ) : (
        <Ikona emri={IKONAT.kycja} madhesia={13} ngjyra={t.vija} />
      )}
    </Animated.View>
  );

  const stiliIShtypjes = ({ pressed }: { pressed: boolean }) => [
    !iFundit && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.vija },
    pressed && { backgroundColor: t.karta2 },
  ];

  if (!hapet || vecoria.href === null) {
    return (
      <Pressable
        onPress={() => {
          prekja.lehte();
          dridhu();
        }}
        style={stiliIShtypjes}
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel={`${vecoria.titulli}, ${gjendja}`}
      >
        {permbajtja}
      </Pressable>
    );
  }
  return (
    <Link href={vecoria.href} asChild>
      <Pressable style={stiliIShtypjes} accessibilityRole="button" accessibilityLabel={`${vecoria.titulli}, ${gjendja}`}>
        {permbajtja}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  rreshti: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  kutia: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 2 },
});
