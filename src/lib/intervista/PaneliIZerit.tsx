// Paneli i Fol-it: avatari lart, statusi ("Po flet Arta · Po të dëgjoj · Arta po mendon… · Radha jote"),
// transkripti i të dyve (children: biseda e ekranit) dhe poshtë: "Përsërit pyetjen" · mikrofoni · "Ndalo".
// Vizatohet vetëm në Fol: kur kandidati kalon te Shkruaj, hiqet bashkë me avatarin dhe mikrofonin.
import { CameraView } from "expo-camera";
import { useRef, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from "react-native-reanimated";

import Prekshme from "@/components/Prekshme";
import { Pulsi } from "@/components/Skeleti";
import { prekja } from "@/lib/prekja";
import { Ikona, T } from "@/components/ui";
import { useTema } from "@/lib/tema";

import { Avatari, type AvatariRef } from "./Avatari";
import { LejaModal } from "./LejaModal";
import { useKamera } from "./useKamera";
import type { Gjendja } from "./gjendja";
import { PAMJA_E_INTERVISTUESIT, type Intervistuesi } from "./tipet";
import type { RezultatiIZerit, ZeriRrjedhe } from "./useIntervista";
import { useZeri } from "./useZeri";

const MIKROFONI = { ios: "mic.fill", android: "mic" };
const NDALO = { ios: "stop.fill", android: "stop" };
const PERSERIT = { ios: "arrow.counterclockwise", android: "replay" };
const HESHT = { ios: "forward.end.fill", android: "skip_next" };
const ANULO = { ios: "xmark", android: "close" };
const KAMERA = { ios: "camera.fill", android: "photo_camera" };
const KAMERA_E_FIKUR = { ios: "video.slash.fill", android: "videocam_off" };

export function PaneliIZerit({
  intervistaId,
  gjendja,
  intervistuesi,
  kaInternet,
  dergoZerin,
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
  dergoZerin: (uri: string, zeri: ZeriRrjedhe) => Promise<RezultatiIZerit>;
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
    uPyet,
    kaloTeShkruaj,
    njofto,
    onRaportiGati,
  });
  const t = useTema();
  const k = useKamera({ avatari, intervistaId, faqjaGati: z.faqjaGati, njofto });
  const emri = PAMJA_E_INTERVISTUESIT[intervistuesi].emri;
  const mbaroi = gjendja.faza === "perfundon" || gjendja.faza === "raporti";

  return (
    <View style={styles.flex}>
      <View style={[styles.avatari, { height: Math.round(height * 0.3) }]}>
        <Avatari
          ref={avatari}
          intervistuesi={intervistuesi}
          onGati={z.onGati}
          onFoliFilloi={z.onFoliFilloi}
          onFoliMbaroi={z.onFoliMbaroi}
          onPrek={z.onPrek}
          onGabim={z.onGabim}
          onKamera={k.onKamera}
          onRinisje={z.onRinisje}
          style={styles.flex}
        />
        {/* Kamera: opsionale. Pamja e kandidatit vjen nga faqja (matje) ose, si rezervë, nga kamera native (vetëm pasqyrë). */}
        {k.menyra === "native" && (
          <View style={styles.pasqyra} pointerEvents="none" accessibilityLabel="Pamja jote nga kamera">
            <CameraView style={styles.flex} facing="front" mirror />
          </View>
        )}
        {k.aktive && k.menyra === "faqja" && k.gjendja !== "ne_rregull" && (
          <Prekshme
            accessibilityRole="button"
            accessibilityLabel={k.gjendja === "u_shkeput" ? "Kamera u shkëput. Prek për ta rilidhur" : "Po rilidhet kamera"}
            accessibilityState={{ disabled: k.gjendja !== "u_shkeput", busy: k.gjendja === "po_rilidhet" }}
            disabled={k.gjendja !== "u_shkeput"}
            onPress={k.rilidh}
            style={[styles.gjendjaKameres, { backgroundColor: t.karta, borderColor: t.vija }]}
          >
            <T pesha="gjysme" madhesia={12.5}>
              {k.gjendja === "u_shkeput" ? "Kamera u shkëput · prek për ta rilidhur" : "Po rilidhet kamera…"}
            </T>
          </Prekshme>
        )}
        <Prekshme
          accessibilityRole="button"
          accessibilityLabel={k.aktive ? "Fik kamerën" : "Ndiz kamerën"}
          accessibilityHint={k.aktive ? "Kamera fiket; intervista vazhdon me zë" : "Të tregon veten dhe mat kontaktin me sy; videoja nuk ruhet"}
          accessibilityState={{ selected: k.aktive }}
          onPress={() => {
            prekja.zgjedhje();
            void k.ndrysho();
          }}
          style={[styles.butoniKamera, { backgroundColor: k.aktive ? t.teksti : t.karta, borderColor: t.vija }]}
        >
          <Ikona emri={k.aktive ? KAMERA : KAMERA_E_FIKUR} madhesia={16} ngjyra={k.aktive ? t.sfondi : t.teksti} />
          <T pesha="gjysme" madhesia={13} ngjyra={k.aktive ? t.sfondi : t.teksti}>
            Kamera
          </T>
        </Prekshme>
      </View>
      <LejaModal
        lloji="kamera"
        faza={k.leja}
        emri={emri}
        onVazhdo={k.lejaVazhdo}
        onJo={k.lejaJo}
        onHapCilesimet={k.lejaHapCilesimet}
        onVazhdoMeShkrim={k.lejaVazhdoPaKamere}
      />
      <LejaModal
        faza={z.leja}
        emri={emri}
        onVazhdo={z.lejaVazhdo}
        onJo={z.lejaJo}
        onHapCilesimet={z.lejaHapCilesimet}
        onVazhdoMeShkrim={z.lejaVazhdoMeShkrim}
      />
      {k.aktive && k.menyra === "faqja" && k.analiza && !mbaroi && <ShiritiIVemendjes perqind={k.vemendja} larg={k.larg} />}
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
          onAnulo={z.anuloRegjistrimin}
          onNdalo={z.ndaloFolesin}
          poshte={poshte}
        />
      )}
    </View>
  );
}

/**
 * Vëmendja te kamera (vlerësim i përafërt, gjatë përgjigjeve; llogaritet në telefon). I qetë: pa zë, pa dridhje, pa ngjyra
 * alarmi; pas ~3 s pa shikim teksti bëhet "Shiko kamerën". Shiriti është neutral (portokallia është vetëm për progres).
 */
function ShiritiIVemendjes({ perqind, larg }: { perqind: number | null; larg: boolean }) {
  const t = useTema();
  const vlera = perqind === null ? "po matet…" : `≈ ${perqind}%`;
  const teksti = larg ? "Shiko kamerën" : "Shikimi te kamera";
  return (
    <View
      style={[styles.vemendja, { backgroundColor: larg ? t.karta2 : "transparent", borderColor: larg ? t.teksti : t.vija }]}
      accessible
      accessibilityLiveRegion={larg ? "polite" : "none"}
      accessibilityLabel={`${teksti}. ${perqind === null ? "Po matet" : `Rreth ${perqind} për qind e kohës gjatë përgjigjeve`}`}
    >
      <T pesha={larg ? "trashe" : "gjysme"} madhesia={13}>
        {teksti}
      </T>
      <View style={[styles.vemendjaBari, { backgroundColor: t.vija }]}>
        <View style={[styles.vemendjaMbushja, { backgroundColor: t.zbehur, width: `${perqind ?? 0}%` }]} />
      </View>
      <T zbehur madhesia={12.5} style={styles.vemendjaVlera}>
        {vlera}
      </T>
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
  onAnulo,
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
  onAnulo: () => void;
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
          {regjistron && (
            <ButoniAnesor ikona={ANULO} teksti="Anulo" pershkrimi="Hedh poshtë regjistrimin pa e dërguar" onPress={onAnulo} />
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
  gjendjaKameres: {
    position: "absolute",
    left: 8,
    bottom: 8,
    maxWidth: "70%",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  vemendja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  vemendjaBari: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  vemendjaMbushja: { height: 4, borderRadius: 2 },
  vemendjaVlera: { minWidth: 64, textAlign: "right" },
  pasqyra: { position: "absolute", right: 10, bottom: 10, width: 84, height: 112, borderRadius: 14, overflow: "hidden" },
  butoniKamera: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  qendroj: { textAlign: "center" },
  avatari: { marginHorizontal: 16, marginTop: 10, borderRadius: 24, overflow: "hidden" },
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
