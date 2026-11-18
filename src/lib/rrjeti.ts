// Rrjeti i vërtetë (J7: gjendjet e rrjetit, offline). Një hook, një njohës gabimesh, një ruajtës kohe.
// Asgjë këtu s'është e rreme: gjendja vjen nga sistemi (expo-network) dhe nga gabimet e vërteta të thirrjeve.
import { FunctionsFetchError, FunctionsRelayError } from "@supabase/supabase-js";
import { useNetworkState } from "expo-network";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { eshtePaInternet } from "@/lib/hyrja-offline";

// Debounce: një humbje e shkurtër e sinjalit (ashensor, ndërrimi Wi-Fi ↔ 4G) s'duhet të ndezë shiritin;
// kthimi i internetit pranohet më shpejt, që ekrani të rifreskohet pa vonesë.
const PRITJA_PA_INTERNET = 900;
const PRITJA_ME_INTERNET = 300;
// Sa zgjat "sapuKthye" pasi kthehet interneti: koha që ekranet e përdorin për të rifreskuar të dhënat.
const KOHA_E_KTHIMIT = 2500;

type Rrjeti = { kaInternet: boolean; sapuKthye: boolean };

/**
 * `kaInternet`: false vetëm kur sistemi thotë qartë "pa lidhje" (ose "pa internet") dhe kjo zgjat disa çaste.
 * Ndërsa gjendja është e panjohur (nisja e app-it), supozohet se ka internet: asnjë shirit i rremë.
 * `sapuKthye`: true për pak sekonda pasi interneti u kthye pas një kohe pa të.
 * `kurKthehet` (opsionale): thirret një herë në çastin që interneti kthehet; aty ekrani rifreskon të dhënat.
 */
export function useRrjeti(kurKthehet?: () => void): Rrjeti {
  const gjendja = useNetworkState();
  const paInternet = gjendja.isConnected === false || gjendja.isInternetReachable === false;
  const [rrjeti, setRrjeti] = useState<Rrjeti>({ kaInternet: true, sapuKthye: false });
  const eraPaInternet = useRef(false);
  const kthehet = useEffectEvent(() => kurKthehet?.());

  useEffect(() => {
    const ora = setTimeout(
      () => {
        if (paInternet) {
          eraPaInternet.current = true;
          setRrjeti((p) => (p.kaInternet ? { kaInternet: false, sapuKthye: false } : p));
          return;
        }
        const kthyer = eraPaInternet.current;
        eraPaInternet.current = false;
        setRrjeti((p) => (p.kaInternet ? p : { kaInternet: true, sapuKthye: true }));
        if (kthyer) kthehet();
      },
      paInternet ? PRITJA_PA_INTERNET : PRITJA_ME_INTERNET,
    );
    return () => clearTimeout(ora);
  }, [paInternet]);

  useEffect(() => {
    if (!rrjeti.sapuKthye) return;
    const ora = setTimeout(() => setRrjeti((p) => ({ ...p, sapuKthye: false })), KOHA_E_KTHIMIT);
    return () => clearTimeout(ora);
  }, [rrjeti.sapuKthye]);

  return rrjeti;
}

/**
 * A është ky gabim një gabim rrjeti (pa internet, serveri s'u arrit)? Njeh gabimet e Supabase, gabimet e Edge
 * Function-eve dhe mesazhet në shqip që lib/*.ts i ndërtojnë nga ato (p.sh. "Pa internet. Kontrollo lidhjen…").
 */
export function eshteGabimRrjeti(gabimi: unknown): boolean {
  if (gabimi instanceof FunctionsFetchError || gabimi instanceof FunctionsRelayError) return true;
  if (typeof gabimi === "string") return gabimi.toLowerCase().includes("pa internet");
  if (typeof gabimi !== "object" || gabimi === null) return false;
  const g = gabimi as { name?: string; code?: string; status?: number; message?: string };
  return eshtePaInternet(g) || (g.message ?? "").toLowerCase().includes("pa internet");
}

export const MESAZHI_PA_INTERNET = "Pa internet. Kontrollo lidhjen dhe provo përsëri.";

/**
 * Ruajtësi i kohës: një thirrje që varet (lidhje që "ka" por s'çon askund) bëhet gabim rrjeti pas `ms`,
 * kështu ekrani s'mbetet kurrë me një rrotë pa fund. Thirrja origjinale s'ndalet (supabase-js s'merr
 * anulim këtu); rezultati i saj i vonuar injorohet.
 */
export function meKohe<T>(premtimi: Promise<T>, ms: number, gabimi: () => Error = () => new Error(MESAZHI_PA_INTERNET)): Promise<T> {
  return new Promise<T>((zgjidhur, refuzuar) => {
    const ora = setTimeout(() => refuzuar(gabimi()), ms);
    premtimi.then(
      (v) => {
        clearTimeout(ora);
        zgjidhur(v);
      },
      (e: unknown) => {
        clearTimeout(ora);
        refuzuar(e);
      },
    );
  });
}

/** Kohët e ruajtësit: leximet janë të shkurtra, AI-ja zgjat 10–40 s (me kufi të gjerë). */
export const KOHA_E_LEXIMIT = 15_000;
export const KOHA_E_NGARKIMIT = 60_000;
export const KOHA_E_AI = 90_000;
