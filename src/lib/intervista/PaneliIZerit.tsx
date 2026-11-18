// Paneli i Fol-it: avatari lart, statusi ("Po flet Arta · Po të dëgjoj · Arta po mendon… · Radha jote"),
// transkripti i të dyve (children: biseda e ekranit) dhe poshtë: "Përsërit pyetjen" · mikrofoni · "Ndalo".
// Vizatohet vetëm në Fol: kur kandidati kalon te Shkruaj, hiqet bashkë me avatarin dhe mikrofonin.
import { useRef, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from "react-native-reanimated";

import Prekshme from "@/components/Prekshme";
import { Pulsi } from "@/components/Skeleti";
import { Ikona, T } from "@/components/ui";
import { useTema } from "@/lib/tema";

import { Avatari, type AvatariRef } from "./Avatari";
import type { Gjendja } from "./gjendja";
import type { FjaliaMeZe } from "./mesazhet";
import { PAMJA_E_INTERVISTUESIT, type Intervistuesi } from "./tipet";
import type { CelesiIZerit, RezultatiIZerit } from "./useIntervista";
import { useZeri } from "./useZeri";

const MIKROFONI = { ios: "mic.fill", android: "mic" };
const NDALO = { ios: "stop.fill", android: "stop" };
const PERSERIT = { ios: "arrow.counterclockwise", android: "replay" };
const HESHT = { ios: "forward.end.fill", android: "skip_next" };

export function PaneliIZerit({
  intervistaId,
  gjendja,
  intervistuesi,
  kaInternet,
  dergoZerin,
  merrZerin,
  uPyet,
  kaloTeShkruaj,
  njofto,
  onRaportiGati,
  poshte,
  children,
}: {
  intervistaId: string;
  gjendja: Gjendja;
  intervistuesi: Intervistuesi;
  kaInternet: boolean;
  dergoZerin: (uri: string) => Promise<RezultatiIZerit>;
  merrZerin: (celesi: CelesiIZerit) => FjaliaMeZe[] | null;
  uPyet: () => void;
  kaloTeShkruaj: (mesazhi: string | null) => void;
  njofto: (teksti: string, lloji?: "sukses" | "info" | "gabim") => void;
  onRaportiGati: () => void;
  /** Hapësira poshtë (safe area). */
  poshte: number;
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const avatari = useRef<AvatariRef>(null);
  const z = useZeri({
    avatari,
    intervistaId,
    gjendja,
    intervistuesi,
    kaInternet,
    dergoZerin,
    merrZerin,
    uPyet,
    kaloTeShkruaj,
    njofto,
    onRaportiGati,
  });
  const emri = PAMJA_E_INTERVISTUESIT[intervistuesi].emri;
  const mbaroi = gjendja.faza === "perfundon" || gjendja.faza === "raporti";

  return (
    <View style={styles.flex}>
      <Avatari
        ref={avatari}
        intervistuesi={intervistuesi}
        onGati={z.onGati}
        onFoliFilloi={z.onFoliFilloi}
        onFoliMbaroi={z.onFoliMbaroi}
        onPrek={z.onPrek}
        onGabim={z.onGabim}
        style={[styles.avatari, { height: Math.round(height * 0.3) }]}
      />
      <Statusi teksti={z.statusi} radha={z.radha} mendon={z.mendon} />
      {children}
      {!mbaroi && (
        <ShiritiPoshte
          regjistron={z.regjistron}
          radhaJote={z.radhaJote}
          flet={z.flet}
          kaInternet={z.kaInternet}
          niveli={z.niveli}
          emri={emri}
          onMikrofoni={z.prekMikrofonin}
          onPerserit={z.perseritPyetjen}
          onNdalo={z.ndaloFolesin}
          poshte={poshte}
        />
      )}
    </View>
  );
}

/** Kush e ka radhën: pika portokalli kur është radha jote; tri pika që pulsojnë kur intervistuesi mendon. */
function Statusi({ teksti, radha, mendon }: { teksti: string; radha: "ai" | "ti" | "askush"; mendon: boolean }) {
  const t = useTema();
  return (
    <View style={styles.statusi} accessibilityLiveRegion="polite" accessibilityLabel={teksti}>
      {mendon ? (
        <Pulsi>
          <View style={styles.pikat}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.pikaE, { backgroundColor: t.zbehur }]} />
            ))}
          </View>
        </Pulsi>
      ) : (
        <View style={[styles.pika, { backgroundColor: radha === "ti" ? t.theksi : radha === "ai" ? t.zbehur : t.vija }]} />
      )}
      <T pesha={radha === "ti" ? "trashe" : "gjysme"} madhesia={14.5} ngjyra={radha === "ti" ? t.teksti : t.zbehur}>
        {teksti}
      </T>
    </View>
  );
}

/** Butoni i vogël anësor (Përsërit / Ndalo): gjithmonë me tekst, jo vetëm ikonë. */
function ButoniAnesor({
  ikona,
  teksti,
  onPress,
  pershkrimi,
}: {
  ikona: { ios: string; android: string };
  teksti: string;
  onPress: () => void;
  pershkrimi: string;
}) {
  return (
    <Prekshme accessibilityRole="button" accessibilityLabel={teksti} accessibilityHint={pershkrimi} onPress={onPress} style={styles.anesor}>
      <Ikona emri={ikona} madhesia={20} />
      <T pesha="gjysme" madhesia={12} style={styles.qendroj}>
        {teksti}
      </T>
    </Prekshme>
  );
}

/** Poshtë: "Përsërit pyetjen" (radha jote) · mikrofoni i madh · "Ndalo" (kur intervistuesi flet). */
function ShiritiPoshte({
  regjistron,
  radhaJote,
  flet,
  kaInternet,
  niveli,
  emri,
  onMikrofoni,
  onPerserit,
  onNdalo,
  poshte,
}: {
  regjistron: boolean;
  radhaJote: boolean;
  flet: boolean;
  kaInternet: boolean;
  niveli: SharedValue<number>;
  emri: string;
  onMikrofoni: () => void;
  onPerserit: () => void;
  onNdalo: () => void;
  poshte: number;
}) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const unaza = useAnimatedStyle(() => ({
    transform: [{ scale: qetesi ? 1 : 1 + niveli.get() * 0.35 }],
    opacity: regjistron ? 0.25 + niveli.get() * 0.4 : 0,
  }));
  const aktiv = regjistron || (radhaJote && kaInternet);
  const ngjyra = regjistron ? t.keq : aktiv ? t.theksi : t.karta2;
  const etiketa = regjistron
    ? "Prek për ta dërguar"
    : radhaJote
      ? kaInternet
        ? "Prek dhe fol"
        : "Pa internet"
      : flet
        ? `Po flet ${emri}`
        : `Prit ${emri}`;
  return (
    <View style={[styles.shiriti, { paddingBottom: poshte, borderTopColor: t.vija, backgroundColor: t.sfondi }]}>
      <View style={styles.rreshti}>
        <View style={styles.ane}>
          {radhaJote && !regjistron && (
            <ButoniAnesor ikona={PERSERIT} teksti="Përsërit pyetjen" pershkrimi={`${emri} e thotë pyetjen sërish`} onPress={onPerserit} />
          )}
        </View>
        <View style={styles.vendi}>
          <Animated.View pointerEvents="none" style={[styles.unaza, { backgroundColor: t.keq }, unaza]} />
          <Prekshme
            accessibilityRole="button"
            accessibilityLabel={regjistron ? "Ndalo dhe dërgo përgjigjen" : "Fol përgjigjen"}
            accessibilityHint={
              regjistron ? "Përgjigjja dërgohet dhe kthehet në tekst" : radhaJote ? "Hap mikrofonin" : `${emri} po flet ose po mendon`
            }
            accessibilityState={{ disabled: !aktiv }}
            onPress={onMikrofoni}
            style={[styles.butoni, { backgroundColor: ngjyra }]}
          >
            <Ikona emri={regjistron ? NDALO : MIKROFONI} madhesia={30} ngjyra={aktiv ? t.sfondi : t.zbehur} />
          </Prekshme>
        </View>
        <View style={styles.ane}>
          {flet && <ButoniAnesor ikona={HESHT} teksti="Ndalo" pershkrimi={`${emri} hesht dhe radha kalon te ti`} onPress={onNdalo} />}
        </View>
      </View>
      <T pesha="gjysme" madhesia={13.5} zbehur={!regjistron}>
        {etiketa}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qendroj: { textAlign: "center" },
  avatari: { marginHorizontal: 16, marginTop: 10 },
  statusi: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 10, minHeight: 30 },
  pika: { width: 9, height: 9, borderRadius: 5 },
  pikat: { flexDirection: "row", gap: 4 },
  pikaE: { width: 6, height: 6, borderRadius: 3 },
  shiriti: { alignItems: "center", gap: 4, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  rreshti: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 },
  ane: { width: 84, alignItems: "center" },
  anesor: { alignItems: "center", justifyContent: "center", gap: 2, minHeight: 56, minWidth: 64, paddingHorizontal: 6 },
  vendi: { width: 104, height: 104, alignItems: "center", justifyContent: "center" },
  unaza: { position: "absolute", width: 104, height: 104, borderRadius: 52 },
  butoni: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
});
