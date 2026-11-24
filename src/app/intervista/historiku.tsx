import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Pulsi, Vije } from "@/components/Skeleti";
import { Chip, Faqja, Karta, T, Titulli } from "@/components/ui";
import { lexoHistorikun, type RreshtiIHistorikut } from "@/lib/intervista/klienti";
import { EMRAT_E_GJUHEVE } from "@/lib/intervista/tipet";
import { Butoni, KartaEGabimit } from "@/lib/intervista/ui";
import { paInternet, tekstiIPlote } from "@/lib/mesazhet";
import { prekja } from "@/lib/prekja";
import { eshteGabimRrjeti, useRrjeti } from "@/lib/rrjeti";
import { useTema } from "@/lib/tema";

// Historiku i intervistave (bordi, ekrani 31): intervistat e mia që kanë mbaruar, me notën dhe ndryshimin e gatishmërisë.
// Prek një rresht për rezultatet, përgjigjet dhe feedback-un e plotë (ekrani Rezultatet). RLS: vetëm të miat.

type Gjendja =
  | { lloji: "ngarkon" }
  | { lloji: "gati"; rreshtat: RreshtiIHistorikut[] }
  | { lloji: "gabim"; mesazhi: string; rrjeti: boolean };

const PA_INTERNET_HISTORIKU = paInternet("historiku s'u lexua", false);

export default function HistorikuEkrani() {
  const t = useTema();
  const router = useRouter();
  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "ngarkon" });
  const [rilexo, setRilexo] = useState(0);
  const { kaInternet } = useRrjeti(() => setRilexo((n) => n + 1));

  const ngarko = useCallback(() => setGjendja({ lloji: "ngarkon" }), []);
  useEffect(() => {
    let aktiv = true;
    lexoHistorikun()
      .then((rreshtat) => {
        if (aktiv) setGjendja({ lloji: "gati", rreshtat });
      })
      .catch((e: unknown) => {
        if (!aktiv) return;
        prekja.gabim();
        setGjendja({
          lloji: "gabim",
          mesazhi: e instanceof Error ? e.message : "Historiku s'u lexua. Provo përsëri.",
          rrjeti: eshteGabimRrjeti(e),
        });
      });
    return () => {
      aktiv = false;
    };
  }, [rilexo]);

  const rreshtat = gjendja.lloji === "gati" ? gjendja.rreshtat : [];
  const notatEPara = rreshtat.filter((r) => r.nota !== null);
  // Nga e para deri te e fundit (rreshtat janë më e reja e para).
  const ecuria =
    notatEPara.length >= 2 ? (notatEPara[0].nota as number) - (notatEPara[notatEPara.length - 1].nota as number) : null;

  return (
    <Faqja>
      <Titulli>Intervistat e tua</Titulli>
      <ShiritiPaInternet teksti={tekstiIPlote(PA_INTERNET_HISTORIKU)} />

      {gjendja.lloji === "ngarkon" && <SkeletiIListes />}

      {gjendja.lloji === "gabim" && (
        <KartaEGabimit
          titulli={gjendja.rrjeti ? PA_INTERNET_HISTORIKU.titulli : "Historiku s'u lexua"}
          mesazhi={gjendja.rrjeti ? tekstiIPlote(PA_INTERNET_HISTORIKU) : gjendja.mesazhi}
          riprovo={() => {
            ngarko();
            setRilexo((n) => n + 1);
          }}
        />
      )}

      {gjendja.lloji === "gati" && rreshtat.length === 0 && (
        <Karta style={styles.karta}>
          <T pesha="trashe" madhesia={16}>
            S&apos;ke bërë ende intervistë
          </T>
          <T zbehur madhesia={14}>
            Pas intervistës së parë, këtu shihni notën dhe sa u rrit gatishmëria për çdo punë.
          </T>
          <Butoni teksti="Fillo një intervistë" onPress={() => router.push("/intervista")} />
        </Karta>
      )}

      {gjendja.lloji === "gati" && rreshtat.length > 0 && (
        <>
          {ecuria !== null && (
            <View
              style={[styles.ecuria, { backgroundColor: ecuria >= 0 ? t.theksiButë : t.karta2 }]}
              accessible
              accessibilityLabel={`Nga e para deri te e fundit: ${ecuria > 0 ? "+" : ""}${ecuria} pikë`}
            >
              <T pesha="gjysme" madhesia={14} ngjyra={ecuria >= 0 ? t.theksi : t.teksti}>
                Nga e para deri te e fundit: {ecuria > 0 ? "+" : ""}
                {ecuria} pikë
              </T>
            </View>
          )}
          <Karta style={styles.lista}>
            {rreshtat.map((r, i) => (
              <Rreshti
                key={r.id}
                r={r}
                kufi={i > 0}
                onPress={() => {
                  prekja.zgjedhje();
                  router.push({ pathname: "/intervista/rezultatet", params: { id: r.id } });
                }}
              />
            ))}
          </Karta>
          <T zbehur madhesia={12.5}>
            {kaInternet ? "Prek një intervistë për rezultatet, përgjigjet dhe feedback-un e plotë." : tekstiIPlote(PA_INTERNET_HISTORIKU)}
          </T>
        </>
      )}
    </Faqja>
  );
}

function Rreshti({ r, kufi, onPress }: { r: RreshtiIHistorikut; kufi: boolean; onPress: () => void }) {
  const t = useTema();
  const data = formatoDaten(r.data);
  const nenteksti = [data, `${r.nrPyetjeve} pyetje`, EMRAT_E_GJUHEVE[r.gjuha]].filter(Boolean).join(" · ");
  const titulli = r.puna ?? "Punë e hequr";
  return (
    <Prekshme
      accessibilityRole="button"
      accessibilityLabel={`${titulli}. ${nenteksti}${r.nota !== null ? `. Nota ${r.nota}` : ""}${r.ndryshimi ? `. Gatishmëria ${r.ndryshimi > 0 ? "+" : ""}${r.ndryshimi}` : ""}`}
      onPress={onPress}
      style={[styles.rreshti, kufi && { borderTopColor: t.vija, borderTopWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={[styles.nota, { backgroundColor: t.karta2 }]}>
        <T pesha="trashe" madhesia={16} maxFontSizeMultiplier={1.3}>
          {r.nota ?? "–"}
        </T>
      </View>
      <View style={styles.flex}>
        <T pesha="gjysme" madhesia={15} numberOfLines={2}>
          {titulli}
        </T>
        <T zbehur madhesia={12.5}>
          {nenteksti}
        </T>
      </View>
      {r.ndryshimi !== null && r.ndryshimi !== 0 && <Chip teksti={`${r.ndryshimi > 0 ? "+" : ""}${r.ndryshimi}`} theks={r.ndryshimi > 0} />}
    </Prekshme>
  );
}

function SkeletiIListes() {
  return (
    <Pulsi>
      <Karta style={styles.lista}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.rreshti} accessibilityLabel="Po ngarkohet historiku">
            <Vije gjeresia={44} lartesia={44} rrezja={12} />
            <View style={styles.flex}>
              <Vije gjeresia="70%" lartesia={14} />
              <Vije gjeresia="45%" lartesia={11} />
            </View>
          </View>
        ))}
      </Karta>
    </Pulsi>
  );
}

function formatoDaten(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("sq-AL", { day: "numeric", month: "short" });
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 3 },
  karta: { gap: 12 },
  lista: { padding: 0, overflow: "hidden" },
  ecuria: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  rreshti: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  nota: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
