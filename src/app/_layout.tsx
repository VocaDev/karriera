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
import { useEffect, useState } from "react";

import Ngarkimi from "@/components/Ngarkimi";
import { NjoftimetProvider } from "@/components/Njoftimet";
import { fikTeGjitha, useHapjaNgaNjoftimi } from "@/lib/kujtesat";
import { useKthimi } from "@/lib/mysafiri";
import { regjistroPerPush } from "@/lib/push";
import { SesioniProvider, useSesioni } from "@/lib/sesioni";
import { SHKRONJAT, useTema, type Tema } from "@/lib/tema";
import { CV_PAS_DEMO_DAY_HAPUR, PUSH_NGA_SERVERI } from "@/lib/vecorite";

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

// Rojet (J6 + mysafiri): kush s'ka hyrë është mysafir dhe sheh tab-at e kërkuesit me Punët, detajet e punës dhe praktikën
// pa internet; çdo gjë personale ose me AI kërkon llogari (src/lib/mysafiri.ts). Pas hyrjes secili lloj llogarie sheh
// vetëm grupin e vet të ekraneve. Roja fsheh ekranet; të dhënat i mbron RLS-i në server.
function Navigimi({ t }: { t: Tema }) {
  const { sesioni, mysafir, profili, profiliPaRol, duke_ngarkuar } = useSesioni();
  const kthimi = useKthimi();
  const [hapja_mbaroi, setHapjaMbaroi] = useState(false);
  const lloji = profili?.lloji;
  const organizate = lloji === "punedhenes" || lloji === "qender";
  const kerkues = lloji === "kerkues";
  // Mysafiri sapo hyri (ose po regjistrohet) nga hyrja që e hapi vetë: ekranet nga erdhi mbeten në stack derisa
  // hyrja ta kthejë atje (hyrja.tsx). Kur del se është organizatë, ato hiqen dhe hyrja e çon te Punët e mia.
  const nePritjeTeKthimit = !!sesioni && kthimi !== null && !organizate && (profiliPaRol?.lloji ?? lloji ?? "kerkues") === "kerkues";
  // Kërkuesi dhe mysafiri: tab-at, praktika pa internet.
  const tabat = mysafir || kerkues || nePritjeTeKthimit;
  // Ku shkon secili kur një ekran i mbyllet: mysafiri → Punët; kush ka sesion pa profil → hyrja;
  // kërkuesi → tab-at; organizata → Punët e mia.
  const kreu = mysafir ? "/pune" : !profili ? "/hyrja" : organizate ? "/organizata" : "/";

  // Prekja e një njoftimi (kujtesat, J10) hap Punët ose nisjen e intervistës, pasi ekrani i hapjes mbaron.
  useHapjaNgaNjoftimi(!duke_ngarkuar && hapja_mbaroi);
  // Kujtesat i takojnë llogarisë: pa llogari (dalja, ose sesioni mbaroi) fiken dhe anulohen në telefon.
  useEffect(() => {
    if (mysafir) fikTeGjitha();
  }, [mysafir]);
  // Push nga serveri: i fikur deri në development build (docs/njoftimet.md).
  const uid = sesioni?.user.id ?? null;
  useEffect(() => {
    if (PUSH_NGA_SERVERI && uid && kerkues) regjistroPerPush();
  }, [uid, kerkues]);

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
          {/* Hyrja mbetet e hapur edhe derisa të lexohet profili pas hyrjes, dhe për mysafirin derisa ta kthejë atje nga erdhi. */}
          <Stack.Protected guard={!sesioni || !profili || (kerkues && kthimi !== null)} redirectTo={kreu}>
            <Stack.Screen name="hyrja" options={{ headerShown: false }} />
          </Stack.Protected>
          {/* E hapur edhe për mysafirin: tab-at (Punët, Sot e mysafirit) dhe praktika pa internet me të dhëna në telefon. */}
          <Stack.Protected guard={tabat} redirectTo={kreu}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="praktika/index" options={{ title: "" }} />
            <Stack.Screen name="praktika/kartat" options={{ title: "" }} />
            <Stack.Screen name="praktika/keshillat/index" options={{ title: "" }} />
            <Stack.Screen name="praktika/keshillat/[id]" options={{ title: "" }} />
            {/* "Afër meje" (J10): vendndodhja një herë ose qyteti me dorë. Pa llogari: qyteti mbetet vetëm në telefon. */}
            <Stack.Screen
              name="pune/qyteti"
              options={{
                presentation: "formSheet",
                headerShown: false,
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.75, 1],
                sheetCornerRadius: 24,
              }}
            />
          </Stack.Protected>
          {/* Vetëm mysafiri: "Krijo llogari që të …", kur prek një veçori që kërkon llogari. */}
          <Stack.Protected guard={mysafir} redirectTo={kreu}>
            <Stack.Screen
              name="kycja"
              options={{
                presentation: "formSheet",
                headerShown: false,
                sheetGrabberVisible: true,
                sheetAllowedDetents: "fitToContents",
                sheetCornerRadius: 24,
              }}
            />
          </Stack.Protected>
          <Stack.Protected guard={kerkues} redirectTo={kreu}>
            {/* CV-ja: vetëm kërkuesi. Titulli i madh është në ekran, prandaj koka mbetet pa tekst. */}
            <Stack.Screen name="cv/index" options={{ title: "" }} />
            <Stack.Screen name="cv/analiza" options={{ title: "" }} />
            {/* Ndërtuesi i CV-së del tani (vendimi i Gentit, 11.11). */}
            <Stack.Screen name="cv/ndertoje" options={{ title: "" }} />
            <Stack.Screen name="cv/dokumenti" options={{ title: "" }} />
            {/* Rrugët e javës (placeholder-at): A jam gati?, Intervista, Cilësimet. */}
            <Stack.Screen name="gati/[id]" options={{ title: "A jam gati?" }} />
            <Stack.Screen name="intervista/index" options={{ title: "Intervista" }} />
            <Stack.Screen name="intervista/[id]" options={{ title: "Intervista" }} />
            <Stack.Screen name="intervista/rezultatet" options={{ title: "Rezultatet" }} />
            <Stack.Screen name="intervista/historiku" options={{ title: "" }} />
            <Stack.Screen name="cilesimet" options={{ title: "Cilësimet" }} />
            {/* Pa internet (J7): rezultatet e fundit të ruajtura. Praktika është më lart (e hapur edhe për mysafirin). */}
            <Stack.Screen name="permbledhja" options={{ title: "" }} />
            {/* Rindërto CV-në: sugjerimet e pranuara të analizës, të zbatuara pa AI (14.11). */}
            <Stack.Screen name="cv/rindertoje" options={{ title: "" }} />
            {/* "Sill linkun tënd" (J7): fletë me dorezë; X-i i rrumbullakët është brenda ekranit. */}
            <Stack.Screen
              name="pune/sill-linkun"
              options={{
                presentation: "formSheet",
                headerShown: false,
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.75, 1],
                sheetCornerRadius: 24,
              }}
            />
            {/* Teksti i shpalljes së një pune private (J7): fletë e gjatë, e njëjta formë. */}
            <Stack.Screen
              name="pune/teksti"
              options={{
                presentation: "formSheet",
                headerShown: false,
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.75, 1],
                sheetCornerRadius: 24,
              }}
            />
          </Stack.Protected>
          {/* Pas Demo Day-t: karta "Ndaje" për rrjetet sociale. Kodi mbetet, ekrani s'hapet. */}
          <Stack.Protected guard={kerkues && CV_PAS_DEMO_DAY_HAPUR} redirectTo={kreu}>
            <Stack.Screen name="cv/ndaje" options={{ title: "" }} />
          </Stack.Protected>
          <Stack.Protected guard={organizate} redirectTo={kreu}>
            <Stack.Screen name="organizata" options={{ headerShown: false }} />
            <Stack.Screen
              name="pune/shto"
              options={{ presentation: "modal", title: "Shto një punë", headerStyle: { backgroundColor: t.karta } }}
            />
          </Stack.Protected>
          {/* Raporti anonim i kandidatit: vetëm punëdhënësi (serveri, kandidatet_anonim, e refuzon çdo lloj tjetër llogarie). */}
          <Stack.Protected guard={lloji === "punedhenes"} redirectTo={kreu}>
            <Stack.Screen name="kandidati/[kodi]" options={{ title: "" }} />
          </Stack.Protected>
          {/* Detajet e punës: çdo llogari dhe mysafiri (RLS-i i jep anon vetëm punët publike aktive). */}
          <Stack.Protected guard={!!profili || mysafir || nePritjeTeKthimit} redirectTo={kreu}>
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
