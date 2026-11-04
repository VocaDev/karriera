import { Link, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import KartaPunes from "@/components/KartaPunes";
import { listoPunet, type Puna } from "@/lib/punet";

export default function Index() {
  const [punet, setPunet] = useState<Puna[]>([]);
  const [duke_ngarkuar, setDukeNgarkuar] = useState(true);
  const [gabimi, setGabimi] = useState<string | null>(null);

  const ngarko = useCallback(async () => {
    setGabimi(null);
    try {
      setPunet(await listoPunet());
    } catch (e) {
      setGabimi(e instanceof Error ? e.message : "Gabim i panjohur");
    } finally {
      setDukeNgarkuar(false);
    }
  }, []);

  // Rilexon sa herë që ekrani shfaqet (p.sh. pasi kthehesh nga "Shto punë").
  useFocusEffect(
    useCallback(() => {
      ngarko();
    }, [ngarko]),
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/pune/shto" asChild>
              <Pressable hitSlop={10}>
                <Text style={styles.shto}>+ Shto</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      {duke_ngarkuar ? (
        <ActivityIndicator style={styles.qendra} />
      ) : gabimi ? (
        <View style={styles.qendra}>
          <Text>S'u lexuan punët: {gabimi}</Text>
          <Pressable onPress={ngarko}>
            <Text style={styles.shto}>Provo përsëri</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={punet}
          keyExtractor={(item) => item.id}
          refreshing={false}
          onRefresh={ngarko}
          ListEmptyComponent={<Text style={styles.bosh}>Ende s'ka shpallje.</Text>}
          renderItem={({ item }) => (
            <Link href={`/pune/${item.id}`} asChild>
              <KartaPunes titulli={item.titulli} kompania={item.kompania} qyteti={item.qyteti} />
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  qendra: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  shto: { fontSize: 17, fontWeight: "600", color: "#E8590C" },
  bosh: { textAlign: "center", marginTop: 40, color: "gray" },
});
