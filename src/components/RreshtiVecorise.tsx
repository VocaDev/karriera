import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { IKONAT, Ikona, T } from "@/components/ui";
import { useTema } from "@/lib/tema";
import { tekstiIGjendjes, type Vecoria } from "@/lib/vecorite";

type Props = { vecoria: Vecoria; iFundit?: boolean };

// Rresht në listën e bordit (ekrani 41): kutia (e gjelbër kur hapi është gati), titulli,
// përshkrimi + gjendja, dhe shigjeta kur hapi hapet. Hapat që s'janë gati nuk hapen.
export default function RreshtiVecorise({ vecoria, iFundit = false }: Props) {
  const t = useTema();
  const gati = vecoria.gjendja.lloji === "gati" && vecoria.href !== null;

  const permbajtja = (
    <View style={[styles.rreshti, !iFundit && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.vija }]}>
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
          {vecoria.pershkrimi} · {tekstiIGjendjes(vecoria.gjendja)}
        </T>
      </View>
      {gati ? (
        <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
      ) : (
        <Ikona emri={IKONAT.kycja} madhesia={13} ngjyra={t.vija} />
      )}
    </View>
  );

  if (!gati || vecoria.href === null) {
    return (
      <View accessible accessibilityLabel={`${vecoria.titulli}, ${tekstiIGjendjes(vecoria.gjendja)}`}>
        {permbajtja}
      </View>
    );
  }
  return (
    <Link href={vecoria.href} asChild>
      <Pressable accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
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
