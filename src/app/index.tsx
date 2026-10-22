import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { punet } from "@/data/punet";

// Edoniku: këtu vjen FlatList-i me komponentin KartaPunes (çdo rresht hap /pune/[id]).
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
