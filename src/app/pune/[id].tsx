import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";

import KerkesatEPunes from "@/components/KerkesatEPunes";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { Pulsi, Vije } from "@/components/Skeleti";
import { Chip, Faqja, IKONAT, Ikona, Karta, Rruga, T } from "@/components/ui";
import { prekja } from "@/lib/prekja";
import { EMRI_I_PORTALIT, gjePunen, type Puna } from "@/lib/punet";
import { hiqeNgaTeRuajturat, listoTeRuajturat, ruajPunen } from "@/lib/ruajtura";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

// Ikonat e veprimeve (vetëm në këtë ekran): SF Symbols në iPhone, Material Symbols në Android.
const IKONA_NDAJE = { ios: "square.and.arrow.up", android: "share" };
const IKONA_SHFLETUESI = { ios: "safari", android: "open_in_browser" };
const IKONA_YLLI_BOSH = { ios: "star", android: "star" };

/** "2026-11-27" → "27.11.2026" dhe sa ditë mbeten (0 = sot, negativ = kaloi). */
function afatiIPunes(afati: string): { data: string; diteMbeten: number } {
  const [v, m, d] = afati.split("-").map(Number);
  const sot = new Date();
  const fillimiISotit = new Date(sot.getFullYear(), sot.getMonth(), sot.getDate()).getTime();
  const diteMbeten = Math.round((new Date(v, m - 1, d).getTime() - fillimiISotit) / 86_400_000);
  return { data: `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${v}`, diteMbeten };
}

/** Chip-i i afatit: "Edhe 5 ditë · 27.11", i kuq kur kaloi. `pershkrimi` është për lexuesit e ekranit (data e plotë). */
function etiketaEAfatit(puna: Puna): { teksti: string; kaloi: boolean; pershkrimi: string } | null {
  if (!puna.aktive) {
    return { teksti: "S'është më aktive", kaloi: true, pershkrimi: "Kjo shpallje s'është më aktive te portali" };
  }
  if (!puna.afati) return null;
  const { data, diteMbeten } = afatiIPunes(puna.afati);
  const shkurt = data.slice(0, 5);
  if (diteMbeten < 0) return { teksti: `Afati kaloi · ${shkurt}`, kaloi: true, pershkrimi: `Afati kaloi më ${data}` };
  if (diteMbeten === 0) return { teksti: "Afati: sot", kaloi: false, pershkrimi: `Afati i aplikimit është sot, ${data}` };
  const ditet = diteMbeten === 1 ? "1 ditë" : `${diteMbeten} ditë`;
  return { teksti: `Edhe ${ditet} · ${shkurt}`, kaloi: false, pershkrimi: `Afati i aplikimit ${data}, edhe ${ditet}` };
}

// Detajet e punës (bordi, ekrani 11).
export default function DetajetEPunes() {
  const t = useTema();
  const njofto = useNjoftim();
  const { profili } = useSesioni();
  // RLS-i (ruajtura_shto) lejon ⭐ vetëm për kërkuesin; punëdhënësi s'e sheh butonin.
  const mundRuan = profili?.lloji === "kerkues";
  const router = useRouter();
  // Lista dërgon vetëm id-në në adresë (/pune/p3); këtu e lexojmë dhe e kërkojmë në Supabase.
  const { id } = useLocalSearchParams<{ id: string }>();
  const [puna, setPuna] = useState<Puna | null | undefined>(undefined); // undefined = duke ngarkuar
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [eRuajtur, setERuajtur] = useState(false);
  const [dukeRuajtur, setDukeRuajtur] = useState(false);

  const lexo = useCallback(() => {
    Promise.all([gjePunen(id), mundRuan ? listoTeRuajturat() : Promise.resolve(new Set<string>())])
      .then(([p, yjet]) => {
        setGabimi(null);
        setPuna(p);
        setERuajtur(yjet.has(id));
      })
      .catch((e) => setGabimi(e instanceof Error ? e.message : "Gabim i panjohur"));
  }, [id, mundRuan]);

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
  const afati = etiketaEAfatit(puna);
  const linku = puna.linku;
  const emriIPortalit = puna.portali ? EMRI_I_PORTALIT[puna.portali] : null;
  const orari = puna.kerkesat?.orari ?? null;
  // Shpalljet e portaleve: "Apliko te KosovaJob". Shpalljet e shtuara me link nga përdoruesi: "Hape shpalljen".
  const butoniKryesor = emriIPortalit ? `Apliko te ${emriIPortalit}` : "Hape shpalljen";

  // ⭐ ndryshon menjëherë; nëse serveri refuzon, kthehet si ishte dhe del njoftimi (si te lista).
  async function ndryshoRuajtjen() {
    if (dukeRuajtur) return;
    const ruaje = !eRuajtur;
    setDukeRuajtur(true);
    setERuajtur(ruaje);
    try {
      if (ruaje) {
        await ruajPunen(id);
        prekja.sukses();
      } else {
        await hiqeNgaTeRuajturat(id);
        prekja.zgjedhje();
      }
    } catch (e) {
      setERuajtur(!ruaje);
      prekja.gabim();
      njofto(e instanceof Error ? e.message : "S'u ruajt.", "gabim");
    } finally {
      setDukeRuajtur(false);
    }
  }

  async function ndaje(p: Puna) {
    const rreshti = `${p.titulli} · ${p.kompania}, ${p.qyteti}`;
    try {
      const rezultati = await Share.share(
        p.linku
          ? { title: p.titulli, message: `${rreshti}\n${p.linku}`, url: p.linku }
          : { title: p.titulli, message: rreshti },
      );
      if (rezultati.action === Share.sharedAction) prekja.sukses();
    } catch {
      prekja.gabim();
      njofto("S'u nda puna. Provo përsëri.", "gabim");
    }
  }

  async function hapeNeShfletues(url: string) {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      prekja.gabim();
      njofto("S'u hap shpallja. Provo përsëri.", "gabim");
    }
  }

  return (
    <Faqja>
      <Stack.Screen options={{ title: puna.kompania }} />

      <View style={styles.rresht}>
        <Chip teksti={roli} />
        {orari && <Chip teksti={orari} />}
        {afati && (
          <View accessible accessibilityLabel={afati.pershkrimi} style={[styles.etiketa, { backgroundColor: t.karta2 }]}>
            <T pesha="gjysme" madhesia={12} ngjyra={afati.kaloi ? t.keq : t.teksti}>
              {afati.teksti}
            </T>
          </View>
        )}
        {puna.burimi === "perdoruesi" && <Chip teksti="Shtuar nga një përdorues" />}
        {emriIPortalit && <Chip teksti={emriIPortalit} />}
      </View>
      <T pesha="trashe" madhesia={26} style={styles.titulli} accessibilityRole="header">
        {puna.titulli}
      </T>
      <T zbehur madhesia={15}>
        {puna.kompania} · {puna.qyteti}
      </T>

      {/* Veprimet (AGENTS.md, Native feel #7): çdo veprim i menysë me shtypje të gjatë është edhe buton këtu. */}
      <View style={styles.veprimet}>
        {linku && (
          <Prekshme
            accessibilityRole="link"
            accessibilityLabel={butoniKryesor}
            accessibilityHint="Hapet shpallja origjinale në shfletuesin brenda app-it"
            onPress={() => hapeNeShfletues(linku)}
            style={[styles.butoni, { backgroundColor: t.teksti }]}
          >
            <Ikona emri={IKONA_SHFLETUESI} madhesia={18} ngjyra={t.sfondi} />
            <T pesha="trashe" madhesia={16} ngjyra={t.sfondi}>
              {butoniKryesor}
            </T>
          </Prekshme>
        )}

        {/* "A jam gati?" (WP3): AI-ja e krahason CV-në e fundit me këtë shpallje. Rruga është vetëm për kërkuesin. */}
        {mundRuan && (
          <Prekshme
            accessibilityRole="button"
            accessibilityHint="AI-ja e krahason CV-në tënde me këtë shpallje"
            onPress={() => router.push({ pathname: "/gati/[id]", params: { id: puna.id } })}
            style={[styles.butoni, { backgroundColor: t.teksti }]}
          >
            <T pesha="trashe" madhesia={16} ngjyra={t.sfondi}>
              A jam gati për këtë?
            </T>
          </Prekshme>
        )}

        <View style={styles.dyshja}>
          {mundRuan && (
            <Prekshme
              accessibilityRole="button"
              accessibilityLabel={eRuajtur ? "E ruajtur. Hiqe nga të ruajturat" : "Ruaje punën"}
              accessibilityState={{ selected: eRuajtur, busy: dukeRuajtur }}
              onPress={ndryshoRuajtjen}
              style={[styles.veprimi, { backgroundColor: eRuajtur ? t.teksti : t.karta, shadowColor: t.hija }]}
            >
              <Ikona emri={eRuajtur ? IKONAT.ylli : IKONA_YLLI_BOSH} madhesia={16} ngjyra={eRuajtur ? t.sfondi : t.teksti} />
              <T pesha="trashe" madhesia={14.5} ngjyra={eRuajtur ? t.sfondi : t.teksti}>
                {eRuajtur ? "E ruajtur" : "Ruaje"}
              </T>
            </Prekshme>
          )}
          <Prekshme
            accessibilityRole="button"
            accessibilityLabel="Ndaje punën"
            onPress={() => ndaje(puna)}
            style={[styles.veprimi, { backgroundColor: t.karta, shadowColor: t.hija }]}
          >
            <Ikona emri={IKONA_NDAJE} madhesia={16} />
            <T pesha="trashe" madhesia={14.5}>
              Ndaje
            </T>
          </Prekshme>
        </View>
      </View>

      <KerkesatEPunes puna={puna} emriIPortalit={emriIPortalit} />

      {/* Ku je në rrugë: vetëm për kërkuesin (punëdhënësi s'ka CV). */}
      {mundRuan && (
        <Karta style={styles.rrugaKarta}>
          <T pesha="trashe" madhesia={14}>
            Tani: CV
          </T>
          <T zbehur madhesia={13}>
            Ngarko CV-në për të parë sa je gati për këtë punë
          </T>
          <Rruga hapi={0} />
        </Karta>
      )}
    </Faqja>
  );
}

const styles = StyleSheet.create({
  qendra: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  qendroj: { textAlign: "center" },
  skeleti: { gap: 12 },
  kartaSkelet: { borderRadius: 22, padding: 16, gap: 10, marginTop: 4 },
  rresht: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  etiketa: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  titulli: { letterSpacing: -0.5, lineHeight: 31 },
  veprimet: { gap: 10, marginTop: 8 },
  dyshja: { flexDirection: "row", gap: 10 },
  veprimi: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
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
    paddingHorizontal: 20,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  rrugaKarta: { marginTop: 18 },
  butoniVogel: { marginTop: 8, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, minHeight: 44, justifyContent: "center" },
});
