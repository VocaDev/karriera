import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Pulsi, Vije } from "@/components/Skeleti";
import { Chip, Faqja, IKONAT, Ikona, Karta, T } from "@/components/ui";
import { nisIntervisten } from "@/lib/intervista/klienti";
import {
  eshteGjuhe,
  GJATESITE,
  GJUHET,
  EMRAT_E_GJUHEVE,
  PAMJA_E_INTERVISTUESIT,
  type Gjatesia,
  type Gjuha,
} from "@/lib/intervista/tipet";
import { useIntervistuesiIZgjedhur } from "@/lib/intervista/intervistuesi";
import { mbeshtetetZeri } from "@/lib/intervista/useRegjistruesi";
import { Butoni, KartaEGabimit, ZgjidhIntervistuesin } from "@/lib/intervista/ui";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { paInternet, tekstiIPlote } from "@/lib/mesazhet";
import { KOHA_E_LEXIMIT, meKohe, pamjaEGabimit, useRrjeti } from "@/lib/rrjeti";
import { gjePunen, listoPunet } from "@/lib/punet";
import { listoTeRuajturatMePune } from "@/lib/ruajtura";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

// Zgjidh intervistën (bordi, ekrani 34): puna, gjuha, gjatësia dhe Shkruaj · Fol. Parametrat: ?puna=<id>&gjuha=sq|en|de
// (Stërvitja dhe detajet e punës e hapin me to). Fol = avatari me zë (docs/zeri-ne-app.md); në web vetëm Shkruaj.

type Opsioni = { id: string; titulli: string; kompania: string; qyteti: string; eRuajtur: boolean };

const GJATESITE_RENDI: Gjatesia[] = ["shkurter", "plote"];
type Menyra = "shkruaj" | "fol";
const MENYRAT: Menyra[] = ["shkruaj", "fol"];
const EMRAT_E_MENYRAVE: Record<Menyra, string> = { shkruaj: "Shkruaj", fol: "Fol" };
const SA_TE_REJA = 8;

/** Të ruajturat (⭐) të parat, pastaj punët më të reja; puna nga parametri del e para edhe nëse s'është te lista. */
async function lexoOpsionet(punaNgaParametri: string | undefined): Promise<Opsioni[]> {
  const [teRuajturat, teRejat] = await Promise.all([listoTeRuajturatMePune(), listoPunet()]);
  const lista: Opsioni[] = teRuajturat.map((p) => ({
    id: p.puna_id,
    titulli: p.titulli,
    kompania: p.kompania,
    qyteti: p.qyteti,
    eRuajtur: true,
  }));
  const teNjohura = new Set(lista.map((o) => o.id));
  for (const p of teRejat) {
    if (lista.length >= teRuajturat.length + SA_TE_REJA) break;
    if (teNjohura.has(p.id)) continue;
    lista.push({ id: p.id, titulli: p.titulli, kompania: p.kompania, qyteti: p.qyteti, eRuajtur: false });
    teNjohura.add(p.id);
  }
  if (punaNgaParametri && !teNjohura.has(punaNgaParametri)) {
    const p = await gjePunen(punaNgaParametri);
    if (p) lista.unshift({ id: p.id, titulli: p.titulli, kompania: p.kompania, qyteti: p.qyteti, eRuajtur: false });
  }
  return lista;
}

export default function ZgjidhIntervisten() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const { profili } = useSesioni();
  const { stili: stiliIButonit, dridhu } = useDridhja();
  const params = useLocalSearchParams<{ puna?: string; gjuha?: string }>();

  const [opsionet, setOpsionet] = useState<Opsioni[] | null>(null);
  const [gabimiListes, setGabimiListes] = useState<string | null>(null);
  const [punaId, setPunaId] = useState<string | null>(params.puna ?? null);
  const [gjuha, setGjuha] = useState<Gjuha>(
    eshteGjuhe(params.gjuha) ? params.gjuha : eshteGjuhe(profili?.gjuha) ? profili.gjuha : "sq",
  );
  const [gjatesia, setGjatesia] = useState<Gjatesia>("shkurter");
  // Shkruaj si parazgjedhje: Fol varet nga zëri në server (Groq + Gemini) dhe nga leja e mikrofonit.
  const [menyra, setMenyra] = useState<Menyra>("shkruaj");
  const { intervistuesi, zgjidh: zgjidhIntervistuesin } = useIntervistuesiIZgjedhur();
  const emriIntervistuesit = PAMJA_E_INTERVISTUESIT[intervistuesi].emri;
  const [duke_nisur, setDukeNisur] = useState(false);
  const [gabimi, setGabimi] = useState<string | null>(null);

  const [rilexo, setRilexo] = useState(0);
  // Interneti u kthye pas një leximi të dështuar: lista e punëve rilexohet vetë.
  const { kaInternet } = useRrjeti(() => {
    if (gabimiListes) {
      setGabimiListes(null);
      setRilexo((n) => n + 1);
    }
  });
  useEffect(() => {
    let aktiv = true;
    meKohe(lexoOpsionet(params.puna), KOHA_E_LEXIMIT)
      .then((lista) => {
        if (!aktiv) return;
        setGabimiListes(null);
        setOpsionet(lista);
      })
      .catch((e: unknown) => {
        if (aktiv) setGabimiListes(e instanceof Error ? e.message : "Punët s'u lexuan. Provo përsëri.");
      });
    return () => {
      aktiv = false;
    };
  }, [params.puna, rilexo]);

  const puna = opsionet?.find((o) => o.id === punaId) ?? null;

  async function nis() {
    if (!puna) {
      prekja.gabim();
      dridhu();
      setGabimi("Zgjidh një punë për intervistën.");
      return;
    }
    if (!kaInternet) {
      // Zgjedhjet (puna, gjuha, intervistuesi) mbeten: "Fillo" provohet kur të lidhesh.
      prekja.gabim();
      dridhu();
      setGabimi(tekstiIPlote(paInternet("zgjedhjet e tua mbeten aty", false)));
      return;
    }
    setGabimi(null);
    setDukeNisur(true);
    try {
      const n = await nisIntervisten({ punaId: puna.id, gjuha, gjatesia, intervistuesi });
      if (n.rifilluar) njofto("Vazhdon intervistën që kishe nisur", "info");
      router.replace({ pathname: "/intervista/[id]", params: { id: n.intervista.id, menyra } });
    } catch (e) {
      prekja.gabim();
      dridhu();
      setGabimi(e instanceof Error ? e.message : "Intervista s'u nis. Provo përsëri.");
      setDukeNisur(false);
    }
  }

  const listaEPuneve =
    opsionet === null ? (
      gabimiListes ? (
        <KartaEGabimit
          titulli={pamjaEGabimit(gabimiListes, "Punët s'u lexuan", "s'kemi ende punë për t'i shfaqur").titulli}
          mesazhi={pamjaEGabimit(gabimiListes, "Punët s'u lexuan", "s'kemi ende punë për t'i shfaqur").teksti}
          riprovo={() => {
            setGabimiListes(null);
            setRilexo((n) => n + 1);
          }}
        />
      ) : (
        <Karta style={styles.listaKarta}>
          <Pulsi>
            <View style={styles.skeleti} accessibilityLabel="Po ngarkohen punët">
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletiRresht}>
                  <Vije gjeresia="70%" lartesia={15} />
                  <Vije gjeresia="45%" lartesia={12} />
                </View>
              ))}
            </View>
          </Pulsi>
        </Karta>
      )
    ) : opsionet.length === 0 ? (
      <Karta style={styles.bosh}>
        <T pesha="trashe" madhesia={15.5}>
          S&apos;ka ende punë
        </T>
        <T zbehur madhesia={14}>
          Ruaj me ⭐ një punë te &quot;Punët&quot; dhe kthehu këtu për ta praktikuar intervistën për të.
        </T>
      </Karta>
    ) : (
      <Karta style={styles.listaKarta}>
        {opsionet.map((o, i) => {
          const zgjedhur = o.id === punaId;
          return (
            <Prekshme
              key={o.id}
              shkalla={1}
              accessibilityRole="radio"
              accessibilityState={{ checked: zgjedhur }}
              accessibilityLabel={`${o.titulli}, ${o.kompania}, ${o.qyteti}${o.eRuajtur ? ", e ruajtur" : ""}`}
              onPress={() => {
                prekja.zgjedhje();
                setGabimi(null);
                setPunaId(o.id);
              }}
              style={[
                styles.rreshti,
                i < opsionet.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.vija },
                zgjedhur && { backgroundColor: t.karta2 },
              ]}
            >
              <View
                style={[
                  styles.rrethi,
                  { borderColor: zgjedhur ? t.teksti : t.vija, backgroundColor: zgjedhur ? t.teksti : "transparent" },
                ]}
              >
                {zgjedhur && <Ikona emri={IKONAT.check} madhesia={12} ngjyra={t.sfondi} />}
              </View>
              <View style={styles.flex}>
                <T pesha="gjysme" madhesia={15} numberOfLines={2}>
                  {o.titulli}
                </T>
                <T zbehur madhesia={13}>
                  {o.kompania} · {o.qyteti}
                </T>
              </View>
              {o.eRuajtur && <Chip teksti="⭐ E ruajtur" />}
            </Prekshme>
          );
        })}
      </Karta>
    );

  return (
    <Faqja>
      {opsionet !== null && <ShiritiPaInternet teksti={paInternet("po t'i shfaqim punët që i pe herën e fundit").cfare} />}
      <T zbehur madhesia={14.5} style={styles.hyrja}>
        {emriIntervistuesit}, {PAMJA_E_INTERVISTUESIT[intervistuesi].roli}, të bën pyetje për punën që zgjedh, me CV-në
        tënde si bazë. Ti përgjigjesh {menyra === "fol" ? "me zë" : "me shkrim"}.
      </T>

      <T pesha="trashe" madhesia={17} style={styles.seksioni}>
        Për cilën punë?
      </T>
      {listaEPuneve}

      <T pesha="trashe" madhesia={17} style={styles.seksioni}>
        Kush të interviston
      </T>
      <ZgjidhIntervistuesin vlera={intervistuesi} onZgjidh={zgjidhIntervistuesin} />

      <T pesha="trashe" madhesia={17} style={styles.seksioni}>
        Si përgjigjesh
      </T>
      {mbeshtetetZeri ? (
        <>
          <SegmentedControl
            values={MENYRAT.map((m) => EMRAT_E_MENYRAVE[m])}
            selectedIndex={MENYRAT.indexOf(menyra)}
            onChange={(e) => {
              const m = MENYRAT[e.nativeEvent.selectedSegmentIndex];
              if (m) {
                prekja.zgjedhje();
                setMenyra(m);
              }
            }}
            appearance={t.errët ? "dark" : "light"}
            accessibilityLabel="Si përgjigjesh: me shkrim ose me zë"
          />
          <T zbehur madhesia={12.5}>
            {menyra === "fol"
              ? `${emriIntervistuesit} flet dhe ti përgjigjesh me zë. Mikrofoni hapet vetëm kur e prek; zëri kthehet në tekst dhe s'ruhet. Mund të kalosh te Shkruaj në çdo çast.`
              : "Pyetjet dhe përgjigjet me shkrim, si në chat. Mund të kalosh te Fol gjatë intervistës."}
          </T>
        </>
      ) : (
        <T zbehur madhesia={13}>Në shfletues intervista është me shkrim. Me zë dhe avatar, hape në telefon.</T>
      )}

      <T pesha="trashe" madhesia={17} style={styles.seksioni}>
        Gjuha
      </T>
      <SegmentedControl
        values={GJUHET.map((g) => EMRAT_E_GJUHEVE[g])}
        selectedIndex={GJUHET.indexOf(gjuha)}
        onChange={(e) => {
          const g = GJUHET[e.nativeEvent.selectedSegmentIndex];
          if (g) {
            prekja.zgjedhje();
            setGjuha(g);
          }
        }}
        appearance={t.errët ? "dark" : "light"}
        accessibilityLabel="Gjuha e intervistës"
      />

      <T pesha="trashe" madhesia={17} style={styles.seksioni}>
        Sa e gjatë?
      </T>
      <SegmentedControl
        values={GJATESITE_RENDI.map((g) => `${GJATESITE[g].emri} · ${GJATESITE[g].min}–${GJATESITE[g].max}`)}
        selectedIndex={GJATESITE_RENDI.indexOf(gjatesia)}
        onChange={(e) => {
          const g = GJATESITE_RENDI[e.nativeEvent.selectedSegmentIndex];
          if (g) {
            prekja.zgjedhje();
            setGjatesia(g);
          }
        }}
        appearance={t.errët ? "dark" : "light"}
        accessibilityLabel="Gjatësia e intervistës"
      />
      <T zbehur madhesia={12.5}>
        Numri tregon pyetjet kryesore. Kur një përgjigje është e shkurtër, {emriIntervistuesit} mund të bëjë një pyetje vazhduese.
      </T>

      <Karta style={styles.info}>
        <Ikona emri={IKONAT.info} madhesia={16} ngjyra={t.zbehur} />
        <T zbehur madhesia={13} style={styles.flex}>
          Deri në 3 intervista të reja në ditë dhe 30 minuta zë. Mund të dalësh e ta vazhdosh më vonë, me shkrim ose
          me zë.
        </T>
      </Karta>

      {gabimi && (
        <T madhesia={14} ngjyra={t.keq} accessibilityRole="alert" style={styles.gabimi}>
          {gabimi}
        </T>
      )}
      <Animated.View style={stiliIButonit}>
        <Butoni
          teksti={duke_nisur ? "Po niset…" : "Nis intervistën"}
          duke_punuar={duke_nisur}
          joaktiv={opsionet === null}
          pershkrimi={
            puna
              ? `Intervistë ${menyra === "fol" ? "me zë" : "me shkrim"} për ${puna.titulli} në ${EMRAT_E_GJUHEVE[gjuha]}, me ${emriIntervistuesit}`
              : "Zgjidh më parë një punë"
          }
          onPress={nis}
          style={styles.butoni}
        />
      </Animated.View>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hyrja: { lineHeight: 20 },
  seksioni: { marginTop: 10 },
  listaKarta: { padding: 0, overflow: "hidden" },
  rreshti: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, minHeight: 56 },
  rrethi: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  skeleti: { padding: 16, gap: 18 },
  skeletiRresht: { gap: 8 },
  bosh: { gap: 6 },
  info: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 6 },
  gabimi: { textAlign: "center" },
  butoni: { marginTop: 6 },
});
