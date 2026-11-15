// Trupi i ekranit të detajeve të punës: çfarë është puna, çka kërkojnë, çka ofrojnë, si aplikohet.
// Një seksion shfaqet vetëm kur ka të dhëna. Pa `kerkesat` (shpallje e vjetër ose AI-ja dështoi) del përshkrimi dhe aftësitë si më parë.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Karta, T } from "@/components/ui";
import { type Kerkesat, type Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

type Vetite = {
  puna: Pick<Puna, "pershkrimi" | "aftesite" | "kerkesat">;
  /** Emri i portalit ("KosovaJob") për shënimin e fundit; null te shpalljet e shtuara nga përdoruesit. */
  emriIPortalit: string | null;
};

function Seksioni({ titulli, children }: { titulli: string; children: ReactNode }) {
  return (
    <View style={styles.seksioni}>
      <T pesha="trashe" madhesia={17} accessibilityRole="header">
        {titulli}
      </T>
      {children}
    </View>
  );
}

/** Një listë me pika. Çdo pikë është një element i vetëm për VoiceOver (pa "pikë" të lexuar). */
function Pikat({ pikat }: { pikat: string[] }) {
  const t = useTema();
  return (
    <View style={styles.pikat}>
      {pikat.map((p, i) => (
        <View key={`${i}-${p}`} style={styles.pika} accessible accessibilityLabel={p}>
          <T madhesia={15.5} ngjyra={t.zbehur} style={styles.shenja} importantForAccessibility="no" accessibilityElementsHidden>
            •
          </T>
          <T madhesia={15.5} style={styles.teksti}>
            {p}
          </T>
        </View>
      ))}
    </View>
  );
}

/** Rreshta të grupuara (Arsimi, Përvoja, Gjuhët): etiketa sipër, vlera poshtë, që rreshtat e gjatë të thyhen mirë me tekst të madh. */
function Rreshtat({ rreshtat }: { rreshtat: { etiketa: string; vlera: string }[] }) {
  const t = useTema();
  return (
    <Karta style={styles.rreshtat}>
      {rreshtat.map((r, i) => (
        <View
          key={r.etiketa}
          style={[styles.rreshti, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.vija }]}
          accessible
          accessibilityLabel={`${r.etiketa}: ${r.vlera}`}
        >
          <T zbehur madhesia={13}>
            {r.etiketa}
          </T>
          <T pesha="mesme" madhesia={15.5}>
            {r.vlera}
          </T>
        </View>
      ))}
    </Karta>
  );
}

function Aftesite({ aftesite }: { aftesite: string[] }) {
  const t = useTema();
  if (aftesite.length === 0) return null;
  return (
    <Seksioni titulli="Aftësitë">
      <View style={styles.aftesite}>
        {aftesite.map((a) => (
          <View key={a} style={[styles.aftesia, { backgroundColor: t.karta, shadowColor: t.hija }]}>
            <T pesha="gjysme" madhesia={13.5}>
              {a}
            </T>
          </View>
        ))}
      </View>
    </Seksioni>
  );
}

function nePjese(k: Kerkesat) {
  const kerkohet: { etiketa: string; vlera: string }[] = [];
  if (k.arsimi) kerkohet.push({ etiketa: "Arsimi", vlera: k.arsimi });
  if (k.pervoja) kerkohet.push({ etiketa: "Përvoja", vlera: k.pervoja });
  if (k.gjuhet.length) kerkohet.push({ etiketa: "Gjuhët", vlera: k.gjuhet.join(", ") });
  return { kerkohet, ofrohet: k.paga ? [{ etiketa: "Paga", vlera: k.paga }] : [] };
}

export default function KerkesatEPunes({ puna, emriIPortalit }: Vetite) {
  const k = puna.kerkesat;

  // Pa kërkesa nga AI-ja: përshkrimi i rezervës dhe aftësitë, si para kësaj veçorie.
  if (!k) {
    return (
      <>
        {puna.pershkrimi ? (
          <Karta>
            <T madhesia={15.5} style={styles.pershkrimi}>
              {puna.pershkrimi}
            </T>
          </Karta>
        ) : null}
        <Aftesite aftesite={puna.aftesite} />
      </>
    );
  }

  const { kerkohet, ofrohet } = nePjese(k);
  const kaKerkesa = k.kerkesat.length > 0 || kerkohet.length > 0;
  const kaOferte = ofrohet.length > 0 || k.perfitimet.length > 0;

  return (
    <>
      <Seksioni titulli="Për punën">
        <T madhesia={16} style={styles.pershkrimi}>
          {k.permbledhja}
        </T>
      </Seksioni>

      {k.detyrat.length > 0 && (
        <Seksioni titulli="Çka do të bësh">
          <Pikat pikat={k.detyrat} />
        </Seksioni>
      )}

      {kaKerkesa && (
        <Seksioni titulli="Çka kërkojnë">
          {k.kerkesat.length > 0 && <Pikat pikat={k.kerkesat} />}
          {kerkohet.length > 0 && <Rreshtat rreshtat={kerkohet} />}
        </Seksioni>
      )}

      {k.perparesi.length > 0 && (
        <Seksioni titulli="Të preferueshme">
          <Pikat pikat={k.perparesi} />
        </Seksioni>
      )}

      {kaOferte && (
        <Seksioni titulli="Çka ofrojnë">
          {ofrohet.length > 0 && <Rreshtat rreshtat={ofrohet} />}
          {k.perfitimet.length > 0 && <Pikat pikat={k.perfitimet} />}
        </Seksioni>
      )}

      <Aftesite aftesite={puna.aftesite} />

      {k.aplikimi && (
        <Seksioni titulli="Si aplikohet">
          <T madhesia={15.5} style={styles.pershkrimi}>
            {k.aplikimi}
          </T>
        </Seksioni>
      )}

      <T zbehur madhesia={12.5} style={styles.shenimi}>
        {emriIPortalit
          ? `Përmbledhur nga AI nga shpallja te ${emriIPortalit}. Kontrollo detajet te shpallja origjinale.`
          : "Përmbledhur nga AI nga shpallja. Kontrollo detajet te shpallja origjinale."}
      </T>
    </>
  );
}

const styles = StyleSheet.create({
  seksioni: { gap: 8, marginTop: 14 },
  pershkrimi: { lineHeight: 23 },
  pikat: { gap: 7 },
  pika: { flexDirection: "row", gap: 9 },
  shenja: { lineHeight: 22 },
  teksti: { flex: 1, lineHeight: 22 },
  rreshtat: { paddingVertical: 4, paddingHorizontal: 16 },
  rreshti: { paddingVertical: 11, gap: 2 },
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
  shenimi: { marginTop: 18, lineHeight: 18 },
});
