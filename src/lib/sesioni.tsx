// Sesioni dhe profili për gjithë app-in. _layout.tsx i përdor për rojet (Stack.Protected):
// kush s'ka hyrë sheh vetëm hyrjen, secili lloj llogarie sheh vetëm ekranet e veta.
// Roja vetëm fsheh ekranet; të dhënat i mbron RLS-i në server.
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { merrProfilin, type Gjuha, type Profili, type RoliSynuar } from "@/lib/hyrja";
import { VONON } from "@/lib/mesazhet";
import { lexoProfilinERuajtur, ruajProfilin } from "@/lib/profili-kesh";
import { eshteGabimKohe, eshteGabimRrjeti, meKohe, useRrjeti } from "@/lib/rrjeti";
import { pasNdryshimitTeSesionit } from "@/lib/sesioni-skaduar";
import { supabase } from "@/lib/supabase";

type GjendjaESesionit = {
  sesioni: Session | null;
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
  useRrjeti(() => {
    if (duhetRilexuar.current) setRilexo((n) => n + 1);
  });

  // Sesioni ruhet në telefon (AsyncStorage): pas rihapjes së app-it je ende brenda, edhe pa internet.
  useEffect(() => {
    let aktiv = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!aktiv) return;
      setSesioni(data.session);
      setSesioniULexua(true);
    });
    const { data } = supabase.auth.onAuthStateChange((ngjarja, sesioniIRi) => {
      pasNdryshimitTeSesionit(ngjarja); // dalje që s'e bëmë ne = sesioni mbaroi: hyrja tregon "Hyr përsëri"
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
    meKohe(merrProfilin(), KOHA_E_PROFILIT, VONON.profili)
      .then((profili) => {
        duhetRilexuar.current = false;
        if (profili) ruajProfilin(profili);
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
              : { uid, profili: null, gabimi: e instanceof Error ? e.message : "Gabim i panjohur" },
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
