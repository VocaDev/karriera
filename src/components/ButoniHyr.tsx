// "Hyr" në kokën e tab-ave, vetëm për mysafirin (AGENTS.md, Native feel #1: butonat e kokës shkojnë në kokë).
// Hap hyrjen pa `kthehu`: pas hyrjes mysafiri kthehet te tab-i ku ishte.
import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import Prekshme from "@/components/Prekshme";
import { T } from "@/components/ui";
import { rrugaEHyrjes } from "@/lib/mysafiri";
import { prekja } from "@/lib/prekja";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

export default function ButoniHyr() {
  const t = useTema();
  const router = useRouter();
  const { mysafir } = useSesioni();
  if (!mysafir) return null;
  return (
    <Prekshme
      accessibilityRole="button"
      accessibilityLabel="Hyr"
      accessibilityHint="Hyr ose krijo llogari"
      hitSlop={8}
      shkalla={0.92}
      onPress={() => {
        prekja.zgjedhje();
        router.push(rrugaEHyrjes());
      }}
      style={[styles.butoni, { backgroundColor: t.teksti }]}
    >
      <T pesha="trashe" madhesia={14} ngjyra={t.sfondi}>
        Hyr
      </T>
    </Prekshme>
  );
}

const styles = StyleSheet.create({
  // Kapsulë e vogël; zona e prekjes arrin 44 pt me hitSlop.
  butoni: { minHeight: 32, minWidth: 52, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
