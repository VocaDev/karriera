// Pjesët e ekranit "A jam gati?" (src/app/gati/[id].tsx): pritja me faza, skeleti i rezultatit, unaza që mbushet,
// rreshti i së kaluarës dhe hapat si veprime. Ngjyrat vijnë nga useTema; portokallia vetëm për progresin (unaza).
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import Prekshme from "@/components/Prekshme";
import { Pulsi, Vije } from "@/components/Skeleti";
import { Faqja, IKONAT, Ikona, Karta, Rruga, T } from "@/components/ui";
import type { CvEFundit, Prova } from "@/lib/gati";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import type { Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

// ---------- Unaza e rezultatit ----------

// Numri i madh (bordi: "rd lg"): harku portokalli mbushet nga 0 te përqindja në ~600 ms (ease-out) kur hapet rezultati.
// Me Reduce Motion rri i plotë që në fillim. Harku animohet me strokeDashoffset (si te Unaza.tsx): për një hark SVG
// s'ka transform ekuivalent pa maskë; ekrani përndryshe animon vetëm transform dhe opacity.
const R = 42;
const PERIMETRI = 2 * Math.PI * R;
const RrethiIAnimuar = Animated.createAnimatedComponent(Circle);
export const KOHA_E_UNAZES = 600;

export function UnazaEGatishmerise({ perqindja }: { perqindja: number }) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const v = perqindja / 100;
  const progresi = useSharedValue(qetesi ? v : 0);

  useEffect(() => {
    progresi.set(qetesi ? v : withTiming(v, { duration: KOHA_E_UNAZES, easing: LEHTESIMI.hyrje }));
  }, [v, qetesi, progresi]);

  const harku = useAnimatedProps(() => ({ strokeDashoffset: PERIMETRI * (1 - progresi.get()) }));

  return (
    <View
      style={styles.unaza}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Gati ${perqindja} për qind për këtë punë`}
      accessibilityValue={{ min: 0, max: 100, now: perqindja }}
    >
      <Svg width={176} height={176} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Circle cx={50} cy={50} r={R} stroke={t.karta2} strokeWidth={7} fill="none" />
        <RrethiIAnimuar
          cx={50}
          cy={50}
          r={R}
          stroke={t.theksi}
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${PERIMETRI} ${PERIMETRI}`}
          animatedProps={harku}
          transform="rotate(-90 50 50)"
        />
      </Svg>
      <T pesha="shumeTrashe" madhesia={52} maxFontSizeMultiplier={1.15} style={styles.numriIMadh}>
        {perqindja}
        <T pesha="trashe" madhesia={22} maxFontSizeMultiplier={1.15}>
          %
        </T>
      </T>
      <T zbehur pesha="gjysme" madhesia={13}>
        gati
      </T>
    </View>
  );
}

// ---------- Pritja (bordi 25): fazat e punës dhe skeleti i rezultatit ----------

// Serveri s'raporton fazat: ato ndjekin kohën që kalon dhe e themi hapur. Faza e fundit nuk "mbaron" kurrë vetë:
// mbaron kur vjen rezultati i vërtetë, dhe numri i sekondave vazhdon të ecë.
const FAZAT = [
  { teksti: "Po lexoj CV-në…", nga: 0 },
  { teksti: "Po krahasoj me kërkesat e punës…", nga: 5 },
  { teksti: "Po i rendit hapat…", nga: 16 },
] as const;

export function Pritja({ puna, cv }: { puna: Puna; cv: CvEFundit }) {
  const t = useTema();
  const [sekondat, setSekondat] = useState(0);

  useEffect(() => {
    const ora = setInterval(() => setSekondat((s) => s + 1), 1000);
    return () => clearInterval(ora);
  }, []);

  const aktive = FAZAT.reduce((k, f, i) => (sekondat >= f.nga ? i : k), 0);
  const detajet = [
    `CV-ja jote, versioni ${cv.versioni}`,
    puna.aftesite.length > 0 ? `${puna.aftesite.length} aftësi të kërkuara në shpallje` : "kërkesat nga shpallja",
    `${sekondat} s · zakonisht 10–40 sekonda`,
  ];

  return (
    <Faqja>
      <View style={styles.koka}>
        {/* Unaza e zbrazët në vendin ku vjen rezultati: faqja s'kërcen kur ai mbërrin. */}
        <Pulsi>
          <View
            style={[styles.unaza, styles.unazaBosh, { borderColor: t.karta2 }]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Po llogaritet, ${sekondat} sekonda`}
          >
            <T pesha="trashe" madhesia={28} maxFontSizeMultiplier={1.15}>
              {sekondat} s
            </T>
          </View>
        </Pulsi>
        <T zbehur madhesia={14} style={styles.qendroj}>
          {puna.titulli}, {puna.kompania}
        </T>
        {/* Bordi 25: rruga tregon ku jemi, CV-ja është kryer dhe po bëhet përputhja. */}
        <View style={styles.rrugaEPritjes}>
          <Rruga hapi={1} />
        </View>
      </View>

      <Karta style={styles.fazat}>
        <T pesha="trashe" madhesia={15} accessibilityRole="header">
          Po e krahasoj CV-në tënde me shpalljen
        </T>
        {FAZAT.map((f, i) => (
          <Faza
            key={f.teksti}
            gjendja={i < aktive ? "kryer" : i === aktive ? "aktiv" : "pret"}
            teksti={f.teksti}
            detaji={i === aktive ? detajet[i] : undefined}
          />
        ))}
        <Faza gjendja="pret" teksti="Rezultati ruhet për këtë punë" />
      </Karta>

      {/* Skeleti ka formën e rezultatit: dy kartat Çka ke / Çka të mungon. */}
      <Pulsi>
        <View style={styles.skeletiKartave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[0, 1].map((i) => (
            <View key={i} style={[styles.kartaSkelet, { backgroundColor: t.karta }]}>
              <Vije gjeresia="35%" lartesia={14} />
              <Vije gjeresia="90%" lartesia={12} />
              <Vije gjeresia="70%" lartesia={12} />
            </View>
          ))}
        </View>
      </Pulsi>

      <T zbehur madhesia={12.5} style={styles.qendroj}>
        Fazat janë të përafërta, sipas kohës që kalon. Mund të dalësh nga ky ekran: rezultati ruhet dhe e gjen këtu herën
        tjetër.
      </T>
    </Faqja>
  );
}

function Faza({ gjendja, teksti, detaji }: { gjendja: "kryer" | "aktiv" | "pret"; teksti: string; detaji?: string }) {
  const t = useTema();
  const etiketa = gjendja === "kryer" ? "kryer" : gjendja === "aktiv" ? "në punë" : "në pritje";
  return (
    <Animated.View
      entering={FadeIn.duration(KOHA.mesme)}
      style={styles.faza}
      accessible
      accessibilityLabel={`${teksti}, ${etiketa}${detaji ? `, ${detaji}` : ""}`}
      accessibilityLiveRegion={gjendja === "aktiv" ? "polite" : "none"}
    >
      <View
        style={[
          styles.pikaEFazes,
          gjendja === "kryer"
            ? { backgroundColor: t.teksti }
            : { borderWidth: 2, borderColor: gjendja === "aktiv" ? t.theksi : t.vija },
        ]}
      >
        {gjendja === "kryer" && <Ikona emri={IKONAT.check} madhesia={12} ngjyra={t.sfondi} />}
        {gjendja === "aktiv" && <ActivityIndicator size="small" color={t.theksi} style={styles.rrota} />}
      </View>
      <View style={styles.flex}>
        <T pesha={gjendja === "pret" ? "normal" : "gjysme"} madhesia={14.5} zbehur={gjendja === "pret"}>
          {teksti}
        </T>
        {detaji ? (
          <T zbehur madhesia={12.5}>
            {detaji}
          </T>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** Skeleti i leximit të parë (pa AI): faqja ka formën e rezultatit që vjen. */
export function SkeletiILeximit() {
  const t = useTema();
  return (
    <Faqja>
      <Pulsi>
        <View style={styles.skeleti} accessibilityLabel="Po ngarkohet">
          <View style={[styles.unaza, styles.unazaBosh, { borderColor: t.karta2 }]} />
          <Vije gjeresia="60%" lartesia={14} />
          <Vije gjeresia="100%" lartesia={10} rrezja={5} />
          <View style={[styles.kartaSkelet, { backgroundColor: t.karta }]}>
            <Vije gjeresia="35%" lartesia={14} />
            <Vije gjeresia="90%" lartesia={12} />
            <Vije gjeresia="70%" lartesia={12} />
          </View>
        </View>
      </Pulsi>
    </Faqja>
  );
}

// ---------- Historia: kontrollet e së kaluarës ----------

const SA_TE_KALUARA = 6;

/** Rreshti i vogël i kontrolleve të punës, nga më i vjetri te më i riu; i tanishmi i theksuar. Vetëm kur ka të paktën dy. */
export function HistoriaERreshtit({ historia, aktualiId }: { historia: Prova[]; aktualiId: string }) {
  const t = useTema();
  if (historia.length < 2) return null;
  const rradha = historia.slice(0, SA_TE_KALUARA).reverse();
  return (
    <View style={styles.historia} accessibilityRole="list">
      <T zbehur madhesia={12.5}>
        Kontrollet e mëparshme për këtë punë
      </T>
      <View style={styles.historiaRreshti}>
        {rradha.map((p) => {
          const eTanishme = p.id === aktualiId;
          return (
            <View
              key={p.id}
              style={[
                styles.prova,
                { backgroundColor: eTanishme ? t.teksti : t.karta2 },
              ]}
              accessible
              accessibilityLabel={`${dataEPlote(p.krijuar_me)}, ${p.perqindja} për qind, ${
                p.burimi === "intervista" ? "pas intervistës" : "nga CV-ja"
              }${eTanishme ? ", ky rezultat" : ""}`}
            >
              <T pesha="trashe" madhesia={14} ngjyra={eTanishme ? t.sfondi : t.teksti}>
                {p.perqindja}%
              </T>
              <T madhesia={11.5} ngjyra={eTanishme ? t.sfondi : t.zbehur}>
                {dataEShkurter(p.krijuar_me)}
                {p.burimi === "intervista" ? " · int." : ""}
              </T>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** "+12 nga herë e kaluar" / "−5 nga herë e kaluar" / "Njësoj si herë e kaluar". Shenja e thotë, jo vetëm ngjyra. */
export function NdryshimiChip({ delta }: { delta: number }) {
  const t = useTema();
  const ngjyra = delta > 0 ? t.ok : delta < 0 ? t.keq : t.zbehur;
  const teksti =
    delta === 0 ? "Njësoj si herë e kaluar" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} nga herë e kaluar`;
  return (
    <View style={[styles.ndryshimi, { backgroundColor: t.karta2 }]} accessible accessibilityLabel={teksti.replace("−", "minus ")}>
      <T pesha="gjysme" madhesia={13} ngjyra={ngjyra}>
        {teksti}
      </T>
    </View>
  );
}

// ---------- Hapat e radhës si veprime ----------

export type VeprimiNeRresht = { teksti: string; ikona?: { ios: string; android: string }; onPress: () => void };

/** Një hap: shenja "e bëra" (e jotja, vetëm në telefon) dhe, kur ekziston një veprim i vërtetë, butoni që e bën. */
export function RreshtiIHapit({
  numri,
  teksti,
  bere,
  onNdrysho,
  veprimi,
}: {
  numri: number;
  teksti: string;
  bere: boolean;
  onNdrysho: () => void;
  veprimi: VeprimiNeRresht | null;
}) {
  const t = useTema();
  return (
    <View style={styles.hapi}>
      <Prekshme
        accessibilityRole="checkbox"
        accessibilityLabel={`Hapi ${numri}: ${teksti}`}
        accessibilityHint="Shenjë e jotja, vetëm në këtë telefon. S'e ndryshon përqindjen."
        accessibilityState={{ checked: bere }}
        onPress={onNdrysho}
        hitSlop={10}
        shkalla={0.9}
        style={[
          styles.kutia,
          bere ? { backgroundColor: t.teksti } : { borderWidth: 1.5, borderColor: t.vija, backgroundColor: t.karta },
        ]}
      >
        {bere ? (
          <Ikona emri={IKONAT.check} madhesia={13} ngjyra={t.sfondi} />
        ) : (
          <T pesha="trashe" madhesia={12.5} zbehur>
            {numri}
          </T>
        )}
      </Prekshme>
      <View style={styles.flex}>
        <T madhesia={14.5} zbehur={bere} style={styles.rreshtiGjate}>
          {teksti}
        </T>
        {veprimi && (
          <Prekshme
            accessibilityRole="button"
            accessibilityLabel={veprimi.teksti}
            onPress={veprimi.onPress}
            style={[styles.veprimi, { borderColor: t.vija, backgroundColor: t.karta }]}
          >
            {veprimi.ikona && <Ikona emri={veprimi.ikona} madhesia={14} ngjyra={t.teksti} />}
            <T pesha="gjysme" madhesia={14}>
              {veprimi.teksti}
            </T>
          </Prekshme>
        )}
      </View>
    </View>
  );
}

// ---------- Pjesët e vogla të përbashkëta ----------

export function Qendra({ children }: { children: ReactNode }) {
  return (
    <Faqja>
      <View style={styles.qendra}>{children}</View>
    </Faqja>
  );
}

export function Butoni({
  teksti,
  onPress,
  dytesor = false,
  jashtePune = false,
  ikona,
  hint,
}: {
  teksti: string;
  onPress: () => void;
  dytesor?: boolean;
  /** Duket i zbehur (p.sh. kufiri u arrit) por prekja ende përgjigjet, me dridhje dhe me tekstin përse. */
  jashtePune?: boolean;
  ikona?: { ios: string; android: string };
  hint?: string;
}) {
  const t = useTema();
  const ngjyra = dytesor ? t.teksti : t.sfondi;
  return (
    <Prekshme
      accessibilityRole="button"
      accessibilityLabel={teksti}
      accessibilityHint={hint}
      accessibilityState={{ disabled: jashtePune }}
      onPress={onPress}
      style={[
        styles.butoni,
        dytesor ? { borderWidth: 1.5, borderColor: t.vija, backgroundColor: t.karta } : { backgroundColor: t.teksti },
        jashtePune && styles.zbehur,
      ]}
    >
      {ikona && <Ikona emri={ikona} madhesia={16} ngjyra={ngjyra} />}
      <T pesha="trashe" madhesia={16} ngjyra={ngjyra}>
        {teksti}
      </T>
    </Prekshme>
  );
}



function dy(n: number) {
  return String(n).padStart(2, "0");
}

export function dataEPlote(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${dy(d.getDate())}.${dy(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function dataEShkurter(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${dy(d.getDate())}.${dy(d.getMonth() + 1)}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qendroj: { textAlign: "center" },
  qendra: { alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: 8 },
  koka: { alignItems: "center", gap: 10, paddingTop: 4, marginBottom: 6 },
  unaza: { width: 176, height: 176, alignItems: "center", justifyContent: "center" },
  unazaBosh: { borderRadius: 88, borderWidth: 12 },
  numriIMadh: { letterSpacing: -1.5, lineHeight: 58 },
  rrugaEPritjes: { alignSelf: "stretch" },
  fazat: { gap: 14 },
  faza: { flexDirection: "row", gap: 12, alignItems: "center" },
  pikaEFazes: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rrota: { transform: [{ scale: 0.7 }] },
  skeletiKartave: { gap: 12, marginTop: 4, marginBottom: 4 },
  kartaSkelet: { alignSelf: "stretch", borderRadius: 22, padding: 16, gap: 10 },
  skeleti: { gap: 12, alignItems: "center", paddingTop: 8 },
  historia: { gap: 8, alignItems: "center" },
  historiaRreshti: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  prova: { borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", minWidth: 62 },
  ndryshimi: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  hapi: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  kutia: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: -1 },
  rreshtiGjate: { lineHeight: 21 },
  veprimi: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 44,
    marginTop: 8,
  },
  butoni: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "stretch",
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 20,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  zbehur: { opacity: 0.45 },
});
