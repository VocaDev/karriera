// Banka e pyetjeve sipas rolit dhe gjuhës. Gjithçka është e paketuar në app: s'ka rrjet, s'ka ngarkim.
import { SWE_DE } from "./swe.de";
import { SWE_EN } from "./swe.en";
import { SWE_SQ } from "./swe.sq";
import type { GjuhaPraktikes, PyetjaPraktikes, RoliPraktikes } from "./tipet";
import { ZYRE_DE } from "./zyre.de";
import { ZYRE_EN } from "./zyre.en";
import { ZYRE_SQ } from "./zyre.sq";

export * from "./tipet";

const BANKA: Record<RoliPraktikes, Record<GjuhaPraktikes, readonly PyetjaPraktikes[]>> = {
  swe: { sq: SWE_SQ, en: SWE_EN, de: SWE_DE },
  zyre: { sq: ZYRE_SQ, en: ZYRE_EN, de: ZYRE_DE },
};

export function pyetjetPer(roli: RoliPraktikes, gjuha: GjuhaPraktikes): readonly PyetjaPraktikes[] {
  return BANKA[roli][gjuha];
}

/** Id-të e një roli (njësoj në çdo gjuhë), për të numëruar progresin pa varësi nga gjuha. */
export function idtePer(roli: RoliPraktikes): readonly string[] {
  return BANKA[roli].sq.map((p) => p.id);
}

export const EMRAT_E_ROLEVE_PRAKTIKES: Record<RoliPraktikes, { titulli: string; pershkrimi: string }> = {
  swe: { titulli: "Zhvillues/e softueri", pershkrimi: "Frontend, backend, mobile" },
  zyre: { titulli: "Asistent/e ose PR", pershkrimi: "Zyrë, administratë, klientë" },
};

export const EMRAT_E_GJUHEVE_PRAKTIKES: Record<GjuhaPraktikes, string> = { sq: "Shqip", en: "English", de: "Deutsch" };
