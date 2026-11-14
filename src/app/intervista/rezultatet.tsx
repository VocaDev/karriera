import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Pulsi, Vije } from "@/components/Skeleti";
import { Chip, Faqja, IKONAT, Ikona, Karta, Progresi, T, Titulli } from "@/components/ui";
import { GabimIIntervistes, krijoRaportin, lexoIntervisten } from "@/lib/intervista/klienti";
import type { IntervistaInfo, Raporti, RreshtiIBisedes } from "@/lib/intervista/tipet";
import { Butoni, KartaEGabimit } from "@/lib/intervista/ui";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

// Rezultatet (bordi, ekranet 15 dhe 26). Lajmi kryesor është gatishmëria për punën (para → pas), pastaj nota,
// feedback-u për çdo përgjigje ("mirë / përmirëso / shembull më i mirë") dhe tri hapat. Parametri: ?id=<intervista>.
// Nëse raporti s'është bërë ende, ky ekran e kërkon (serveri e bën vetëm një herë dhe e kthen të ruajtur pas kësaj).

type Gjendja =
  | { lloji: "ngarkon" }
  | { lloji: "pret" }
  | { lloji: "gati"; raporti: Raporti; info: IntervistaInfo; biseda: RreshtiIBisedes[] }
  | { lloji: "aktive" }
  | { lloji: "nuk_u_gjet" }
  | { lloji: "gabim"; mesazhi: string; riprovohet: boolean };

const PRITJA_MS = 4000; // kur raporti po shkruhet nga një kërkesë tjetër
const MAKS_PRITJE = 12;

/** Lexon raportin; nëse intervista ka mbaruar por raporti s'është bërë ende, e kërkon (dhe pret nëse po shkruhet). */
async function ngarkoRezultatet(id: string, iGjalle: () => boolean, vendos: (g: Gjendja) => void): Promise<void> {
  try {
    const lexuar = await lexoIntervisten(id);
    if (!lexuar) return vendos({ lloji: "nuk_u_gjet" });
    if (lexuar.raporti) {
      return vendos({ lloji: "gati", raporti: lexuar.raporti, info: lexuar.info, biseda: lexuar.biseda });
    }
    if (lexuar.info.gjendja === "aktive") return vendos({ lloji: "aktive" });

    vendos({ lloji: "pret" });
    for (let prova = 0; prova < MAKS_PRITJE; prova++) {
      try {
        const raporti = await krijoRaportin(id);
        if (!iGjalle()) return;
        prekja.sukses();
        return vendos({ lloji: "gati", raporti, info: lexuar.info, biseda: lexuar.biseda });
      } catch (e) {
        // Një kërkesë tjetër (ekrani i intervistës) po e shkruan raportin: prit dhe pyet sërish.
        if (e instanceof GabimIIntervistes && e.kodi === "po_perpunohet") {
          await new Promise((r) => setTimeout(r, PRITJA_MS));
          if (!iGjalle()) return;
          continue;
        }
        throw e;
      }
    }
    throw new GabimIIntervistes("Raporti po zgjat më shumë se zakonisht. Provo përsëri pas pak.", "po_perpunohet");
  } catch (e) {
    if (!iGjalle()) return;
    prekja.gabim();
    vendos({
      lloji: "gabim",
      mesazhi: e instanceof Error ? e.message : "Rezultatet s'u lexuan. Provo përsëri.",
      riprovohet: !(e instanceof GabimIIntervistes) || e.riprovohet,
    });
  }
}

export default function RezultatetEkrani() {
  const t = useTema();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "ngarkon" });

  const [rilexo, setRilexo] = useState(0);
  useEffect(() => {
    let aktiv = true;
    ngarkoRezultatet(
      id,
      () => aktiv,
      (g) => {
        if (aktiv) setGjendja(g);
      },
    );
    return () => {
      aktiv = false;
    };
  }, [id, rilexo]);

  if (gjendja.lloji === "ngarkon" || gjendja.lloji === "pret") {
    return <PoPergatitet pret={gjendja.lloji === "pret"} />;
  }

  if (gjendja.lloji === "gabim" || gjendja.lloji === "nuk_u_gjet" || gjendja.lloji === "aktive") {
    return (
      <Faqja>
        {gjendja.lloji === "gabim" && (
          <KartaEGabimit
            titulli="Rezultatet s'u përgatitën"
            mesazhi={gjendja.mesazhi}
            riprovo={
              gjendja.riprovohet
                ? () => {
                    setGjendja({ lloji: "ngarkon" });
                    setRilexo((n) => n + 1);
                  }
                : undefined
            }
          />
        )}
        {gjendja.lloji === "nuk_u_gjet" && (
          <KartaEGabimit titulli="Intervista nuk u gjet" mesazhi="Mund të jetë fshirë, ose s'është e jotja." />
        )}
        {gjendja.lloji === "aktive" && (
          <>
            <KartaEGabimit
              titulli="Intervista s'ka mbaruar ende"
              mesazhi="Përgjigju pyetjeve të mbetura, ose prek “Dil” → “Përfundo dhe shiko rezultatet”."
            />
            <Butoni
              teksti="Vazhdo intervistën"
              onPress={() => router.replace({ pathname: "/intervista/[id]", params: { id } })}
            />
          </>
        )}
      </Faqja>
    );
  }

  const { raporti, biseda } = gjendja;
  const g = raporti.gatishmeria;
  const ndryshimi = g.para !== null && g.pas !== null ? g.pas - g.para : null;
  const pergjigjet = new Map(biseda.map((k) => [k.nr, k.pergjigja]));

  return (
    <Faqja>
      <Titulli>Intervista mbaroi</Titulli>
      <T zbehur madhesia={15}>
        {raporti.puna.titulli} · {raporti.puna.kompania}
      </T>

      {/* 1 · Gatishmëria për punën: lajmi kryesor */}
      {g.pas !== null ? (
        <Karta style={styles.karta}>
          <T pesha="trashe" madhesia={14} zbehur>
            Gatishmëria për këtë punë
          </T>
          <View style={styles.rreshtiINumrave}>
            {g.para !== null && (
              <>
                <T pesha="gjysme" madhesia={22} zbehur maxFontSizeMultiplier={1.3}>
                  {g.para}%
                </T>
                <Ikona emri={IKONAT.shigjeta} madhesia={16} ngjyra={t.zbehur} />
              </>
            )}
            <T pesha="shumeTrashe" madhesia={40} ngjyra={t.theksi} maxFontSizeMultiplier={1.2}>
              {g.pas}%
            </T>
            {ndryshimi !== null && ndryshimi !== 0 && (
              <Chip teksti={`${ndryshimi > 0 ? "+" : ""}${ndryshimi} nga kjo intervistë`} theks={ndryshimi > 0} />
            )}
          </View>
          <Progresi vlera={g.pas / 100} />
          <T zbehur madhesia={13.5} style={styles.rreshtat}>
            {g.para === null ? "Hera e parë që matet për këtë punë. " : ""}
            {g.arsyeja}
          </T>
        </Karta>
      ) : (
        <Karta style={styles.karta}>
          <T zbehur madhesia={13.5}>
            Gatishmëria për këtë punë s&apos;u përditësua këtë herë. Feedback-u më poshtë vlen gjithsesi.
          </T>
        </Karta>
      )}

      {/* 2 · Nota e intervistës */}
      <Karta style={styles.karta}>
        <View style={styles.rreshtiINumrave}>
          <T pesha="shumeTrashe" madhesia={34} maxFontSizeMultiplier={1.2} accessibilityLabel={`Nota ${raporti.nota} nga 100`}>
            {raporti.nota}
          </T>
          <T zbehur madhesia={15}>
            /100 · nota e intervistës
          </T>
        </View>
        <T madhesia={15} style={styles.rreshtat}>
          {raporti.permbledhja}
        </T>
        <T zbehur madhesia={12}>
          Vlerësim praktik nga AI-ja, jo parashikim punësimi.
        </T>
      </Karta>

      {/* 3 · Çdo përgjigje */}
      <T pesha="trashe" madhesia={18} style={styles.seksioni}>
        Përgjigjet
      </T>
      {raporti.pergjigjet.map((p) => {
        const ePerdoruesit = pergjigjet.get(p.nr);
        return (
          <Karta key={p.nr} style={styles.karta}>
            <View style={styles.rresht}>
              <T pesha="trashe" madhesia={14.5}>
                Pyetja {p.nr}
              </T>
              {p.lloji === "vazhdim" && <Chip teksti="Vazhduese" />}
            </View>
            <T zbehur madhesia={14} style={styles.rreshtat}>
              {p.pyetja}
            </T>
            {ePerdoruesit ? (
              <View style={[styles.ePerdoruesit, { borderLeftColor: t.vija }]}>
                <T zbehur madhesia={13} numberOfLines={4} accessibilityLabel={`Përgjigjja jote: ${ePerdoruesit}`}>
                  {ePerdoruesit}
                </T>
              </View>
            ) : null}
            <Pika ngjyra={t.ok} etiketa="Mirë" teksti={p.cka_ishte_mire} />
            <Pika ngjyra={t.theksi} etiketa="Përmirëso" teksti={p.cka_te_permiresosh} />
            {p.shembull_me_i_mire !== "—" && (
              <View style={[styles.shembulli, { backgroundColor: t.karta2 }]}>
                <T pesha="trashe" madhesia={12.5} zbehur>
                  Shembull më i mirë
                </T>
                <T madhesia={14.5} style={styles.rreshtat}>
                  “{p.shembull_me_i_mire}”
                </T>
              </View>
            )}
          </Karta>
        );
      })}

      {/* 4 · Çka mungon */}
      {g.mungon.length > 0 && (
        <>
          <T pesha="trashe" madhesia={18} style={styles.seksioni}>
            Çka të mungon për këtë punë
          </T>
          <Karta style={styles.karta}>
            {g.mungon.slice(0, 4).map((m, i) => (
              <View key={`m${i}`} style={styles.mungon}>
                <T pesha="gjysme" madhesia={14.5}>
                  {m.aftesia}
                </T>
                <T zbehur madhesia={13.5} style={styles.rreshtat}>
                  {m.si}
                </T>
              </View>
            ))}
          </Karta>
        </>
      )}

      {/* 5 · Tri hapat */}
      {raporti.tri_hapat_e_radhes.length > 0 && (
        <>
          <T pesha="trashe" madhesia={18} style={styles.seksioni}>
            Hapat e radhës
          </T>
          <Karta style={styles.karta}>
            {raporti.tri_hapat_e_radhes.map((h, i) => (
              <View key={`h${i}`} style={styles.hapi}>
                <View style={[styles.numri, { backgroundColor: t.theksiButë }]}>
                  <T pesha="trashe" madhesia={13} ngjyra={t.theksi}>
                    {i + 1}
                  </T>
                </View>
                <T madhesia={14.5} style={[styles.flex, styles.rreshtat]}>
                  {h}
                </T>
              </View>
            ))}
          </Karta>
        </>
      )}

      <View style={styles.butonat}>
        <Butoni
          teksti="Provo përsëri"
          pershkrimi="Intervistë e re për të njëjtën punë"
          onPress={() =>
            router.replace({ pathname: "/intervista", params: { puna: raporti.puna.id, gjuha: raporti.gjuha } })
          }
        />
        <Butoni
          teksti="Kthehu te puna"
          lloji="dytesor"
          onPress={() => router.replace({ pathname: "/pune/[id]", params: { id: raporti.puna.id } })}
        />
      </View>
    </Faqja>
  );
}

function Pika({ ngjyra, etiketa, teksti }: { ngjyra: string; etiketa: string; teksti: string }) {
  return (
    <View style={styles.pikaRresht} accessible accessibilityLabel={`${etiketa}: ${teksti}`}>
      <View style={[styles.pika, { backgroundColor: ngjyra }]} />
      <T madhesia={14} style={[styles.flex, styles.rreshtat]}>
        <T pesha="trashe" madhesia={14}>
          {etiketa}:{" "}
        </T>
        {teksti}
      </T>
    </View>
  );
}

/** Ekrani 26: gjatë pritjes skeleti ka formën e rezultateve, që asgjë të mos kërcejë kur vijnë. */
function PoPergatitet({ pret }: { pret: boolean }) {
  return (
    <Faqja>
      <View accessibilityLiveRegion="polite" style={styles.pritja}>
        <T pesha="trashe" madhesia={22}>
          {pret ? "Po i përgatis rezultatet" : "Po hapen rezultatet"}
        </T>
        {pret && (
          <T zbehur madhesia={14.5} style={styles.rreshtat}>
            AI-ja po i lexon përgjigjet e tua edhe një herë. Zakonisht 10–30 sekonda.
          </T>
        )}
      </View>
      <Pulsi>
        <View style={styles.skeleti} accessibilityLabel="Po ngarkohen rezultatet">
          <Karta style={styles.karta}>
            <Vije gjeresia="45%" lartesia={13} />
            <Vije gjeresia={120} lartesia={36} rrezja={10} />
            <Vije gjeresia="100%" lartesia={6} rrezja={3} />
          </Karta>
          <Karta style={styles.karta}>
            <Vije gjeresia="30%" lartesia={28} rrezja={8} />
            <Vije gjeresia="90%" lartesia={13} />
            <Vije gjeresia="70%" lartesia={13} />
          </Karta>
        </View>
      </Pulsi>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  karta: { gap: 10 },
  rresht: { flexDirection: "row", alignItems: "center", gap: 8 },
  rreshtiINumrave: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  rreshtat: { lineHeight: 20 },
  seksioni: { marginTop: 10 },
  ePerdoruesit: { borderLeftWidth: 3, paddingLeft: 10 },
  pikaRresht: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  pika: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  shembulli: { borderRadius: 14, padding: 12, gap: 4 },
  mungon: { gap: 2 },
  hapi: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  numri: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  butonat: { gap: 10, marginTop: 14 },
  pritja: { gap: 6, marginBottom: 6 },
  skeleti: { gap: 12 },
});
