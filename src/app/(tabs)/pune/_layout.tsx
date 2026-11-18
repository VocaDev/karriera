import { Stack, useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import Prekshme from "@/components/Prekshme";
import { useOpsionetETabit } from "@/components/TabEkrani";
import { IKONAT, Ikona } from "@/components/ui";

// Stack-u i tab-it "Punët": titulli i madh i sistemit (AGENTS.md, "Native feel" #1).
// "+" në kokë hap fletën "Sill linkun tënd" (J7): butonat e kokës shkojnë në kokë, jo në përmbajtje.
export default function PunetLayout() {
  const opsionet = useOpsionetETabit();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: "Punët", headerRight: () => <ButoniSillLinkun /> }} />
    </Stack>
  );
}

function ButoniSillLinkun() {
  const router = useRouter();
  return (
    <Prekshme
      accessibilityRole="button"
      accessibilityLabel="Sill linkun tënd"
      accessibilityHint="Shto një punë që e gjete diku tjetër"
      hitSlop={8}
      shkalla={0.9}
      onPress={() => router.push("/pune/sill-linkun")}
      style={styles.butoni}
    >
      <Ikona emri={IKONAT.plus} madhesia={22} />
    </Prekshme>
  );
}

const styles = StyleSheet.create({
  butoni: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
