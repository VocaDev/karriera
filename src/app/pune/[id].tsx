import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { gjePunen, type Puna } from "@/lib/punet";

export default function DetajetEPunes() {
  // Lista dërgon vetëm id-në në adresë (/pune/p3); këtu e lexojmë dhe e kërkojmë në Supabase.
  const { id } = useLocalSearchParams<{ id: string }>();
  const [puna, setPuna] = useState<Puna | null | undefined>(undefined); // undefined = duke ngarkuar
  const [gabimi, setGabimi] = useState<string | null>(null);

  useEffect(() => {
    gjePunen(id)
      .then(setPuna)
      .catch((e) => setGabimi(e instanceof Error ? e.message : "Gabim i panjohur"));
  }, [id]);

  if (gabimi) {
    return (
      <View style={styles.qendra}>
        <Text>S&apos;u lexua puna: {gabimi}</Text>
      </View>
    );
  }

  if (puna === undefined) {
    return <ActivityIndicator style={styles.qendra} />;
  }

  // Roja: nëse id-ja nuk ekziston (p.sh. /pune/x99), nuk rrëzohet aplikacioni.
  if (puna === null) {
    return (
      <View style={styles.qendra}>
        <Stack.Screen options={{ title: "Nuk u gjet" }} />
        <Text>Puna “{id}” nuk u gjet.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.faqja}>
      <Stack.Screen options={{ title: puna.kompania }} />
      <Text style={styles.titulli}>{puna.titulli}</Text>
      <Text style={styles.nentitulli}>
        {puna.kompania} · {puna.qyteti} · {puna.roli}
      </Text>
      {puna.pershkrimi ? <Text style={styles.pershkrimi}>{puna.pershkrimi}</Text> : null}

      {puna.aftesite.length > 0 && <Text style={styles.seksioni}>Aftësitë që kërkohen</Text>}
      {puna.aftesite.map((aftesia) => (
        <Text key={aftesia} style={styles.aftesia}>
          • {aftesia}
        </Text>
      ))}
      {puna.burimi === "perdoruesi" && <Text style={styles.burimi}>Shtuar nga një përdorues</Text>}
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
  burimi: { marginTop: 16, color: "gray", fontSize: 13 },
});
