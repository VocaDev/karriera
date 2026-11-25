import { NativeTabs } from "expo-router/native-tabs";

import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

// Tab-at e organizatës. Kërkuesi s'i sheh kurrë: roja te _layout.tsx. Edhe sikur t'i hapte, RLS-i s'e lejon.
// Punëdhënësi (bordi, rreshti 8, ekranet 59–66): Kreu · Pozitat · Kandidatët · Kompania.
// Qendra (bordi, rreshti 13): Qendra · Profili, si më parë.
// Tab-at që s'i përkasin llojit të llogarisë janë `hidden`: s'shfaqen dhe s'hapen dot.
export default function OrganizataLayout() {
  const t = useTema();
  const { profili } = useSesioni();
  const punedhenes = profili?.lloji === "punedhenes";
  return (
    <NativeTabs tintColor={t.theksi}>
      <NativeTabs.Trigger name="(kreu)">
        <NativeTabs.Trigger.Label>{punedhenes ? "Kreu" : "Qendra"}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={punedhenes ? { default: "house", selected: "house.fill" } : { default: "graduationcap", selected: "graduationcap.fill" }}
          md={punedhenes ? "home" : "school"}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pozitat" hidden={!punedhenes}>
        <NativeTabs.Trigger.Label>Pozitat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} md="work" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="kandidatet" hidden={!punedhenes}>
        <NativeTabs.Trigger.Label>Kandidatët</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person.2", selected: "person.2.fill" }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="kompania" hidden={!punedhenes}>
        <NativeTabs.Trigger.Label>Kompania</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "building.2", selected: "building.2.fill" }} md="apartment" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profili" hidden={punedhenes}>
        <NativeTabs.Trigger.Label>Profili</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
