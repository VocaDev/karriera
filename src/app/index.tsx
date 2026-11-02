import { Link } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { punet } from "@/data/punet";
import KartaPunes from "@/components/KartaPunes";

export default function Index() {
  return (
    <View style={styles.container}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={punet}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={("/pune/" + item.id) as any} asChild>
            <KartaPunes
              titulli={item.titulli}
              kompania={item.kompania}
              qyteti={item.qyteti}
            />
          </Link>
        )}
        ListFooterComponent={
          <Link href="/spike" style={styles.spike}>
            <Text style={styles.spikeText}>🧪 Testi i avatarit</Text>
          </Link>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spike: { padding: 16 },
  spikeText: { color: "#F2611D", fontWeight: "700", fontSize: 16 },
});