// Sot i mysafirit: çka bën Karriera, "Krijo llogari", hapat (të hapurit dhe të kyçurit) dhe punët e fundit.
// Asnjë thirrje që kërkon llogari: vetëm punët publike (RLS anon). Hapat e kyçur hapin fletën "Krijo llogari që të …".
import { Link, useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { ButoniKryesor } from "@/components/Forma";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Pulsi, Vije } from "@/components/Skeleti";
import { TabScroll } from "@/components/TabEkrani";
import { IKONAT, Ikona, Karta, Rruga, T } from "@/components/ui";
import { paInternet } from "@/lib/mesazhet";
import { rrugaEHyrjes, useKycja, type Arsyeja } from "@/lib/mysafiri";
import { rrugaPraktikes } from "@/lib/praktika";
import { prekja } from "@/lib/prekja";
import { listoPunet, type Puna } from "@/lib/punet";
import { KOHA_E_LEXIMIT, meKohe, useRrjeti } from "@/lib/rrjeti";
import { useTema } from "@/lib/tema";

type Hapi =
  | { titulli: string; pershkrimi: string; lloji: "hapur"; href: Href }
  | { titulli: string; pershkrimi: string; lloji: "kycur"; arsyeja: Arsyeja; kthehu: string };

// Rruga e HARTA-s: CV → Punët → A jam gati? → Intervista, plus praktika pa internet që s'kërkon llogari.
const HAPAT: Hapi[] = [
  { titulli: "CV-ja ime", pershkrimi: "Ngarko CV-në; AI-ja të thotë çka e ngre dhe çka e ul", lloji: "kycur", arsyeja: "cv", kthehu: "/cv" },
  { titulli: "Punët", pershkrimi: "Shpallje nga Kosova, të hapura për të gjithë", lloji: "hapur", href: "/pune" },
  {
    titulli: "A jam gati?",
    pershkrimi: "Zgjidh një punë dhe shih sa i përshtatesh",
    lloji: "kycur",
    arsyeja: "gati",
    kthehu: "/pune",
  },
  {
    titulli: "Intervista me AI",
    pershkrimi: "AI-ja të pyet për punën që zgjedh, në shqip, anglisht ose gjermanisht",
    lloji: "kycur",
    arsyeja: "intervista",
    kthehu: "/stervitja",
  },
  {
    titulli: "Praktiko pa internet",
    pershkrimi: "Pyetje, karta dhe këshilla që hapen edhe pa lidhje",
    lloji: "hapur",
    href: rrugaPraktikes("/praktika"),
  },
];

export default function SotMysafir() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const [punet, setPunet] = useState<Puna[] | null | "gabim">(null); // null = ende pa ardhur
  const [rifreskim, setRifreskim] = useState(false);

  const ngarko = useCallback(async (): Promise<boolean> => {
    try {
      const p = await meKohe(listoPunet(true), KOHA_E_LEXIMIT);
      setPunet(p);
      return true;
    } catch {
      setPunet((m) => (Array.isArray(m) ? m : "gabim")); // lista që e kishim mbetet
      return false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      ngarko();
    }, [ngarko]),
  );

  const { kaInternet } = useRrjeti(() => {
    ngarko();
  });

  async function rifresko() {
    if (!kaInternet) {
      prekja.gabim();
      njofto(paInternet("po t'i shfaqim punët që i pe herën e fundit").cfare, "gabim");
      return;
    }
    setRifreskim(true);
    const ok = await ngarko();
    setRifreskim(false);
    if (!ok) {
      prekja.gabim();
      njofto("S'u rifreskuan punët. Provo përsëri.", "gabim");
    }
  }

  const lista = Array.isArray(punet) ? punet : null;

  return (
    <TabScroll onRefresh={rifresko} refreshing={rifreskim}>
      {lista && <ShiritiPaInternet teksti={paInternet("po t'i shfaqim punët që i pe herën e fundit").cfare} />}

      <Karta style={styles.hero}>
        <T pesha="trashe" madhesia={22} accessibilityRole="header" style={styles.titulli}>
          Sa je gati për punën që do?
        </T>
        <T zbehur madhesia={14.5}>
          Karriera e krahason CV-në tënde me një punë konkrete, të tregon çka të mungon dhe të lë ta praktikosh
          intervistën derisa të bëhesh gati.
        </T>
        <Rruga hapi={0} />
        <ButoniKryesor
          teksti="Krijo llogari"
          onPress={() => {
            prekja.zgjedhje();
            router.push(rrugaEHyrjes({ menyra: "regjistrohu" }));
          }}
        />
        <T zbehur madhesia={13} style={styles.qendroj}>
          Pa llogari: shiko punët dhe praktiko pa internet.
        </T>
      </Karta>

      <Karta style={styles.lista}>
        {HAPAT.map((h, i) => (
          <RreshtiIHapit key={h.titulli} hapi={h} iFundit={i === HAPAT.length - 1} />
        ))}
      </Karta>

      <Link href="/pune" asChild>
        <Prekshme accessibilityRole="button" accessibilityLabel="Hap listën e punëve">
          <Karta style={styles.rreshtKarte}>
            <Ikona emri={IKONAT.canta} madhesia={20} ngjyra={t.theksi} />
            <View style={styles.flex}>
              {punet === null ? (
                <Pulsi>
                  <View style={styles.skeleti} accessibilityLabel="Po ngarkohen punët">
                    <Vije gjeresia="55%" lartesia={16} />
                    <Vije gjeresia="85%" lartesia={12} />
                  </View>
                </Pulsi>
              ) : lista === null ? (
                <>
                  <T pesha="trashe" madhesia={15.5}>
                    S&apos;u lexuan punët
                  </T>
                  <T zbehur madhesia={13}>
                    Hape listën për të provuar përsëri
                  </T>
                </>
              ) : (
                <>
                  <T pesha="trashe" madhesia={15.5}>
                    {lista.length} punë në Karriera
                  </T>
                  <T zbehur madhesia={13} numberOfLines={2}>
                    {lista.length === 0
                      ? "Ende s'ka shpallje"
                      : lista
                          .slice(0, 2)
                          .map((p) => p.titulli)
                          .join(" · ")}
                  </T>
                </>
              )}
            </View>
            <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
          </Karta>
        </Prekshme>
      </Link>
    </TabScroll>
  );
}

// Rresht si te listat e iPhone-it: i hapuri të çon atje; i kyçuri dridhet, jep prekjen e lehtë dhe hap fletën.
function RreshtiIHapit({ hapi, iFundit }: { hapi: Hapi; iFundit: boolean }) {
  const t = useTema();
  const router = useRouter();
  const { stili, kyc } = useKycja();
  const kycur = hapi.lloji === "kycur";

  return (
    <Pressable
      onPress={() => {
        if (hapi.lloji === "kycur") {
          kyc(hapi.arsyeja, hapi.kthehu);
        } else {
          prekja.zgjedhje();
          router.push(hapi.href);
        }
      }}
      style={({ pressed }) => [
        !iFundit && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.vija },
        pressed && { backgroundColor: t.karta2 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${hapi.titulli}, ${hapi.pershkrimi}`}
      accessibilityHint={kycur ? "Kërkon llogari" : undefined}
    >
      <Animated.View style={[styles.rreshti, stili]}>
        <View style={styles.info}>
          <T pesha="trashe" madhesia={15.5}>
            {hapi.titulli}
          </T>
          <T zbehur madhesia={13}>
            {hapi.pershkrimi}
          </T>
        </View>
        {kycur ? (
          <Ikona emri={IKONAT.kycja} madhesia={13} ngjyra={t.zbehur} />
        ) : (
          <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: 8 },
  titulli: { letterSpacing: -0.4 },
  qendroj: { textAlign: "center", marginTop: 2 },
  lista: { padding: 0, overflow: "hidden" },
  rreshti: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 56 },
  info: { flex: 1, gap: 2 },
  rreshtKarte: { flexDirection: "row", alignItems: "center", gap: 12 },
  skeleti: { gap: 7, paddingVertical: 2 },
});
