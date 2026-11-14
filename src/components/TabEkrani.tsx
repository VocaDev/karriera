// Pjesët e përbashkëta të katër tab-ave (AGENTS.md, "Native feel" #1): koka me titull të madh të sistemit
// dhe ScrollView-ja që është rrënja e ekranit, që titulli të palosë kur rrëshqet përmbajtja.
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackNavigationOptions } from "expo-router";
import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";

import { SHKRONJAT, useTema, type Tema } from "@/lib/tema";

/** Opsionet e Stack-ut të një tab-i: titull i madh, pa hije, ngjyrat e temës, fonti i bordit. */
export function opsionetETabit(t: Tema): NativeStackNavigationOptions {
  return {
    headerLargeTitleEnabled: true,
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    // Koka merr ngjyrën e fillimit të gradientit portokalli (t.theksiButë), që të bashkohet me faqen pa vijë.
    headerStyle: { backgroundColor: t.theksiButë },
    headerLargeStyle: { backgroundColor: t.theksiButë },
    headerTintColor: t.teksti,
    headerTitleStyle: { fontFamily: SHKRONJAT.trashe, color: t.teksti },
    headerLargeTitleStyle: { fontFamily: SHKRONJAT.trashe, color: t.teksti },
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: t.sfondi },
  };
}

export function useOpsionetETabit(): NativeStackNavigationOptions {
  return opsionetETabit(useTema());
}

/**
 * Gradienti portokalli lart (si në bord). Shkon brenda përmbajtjes që rrëshqet, jo si vëlla i ScrollView-së.
 * `brenda` = sa pika e fut mbrapsht ndarja e përmbajtjes (p.sh. 18 kur është brenda kokës së një FlatList-e me padding 18).
 */
export function GradientiSiper({ brenda = 0 }: { brenda?: number }) {
  const t = useTema();
  return (
    <LinearGradient
      colors={[t.theksiButë, t.sfondi]}
      locations={[0, 1]}
      style={[styles.gradienti, { left: -brenda, right: -brenda, top: -brenda }]}
      pointerEvents="none"
    />
  );
}

type Props = {
  children: ReactNode;
  /** Kur jepet, tërheqja poshtë rifreskon (sa zgjat `refreshing`, rrotullon i sistemit). */
  onRefresh?: () => void;
  refreshing?: boolean;
};

/** Rrënja e një ekrani tab-i: ScrollView me `contentInsetAdjustmentBehavior="automatic"` (titulli i madh palos). */
export function TabScroll({ children, onRefresh, refreshing = false }: Props) {
  const t = useTema();
  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      contentContainerStyle={styles.permbajtja}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.zbehur} /> : undefined}
    >
      <GradientiSiper />
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradienti: { position: "absolute", left: 0, right: 0, top: 0, height: 320 },
  permbajtja: { padding: 18, gap: 12, paddingBottom: 120 },
});
