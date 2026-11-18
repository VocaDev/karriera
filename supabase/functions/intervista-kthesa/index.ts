// intervista-kthesa: merr përgjigjen e kandidatit, e vlerëson dhe kthen pyetjen tjetër (ose fundin).
//
// Hyrja:  POST { "intervista_id": "<uuid>", "nr": 3, "pergjigja": "..." }
//         ose  { "intervista_id": "<uuid>", "nr": 3, "perfundo": true }   (kandidati e mbyll vetë; duhet ≥ 1 përgjigje)
// Dalja:  { "fund": false, "kthesa": { nr, lloji, reagimi, pyetja, shprehja }, "nr_pyetjeve", "min", "max" }
//         ose { "fund": true, "reagimi": string | null, "nr_pyetjeve" }
// Gabimet 409 kanë "kodi": "jashte_radhe" (app-i rilexon gjendjen), "po_perpunohet" (dërgim i dyfishtë)
// ose "mbaroi" (intervista s'është më aktive: app-i hap rezultatet).
//
// Logjika e kthesës jeton te _shared/intervista-kthesa.ts: e njëjta për përgjigjet me zë (intervista-zeri).
import { ETIKETA_E_THIRRESIT, gabim, UUID } from "../_shared/intervista-ai.ts";
import { perpunoKthesen } from "../_shared/intervista-kthesa.ts";
import { CORS_HEADERS, json, kontrolloThirresin } from "../_shared/thirresi.ts";

type Objekt = Record<string, unknown>;
const eshteObjekt = (v: unknown): v is Objekt => typeof v === "object" && v !== null && !Array.isArray(v);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return gabim("Metoda nuk lejohet.", 405);

  const t = await kontrolloThirresin(req, ETIKETA_E_THIRRESIT, Number.POSITIVE_INFINITY);
  if (t instanceof Response) return t;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return gabim("Kërkesa nuk është e vlefshme.", 400);
  }
  const b = eshteObjekt(body) ? body : {};
  const intervistaId = b.intervista_id;
  if (typeof intervistaId !== "string" || !UUID.test(intervistaId)) return gabim("Mungon intervista.", 400);
  if (typeof b.nr !== "number" || !Number.isInteger(b.nr) || b.nr < 1) return gabim("Mungon numri i pyetjes.", 400);

  const r = await perpunoKthesen(t, {
    intervistaId,
    nr: b.nr,
    perfundo: b.perfundo === true,
    pergjigja: typeof b.pergjigja === "string" ? b.pergjigja : "",
  });
  return json(r.trupi, r.status);
});
