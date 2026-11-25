import { Stack } from "expo-router";

import { useOpsionetETabit } from "@/components/TabEkrani";

// Stack-u i tab-it "Kandidatët" (bordi, ekrani 62): titull i madh i sistemit.
export default function KandidatetLayout() {
  const opsionet = useOpsionetETabit();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: "Kandidatët" }} />
    </Stack>
  );
}
