import { Stack } from "expo-router";

import { useOpsionetETabit } from "@/components/TabEkrani";
import { useSesioni } from "@/lib/sesioni";

// Tab-i i parë i organizatës (titull i madh, AGENTS.md "Native feel" #1): "Kreu" për punëdhënësin, "Qendra" për qendrën.
// "(kreu)" është grup, kështu që kreu mbetet në URL-në "/organizata" (aty i dërgon roja te _layout.tsx).
export default function KreuLayout() {
  const opsionet = useOpsionetETabit();
  const { profili } = useSesioni();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: profili?.lloji === "qender" ? "Qendra e karrierës" : "Kreu" }} />
    </Stack>
  );
}
