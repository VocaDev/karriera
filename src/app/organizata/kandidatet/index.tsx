// Kandidatët (bordi, ekrani 62): renditja e kandidatëve anonimë për pozitat e mia.
// "Të gjitha": secili kandidat një herë, me pozitën ku përputhet më mirë. Ose një pozitë e vetme.
// (Kërkimi i talenteve pa shpallje, sipas rolit, s'ekziston: gatishmëria llogaritet gjithmonë për një punë konkrete.)
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import {
  gjendjaEGabimit,
  KartaEKandidatit,
  MesazhiNeQender,
  PA_INTERNET_KANDIDATET,
  ShenimiIPrivatesise,
  SkeletiIKandidateve,
  TEKSTI_PA_KANDIDATE,
  useKandidatet,
} from "@/components/Kandidatet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { GradientiSiper } from "@/components/TabEkrani";
import { Chip } from "@/components/ui";
import { meTeMiretSipasKandidatit } from "@/lib/kandidatet";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

const TE_GJITHA = "__te_gjitha__";

export default function Kandidatet() {
  const t = useTema();
  const te_dhenat = useKandidatet();
  const { punet, kandidatet, numrat, rifreskim, rifresko, titulliIPunes } = te_dhenat;
  const [zgjedhur, setZgjedhur] = useState<string>(TE_GJITHA);

  // Vetëm pozitat që kanë kandidatë, që filtrat të mos çojnë në lista bosh.
  const pozitat = useMemo(
    () => (punet && kandidatet ? punet.filter((p) => kandidatet.some((k) => k.puna_id === p.id)) : []),
    [punet, kandidatet],
  );
  // Pozita e zgjedhur mund të zhduket pas një rifreskimi (u fshi, ose s'ka më kandidatë): atëherë "Të gjitha".
  const filtri = zgjedhur !== TE_GJITHA && pozitat.some((p) => p.id === zgjedhur) ? zgjedhur : TE_GJITHA;

  const rreshtat = useMemo(() => {
    if (!kandidatet) return [];
    if (filtri === TE_GJITHA) {
      return meTeMiretSipasKandidatit(kandidatet).map(({ kandidati, punetTjera }) => ({
        kandidati,
        nentitulli: `${titulliIPunes(kandidati.puna_id)}${punetTjera > 0 ? ` · +${punetTjera} ${punetTjera === 1 ? "pozitë tjetër" : "pozita të tjera"}` : ""}`,
      }));
    }
    return kandidatet.filter((k) => k.puna_id === filtri).map((kandidati) => ({ kandidati, nentitulli: undefined }));
  }, [kandidatet, filtri, titulliIPunes]);

  const gabimi = gjendjaEGabimit(te_dhenat);

  function zgjidh(id: string) {
    if (id === filtri) return;
    prekja.zgjedhje();
    setZgjedhur(id);
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.faqja}
      refreshControl={<RefreshControl refreshing={rifreskim} onRefresh={rifresko} tintColor={t.zbehur} />}
    >
      <GradientiSiper />
      {kandidatet !== null && <ShiritiPaInternet teksti={PA_INTERNET_KANDIDATET.cfare} />}

      {pozitat.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrat}
          style={styles.filtratJashte}
          accessibilityRole="tablist"
        >
          {[{ id: TE_GJITHA, titulli: "Të gjitha" }, ...pozitat].map((p) => {
            const aktiv = p.id === filtri;
            const sa = p.id === TE_GJITHA ? meTeMiretSipasKandidatit(kandidatet ?? []).length : (numrat?.get(p.id)?.gati ?? null);
            return (
              <Prekshme
                key={p.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: aktiv }}
                onPress={() => zgjidh(p.id)}
                style={styles.filtri}
              >
                <Chip teksti={sa !== null ? `${p.titulli} ${sa}` : p.titulli} aktiv={aktiv} />
              </Prekshme>
            );
          })}
        </ScrollView>
      )}

      {gabimi ??
        (kandidatet === null ? (
          <SkeletiIKandidateve />
        ) : punet?.length === 0 ? (
          <MesazhiNeQender
            titulli="Ende s'keni asnjë pozitë"
            teksti="Kandidatët renditen gjithmonë për një pozitë konkrete. Shtoni një pozitë te tab-i Pozitat."
          />
        ) : rreshtat.length === 0 ? (
          <MesazhiNeQender titulli="Ende asnjë kandidat i dukshëm" teksti={TEKSTI_PA_KANDIDATE} />
        ) : (
          <View style={styles.lista}>
            {rreshtat.map(({ kandidati, nentitulli }, i) => (
              <KartaEKandidatit
                key={`${kandidati.kodi}-${kandidati.puna_id}`}
                kandidati={kandidati}
                renditja={i + 1}
                nentitulli={nentitulli}
              />
            ))}
          </View>
        ))}

      <ShenimiIPrivatesise />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  faqja: { padding: 18, gap: 12, paddingBottom: 120 },
  filtratJashte: { marginHorizontal: -18 },
  filtrat: { paddingHorizontal: 18, gap: 8 },
  filtri: { minHeight: 44, justifyContent: "center" },
  lista: { gap: 10 },
});
