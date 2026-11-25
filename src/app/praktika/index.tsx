import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { Stack, useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { Faqja, IKONAT, Ikona, Karta, Progresi, T, Titulli } from "@/components/ui";
import {
  EMRAT_E_GJUHEVE_PRAKTIKES,
  EMRAT_E_ROLEVE_PRAKTIKES,
  GJUHET_E_PRAKTIKES,
  ROLET_E_PRAKTIKES,
  idtePer,
  type GjuhaPraktikes,
  type RoliPraktikes,
} from "@/data/pyetjet";
import { KESHILLAT } from "@/data/keshillat";
import { useDridhja } from "@/lib/levizja";
import {
  gjuhaNgaProfili,
  lexoZgjedhjen,
  numro,
  roliNgaProfili,
  rrugaPraktikes,
  ruajZgjedhjen,
  useProgresin,
  type ZgjedhjaPraktikes,
} from "@/lib/praktika";
import { prekja } from "@/lib/prekja";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

// Praktiko pa internet: zgjidh rolin dhe gjuhën, pastaj kartat. Pyetjet dhe këshillat janë të paketuara në app,
// kështu që gjithçka këtu punon në modalitetin e avionit. Rroli dhe gjuha fillojnë nga zgjedhja e fundit,
// pastaj nga profili; nëse s'ka asnjërën, zgjedhja është e jotja.

const SA_PYETJE = idtePer("swe").length;

export default function Praktika() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const { sesioni, roli_synuar, gjuha: gjuhaEProfilit } = useSesioni();
  const uid = sesioni?.user.id ?? null;
  const { stili: stiliIButonit, dridhu } = useDridhja();

  const [ruajtur, setRuajtur] = useState<ZgjedhjaPraktikes | null>(null);
  const [roliIZgjedhur, setRoliIZgjedhur] = useState<RoliPraktikes | null>(null);
  const [gjuhaEZgjedhur, setGjuhaEZgjedhur] = useState<GjuhaPraktikes | null>(null);

  // Zgjedhja e fundit e këtij përdoruesi (vetëm lexim lokal).
  useEffect(() => {
    if (!uid) return;
    let aktiv = true;
    lexoZgjedhjen(uid).then((z) => {
      if (aktiv) setRuajtur(z);
    });
    return () => {
      aktiv = false;
    };
  }, [uid]);

  const roli = roliIZgjedhur ?? ruajtur?.roli ?? roliNgaProfili(roli_synuar);
  const gjuha = gjuhaEZgjedhur ?? ruajtur?.gjuha ?? gjuhaNgaProfili(gjuhaEProfilit) ?? "sq";

  const swe = useProgresin(uid, "swe");
  const zyre = useProgresin(uid, "zyre");
  const progresiPerRol = { swe: swe.progresi, zyre: zyre.progresi };
  const perPerserit = roli ? numro(progresiPerRol[roli], idtePer(roli)).perserit : 0;

  function hapKartat(vetemPerserit: boolean) {
    if (!roli) {
      prekja.gabim();
      dridhu();
      njofto("Zgjidh një rol së pari.", "info");
      return;
    }
    prekja.zgjedhje();
    if (uid) ruajZgjedhjen(uid, { roli, gjuha });
    router.push({
      pathname: "/praktika/kartat",
      params: { roli, gjuha, ...(vetemPerserit ? { modi: "perserit" } : {}) },
    } as unknown as Href);
  }

  return (
    <Faqja>
      <Stack.Screen options={{ title: "" }} />
      <Titulli>Praktiko pa internet</Titulli>
      <T zbehur madhesia={14}>
        Pyetje, kartat dhe këshilla që hapen edhe pa lidhje. Asgjë nuk dërgohet askund.
      </T>

      <T pesha="gjysme" madhesia={13} zbehur style={styles.etiketa}>
        Roli
      </T>
      {ROLET_E_PRAKTIKES.map((r) => {
        const aktiv = roli === r;
        const { di } = numro(progresiPerRol[r], idtePer(r));
        return (
          <Prekshme
            key={r}
            onPress={() => {
              prekja.zgjedhje();
              setRoliIZgjedhur(r);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: aktiv }}
            accessibilityLabel={`${EMRAT_E_ROLEVE_PRAKTIKES[r].titulli}, ${di} nga ${SA_PYETJE} të dhëna`}
          >
            <Karta style={[styles.roli, { borderWidth: 2, borderColor: aktiv ? t.teksti : "transparent" }]}>
              <View style={styles.rresht}>
                <View style={styles.flex}>
                  <T pesha="trashe" madhesia={16}>
                    {EMRAT_E_ROLEVE_PRAKTIKES[r].titulli}
                  </T>
                  <T zbehur madhesia={13.5}>
                    {EMRAT_E_ROLEVE_PRAKTIKES[r].pershkrimi}
                  </T>
                </View>
                <View style={[styles.radio, { borderColor: aktiv ? t.teksti : t.vija }]}>
                  {aktiv && <View style={[styles.radioPika, { backgroundColor: t.teksti }]} />}
                </View>
              </View>
              <Progresi vlera={di / SA_PYETJE} />
              <T zbehur madhesia={12.5}>
                {di} nga {SA_PYETJE} të di
              </T>
            </Karta>
          </Prekshme>
        );
      })}

      <T pesha="gjysme" madhesia={13} zbehur style={styles.etiketa}>
        Gjuha e pyetjeve
      </T>
      <SegmentedControl
        values={GJUHET_E_PRAKTIKES.map((g) => g.toUpperCase())}
        selectedIndex={GJUHET_E_PRAKTIKES.indexOf(gjuha)}
        onChange={(e) => {
          prekja.zgjedhje();
          setGjuhaEZgjedhur(GJUHET_E_PRAKTIKES[e.nativeEvent.selectedSegmentIndex]);
        }}
        appearance={t.errët ? "dark" : "light"}
        accessibilityLabel="Gjuha e pyetjeve"
      />
      <T zbehur madhesia={13}>
        Pyetjet dhe përgjigjet në {EMRAT_E_GJUHEVE_PRAKTIKES[gjuha]}.
      </T>

      <Animated.View style={stiliIButonit}>
        <Prekshme
          onPress={() => hapKartat(false)}
          accessibilityRole="button"
          accessibilityLabel="Fillo kartat"
          style={StyleSheet.flatten([styles.butoni, { backgroundColor: t.teksti }, !roli && styles.iDobet])}
        >
          <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
            Fillo kartat
          </T>
        </Prekshme>
      </Animated.View>
      {perPerserit > 0 && (
        <Prekshme
          onPress={() => hapKartat(true)}
          accessibilityRole="button"
          accessibilityLabel={`Vetëm ${perPerserit} karta për t'i përsëritur`}
          style={StyleSheet.flatten([styles.butoniDyte, { borderColor: t.vija }])}
        >
          <T pesha="gjysme" madhesia={14.5}>
            Vetëm ato për përsëritje ({perPerserit})
          </T>
        </Prekshme>
      )}

      <Prekshme
        onPress={() => {
          prekja.zgjedhje();
          router.push(rrugaPraktikes("/praktika/keshillat"));
        }}
        accessibilityRole="button"
        accessibilityLabel={`Këshilla për intervistën, ${KESHILLAT.length} karta`}
      >
        <Karta style={styles.rresht}>
          <View style={[styles.ikona, { backgroundColor: t.theksiButë }]}>
            <Ikona emri={IKONAT.shkolla} madhesia={20} ngjyra={t.theksi} />
          </View>
          <View style={styles.flex}>
            <T pesha="trashe" madhesia={16}>
              Këshilla për intervistën
            </T>
            <T zbehur madhesia={13.5}>
              {KESHILLAT.length} karta: STAR, paga, &quot;pse ju?&quot;, intervista online.
            </T>
          </View>
          <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
        </Karta>
      </Prekshme>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  rresht: { flexDirection: "row", alignItems: "center", gap: 12 },
  etiketa: { marginTop: 8 },
  roli: { gap: 10 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioPika: { width: 10, height: 10, borderRadius: 5 },
  ikona: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  butoni: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 26,
    minHeight: 48,
    marginTop: 8,
  },
  iDobet: { opacity: 0.55 },
  butoniDyte: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 26,
    minHeight: 48,
  },
});
