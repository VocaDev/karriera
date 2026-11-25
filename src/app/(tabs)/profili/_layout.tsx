import { Stack } from "expo-router";

import ButoniHyr from "@/components/ButoniHyr";
import { useOpsionetETabit } from "@/components/TabEkrani";

// Stack-u i tab-it "Profili": titulli i madh i sistemit (AGENTS.md, "Native feel" #1).
// "Hyr" në kokë vetëm për mysafirin.
export default function ProfiliLayout() {
  const opsionet = useOpsionetETabit();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: "Profili", headerRight: () => <ButoniHyr /> }} />
    </Stack>
  );
}
