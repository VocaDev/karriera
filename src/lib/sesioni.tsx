// Sesioni dhe profili për gjithë app-in. _layout.tsx i përdor për rojet (Stack.Protected):
// kush s'ka hyrë është mysafir (sheh punët dhe praktikën, src/lib/mysafiri.ts), secili lloj llogarie sheh vetëm ekranet e veta.
// Roja vetëm fsheh ekranet; të dhënat i mbron RLS-i në server.
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { merrProfilin, pastroTeDhenatELokale, type Gjuha, type Profili, type RoliSynuar } from "@/lib/hyrja";
import { VONON } from "@/lib/mesazhet";
import { lexoProfilinERuajtur, lexoSesioninERuajtur, ruajProfilin } from "@/lib/profili-kesh";
import { eshteGabimKohe, eshteGabimRrjeti, KOHA_E_SESIONIT, meKohe, useRrjeti } from "@/lib/rrjeti";
import { pasNdryshimitTeSesionit } from "@/lib/sesioni-skaduar";
import { supabase } from "@/lib/supabase";

type GjendjaESesionit = {
  sesioni: Session | null;
  /** S'ka sesion (dhe kjo dihet, jo "po lexohet"): app-i hapet si mysafir. */
  mysafir: boolean;
  /**
   * Profili që app-i mund ta përdorë. Një kërkues që s'e ka zgjedhur ende rolin (roli_synuar = null) NUK është këtu:
   * për rojet te _layout.tsx ai është "pa profil të gatshëm" dhe mbetet te ekrani i hyrjes, që i shfaq onboarding-un
   * (zgjedhja e rolit dhe e gjuhës). Sapo e ruan zgjedhjen, profili shfaqet dhe rojet e çojnë te tab-at.
   */
  profili: Profili | null;
  /** Profili i kërkuesit që pret ende onboarding-un (roli pa zgjedhur); përndryshe null. */
  profiliPaRol: Profili | null;
  /** Roli i synuar dhe gjuha e intervistës të profilit të gatshëm (null / "sq" kur s'ka profil). */
  roli_synuar: RoliSynuar | null;
  gjuha: Gjuha;
  /** true derisa të dihet a ka sesion dhe, nëse ka, cili është profili. */
  duke_ngarkuar: boolean;
  /** Gabimi i leximit të profilit (p.sh. pa internet). */
  gabimiIProfilit: string | null;
  /**
   * Pa argument: e lexon sërish profilin nga serveri (në heshtje: ekranet nuk zhduken derisa të vijë përgjigja).
   * Me profilin e ri (p.sh. nga ndryshoProfilin): e vendos menjëherë, pa rrugë shtesë te rrjeti.
   */
  rifreskoProfilin: (profili?: Profili) => void;
};

const Konteksti = createContext<GjendjaESesionit | null>(null);

// Hapja e app-it s'pret më shumë se kaq për profilin: pastaj përdoret ai i ruajtur në telefon (ose del gabimi me "Provo përsëri").
const KOHA_E_PROFILIT = 8_000;

type ProfiliILexuar = { uid: string; profili: Profili | null; gabimi: string | null };

export function SesioniProvider({ children }: { children: ReactNode }) {
  const [sesioni, setSesioni] = useState<Session | null>(null);
  const [sesioniULexua, setSesioniULexua] = useState(false);
  const [lexuar, setLexuar] = useState<ProfiliILexuar | null>(null);
  const [rilexo, setRilexo] = useState(0);
  // Leximi i fundit i profilit dështoi pse s'ka internet / s'u përgjigj: kur kthehet interneti, rilexohet në heshtje.
  const duhetRilexuar = useRef(false);
  // Sesioni erdhi nga ajo që është ruajtur në telefon (getSession s'u përgjigj): identitet pa internet, jo i rifreskuar.
  const sesioniPaInternet = useRef(false);
  useRrjeti(() => {
    if (duhetRilexuar.current) setRilexo((n) => n + 1);
  });

  // Sesioni ruhet në telefon (AsyncStorage): pas rihapjes së app-it je ende brenda, edhe pa internet.
  useEffect(() => {
    let aktiv = true;
    meKohe(supabase.auth.getSession(), KOHA_E_SESIONIT, VONON.profili)
      .then(({ data }) => {
        if (!aktiv) return;
        setSesioni(data.session);
        setSesioniULexua(true);
      })
      .catch(async () => {
        // Varet (pa internet, token i skaduar): sesioni i ruajtur në telefon. Pa të: hyrja, pa pritje shtesë.
        const iRuajtur = await lexoSesioninERuajtur();
        if (!aktiv) return;
        sesioniPaInternet.current = iRuajtur !== null;
        setSesioni(iRuajtur);
        setSesioniULexua(true);
      });
    const { data } = supabase.auth.onAuthStateChange((ngjarja, sesioniIRi) => {
      // Pas ~30 s auth-js njofton INITIAL_SESSION bosh (s'rifreskoi dot pa internet): kjo s'është dalje, mbetemi brenda.
      if (!sesioniIRi && ngjarja === "INITIAL_SESSION" && sesioniPaInternet.current) return;
      sesioniPaInternet.current = false; // një ngjarje e vërtetë (rifreskim, hyrje, dalje) e zëvendëson identitetin e ruajtur
      pasNdryshimitTeSesionit(ngjarja); // dalje që s'e bëmë ne = sesioni mbaroi: hyrja tregon "Hyr përsëri"
      // Çdo dalje (edhe e detyruar nga 401, që s'kalon nga dil()): të dhënat e ruajtura të llogarisë fshihen.
      if (ngjarja === "SIGNED_OUT") void pastroTeDhenatELokale();
      setSesioni(sesioniIRi);
      setSesioniULexua(true);
    });
    return () => {
      aktiv = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Profili lexohet sa herë ndryshon llogaria (hyrje, dalje, llogari tjetër).
  const uid = sesioni?.user.id ?? null;
  useEffect(() => {
    if (!uid) return;
    let aktiv = true;
    // Me identitet të ruajtur (pa internet) s'presim 8 s për një lexim që s'do të vijë: 3 s dhe profili i ruajtur.
    meKohe(merrProfilin(), sesioniPaInternet.current ? 3_000 : KOHA_E_PROFILIT, VONON.profili)
      .then((profili) => {
        duhetRilexuar.current = false;
        if (profili && aktiv) ruajProfilin(profili);
        if (aktiv) setLexuar({ uid, profili, gabimi: profili ? null : "Profili s'u gjet." });
      })
      .catch(async (e: unknown) => {
        const nga = eshteGabimRrjeti(e) || eshteGabimKohe(e);
        duhetRilexuar.current = nga;
        // Pa internet ose pa përgjigje në kohë: profili i ruajtur i kësaj llogarie, që përdoruesi të hyjë në app.
        const iRuajtur = nga ? await lexoProfilinERuajtur(uid) : null;
        if (!aktiv) return;
        // Një rilexim që dështon nuk e heq profilin që e kemi: përdoruesi mbetet ku është.
        setLexuar((l) =>
          l?.uid === uid && l.profili
            ? l
            : iRuajtur
              ? { uid, profili: iRuajtur, gabimi: null }
              : {
                  uid,
                  profili: null,
                  // Asnjë tekst teknik te përdoruesi: mesazhi i pa internet / vonesës, ose fjalia e përgjithshme.
                  gabimi: nga && e instanceof Error ? e.message : "Diçka shkoi keq. Provo përsëri.",
                },
        );
      });
    return () => {
      aktiv = false;
    };
  }, [uid, rilexo]);

  const iKesajLlogarie = uid && lexuar?.uid === uid ? lexuar : null;
  const iLexuari = iKesajLlogarie?.profili ?? null;
  const paRol = iLexuari?.lloji === "kerkues" && iLexuari.roli_synuar === null;
  const vlera: GjendjaESesionit = {
    sesioni,
    mysafir: sesioniULexua && !sesioni,
    profili: paRol ? null : iLexuari,
    profiliPaRol: paRol ? iLexuari : null,
    roli_synuar: iLexuari?.roli_synuar ?? null,
    gjuha: iLexuari?.gjuha ?? "sq",
    duke_ngarkuar: !sesioniULexua || (uid !== null && iKesajLlogarie === null),
    gabimiIProfilit: iKesajLlogarie?.gabimi ?? null,
    rifreskoProfilin: (profiliIRi) => {
      if (profiliIRi && uid && profiliIRi.id === uid) {
        setLexuar({ uid, profili: profiliIRi, gabimi: null });
        return;
      }
      // Rilexim në heshtje: profili i vjetër mbetet derisa të vijë i riu, që rojet te _layout të mos të nxjerrin
      // ekranin e hapur. Vetëm pas një gabimi (s'ka profil) kthehemi te gjendja "po ngarkohet".
      setLexuar((l) => (l?.profili ? l : null));
      setRilexo((n) => n + 1);
    },
  };

  return <Konteksti.Provider value={vlera}>{children}</Konteksti.Provider>;
}

export function useSesioni(): GjendjaESesionit {
  const k = useContext(Konteksti);
  if (!k) throw new Error("useSesioni duhet të jetë brenda SesioniProvider");
  return k;
}
