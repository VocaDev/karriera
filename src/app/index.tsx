import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { punet } from "@/data/punet";

// Edoniku · J3: zëvendësoje këtë ekran me listën e punëve.
// TODO 1: FlatList me data={punet} dhe keyExtractor={(item) => item.id}
// TODO 2: renderItem: <Link href={`/pune/${item.id}`}> me <KartaPunes ... /> brenda
// TODO 3: fshiji dy linqet e provës më poshtë kur lista punon
// Ekrani i detajeve është gati: src/app/pune/[id].tsx
export default function Index() {
  return (
    <View style={styles.container}>
      <Text>{punet.length} punë gati për listën.</Text>
      <Link href="/pune/p1" style={styles.linku}>
        Provo detajet: /pune/p1
      </Link>
      <Link href="/pune/x99" style={styles.linku}>
        Provo rojën: /pune/x99
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  linku: { color: "#155E54", fontSize: 16 },
});
