import { NativeTabs } from "expo-router/native-tabs";

import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

// Tab-at e punëdhënësit dhe të qendrës së karrierës (bordi: rreshtat 8 dhe 13). Kërkuesi s'i sheh kurrë:
// roja te _layout.tsx. Edhe sikur t'i hapte, RLS-i s'e lejon të postojë.
export default function OrganizataLayout() {
  const t = useTema();
  const { profili } = useSesioni();
  const qender = profili?.lloji === "qender";
  return (
    <NativeTabs tintColor={t.theksi}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{qender ? "Qendra" : "Punët e mia"}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={qender ? { default: "graduationcap", selected: "graduationcap.fill" } : { default: "briefcase", selected: "briefcase.fill" }}
          md={qender ? "school" : "work"}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profili">
        <NativeTabs.Trigger.Label>Profili</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
