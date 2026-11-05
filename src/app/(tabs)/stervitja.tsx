import { ScrollView, StyleSheet, Text, View } from "react-native";

import RreshtiVecorise from "@/components/RreshtiVecorise";
import { useTema } from "@/lib/tema";
import { VECORITE } from "@/lib/vecorite";

// Stërvitja: CV-ja (Edoniku) dhe intervista me AI (Genti). Hapen sapo të jenë gati.
export default function Stervitja() {
  const t = useTema();
  const stervitja = VECORITE.filter((v) => v.celesi === "cv" || v.celesi === "intervista");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: t.sfondi }}
      contentContainerStyle={styles.faqja}
    >
      <Text style={[styles.titulli, { color: t.teksti }]}>Stërvitja</Text>
      <View style={[styles.karta, { backgroundColor: t.karta }]}>
        {stervitja.map((v) => (
          <RreshtiVecorise key={v.celesi} vecoria={v} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  faqja: { padding: 20, gap: 16 },
  titulli: { fontSize: 34, fontWeight: "800" },
  karta: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 },
});
