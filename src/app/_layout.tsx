import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { SHKRONJAT, useTema } from "@/lib/tema";

// Splash-i mbetet derisa të ngarkohen fontet, që teksti të mos "kërcejë" nga fonti i sistemit.
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

  useEffect(() => {
    if (fontet_gati || gabimi_fonteve) SplashScreen.hideAsync();
  }, [fontet_gati, gabimi_fonteve]);

  // Nëse fontet dështojnë, app-i vazhdon me fontin e sistemit.
  if (!fontet_gati && !gabimi_fonteve) return null;

  return (
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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="pune/[id]" options={{ title: "" }} />
      <Stack.Screen
        name="pune/shto"
        options={{ presentation: "modal", title: "Shto një punë", headerStyle: { backgroundColor: t.karta } }}
      />
    </Stack>
  );
}
