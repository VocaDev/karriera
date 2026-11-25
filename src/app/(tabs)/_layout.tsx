import { usePathname, useRouter } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useEffect, useState } from "react";

import { useNjoftim } from "@/components/Njoftimet";
import { prekja } from "@/lib/prekja";
import { HYR_PERSERI, tekstiIPlote } from "@/lib/mesazhet";
import { degjoPunetERe } from "@/lib/punet";
import { useSesioni } from "@/lib/sesioni";
import { useSesioniSkaduar } from "@/lib/sesioni-skaduar";
import { useTema } from "@/lib/tema";

// Tab-at e Kërkuesit të punës (bordi: Sot · Punët · Stërvitja · Profili). I sheh edhe mysafiri (pa llogari).
// Kur një punëdhënës poston, kërkuesi merr njoftimin dhe shenjën me numrin e vërtetë te "Punët".
export default function TabLayout() {
  const t = useTema();
  const njofto = useNjoftim();
  const router = useRouter();
  const { mysafir } = useSesioni();
  const sesioniSkaduar = useSesioniSkaduar();
  const rruga = usePathname();
  const neListe = rruga === "/pune";
  const [teReja, setTeReja] = useState(0);

  // Hyrja te "Punët" e pastron shenjën: i ke parë.
  const [rrugaEFundit, setRrugaEFundit] = useState(rruga);
  if (rruga !== rrugaEFundit) {
    setRrugaEFundit(rruga);
    if (neListe) setTeReja(0);
  }

  // Mysafiri hapet te Punët (hapja e parë pa llogari, ose pas daljes nga llogaria): ato janë çka mund të shohë menjëherë.
  useEffect(() => {
    if (mysafir) router.navigate("/pune");
  }, [mysafir, router]);

  // Sesioni mbaroi vetë (jo "Dil"): app-i mbetet i hapur si mysafir, dhe e themi një herë.
  useEffect(() => {
    if (mysafir && sesioniSkaduar) njofto(tekstiIPlote(HYR_PERSERI), "gabim");
  }, [mysafir, sesioniSkaduar, njofto]);

  // Njoftimet në kohë reale vetëm me llogari: anon s'i merr ngjarjet e Realtime-it, dhe shenja i takon kërkuesit.
  useEffect(() => {
    if (mysafir) return;
    return degjoPunetERe("njoftimi-i-punes-se-re", (puna) => {
      prekja.lehte();
      njofto(`Punë e re: ${puna.titulli} · ${puna.kompania}`, "sukses");
      setTeReja((n) => n + 1);
    });
  }, [mysafir, njofto]);

  return (
    <NativeTabs tintColor={t.theksi}>
      {/* Çdo tab ka Stack-un e vet (titull i madh); "(sot)" është grup, kështu që Sot mbetet në URL-në "/". */}
      <NativeTabs.Trigger name="(sot)">
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
