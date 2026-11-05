import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useTema } from "@/lib/tema";

// Profili: llogaria vjen me hyrjen (J6, 11.11). Deri atëherë vetëm informacion.
export default function Profili() {
  const t = useTema();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: t.sfondi }}
      contentContainerStyle={styles.faqja}
    >
      <Text style={[styles.titulli, { color: t.teksti }]}>Profili</Text>
      <View style={[styles.karta, { backgroundColor: t.karta }]}>
        <Text style={[styles.rreshti, { color: t.teksti }]}>Llogaria vjen së shpejti</Text>
        <Text style={{ color: t.zbehur }}>
          Hyrja me email, roli (SWE ose Asistent/PR) dhe gjuha e intervistës shtohen më 11.11.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  faqja: { padding: 20, gap: 16 },
  titulli: { fontSize: 34, fontWeight: "800" },
  karta: { borderRadius: 20, padding: 16, gap: 6 },
  rreshti: { fontSize: 16, fontWeight: "600" },
});
