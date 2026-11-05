import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Chip, Faqja, Karta, Rruga, T } from "@/components/ui";
import { gjePunen, type Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

// Detajet e punës (bordi, ekrani 11).
export default function DetajetEPunes() {
  const t = useTema();
  // Lista dërgon vetëm id-në në adresë (/pune/p3); këtu e lexojmë dhe e kërkojmë në Supabase.
  const { id } = useLocalSearchParams<{ id: string }>();
  const [puna, setPuna] = useState<Puna | null | undefined>(undefined); // undefined = duke ngarkuar
  const [gabimi, setGabimi] = useState<string | null>(null);

  useEffect(() => {
    gjePunen(id)
      .then(setPuna)
      .catch((e) => setGabimi(e instanceof Error ? e.message : "Gabim i panjohur"));
  }, [id]);

  if (gabimi) {
    return (
      <View style={[styles.qendra, { backgroundColor: t.sfondi }]}>
        <T>S&apos;u lexua puna: {gabimi}</T>
      </View>
    );
  }

  if (puna === undefined) {
    return <ActivityIndicator style={[styles.qendra, { backgroundColor: t.sfondi }]} />;
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

      <View style={[styles.butoni, { backgroundColor: t.teksti, opacity: 0.35 }]} accessibilityState={{ disabled: true }}>
        <T pesha="trashe" madhesia={16} ngjyra={t.sfondi}>
          A jam gati për këtë?
        </T>
      </View>
      <T zbehur madhesia={12.5} style={styles.qendroj}>
        &quot;A jam gati?&quot; vjen më 02.12, me AI-në
      </T>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  qendra: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
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
  butoni: { borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  qendroj: { textAlign: "center" },
});
