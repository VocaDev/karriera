// Sulmojmë "Kandidatët" e punëdhënësit (migrimi 20261125100000_kandidatet_anonim.sql), në stilin e test-rls.mjs:
// vetëm me URL-në dhe çelësin publishable, pikërisht ato që janë brenda app-it.
//
// Nisja (nga rrënja e projektit, me .env lokal), PASI të jetë aplikuar migrimi:
//   node --env-file=.env scripts/test-kandidatet.mjs
// Fjalëkalimi i llogarive të testit krijohet rastësisht në çdo nisje dhe s'shkruhet askund.
// Krijon llogari kand-<koha>-...@karriera-test.com (Confirm email duhet të jetë i fikur).
//
// Rruga pozitive (punëdhënësi SHEH kandidatin e dukshëm) kërkon rreshta te gatishmeria, që i shkruan vetëm serveri.
// Nëse në .env (JO në app, pa EXPO_PUBLIC_) ka SUPABASE_SECRET_KEY ose SUPABASE_SERVICE_ROLE_KEY, skripti i fut ato
// rreshta me atë çelës; përndryshe këto prova kapërcehen dhe rruga pozitive provohet me testin SQL në fund të migrimit.
//
// Pastrimi pas testit, në SQL Editor:
//   delete from auth.users where email like 'kand-%@karriera-test.com';
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CELESI = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SEKRETI = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
if (!URL || !CELESI) throw new Error("Mungojnë EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY (nis me --env-file=.env)");

const koha = Date.now();
// I ri në çdo nisje, mjaft i gjatë dhe me të gjitha llojet e shenjave; s'printohet.
const FJALEKALIMI = `${randomBytes(24).toString("base64url")}aA1!`;
let kaluan = 0;
let deshtuan = 0;
let kapercyen = 0;

function rezultati(emri, ok, detaj = "") {
  if (ok) kaluan++;
  else deshtuan++;
  console.log(`${ok ? "✅" : "❌"} ${emri}${detaj ? `  (${detaj})` : ""}`);
}

function kaperce(emri, pse) {
  kapercyen++;
  console.log(`⏭  ${emri}  (${pse})`);
}

const klienti = (celesi = CELESI) => createClient(URL, celesi, { auth: { persistSession: false, autoRefreshToken: false } });

async function llogari(emri, lloji) {
  const k = klienti();
  const email = `kand-${koha}-${emri}@karriera-test.com`;
  const { data, error } = await k.auth.signUp({
    email,
    password: FJALEKALIMI,
    options: { data: { emri: `Emri ${emri}`, lloji, organizata: lloji === "punedhenes" ? "Test SH.P.K." : "" } },
  });
  if (error || !data.session) throw new Error(`S'u krijua ${emri}: ${error?.message ?? "pa sesion (Confirm email ndezur?)"}`);
  return { k, id: data.user.id, email };
}

// Kolonat e vetme që lejohen të dalin te punëdhënësi.
const KOLONAT_E_LEJUARA = [
  "burimi",
  "etiketa",
  "intervista_nota",
  "intervista_nr",
  "ke",
  "kodi",
  "llogaritur_me",
  "mungon",
  "perqindja",
  "puna_id",
].join(",");

// ---------- Pa hyrë (anon) ----------
const anon = klienti();
{
  const { error } = await anon.rpc("kandidatet_anonim");
  rezultati("Pa hyrë: s'i sheh kandidatët", !!error, error?.message);
}
{
  const { error } = await anon.rpc("numrat_e_pozitave");
  rezultati("Pa hyrë: s'i sheh numrat e pozitave", !!error, error?.message);
}
{
  const { error } = await anon.rpc("vendos_dukshmerine", { p_anonim: true });
  rezultati("Pa hyrë: s'ndez dukshmërinë", !!error, error?.message);
}
{
  const { data, error } = await anon.from("dukshmeria").select("user_id");
  rezultati("Pa hyrë: s'lexon pëlqimet", !!error || (data ?? []).length === 0, error?.message);
}

// ---------- Llogaritë ----------
const k1 = await llogari("kerkues1", "kerkues"); // do ta ndezë pëlqimin
const k2 = await llogari("kerkues2", "kerkues"); // s'e ndez kurrë
const p1 = await llogari("punedhenes1", "punedhenes");
const p2 = await llogari("punedhenes2", "punedhenes");

// ---------- Pëlqimi i kërkuesit ----------
{
  const { data, error } = await k1.k.from("dukshmeria").select("anonim");
  rezultati("Parazgjedhja: i padukshëm (pa rresht)", !error && (data ?? []).length === 0, error?.message);
}
{
  const { data, error } = await k1.k.rpc("vendos_dukshmerine", { p_anonim: true });
  rezultati("Kërkuesi e ndez pëlqimin për veten", !error && data === true, error?.message);
}
{
  const { data } = await k1.k.from("dukshmeria").select("user_id, anonim");
  rezultati("Kërkuesi e sheh pëlqimin e vet", data?.length === 1 && data[0].user_id === k1.id && data[0].anonim === true);
}
{
  const { data } = await k2.k.from("dukshmeria").select("user_id");
  rezultati("Kërkuesi 2 s'e sheh pëlqimin e kërkuesit 1", (data ?? []).length === 0);
}
{
  const { error } = await k2.k.from("dukshmeria").insert({ user_id: k1.id, anonim: false });
  rezultati("S'shkruan drejtpërdrejt në tabelë (as në emër të tjetrit)", !!error, error?.message);
}
{
  const { data } = await k2.k.from("dukshmeria").update({ anonim: false }).eq("user_id", k1.id).select("user_id");
  rezultati("S'ia fik pëlqimin tjetrit", (data ?? []).length === 0);
}
{
  const { error } = await p1.k.rpc("vendos_dukshmerine", { p_anonim: true });
  rezultati("Punëdhënësi s'ka pëlqim për të ndezur", !!error, error?.message);
}
{
  const { data } = await p1.k.from("dukshmeria").select("user_id");
  rezultati("Punëdhënësi s'i lexon pëlqimet e kërkuesve", (data ?? []).length === 0);
}

// ---------- Funksionet e punëdhënësit ----------
{
  const { error } = await k1.k.rpc("kandidatet_anonim");
  rezultati("Kërkuesi s'i sheh kandidatët", !!error, error?.message);
}
{
  const { error } = await k1.k.rpc("numrat_e_pozitave");
  rezultati("Kërkuesi s'i sheh numrat e pozitave", !!error, error?.message);
}
let punaP1 = null;
{
  const { data, error } = await p1.k
    .from("punet")
    .insert({ titulli: "Test Kandidatët", kompania: "Test SH.P.K.", qyteti: "Mitrovicë", roli: "SWE" })
    .select("id")
    .single();
  punaP1 = data?.id ?? null;
  rezultati("Punëdhënësi 1 poston një punë", !error && !!punaP1, error?.message);
}
{
  const { data, error } = await p1.k.rpc("numrat_e_pozitave");
  const rreshti = (data ?? []).find((r) => r.puna_id === punaP1);
  rezultati("Punëdhënësi 1 i sheh numrat e punës së vet", !error && !!rreshti, error?.message);
}
{
  const { data, error } = await p2.k.rpc("numrat_e_pozitave");
  rezultati("Punëdhënësi 2 s'i sheh numrat e punës së 1", !error && !(data ?? []).some((r) => r.puna_id === punaP1), error?.message);
}
{
  const { data, error } = await p2.k.rpc("kandidatet_anonim", { p_puna_id: punaP1 });
  rezultati("Punëdhënësi 2 s'merr kandidatë për punën e 1", !error && (data ?? []).length === 0, error?.message);
}
{
  const { data } = await p1.k.from("gatishmeria").select("id");
  rezultati("Punëdhënësi s'e lexon gatishmërinë drejtpërdrejt", (data ?? []).length === 0);
}
{
  const { data } = await p1.k.from("intervistat").select("id");
  rezultati("Punëdhënësi s'i lexon intervistat drejtpërdrejt", (data ?? []).length === 0);
}
{
  const { data } = await p1.k.from("profiles").select("id");
  rezultati("Punëdhënësi sheh vetëm profilin e vet", data?.length === 1 && data[0].id === p1.id);
}

// ---------- Rruga pozitive (kërkon çelësin sekret për të futur gatishmërinë) ----------
if (!SEKRETI) {
  kaperce("Punëdhënësi sheh kandidatin e dukshëm, anonim", "s'ka SUPABASE_SECRET_KEY: përdor testin SQL te migrimi");
  kaperce("Kandidati pa pëlqim s'shfaqet", "po ashtu");
  kaperce("Nën 60% s'shfaqet", "po ashtu");
  kaperce("Pas fikjes së pëlqimit zhduket", "po ashtu");
} else if (punaP1) {
  const admin = klienti(SEKRETI);
  const rresht = (user_id, perqindja) => ({
    user_id,
    puna_id: punaP1,
    burimi: "cv",
    perqindja,
    ke: [{ aftesia: "React Native", deshmia: `Dëshmi sekrete e ${user_id}` }],
    mungon: [{ aftesia: "Testimi", pse: "x", si: "y" }],
    arsyeja: `Arsye me emrin Emri ${user_id}`,
    modeli: "test",
  });
  const k3 = await llogari("kerkues3", "kerkues"); // i dukshëm, por 40%
  await k3.k.rpc("vendos_dukshmerine", { p_anonim: true });
  const { error: gabimiFutjes } = await admin.from("gatishmeria").insert([rresht(k1.id, 82), rresht(k2.id, 95), rresht(k3.id, 40)]);
  if (gabimiFutjes) throw new Error(`S'u fut gatishmëria e testit: ${gabimiFutjes.message}`);

  const { data, error } = await p1.k.rpc("kandidatet_anonim", { p_puna_id: punaP1 });
  const lista = data ?? [];
  rezultati("Punëdhënësi sheh vetëm kandidatin e dukshëm ≥ 60%", !error && lista.length === 1 && lista[0]?.perqindja === 82, error?.message ?? `${lista.length} rreshta`);
  const r = lista[0] ?? {};
  rezultati("Rreshti ka vetëm kolonat anonime", Object.keys(r).sort().join(",") === KOLONAT_E_LEJUARA, Object.keys(r).join(","));
  rezultati("Etiketa është anonime (Kandidati #X00)", /^Kandidati #[A-Z]\d{2}$/.test(r.etiketa ?? ""), r.etiketa);
  const teksti = JSON.stringify(r);
  rezultati(
    "S'del asnjë id, email, emër, dëshmi apo arsye",
    !teksti.includes(k1.id) && !teksti.includes(k1.email) && !/Emri |sekret|Arsye/i.test(teksti),
  );
  rezultati("Vetëm emrat e aftësive", JSON.stringify(r.ke) === '["React Native"]' && JSON.stringify(r.mungon) === '["Testimi"]');

  await k1.k.rpc("vendos_dukshmerine", { p_anonim: false });
  const { data: pas } = await p1.k.rpc("kandidatet_anonim", { p_puna_id: punaP1 });
  rezultati("Pas fikjes së pëlqimit, kandidati zhduket", (pas ?? []).length === 0);
}

// Pastrim i asaj që lejohet nga app-i (llogaritë dhe gatishmëria fshihen me to nga SQL Editor-i / cascade).
if (punaP1) await p1.k.from("punet").delete().eq("id", punaP1);

console.log(`\n${kaluan} kaluan, ${deshtuan} dështuan${kapercyen ? `, ${kapercyen} u kapërcyen` : ""}.`);
console.log(`Llogaritë e testit: kand-${koha}-*@karriera-test.com`);
process.exit(deshtuan ? 1 : 0);
