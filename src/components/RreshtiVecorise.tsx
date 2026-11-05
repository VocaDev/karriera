import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTema } from "@/lib/tema";
import { tekstiIGjendjes, type Vecoria } from "@/lib/vecorite";

type Props = { vecoria: Vecoria; numri?: number };

// Një hap i rrjedhës: nëse është gati hapet, përndryshe tregon kush e ndërton ose kur vjen.
export default function RreshtiVecorise({ vecoria, numri }: Props) {
  const t = useTema();
  const gati = vecoria.gjendja.lloji === "gati" && vecoria.href !== null;

  const permbajtja = (
    <View style={styles.rreshti}>
      {numri !== undefined && (
        <View style={[styles.numri, { backgroundColor: gati ? t.theksi : t.vija }]}>
          <Text style={[styles.numriTekst, { color: gati ? "#fff" : t.zbehur }]}>{numri}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={[styles.titulli, { color: t.teksti }]}>{vecoria.titulli}</Text>
        <Text style={[styles.pershkrimi, { color: t.zbehur }]}>{vecoria.pershkrimi}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: gati ? t.theksiButë : t.vija }]}>
        <Text style={[styles.chipTekst, { color: gati ? t.theksi : t.zbehur }]}>
          {tekstiIGjendjes(vecoria.gjendja)}
        </Text>
      </View>
    </View>
  );

  if (!gati || vecoria.href === null) {
    return <View accessibilityLabel={`${vecoria.titulli}, ${tekstiIGjendjes(vecoria.gjendja)}`}>{permbajtja}</View>;
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
  rreshti: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  numri: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  numriTekst: { fontSize: 13, fontWeight: "700" },
  info: { flex: 1, gap: 2 },
  titulli: { fontSize: 16, fontWeight: "600" },
  pershkrimi: { fontSize: 13 },
  chip: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  chipTekst: { fontSize: 12, fontWeight: "600" },
});
