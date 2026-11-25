import { Stack } from "expo-router";

import ButoniHyr from "@/components/ButoniHyr";
import { useOpsionetETabit } from "@/components/TabEkrani";

// Stack-u i tab-it "Stërvitja": titulli i madh i sistemit (AGENTS.md, "Native feel" #1).
// "Hyr" në kokë vetëm për mysafirin.
export default function StervitjaLayout() {
  const opsionet = useOpsionetETabit();
  return (
    <Stack screenOptions={opsionet}>
      <Stack.Screen name="index" options={{ title: "Stërvitja", headerRight: () => <ButoniHyr /> }} />
    </Stack>
  );
}
