import { Link } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

import { punet } from "@/data/punet";
import KartaPunes from "@/components/KartaPunes";

export default function Index() {
  return (
    <View style={styles.container}>
      <FlatList
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});