import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useState } from "react";

import Ngarkimi from "@/components/Ngarkimi";
import { NjoftimetProvider } from "@/components/Njoftimet";
import { SesioniProvider, useSesioni } from "@/lib/sesioni";
import { SHKRONJAT, useTema, type Tema } from "@/lib/tema";

// Splash-i i telefonit mbetet derisa të ngarkohen fontet dhe ekrani i hapjes (Ngarkimi) të vizatohet
// mbi app: atëherë fshihet, dhe kalimi nga splash-i te app-i bëhet pa kërcim.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTema();
  const [fontet_gati, gabimi_fonteve] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Nëse fontet dështojnë, app-i vazhdon me fontin e sistemit.
  if (!fontet_gati && !gabimi_fonteve) return null;

  // Ngjyrat e navigimit = ngjyrat e temës: kalimet mes ekraneve (sidomos në dark mode) pa blic të bardhë.
  const baza = t.errët ? DarkTheme : DefaultTheme;
  const temaENavigimit = {
    ...baza,
    colors: {
      ...baza.colors,
      primary: t.theksi,
      background: t.sfondi,
      card: t.karta,
      text: t.teksti,
      border: t.vija,
      notification: t.keq,
    },
  };

  return (
    <ThemeProvider value={temaENavigimit}>
      <NjoftimetProvider>
        <SesioniProvider>
          <Navigimi t={t} />
        </SesioniProvider>
      </NjoftimetProvider>
    </ThemeProvider>
  );
}

// Rojet (J6): dera mbyllet para hyrjes. Kush s'ka hyrë sheh vetëm "hyrja"; pastaj secili lloj llogarie
// sheh vetëm grupin e vet të ekraneve. Roja fsheh ekranet; të dhënat i mbron RLS-i në server.
function Navigimi({ t }: { t: Tema }) {
  const { sesioni, profili, duke_ngarkuar } = useSesioni();
  const [hapja_mbaroi, setHapjaMbaroi] = useState(false);
  const lloji = profili?.lloji;
  const organizate = lloji === "punedhenes" || lloji === "qender";
  // Ku shkon secili kur një ekran i mbyllet: kush s'ka hyrë → hyrja; kërkuesi → tab-at; organizata → Punët e mia.
  const kreu = !sesioni || !profili ? "/hyrja" : organizate ? "/organizata" : "/";

  return (
    <>
      {(!duke_ngarkuar || hapja_mbaroi) && (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.theksiButë },
            headerShadowVisible: false,
            headerTintColor: t.teksti,
            headerTitleStyle: { fontFamily: SHKRONJAT.trashe },
            headerBackTitle: "Mbrapa",
            contentStyle: { backgroundColor: t.sfondi },
          }}
        >
          {/* Hyrja mbetet e hapur edhe derisa të lexohet profili pas hyrjes. */}
          <Stack.Protected guard={!sesioni || !profili} redirectTo={kreu}>
            <Stack.Screen name="hyrja" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={lloji === "kerkues"} redirectTo={kreu}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={organizate} redirectTo={kreu}>
            <Stack.Screen name="organizata" options={{ headerShown: false }} />
            <Stack.Screen
              name="pune/shto"
              options={{ presentation: "modal", title: "Shto një punë", headerStyle: { backgroundColor: t.karta } }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!!profili} redirectTo={kreu}>
            <Stack.Screen name="pune/[id]" options={{ title: "" }} />
          </Stack.Protected>
        </Stack>
      )}
      {!hapja_mbaroi && (
        <Ngarkimi
          gati={!duke_ngarkuar}
          kurShfaqet={() => {
            SplashScreen.hideAsync().catch(() => {});
          }}
          kurMbaron={() => setHapjaMbaroi(true)}
        />
      )}
    </>
  );
}
