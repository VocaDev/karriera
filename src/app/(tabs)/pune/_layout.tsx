import { Stack, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import ButoniHyr from "@/components/ButoniHyr";
import Prekshme from "@/components/Prekshme";
import { useOpsionetETabit } from "@/components/TabEkrani";
import { IKONAT, Ikona } from "@/components/ui";
import { useKycja } from "@/lib/mysafiri";
import { useSesioni } from "@/lib/sesioni";

// Stack-u i tab-it "Punët": titulli i madh i sistemit (AGENTS.md, "Native feel" #1).
// "+" në kokë hap fletën "Sill linkun tënd" (J7): butonat e kokës shkojnë në kokë, jo në përmbajtje.
// Mysafiri sheh edhe "Hyr"; "+" i tij është i kyçur (puna me link ruhet private te një llogari).
export default function PunetLayout() {
  const opsionet = useOpsionetETabit();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: "Punët", headerRight: () => <ButonatEKokes /> }} />
    </Stack>
  );
}

function ButonatEKokes() {
  return (
    <View style={styles.rreshti}>
      <ButoniHyr />
      <ButoniSillLinkun />
    </View>
  );
}

function ButoniSillLinkun() {
  const router = useRouter();
  const { mysafir } = useSesioni();
  const { stili, kyc } = useKycja();
  return (
    <Animated.View style={stili}>
      <Prekshme
        accessibilityRole="button"
        accessibilityLabel="Sill linkun tënd"
        accessibilityHint="Shto një punë që e gjete diku tjetër"
        hitSlop={8}
        shkalla={0.9}
        // Mysafiri: pas hyrjes hapet vetë fleta "Sill linkun tënd".
        onPress={() => (mysafir ? kyc("linku", "/pune/sill-linkun") : router.push("/pune/sill-linkun"))}
        style={styles.butoni}
      >
        <Ikona emri={IKONAT.plus} madhesia={22} />
      </Prekshme>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rreshti: { flexDirection: "row", alignItems: "center", gap: 6 },
  butoni: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
