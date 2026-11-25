import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import Prekshme from "@/components/Prekshme";
import { Chip, Faqja, Karta, Progresi, T } from "@/components/ui";
import { EMRAT_E_ROLEVE_PRAKTIKES, pyetjetPer, type PyetjaPraktikes } from "@/data/pyetjet";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import {
  eshteGjuhe,
  eshteRol,
  KOHAT,
  lexoKohen,
  numro,
  ruajKohen,
  useProgresin,
  type Kuta,
  type KohaPraktikes,
  type Progresi as ProgresiTipi,
} from "@/lib/praktika";
import { prekja } from "@/lib/prekja";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

// Kartat (flashcards): një pyetje për ekran. Prek kartën për të parë çka do të dëgjojë intervistuesi, hintin dhe gabimin
// e zakonshëm. Rrëshqit anash për të kaluar; "E di" / "Përsërite" ruhen në telefon (praktika:<uid>:progresi:<roli>).
// Parametrat: ?roli=swe|zyre&gjuha=sq|en|de&modi=perserit (vetëm kartat e shënuara "Përsërite").

const KOHA_ETIKETAT = ["Pa kohë", "60 s", "90 s"] as const;

export default function Kartat() {
  const params = useLocalSearchParams<{ roli?: string; gjuha?: string; modi?: string }>();
  const roli = eshteRol(params.roli) ? params.roli : "swe";
  const gjuha = eshteGjuhe(params.gjuha) ? params.gjuha : "sq";
  const { sesioni } = useSesioni();
  const uid = sesioni?.user.id ?? null;
  const { progresi, gati, shenjo } = useProgresin(uid, roli);
  const pyetjet = pyetjetPer(roli, gjuha);

  return (
    <Faqja pa_scroll>
      <Stack.Screen options={{ title: EMRAT_E_ROLEVE_PRAKTIKES[roli].titulli }} />
      {gati ? (
        <Seanca
          // Çelësi: një rol ose gjuhë tjetër nis një seancë të re.
          key={`${roli}:${gjuha}`}
          uid={uid}
          roliEtiketa={roli === "swe" ? "SWE" : "Zyrë"}
          gjuhaEtiketa={gjuha.toUpperCase()}
          pyetjet={pyetjet}
          progresi={progresi}
          shenjo={shenjo}
          vetemPerserit={params.modi === "perserit"}
        />
      ) : (
        <View style={styles.qender}>
          <T zbehur>Po hapen kartat…</T>
        </View>
      )}
    </Faqja>
  );
}

type SeancaProps = {
  uid: string | null;
  roliEtiketa: string;
  gjuhaEtiketa: string;
  pyetjet: readonly PyetjaPraktikes[];
  progresi: ProgresiTipi;
  shenjo: (id: string, kuta: Kuta | null) => void;
  vetemPerserit: boolean;
};

function Seanca({ uid, roliEtiketa, gjuhaEtiketa, pyetjet, progresi, shenjo, vetemPerserit }: SeancaProps) {
  const t = useTema();
  const router = useRouter();
  const kufijte = useSafeAreaInsets();
  const { width: gjeresia } = useWindowDimensions();
  const lista = useRef<FlatList<PyetjaPraktikes>>(null);

  // Rendi i kartave ngrihet një herë kur hapet seanca: shënimi i një karte s'e zhvendos kartën tjetër poshtë gishtit.
  const [rendi, setRendi] = useState<readonly string[]>(() =>
    vetemPerserit ? pyetjet.filter((p) => progresi[p.id] === "perserit").map((p) => p.id) : pyetjet.map((p) => p.id),
  );
  const [rinisja, setRinisja] = useState(0);
  const [i, setI] = useState(0);
  const [kthyerId, setKthyerId] = useState<string | null>(null);
  const [fundi, setFundi] = useState(false);
  const [koha, setKoha] = useState<KohaPraktikes>(0);

  // Koha e zgjedhur herën e fundit (vetëm lokale).
  useEffect(() => {
    if (!uid) return;
    let aktiv = true;
    lexoKohen(uid).then((k) => {
      if (aktiv) setKoha(k);
    });
    return () => {
      aktiv = false;
    };
  }, [uid]);

  const karta = rendi.length > 0 ? pyetjet.find((p) => p.id === rendi[i]) : undefined;
  const kartat = rendi.map((id) => pyetjet.find((p) => p.id === id)).filter((p): p is PyetjaPraktikes => p !== undefined);
  const permbledhja = numro(progresi, pyetjet.map((p) => p.id));

  function shko(n: number) {
    setI(n);
    setKthyerId(null);
    lista.current?.scrollToIndex({ index: n, animated: true });
  }

  function vazhdo() {
    if (i + 1 < kartat.length) {
      shko(i + 1);
    } else {
      prekja.sukses();
      setFundi(true);
    }
  }

  function shenjoDheVazhdo(kuta: Kuta) {
    if (!karta) return;
    prekja.zgjedhje();
    shenjo(karta.id, kuta);
    vazhdo();
  }

  function riFillo(tePerserit: boolean) {
    prekja.zgjedhje();
    setRendi(
      tePerserit ? pyetjet.filter((p) => progresi[p.id] === "perserit").map((p) => p.id) : pyetjet.map((p) => p.id),
    );
    setI(0);
    setKthyerId(null);
    setFundi(false);
    setRinisja((n) => n + 1);
  }

  if (rendi.length === 0 || fundi) {
    const bosh = rendi.length === 0;
    return (
      <View style={[styles.faqja, styles.faqjaEFundit, { paddingBottom: kufijte.bottom + 16 }]}>
        <Karta>
          <T pesha="trashe" madhesia={22}>
            {bosh ? "S'ke asgjë për të përsëritur" : "E mbarove këtë radhë"}
          </T>
          <T zbehur madhesia={14.5}>
            {bosh
              ? "Asnjë kartë nuk është shënuar “Përsërite”. Hap të gjitha kartat dhe shëno ato që s'të dalin ende."
              : `${permbledhja.di} nga ${pyetjet.length} të di, ${permbledhja.perserit} për t'i përsëritur.`}
          </T>
          <Progresi vlera={permbledhja.di / pyetjet.length} />
        </Karta>
        {permbledhja.perserit > 0 && (
          <Prekshme
            onPress={() => riFillo(true)}
            accessibilityRole="button"
            style={StyleSheet.flatten([styles.butoni, { backgroundColor: t.teksti }])}
          >
            <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
              Përsërit {permbledhja.perserit} karta
            </T>
          </Prekshme>
        )}
        <Prekshme
          onPress={() => riFillo(false)}
          accessibilityRole="button"
          style={StyleSheet.flatten([styles.butoniDyte, { borderColor: t.vija }])}
        >
          <T pesha="gjysme" madhesia={14.5}>
            Të gjitha nga e para
          </T>
        </Prekshme>
        <Prekshme
          onPress={() => router.back()}
          accessibilityRole="button"
          style={StyleSheet.flatten([styles.butoniDyte, { borderColor: t.vija }])}
        >
          <T pesha="gjysme" madhesia={14.5}>
            Mbrapa te zgjedhja
          </T>
        </Prekshme>
      </View>
    );
  }

  return (
    <View style={[styles.faqja, { paddingBottom: kufijte.bottom + 12 }]}>
      <View style={styles.siper}>
        <View style={styles.rresht}>
          <Chip teksti={`${roliEtiketa} · ${gjuhaEtiketa}`} />
          <T pesha="gjysme" madhesia={14} zbehur accessibilityLabel={`Karta ${i + 1} nga ${kartat.length}`}>
            {i + 1} / {kartat.length}
          </T>
        </View>
        <SegmentedControl
          values={[...KOHA_ETIKETAT]}
          selectedIndex={KOHAT.indexOf(koha)}
          onChange={(e) => {
            const k = KOHAT[e.nativeEvent.selectedSegmentIndex];
            prekja.zgjedhje();
            setKoha(k);
            if (uid) ruajKohen(uid, k);
          }}
          appearance={t.errët ? "dark" : "light"}
          accessibilityLabel="Koha për përgjigje"
        />
        {koha > 0 && karta && (
          <Kohamati
            key={`${karta.id}:${koha}:${rinisja}`}
            sekonda={koha}
            aktiv={kthyerId !== karta.id}
            onMbaroi={() => {
              prekja.lehte();
              setKthyerId(karta.id);
            }}
          />
        )}
      </View>

      <FlatList
        // Çelësi: pas rifillimit lista rinis nga karta e parë.
        key={rinisja}
        ref={lista}
        data={kartat}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_d, n) => ({ length: gjeresia, offset: gjeresia * n, index: n })}
        onMomentumScrollEnd={(e) => {
          const n = Math.round(e.nativeEvent.contentOffset.x / gjeresia);
          if (n !== i && n >= 0 && n < kartat.length) {
            setI(n);
            setKthyerId(null);
          }
        }}
        style={styles.lista}
        renderItem={({ item }) => (
          <View style={{ width: gjeresia, paddingHorizontal: 18 }}>
            <KartaEPyetjes
              pyetja={item}
              kthyer={kthyerId === item.id}
              shenja={progresi[item.id]}
              onPrek={() => setKthyerId((k) => (k === item.id ? null : item.id))}
            />
          </View>
        )}
      />

      <View style={styles.poshte}>
        <View style={styles.rresht}>
          <Prekshme
            onPress={() => shenjoDheVazhdo("perserit")}
            accessibilityRole="button"
            accessibilityLabel="Përsërite: do ta shoh sërish"
            style={StyleSheet.flatten([styles.butoniDyte, styles.flex, { borderColor: t.vija }])}
          >
            <T pesha="gjysme" madhesia={15}>
              Përsërite
            </T>
          </Prekshme>
          <Prekshme
            onPress={() => shenjoDheVazhdo("di")}
            accessibilityRole="button"
            accessibilityLabel="E di: e di përgjigjen"
            style={StyleSheet.flatten([styles.butoni, styles.flex, { backgroundColor: t.teksti }])}
          >
            <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
              E di
            </T>
          </Prekshme>
        </View>
        <View style={[styles.rresht, styles.navigimi]}>
          <Prekshme
            onPress={() => {
              if (i > 0) shko(i - 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Karta e mëparshme"
            accessibilityState={{ disabled: i === 0 }}
            style={StyleSheet.flatten([styles.tekstButoni, i === 0 && styles.iDobet])}
          >
            <T zbehur pesha="gjysme" madhesia={14}>
              ‹ Mbrapa
            </T>
          </Prekshme>
          <Prekshme
            onPress={vazhdo}
            accessibilityRole="button"
            accessibilityLabel="Kalo kartën pa e shënuar"
            style={styles.tekstButoni}
          >
            <T zbehur pesha="gjysme" madhesia={14}>
              Kalo ›
            </T>
          </Prekshme>
        </View>
      </View>
    </View>
  );
}

/** Numërimi mbrapsht: shiriti portokalli tregon kohën që mbetet. Ndalet kur kartën e kthen (aktiv = false). */
function Kohamati({ sekonda, aktiv, onMbaroi }: { sekonda: number; aktiv: boolean; onMbaroi: () => void }) {
  const [mbetur, setMbetur] = useState(sekonda);

  useEffect(() => {
    if (!aktiv || mbetur <= 0) return;
    const ora = setTimeout(() => setMbetur((m) => m - 1), 1000);
    return () => clearTimeout(ora);
  }, [aktiv, mbetur]);

  // Koha mbaroi: karta kthehet vetë dhe shfaq përgjigjen e pritur. Vetëm një herë: nëse e kthen mbrapa, mbetet.
  const njoftuar = useRef(false);
  useEffect(() => {
    if (aktiv && mbetur <= 0 && !njoftuar.current) {
      njoftuar.current = true;
      onMbaroi();
    }
  }, [aktiv, mbetur, onMbaroi]);

  const minuta = Math.floor(mbetur / 60);
  const sekonda2 = String(mbetur % 60).padStart(2, "0");
  return (
    <View style={styles.kohamati} accessibilityLabel={`Kanë mbetur ${mbetur} sekonda`}>
      <T pesha="gjysme" madhesia={14} style={styles.koha}>
        {minuta}:{sekonda2}
      </T>
      <View style={styles.flex}>
        <Progresi vlera={mbetur / sekonda} />
      </View>
    </View>
  );
}

type KartaProps = { pyetja: PyetjaPraktikes; kthyer: boolean; shenja: Kuta | undefined; onPrek: () => void };

/** Karta me kthim: dalja e pjesës para zhduket në 90°, përmbajtja ndërrohet, pjesa e pasme hyn. */
function KartaEPyetjes({ pyetja, kthyer, shenja, onPrek }: KartaProps) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const [shfaqur, setShfaqur] = useState(kthyer);
  const rrotullimi = useSharedValue(0);
  const stili = useAnimatedStyle(() =>
    qetesi ? {} : { transform: [{ perspective: 900 }, { rotateY: `${rrotullimi.get()}deg` }] },
  );

  useEffect(() => {
    if (kthyer === shfaqur) return;
    rrotullimi.set(
      withTiming(90, { duration: KOHA.shpejt, easing: LEHTESIMI.dalje }, (mbaroi) => {
        if (!mbaroi) return;
        scheduleOnRN(setShfaqur, kthyer);
        rrotullimi.set(-90);
        rrotullimi.set(withTiming(0, { duration: KOHA.shpejt, easing: LEHTESIMI.hyrje }));
      }),
    );
  }, [kthyer, shfaqur, rrotullimi]);

  return (
    <Animated.View style={[styles.flex, stili]}>
      <Prekshme
        onPress={onPrek}
        shkalla={0.99}
        accessibilityRole="button"
        accessibilityLabel={shfaqur ? "Kthe kartën te pyetja" : "Kthe kartën për të parë çka pret intervistuesi"}
        style={styles.flex}
      >
        <Karta style={styles.karta}>
          {shenja !== undefined && (
            <Chip teksti={shenja === "di" ? "E di" : "Përsërite"} theks={shenja === "perserit"} />
          )}
          {shfaqur ? (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.pjesa}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <T zbehur madhesia={13.5}>
                {pyetja.pyetja}
              </T>
              <Pjesa titulli="Çka do të dëgjojë intervistuesi" teksti={pyetja.degjon} />
              <Pjesa titulli="Hint (STAR)" teksti={pyetja.hinti} />
              <Pjesa titulli="Gabimi i zakonshëm" teksti={pyetja.gabimi} ngjyra={t.keq} />
            </ScrollView>
          ) : (
            <View style={styles.perpara}>
              <T pesha="trashe" madhesia={24} style={styles.pyetja}>
                {pyetja.pyetja}
              </T>
              <T zbehur madhesia={13} style={styles.udhezimi}>
                Mendo përgjigjen me zë të lartë, pastaj prek kartën
              </T>
            </View>
          )}
        </Karta>
      </Prekshme>
    </Animated.View>
  );
}

function Pjesa({ titulli, teksti, ngjyra }: { titulli: string; teksti: string; ngjyra?: string }) {
  return (
    <View style={styles.pjesaTekst}>
      <T pesha="gjysme" madhesia={12.5} zbehur ngjyra={ngjyra}>
        {titulli}
      </T>
      <T madhesia={15.5} style={styles.rreshtimi}>
        {teksti}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qender: { flex: 1, alignItems: "center", justifyContent: "center" },
  faqja: { flex: 1, paddingTop: 8, gap: 12 },
  siper: { paddingHorizontal: 18, gap: 10 },
  rresht: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  lista: { flex: 1 },
  karta: { flex: 1, gap: 10 },
  perpara: { flex: 1, justifyContent: "center", gap: 18 },
  pyetja: { letterSpacing: -0.4, lineHeight: 31 },
  udhezimi: { textAlign: "center" },
  pjesa: { gap: 16, paddingBottom: 8 },
  pjesaTekst: { gap: 4 },
  rreshtimi: { lineHeight: 22 },
  poshte: { paddingHorizontal: 18, gap: 4 },
  navigimi: { justifyContent: "space-between" },
  butoni: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minHeight: 48,
  },
  butoniDyte: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 22,
    minHeight: 48,
  },
  tekstButoni: { minHeight: 44, minWidth: 80, justifyContent: "center", paddingHorizontal: 8 },
  iDobet: { opacity: 0.4 },
  kohamati: { flexDirection: "row", alignItems: "center", gap: 12 },
  koha: { width: 44, fontVariant: ["tabular-nums"] },
  faqjaEFundit: { paddingHorizontal: 18 },
});
