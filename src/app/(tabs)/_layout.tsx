import { NativeTabs } from "expo-router/native-tabs";

import { useTema } from "@/lib/tema";

// Tab-at e Kërkuesit të punës (bordi: Sot · Punët · Stërvitja · Profili).
export default function TabLayout() {
  const t = useTema();
  return (
    <NativeTabs tintColor={t.theksi}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Sot</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pune">
        <NativeTabs.Trigger.Label>Punët</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} md="work" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stervitja">
        <NativeTabs.Trigger.Label>Stërvitja</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "dumbbell", selected: "dumbbell.fill" }} md="fitness_center" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profili">
        <NativeTabs.Trigger.Label>Profili</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
