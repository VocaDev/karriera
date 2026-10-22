import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { gjePunen } from "@/data/punet";

export default function DetajetEPunes() {
  // Lista dërgon vetëm id-në në adresë (/pune/p3); këtu e lexojmë dhe e gjejmë punën vetë.
  const { id } = useLocalSearchParams<{ id: string }>();
  const puna = gjePunen(id);

  // Roja: nëse id-ja nuk ekziston (p.sh. /pune/x99), nuk rrëzohet aplikacioni.
  if (!puna) {
    return (
      <View style={styles.qendra}>
        <Stack.Screen options={{ title: "Nuk u gjet" }} />
        <Text>Puna “{id}” nuk u gjet.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.faqja}>
      <Stack.Screen options={{ title: puna.kompania }} />
      <Text style={styles.titulli}>{puna.titulli}</Text>
      <Text style={styles.nentitulli}>
        {puna.kompania} · {puna.qyteti} · {puna.roli}
      </Text>
      <Text style={styles.pershkrimi}>{puna.pershkrimi}</Text>

      <Text style={styles.seksioni}>Aftësitë që kërkohen</Text>
      {puna.aftesite.map((aftesia) => (
        <Text key={aftesia} style={styles.aftesia}>
          • {aftesia}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  qendra: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  faqja: { padding: 20, gap: 8 },
  titulli: { fontSize: 22, fontWeight: "700" },
  nentitulli: { fontSize: 15, color: "#666" },
  pershkrimi: { fontSize: 16, lineHeight: 22, marginTop: 8 },
  seksioni: { fontSize: 17, fontWeight: "600", marginTop: 16 },
  aftesia: { fontSize: 16 },
});
