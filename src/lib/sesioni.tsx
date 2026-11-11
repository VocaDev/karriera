// Sesioni dhe profili për gjithë app-in. _layout.tsx i përdor për rojet (Stack.Protected):
// kush s'ka hyrë sheh vetëm hyrjen, secili lloj llogarie sheh vetëm ekranet e veta.
// Roja vetëm fsheh ekranet; të dhënat i mbron RLS-i në server.
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { merrProfilin, type Profili } from "@/lib/hyrja";
import { supabase } from "@/lib/supabase";

type GjendjaESesionit = {
  sesioni: Session | null;
  profili: Profili | null;
  /** true derisa të dihet a ka sesion dhe, nëse ka, cili është profili. */
  duke_ngarkuar: boolean;
  /** Gabimi i leximit të profilit (p.sh. pa internet). */
  gabimiIProfilit: string | null;
  rifreskoProfilin: () => void;
};

const Konteksti = createContext<GjendjaESesionit | null>(null);

type ProfiliILexuar = { uid: string; profili: Profili | null; gabimi: string | null };

export function SesioniProvider({ children }: { children: ReactNode }) {
  const [sesioni, setSesioni] = useState<Session | null>(null);
  const [sesioniULexua, setSesioniULexua] = useState(false);
  const [lexuar, setLexuar] = useState<ProfiliILexuar | null>(null);
  const [rilexo, setRilexo] = useState(0);

  // Sesioni ruhet në telefon (AsyncStorage): pas rihapjes së app-it je ende brenda, edhe pa internet.
  useEffect(() => {
    let aktiv = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!aktiv) return;
      setSesioni(data.session);
      setSesioniULexua(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_ngjarja, sesioniIRi) => {
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
    merrProfilin()
      .then((profili) => {
        if (aktiv) setLexuar({ uid, profili, gabimi: profili ? null : "Profili s'u gjet." });
      })
      .catch((e: unknown) => {
        if (aktiv) setLexuar({ uid, profili: null, gabimi: e instanceof Error ? e.message : "Gabim i panjohur" });
      });
    return () => {
      aktiv = false;
    };
  }, [uid, rilexo]);

  const iKesajLlogarie = uid && lexuar?.uid === uid ? lexuar : null;
  const vlera: GjendjaESesionit = {
    sesioni,
    profili: iKesajLlogarie?.profili ?? null,
    duke_ngarkuar: !sesioniULexua || (uid !== null && iKesajLlogarie === null),
    gabimiIProfilit: iKesajLlogarie?.gabimi ?? null,
    rifreskoProfilin: () => {
      setLexuar(null);
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
