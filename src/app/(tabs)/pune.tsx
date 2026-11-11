
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import KartaPunes from "@/components/KartaPunes";
import { Faqja, Ikona, IKONAT, T, Titulli } from "@/components/ui";
import { listoPunet, type Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

type FiltriRolit = "Të gjitha" | Puna["roli"];

const FILTRAT: FiltriRolit[] = [
  "Të gjitha",
  "SWE",
  "Asistent/PR",
  "Tjetër",
];

function normalizo(teksti: string): string {
  return teksti
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function Punet() {
  const t = useTema();

  const [punet, setPunet] = useState<Puna[]>([]);
  const [duke_ngarkuar, setDukeNgarkuar] = useState(true);
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [kerkimi, setKerkimi] = useState("");
  const [filtri, setFiltri] = useState<FiltriRolit>("Të gjitha");

  const ngarko = useCallback(async () => {
    setGabimi(null);

    try {
      setPunet(await listoPunet());
    } catch (e) {
      setGabimi(e instanceof Error ? e.message : "Gabim i panjohur");
    } finally {
      setDukeNgarkuar(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      ngarko();
    }, [ngarko]),
  );

  const numrat = useMemo(() => {
    return {
      "Të gjitha": punet.length,
      SWE: punet.filter((p) => p.roli === "SWE").length,
      "Asistent/PR": punet.filter((p) => p.roli === "Asistent/PR").length,
      Tjetër: punet.filter((p) => p.roli === "Tjetër").length,
    };
  }, [punet]);

  const punetEFiltuara = useMemo(() => {
    const kerkimiNormal = normalizo(kerkimi);

    return punet.filter((puna) => {
      const perputhetRoli =
        filtri === "Të gjitha" || puna.roli === filtri;

      const fusha =
        `${puna.titulli} ${puna.kompania} ${puna.qyteti}`;

      const perputhetKerkimi =
        kerkimiNormal === "" ||
        normalizo(fusha).includes(kerkimiNormal);

      return perputhetRoli && perputhetKerkimi;
    });
  }, [punet, filtri, kerkimi]);

  const pastroFiltrat = () => {
    setKerkimi("");
    setFiltri("Të gjitha");
  };

  const koka = (
    <View>
      <View style={styles.koka}>
        <Titulli>Punët</Titulli>

        <Link href="/pune/shto" asChild>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Shto një punë"
            style={[
              styles.butoniIkone,
              {
                backgroundColor: t.theksiButë,
              },
            ]}
          >
            <Ikona emri={IKONAT.plus} madhesia={18} ngjyra={t.theksi} />
          </Pressable>
        </Link>
      </View>

      <View style={[styles.kutiaKerkuese, {
        backgroundColor: t.karta,
        borderColor: t.vija,
      }]}>
        <Ikona emri={IKONAT.linku} madhesia={18} ngjyra={t.zbehur} />
        <TextInput
          value={kerkimi}
          onChangeText={setKerkimi}
          placeholder="Kërko punë, kompani ose qytet..."
          placeholderTextColor={t.zbehur}
          style={[styles.input, { color: t.teksti }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Kërko shpallje pune"
        />
        {kerkimi.length > 0 ? (
          <Pressable onPress={() => setKerkimi("")} hitSlop={8}>
            <T ngjyra={t.zbehur}>✕</T>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filtrat}>
        {FILTRAT.map((kategori) => {
          const aktiv = filtri === kategori;

          return (
            <Pressable
              key={kategori}
              onPress={() => setFiltri(kategori)}
              style={[
                styles.chip,
                {
                  backgroundColor: aktiv ? t.teksti : t.karta,
                  borderColor: aktiv ? t.teksti : t.vija,
                },
              ]}
            >
              <T
                madhesia={12}
                pesha="mesme"
                ngjyra={aktiv ? t.sfondi : t.teksti}
              >
                {kategori} · {numrat[kategori]}
              </T>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.rezultatet}>
        <T zbehur madhesia={12}>
          {punetEFiltuara.length} shpallje
        </T>
      </View>
    </View>
  );

  if (duke_ngarkuar) {
    return (
      <Faqja>
        <View style={styles.qendra}>
          <ActivityIndicator size="large" color={t.theksi} />
        </View>
      </Faqja>
    );
  }

  if (gabimi) {
    return (
      <Faqja>
        <View style={styles.qendra}>
          <T>S&apos;u lexuan punët: {gabimi}</T>
          <Pressable onPress={ngarko} accessibilityRole="button">
            <T pesha="trashe" ngjyra={t.theksi}>
              Provo përsëri
            </T>
          </Pressable>
        </View>
      </Faqja>
    );
  }

  return (
    <Faqja pa_scroll>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.lista}
        data={punetEFiltuara}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        refreshing={false}
        onRefresh={ngarko}
        ListHeaderComponent={koka}
        ListEmptyComponent={
          <View style={styles.bosh}>
            {punet.length === 0 ? (
              <T zbehur>Ende s&apos;ka shpallje.</T>
            ) : (
              <>
                <T pesha="trashe">Asnjë punë s&apos;përputhet me filtrin</T>
                <Pressable
                  onPress={pastroFiltrat}
                  style={[styles.pastro, { backgroundColor: t.teksti }]}
                >
                  <T ngjyra={t.sfondi} pesha="trashe">
                    Pastro filtrat
                  </T>
                </Pressable>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Link href={`/pune/${item.id}`} asChild>
            <KartaPunes puna={item} />
          </Link>
        )}
      />
    </Faqja>
  );
}

const styles = StyleSheet.create({
  koka: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  butoniIkone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  lista: {
    padding: 18,
    gap: 10,
    paddingBottom: 120,
  },
  qendra: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  kutiaKerkuese: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  filtrat: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 14,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  rezultatet: {
    marginTop: 15,
    marginBottom: 5,
  },
  bosh: {
    alignItems: "center",
    gap: 15,
    marginTop: 40,
    paddingHorizontal: 15,
  },
  pastro: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
});
