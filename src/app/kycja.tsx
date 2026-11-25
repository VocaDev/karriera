import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import FtesaPerLlogari from "@/components/FtesaPerLlogari";
import Prekshme from "@/components/Prekshme";
import { IKONAT, Ikona } from "@/components/ui";
import { eshteArsye, kthehuISigurt, veprimiNgaParametri } from "@/lib/mysafiri";
import { useTema } from "@/lib/tema";

// Fleta e veçorisë së kyçur për mysafirin (AGENTS.md, Native feel #2: formSheet me dorezë, X i rrumbullakët).
// Hapet nga useKycja (src/lib/mysafiri.ts) pas dridhjes dhe prekjes së lehtë. Vetëm mysafiri e sheh (roja te _layout.tsx).
export default function Kycja() {
  const t = useTema();
  const router = useRouter();
  const p = useLocalSearchParams<{ arsyeja?: string; kthehu?: string; veprimi?: string }>();
  // Një parametër i panjohur (p.sh. nga një link i jashtëm) s'e prish fletën: arsyeja e përgjithshme e profilit.
  const arsyeja = eshteArsye(p.arsyeja) ? p.arsyeja : "profili";

  return (
    // "fitToContents": rrënja është View (jo ScrollView), që fleta ta marrë lartësinë nga përmbajtja.
    <View style={[styles.faqja, { backgroundColor: t.sfondi }]}>
      <View style={styles.koka}>
        <Prekshme
          accessibilityRole="button"
          accessibilityLabel="Mbyll"
          hitSlop={8}
          shkalla={0.9}
          onPress={() => router.back()}
          style={styles.mbyll}
        >
          <Ikona emri={IKONAT.mbyll} madhesia={30} ngjyra={t.zbehur} />
        </Prekshme>
      </View>
      <FtesaPerLlogari
        arsyeja={arsyeja}
        kthehu={kthehuISigurt(p.kthehu)}
        veprimi={veprimiNgaParametri(p.veprimi)}
        neFlete
      />
    </View>
  );
}

const styles = StyleSheet.create({
  faqja: { padding: 22, paddingTop: 14, paddingBottom: 36 },
  koka: { flexDirection: "row", justifyContent: "flex-end", marginBottom: -28 },
  mbyll: { minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center", zIndex: 1 },
});
