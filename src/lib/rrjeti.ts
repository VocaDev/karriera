// Rrjeti i vërtetë (J7: gjendjet e rrjetit, offline). Një hook, një njohës gabimesh, një ruajtës kohe.
// Asgjë këtu s'është e rreme: gjendja vjen nga sistemi (expo-network) dhe nga gabimet e vërteta të thirrjeve.
import { FunctionsFetchError, FunctionsRelayError } from "@supabase/supabase-js";
import { useNetworkState } from "expo-network";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { eshtePaInternet } from "@/lib/hyrja-offline";
import { eshteTekstVonese, FILLIMI_PA_INTERNET, paInternet, tekstiIPlote, VONON } from "@/lib/mesazhet";

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
 * A është ky gabim një gabim rrjeti (pa internet)? Njeh gabimet e Supabase, gabimet e Edge Function-eve dhe
 * mesazhet në shqip që lib/*.ts i ndërtojnë nga ato (shih `FILLIMI_PA_INTERNET` te mesazhet.ts).
 * `FunctionsRelayError` është problem i shërbimit, jo i telefonit: llogaritet "pa internet" vetëm kur sistemi
 * thotë se s'ka lidhje (`kaInternet` false); përndryshe ekrani tregon mesazhin e vonesës.
 */
export function eshteGabimRrjeti(gabimi: unknown, kaInternet = true): boolean {
  if (gabimi instanceof FunctionsFetchError) return true;
  if (gabimi instanceof FunctionsRelayError) return !kaInternet;
  if (typeof gabimi === "string") return gabimi.startsWith(FILLIMI_PA_INTERNET);
  if (typeof gabimi !== "object" || gabimi === null) return false;
  const g = gabimi as { name?: string; code?: string; status?: number; message?: string };
  return eshtePaInternet(g) || (g.message ?? "").startsWith(FILLIMI_PA_INTERNET);
}

/** Ruajtësi i kohës mbaroi (ose shërbimi s'u përgjigj): mesazhi është fjalia e plotë nga `VONON`. */
export class GabimKohe extends Error {
  constructor(mesazhi: string) {
    super(mesazhi);
    this.name = "GabimKohe";
  }
}

/** A është ky gabim "po vonon më shumë se zakonisht" (ruajtësi i kohës ose një përgjigje që s'erdhi në kohë)? */
export function eshteGabimKohe(gabimi: unknown): boolean {
  if (gabimi instanceof GabimKohe || gabimi instanceof FunctionsRelayError) return true;
  if (typeof gabimi === "string") return eshteTekstVonese(gabimi);
  return typeof gabimi === "object" && gabimi !== null && eshteTekstVonese((gabimi as { message?: string }).message ?? "");
}

/**
 * Titulli dhe teksti për një lexim që dështoi, sipas shkakut: pa internet, po vonon, ose gabimi i zakonshëm.
 * `mbetet`: çka ka ekrani tani ("po t'i shfaqim punët që i pe herën e fundit" ose "s'kemi ende punë…").
 * `vetvetiu`/`kush`: si te `paInternet` (ekrani rifreskohet vetë kur kthehet interneti).
 */
export function pamjaEGabimit(
  gabimi: unknown,
  titulliIZakonshem: string,
  mbetet: string,
  vetvetiu = true,
  kush = "lista",
): { titulli: string; teksti: string } {
  const mesazhi = typeof gabimi === "string" ? gabimi : gabimi instanceof Error ? gabimi.message : "Gabim i panjohur";
  if (eshteGabimRrjeti(gabimi)) {
    const m = paInternet(mbetet, vetvetiu, kush);
    return { titulli: m.titulli, teksti: tekstiIPlote(m) };
  }
  if (eshteGabimKohe(gabimi)) return { titulli: VONON.titulli, teksti: `${mesazhi} ${VONON.bere}` };
  return { titulli: titulliIZakonshem, teksti: mesazhi };
}

/**
 * Ruajtësi i kohës: një thirrje që varet (lidhje që "ka" por s'çon askund) bëhet gabim pas `ms`, kështu ekrani
 * s'mbetet kurrë me një rrotë pa fund. `fjalia`: çka nuk mbaroi (një nga `VONON`), ose një funksion që e
 * ndërton gabimin vetë. Thirrja origjinale s'ndalet (supabase-js s'merr anulim këtu); rezultati i saj i vonuar injorohet.
 */
export function meKohe<T>(premtimi: Promise<T>, ms: number, fjalia: string | (() => Error) = VONON.leximi): Promise<T> {
  const gabimi = typeof fjalia === "string" ? () => new GabimKohe(fjalia) : fjalia;
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
