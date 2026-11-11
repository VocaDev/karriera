// Përbërësit e përbashkët të drejtimit D: faqja me gradient, karta, tekstet, chip-at, ikonat, rruga.
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useEffect, type ReactNode } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { SHKRONJAT, useTema } from "@/lib/tema";

/** Faqja: sfondi me gradientin portokalli lart (si në bord) dhe ScrollView. */
export function Faqja({ children, pa_scroll = false }: { children: ReactNode; pa_scroll?: boolean }) {
  const t = useTema();
  const gradienti = (
    <LinearGradient
      colors={[t.theksiButë, t.sfondi]}
      locations={[0, 1]}
      style={styles.gradienti}
      pointerEvents="none"
    />
  );
  if (pa_scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: t.sfondi }]}>
        {gradienti}
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.flex, { backgroundColor: t.sfondi }]}>
      {gradienti}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.permbajtja}>
        {children}
      </ScrollView>
    </View>
  );
}

type Pesha = keyof typeof SHKRONJAT;

/** Tekst me fontin e bordit; `zbehur` për tekstin dytësor. */
export function T({
  pesha = "normal",
  madhesia = 15,
  zbehur = false,
  ngjyra,
  style,
  ...rest
}: TextProps & { pesha?: Pesha; madhesia?: number; zbehur?: boolean; ngjyra?: string }) {
  const t = useTema();
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: SHKRONJAT[pesha], fontSize: madhesia, color: ngjyra ?? (zbehur ? t.zbehur : t.teksti) },
        style,
      ]}
    />
  );
}

/** Titulli i madh i ekranit (h-l në bord). */
export function Titulli({ children }: { children: ReactNode }) {
  return (
    <T pesha="trashe" madhesia={30} style={{ letterSpacing: -0.75 }}>
      {children}
    </T>
  );
}

/** Karta e bardhë me hije të butë. */
export function Karta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTema();
  return (
    <View
      style={[
        styles.karta,
        { backgroundColor: t.karta, shadowColor: t.hija, borderWidth: t.errët ? StyleSheet.hairlineWidth : 0, borderColor: t.vija },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type EmriIkones = { ios: string; android: string };

/** Ikonë: SF Symbols në iPhone, Material Symbols në Android dhe web. */
export function Ikona({ emri, madhesia = 20, ngjyra }: { emri: EmriIkones; madhesia?: number; ngjyra?: string }) {
  const t = useTema();
  return (
    <SymbolView
      // @ts-expect-error emrat vijnë si tekst; lista e plotë e tipeve është shumë e madhe për t'u importuar
      name={{ ios: emri.ios, android: emri.android, web: emri.android }}
      size={madhesia}
      tintColor={ngjyra ?? t.teksti}
      fallback={<View style={{ width: madhesia, height: madhesia }} />}
    />
  );
}

export const IKONAT = {
  flaka: { ios: "flame.fill", android: "local_fire_department" },
  shigjeta: { ios: "chevron.right", android: "chevron_right" },
  linku: { ios: "link", android: "link" },
  plus: { ios: "plus", android: "add" },
  pin: { ios: "mappin.and.ellipse", android: "location_on" },
  canta: { ios: "briefcase.fill", android: "work" },
  mikrofoni: { ios: "mic.fill", android: "mic" },
  dokumenti: { ios: "doc.text.fill", android: "description" },
  grafiku: { ios: "chart.bar.fill", android: "bar_chart" },
  check: { ios: "checkmark", android: "check" },
  personi: { ios: "person.fill", android: "person" },
  kycja: { ios: "lock.fill", android: "lock" },
  info: { ios: "info.circle.fill", android: "info" },
  alarm: { ios: "exclamationmark.circle.fill", android: "error" },
  dalja: { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  ylli: { ios: "star.fill", android: "star" },
  shkolla: { ios: "graduationcap.fill", android: "school" },
  kosha: { ios: "trash", android: "delete" },
  email: { ios: "envelope.fill", android: "mail" },
  kerko: { ios: "magnifyingglass", android: "search" },
  mbyll: { ios: "xmark.circle.fill", android: "cancel" },
} satisfies Record<string, EmriIkones>;

/** Chip (etiketë e vogël), p.sh. "SWE" ose "Gati". */
export function Chip({ teksti, aktiv = false, theks = false }: { teksti: string; aktiv?: boolean; theks?: boolean }) {
  const t = useTema();
  const sfondi = aktiv ? t.teksti : theks ? t.theksiButë : t.karta2;
  const ngjyra = aktiv ? t.sfondi : theks ? t.theksi : t.teksti;
  return (
    <View style={[styles.chip, { backgroundColor: sfondi }]}>
      <T pesha="gjysme" madhesia={12} ngjyra={ngjyra}>
        {teksti}
      </T>
    </View>
  );
}

/** Rruga e gatishmërisë (shenja e drejtimit D): CV → Përputhja → Intervista → Mëso → Gati. */
export const HAPAT_E_RRUGES = ["CV", "Përputhja", "Intervista", "Mëso", "Gati"] as const;

export function Rruga({ hapi }: { hapi: number }) {
  const t = useTema();
  return (
    <View style={styles.rruga}>
      {HAPAT_E_RRUGES.map((h, i) => (
        <View key={h} style={[styles.rrugaPjesa, i === HAPAT_E_RRUGES.length - 1 && { flex: 0 }]}>
          <View
            style={[
              styles.pika,
              {
                backgroundColor: i < hapi ? t.theksi : t.karta,
                borderColor: i <= hapi ? t.theksi : t.vija,
              },
            ]}
          />
          {i < HAPAT_E_RRUGES.length - 1 && (
            <View
              style={[
                styles.vija,
                i < hapi
                  ? { borderColor: t.theksi, borderStyle: "solid" }
                  : { borderColor: t.vija, borderStyle: Platform.OS === "ios" ? "dotted" : "dashed" },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
}

/** Shiriti i progresit (portokalli). Mbushet kur shfaqet: e tregon që numri është i gjallë, jo dekor. */
export function Progresi({ vlera }: { vlera: number }) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const v = Math.max(0, Math.min(1, vlera));
  const gjeresia = useSharedValue(0);
  const p = useSharedValue(qetesi ? v : 0);

  useEffect(() => {
    p.set(qetesi ? v : withTiming(v, { duration: KOHA.ngadale, easing: LEHTESIMI.hyrje }));
  }, [v, qetesi, p]);

  // Lëvizim shiritin me translateX (jo me width), që animacioni të mos rillogarisë faqen dhe fundi të mbetet i rrumbullakët.
  const stili = useAnimatedStyle(() => ({
    opacity: gjeresia.get() > 0 ? 1 : 0,
    transform: [{ translateX: -(1 - p.get()) * gjeresia.get() }],
  }));

  return (
    <View
      style={[styles.progresi, { backgroundColor: t.karta2 }]}
      onLayout={(e) => gjeresia.set(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
    >
      <Animated.View style={[styles.progresiMbushur, { backgroundColor: t.theksi }, stili]} />
    </View>
  );
}

export const stiliTitullit: TextStyle = { fontFamily: SHKRONJAT.trashe };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradienti: { position: "absolute", left: 0, right: 0, top: 0, height: 320 },
  permbajtja: { padding: 18, gap: 12, paddingBottom: 120 },
  karta: {
    borderRadius: 22,
    padding: 16,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  chip: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  rruga: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  rrugaPjesa: { flex: 1, flexDirection: "row", alignItems: "center" },
  pika: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  vija: { flex: 1, borderTopWidth: 2, marginHorizontal: 3 },
  progresi: { height: 6, borderRadius: 3, overflow: "hidden" },
  progresiMbushur: { height: 6, width: "100%", borderRadius: 3 },
});
