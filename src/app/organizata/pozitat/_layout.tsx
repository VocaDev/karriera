import { Stack, useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import Prekshme from "@/components/Prekshme";
import { useOpsionetETabit } from "@/components/TabEkrani";
import { IKONAT, Ikona } from "@/components/ui";

// Stack-u i tab-it "Pozitat" (bordi, ekrani 61): punët e mia → kandidatët e secilës.
// "+" në kokë hap "Shto një punë" (butonat e kokës shkojnë në kokë, jo në përmbajtje).
export default function PozitatLayout() {
  const opsionet = useOpsionetETabit();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: "Pozitat", headerRight: () => <ButoniShto /> }} />
      <Stack.Screen name="[id]" options={{ title: "", headerLargeTitleEnabled: false }} />
    </Stack>
  );
}

function ButoniShto() {
  const router = useRouter();
  return (
    <Prekshme
      accessibilityRole="button"
      accessibilityLabel="Shto një punë"
      hitSlop={8}
      shkalla={0.9}
      onPress={() => router.push("/pune/shto")}
      style={styles.butoni}
    >
      <Ikona emri={IKONAT.plus} madhesia={22} />
    </Prekshme>
  );
}

const styles = StyleSheet.create({
  butoni: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
