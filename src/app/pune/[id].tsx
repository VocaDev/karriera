import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import Prekshme from "@/components/Prekshme";
import { Pulsi, Vije } from "@/components/Skeleti";
import { Chip, Faqja, IKONAT, Ikona, Karta, Rruga, T } from "@/components/ui";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { gjePunen, type Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

// Detajet e punës (bordi, ekrani 11).
export default function DetajetEPunes() {
  const t = useTema();
  const { stili: stiliIButonit, dridhu } = useDridhja();
  // Lista dërgon vetëm id-në në adresë (/pune/p3); këtu e lexojmë dhe e kërkojmë në Supabase.
  const { id } = useLocalSearchParams<{ id: string }>();
  const [puna, setPuna] = useState<Puna | null | undefined>(undefined); // undefined = duke ngarkuar
  const [gabimi, setGabimi] = useState<string | null>(null);

  const lexo = useCallback(() => {
    gjePunen(id)
      .then((p) => {
        setGabimi(null);
        setPuna(p);
      })
      .catch((e) => setGabimi(e instanceof Error ? e.message : "Gabim i panjohur"));
  }, [id]);

  useEffect(() => {
    lexo();
  }, [lexo]);

  if (gabimi) {
    return (
      <View style={[styles.qendra, { backgroundColor: t.sfondi }]}>
        <T pesha="trashe" madhesia={16}>
          S&apos;u lexua puna
        </T>
        <T zbehur madhesia={14} style={styles.qendroj}>
          {gabimi}
        </T>
        <Prekshme
          accessibilityRole="button"
          onPress={() => {
            setGabimi(null);
            setPuna(undefined);
            lexo();
          }}
          style={[styles.butoniVogel, { backgroundColor: t.teksti }]}
        >
          <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
            Provo përsëri
          </T>
        </Prekshme>
      </View>
    );
  }

  // Gjatë leximit: skeleti ka formën e faqes (chip-i, titulli, kompania, karta), që asgjë të mos kërcejë.
  if (puna === undefined) {
    return (
      <Faqja>
        <Pulsi>
          <View style={styles.skeleti} accessibilityLabel="Po ngarkohet puna">
            <Vije gjeresia={48} lartesia={22} rrezja={7} />
            <Vije gjeresia="88%" lartesia={26} rrezja={8} />
            <Vije gjeresia="55%" lartesia={15} />
            <View style={[styles.kartaSkelet, { backgroundColor: t.karta }]}>
              <Vije gjeresia="40%" lartesia={14} />
              <Vije gjeresia="80%" lartesia={12} />
              <Vije gjeresia="100%" lartesia={10} rrezja={5} />
            </View>
          </View>
        </Pulsi>
      </Faqja>
    );
  }

  // Roja: nëse id-ja nuk ekziston (p.sh. /pune/x99), nuk rrëzohet aplikacioni.
  if (puna === null) {
    return (
      <View style={[styles.qendra, { backgroundColor: t.sfondi }]}>
        <Stack.Screen options={{ title: "Nuk u gjet" }} />
        <T>Puna “{id}” nuk u gjet.</T>
      </View>
    );
  }

  const roli = puna.roli === "Asistent/PR" ? "ZYRË" : puna.roli === "Tjetër" ? "TJETËR" : "SWE";

  return (
    <Faqja>
      <Stack.Screen options={{ title: puna.kompania }} />

      <View style={styles.rresht}>
        <Chip teksti={roli} />
        {puna.burimi === "perdoruesi" && <Chip teksti="Shtuar nga një përdorues" />}
      </View>
      <T pesha="trashe" madhesia={26} style={styles.titulli}>
        {puna.titulli}
      </T>
      <T zbehur madhesia={15}>
        {puna.kompania}, {puna.qyteti}
      </T>

      <Karta>
        <T pesha="trashe" madhesia={14}>
          Tani: CV
        </T>
        <T zbehur madhesia={13}>
          Ngarko CV-në për të parë sa je gati për këtë punë
        </T>
        <Rruga hapi={0} />
      </Karta>

      {puna.pershkrimi ? (
        <Karta>
          <T madhesia={15.5} style={styles.pershkrimi}>
            {puna.pershkrimi}
          </T>
        </Karta>
      ) : null}

      {puna.aftesite.length > 0 && (
        <>
          <T pesha="trashe" madhesia={17} style={styles.seksioni}>
            Aftësitë që kërkohen
          </T>
          <View style={styles.aftesite}>
            {puna.aftesite.map((a) => (
              <View key={a} style={[styles.aftesia, { backgroundColor: t.karta, shadowColor: t.hija }]}>
                <T pesha="gjysme" madhesia={13.5}>
                  {a}
                </T>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Ende i kyçur: prekja jep një dridhje të lehtë ("jo tani"), dhe teksti poshtë thotë kur vjen. */}
      <Animated.View style={stiliIButonit}>
        <Prekshme
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityHint="Vjen më 02.12"
          onPress={() => {
            prekja.lehte();
            dridhu();
          }}
          style={[styles.butoni, { backgroundColor: t.teksti, opacity: 0.35 }]}
        >
          <Ikona emri={IKONAT.kycja} madhesia={14} ngjyra={t.sfondi} />
          <T pesha="trashe" madhesia={16} ngjyra={t.sfondi}>
            A jam gati për këtë?
          </T>
        </Prekshme>
      </Animated.View>
      <T zbehur madhesia={12.5} style={styles.qendroj}>
        &quot;A jam gati?&quot; vjen më 02.12, me AI-në
      </T>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  qendra: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  qendroj: { textAlign: "center" },
  skeleti: { gap: 12 },
  kartaSkelet: { borderRadius: 22, padding: 16, gap: 10, marginTop: 4 },
  rresht: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  titulli: { letterSpacing: -0.5, lineHeight: 31 },
  pershkrimi: { lineHeight: 22 },
  seksioni: { marginTop: 6 },
  aftesite: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  aftesia: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  butoni: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  butoniVogel: { marginTop: 8, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, minHeight: 44, justifyContent: "center" },
});
