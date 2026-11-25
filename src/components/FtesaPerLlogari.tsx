// "Krijo llogari që të …": një arsye e ndershme, "Krijo llogari" dhe "Hyr". E përdor fleta e veçorisë së kyçur
// (src/app/kycja.tsx) dhe Profili i mysafirit. Butonat hapin hyrjen me `kthehu`: pas hyrjes mysafiri kthehet atje.
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ButoniKryesor } from "@/components/Forma";
import Prekshme from "@/components/Prekshme";
import { IKONAT, Ikona, T } from "@/components/ui";
import { ARSYET, rrugaEHyrjes, type Arsyeja, type VeprimiPasHyrjes } from "@/lib/mysafiri";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

type Props = {
  arsyeja: Arsyeja;
  kthehu?: string | null;
  veprimi?: VeprimiPasHyrjes | null;
  /** Brenda fletës: fleta mbyllet para se të hapet hyrja, që hyrja të dalë mbi ekranin nga erdhi mysafiri. */
  neFlete?: boolean;
};

export default function FtesaPerLlogari({ arsyeja, kthehu = null, veprimi = null, neFlete = false }: Props) {
  const t = useTema();
  const router = useRouter();
  const { folja, arsyeja: teksti } = ARSYET[arsyeja];

  function hape(menyra: "hyr" | "regjistrohu") {
    prekja.zgjedhje();
    if (neFlete && router.canGoBack()) router.back();
    router.push(rrugaEHyrjes({ menyra, kthehu, veprimi }));
  }

  return (
    <View style={styles.permbajtja}>
      <View style={[styles.ikona, { backgroundColor: t.karta2 }]}>
        <Ikona emri={IKONAT.kycja} madhesia={20} ngjyra={t.teksti} />
      </View>
      <T pesha="trashe" madhesia={20} accessibilityRole="header" style={styles.titulli}>
        Krijo llogari që të {folja}
      </T>
      <T zbehur madhesia={14.5}>
        {teksti}
      </T>
      <View style={styles.butonat}>
        <ButoniKryesor teksti="Krijo llogari" onPress={() => hape("regjistrohu")} />
        <Prekshme
          accessibilityRole="button"
          accessibilityLabel="Hyr, ke llogari"
          onPress={() => hape("hyr")}
          style={[styles.dytesor, { backgroundColor: t.karta, borderColor: t.vija }]}
        >
          <T pesha="trashe" madhesia={16}>
            Hyr
          </T>
        </Prekshme>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permbajtja: { gap: 8 },
  ikona: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  titulli: { letterSpacing: -0.3 },
  butonat: { gap: 10 }, // ButoniKryesor e ka vetë hapësirën lart
  dytesor: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
});
