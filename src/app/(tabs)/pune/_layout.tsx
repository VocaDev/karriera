import { Stack } from "expo-router";

import { useOpsionetETabit } from "@/components/TabEkrani";

// Stack-u i tab-it "Punët": titulli i madh i sistemit (AGENTS.md, "Native feel" #1).
export default function PunetLayout() {
  const opsionet = useOpsionetETabit();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: "Punët" }} />
    </Stack>
  );
}
