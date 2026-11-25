import { Stack } from "expo-router";

import { useOpsionetETabit } from "@/components/TabEkrani";

// Stack-u i tab-it "Kompania" (bordi, ekrani 66): titull i madh i sistemit.
export default function KompaniaLayout() {
  const opsionet = useOpsionetETabit();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: "Kompania" }} />
    </Stack>
  );
}
