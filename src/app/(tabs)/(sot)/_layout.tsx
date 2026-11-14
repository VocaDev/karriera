import { Stack } from "expo-router";

import { useOpsionetETabit } from "@/components/TabEkrani";

// Stack-u i tab-it "Sot": titulli i madh i sistemit (AGENTS.md, "Native feel" #1).
export default function SotLayout() {
  const opsionet = useOpsionetETabit();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: "Sot" }} />
    </Stack>
  );
}
