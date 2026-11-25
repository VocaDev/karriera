// Banka e pyetjeve për praktikën pa internet: të dhëna të shkruara me dorë, pa asnjë thirrje rrjeti.
// Çdo rol ka të njëjtat 20 id në çdo gjuhë; kështu "E di" / "Përsërite" mbeten kur ndërron gjuhën.

export type RoliPraktikes = "swe" | "zyre";
export type GjuhaPraktikes = "sq" | "en" | "de";

export const ROLET_E_PRAKTIKES: readonly RoliPraktikes[] = ["swe", "zyre"];
export const GJUHET_E_PRAKTIKES: readonly GjuhaPraktikes[] = ["sq", "en", "de"];

/** Një pyetje intervistë. Të katër fushat janë në gjuhën e bankës (jo domosdoshmërisht shqip). */
export type PyetjaPraktikes = {
  /** Njësoj në të gjitha gjuhët e një roli (p.sh. "swe-bug"). */
  id: string;
  pyetja: string;
  /** Çka do të dëgjojë intervistuesi (1–2 rreshta). */
  degjon: string;
  /** Hinti i shkurtër (STAR ose struktura e përgjigjes). */
  hinti: string;
  /** Gabimi më i zakonshëm. */
  gabimi: string;
};
