import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useEffect, useState } from "react";

import { useNjoftim } from "@/components/Njoftimet";
import { prekja } from "@/lib/prekja";
import { degjoPunetERe } from "@/lib/punet";
import { useTema } from "@/lib/tema";

// Tab-at e Kërkuesit të punës (bordi: Sot · Punët · Stërvitja · Profili).
// Kur një punëdhënës poston, kërkuesi merr njoftimin dhe shenjën me numrin e vërtetë te "Punët".
export default function TabLayout() {
  const t = useTema();
  const njofto = useNjoftim();
  const rruga = usePathname();
  const neListe = rruga === "/pune";
  const [teReja, setTeReja] = useState(0);

  // Hyrja te "Punët" e pastron shenjën: i ke parë.
  const [rrugaEFundit, setRrugaEFundit] = useState(rruga);
  if (rruga !== rrugaEFundit) {
    setRrugaEFundit(rruga);
    if (neListe) setTeReja(0);
  }

  useEffect(
    () =>
      degjoPunetERe("njoftimi-i-punes-se-re", (puna) => {
        prekja.lehte();
        njofto(`Punë e re: ${puna.titulli} · ${puna.kompania}`, "sukses");
        setTeReja((n) => n + 1);
      }),
    [njofto],
  );

  return (
    <NativeTabs tintColor={t.theksi}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Sot</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pune">
        <NativeTabs.Trigger.Label>Punët</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} md="work" />
        {/* Shenja vetëm me numër të vërtetë (punë që erdhën pasi e hape listën); pa punë të reja s'ka shenjë. */}
        <NativeTabs.Trigger.Badge hidden={neListe || teReja === 0}>
          {neListe || teReja === 0 ? undefined : String(teReja)}
        </NativeTabs.Trigger.Badge>
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
