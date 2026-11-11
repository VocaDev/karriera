// Sulmojmë aplikacionin tonë (J6, standardi i ekselencës): vetëm me URL-në dhe çelësin publishable,
// pikërisht ato që janë brenda app-it. Çdo rregull i RLS-it provohet si "pa hyrë" dhe "me llogarinë tjetër".
//
// Nisja (nga rrënja e projektit, me .env lokal):
//   node --env-file=.env scripts/test-rls.mjs
// Krijon llogari testi rls-<koha>-...@karriera-test.com (Confirm email duhet të jetë i fikur).
// Pastrimi pas testit, në SQL Editor:
//   delete from auth.users where email like 'rls-%@karriera-test.com';
import { createClient } from "@supabase/supabase-js";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CELESI = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !CELESI) throw new Error("Mungojnë EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY (nis me --env-file=.env)");

const koha = Date.now();
const FJALEKALIMI = `Test-${koha}-rls!`;
let kaluan = 0;
let deshtuan = 0;

function rezultati(emri, ok, detaj = "") {
  if (ok) kaluan++;
  else deshtuan++;
  console.log(`${ok ? "✅" : "❌"} ${emri}${detaj ? `  (${detaj})` : ""}`);
}

const klienti = () => createClient(URL, CELESI, { auth: { persistSession: false, autoRefreshToken: false } });

async function llogari(emri, lloji) {
  const k = klienti();
  const email = `rls-${koha}-${emri}@karriera-test.com`;
  const { data, error } = await k.auth.signUp({
    email,
    password: FJALEKALIMI,
    options: { data: { emri, lloji, organizata: lloji === "punedhenes" ? "Test SH.P.K." : "" } },
  });
  if (error || !data.session) throw new Error(`S'u krijua ${emri}: ${error?.message ?? "pa sesion (Confirm email ndezur?)"}`);
  return { k, id: data.user.id, email };
}

// ---------- Pa hyrë (anon) ----------
const anon = klienti();
{
  const { data, error } = await anon.from("punet").select("id");
  rezultati("Pa hyrë: s'lexon punët", !!error || (data ?? []).length === 0, error?.message ?? `${data?.length} rreshta`);
}
{
  const { error } = await anon.from("punet").insert({ titulli: "Sulm anon", kompania: "X", qyteti: "Y" });
  rezultati("Pa hyrë: s'shton punë", !!error, error?.message);
}
{
  const { data, error } = await anon.from("profiles").select("id");
  rezultati("Pa hyrë: s'lexon profilet", !!error || (data ?? []).length === 0, error?.message);
}

// ---------- Llogaritë ----------
const k1 = await llogari("kerkues1", "kerkues");
const k2 = await llogari("kerkues2", "kerkues");
const p1 = await llogari("punedhenes1", "punedhenes");
const p2 = await llogari("punedhenes2", "punedhenes");
const qVete = await llogari("qendervete", "qender"); // provon ta zgjedhë vetë "qender"

// ---------- Profilet ----------
{
  const { data } = await k1.k.from("profiles").select("id, lloji");
  rezultati("Kërkuesi sheh vetëm profilin e vet", data?.length === 1 && data[0].id === k1.id && data[0].lloji === "kerkues");
}
{
  const { data } = await p1.k.from("profiles").select("lloji").single();
  rezultati("Punëdhënësi merr llojin 'punedhenes'", data?.lloji === "punedhenes");
}
{
  const { data } = await qVete.k.from("profiles").select("lloji").single();
  rezultati("'qender' s'zgjidhet dot gjatë regjistrimit (bëhet kerkues)", data?.lloji === "kerkues", data?.lloji);
}
{
  const { error } = await k1.k.from("profiles").update({ lloji: "punedhenes" }).eq("id", k1.id);
  rezultati("Askush s'e ndryshon llojin e vet", !!error, error?.message);
}
{
  const { data, error } = await k1.k.from("profiles").update({ emri: "Emri i ri" }).eq("id", k1.id).select("emri");
  rezultati("Emrin e vet po e ndryshon", !error && data?.[0]?.emri === "Emri i ri", error?.message);
}
{
  // Pa .eq(): RLS duhet të lejojë vetëm rreshtin tim.
  const { data } = await k2.k.from("profiles").update({ emri: "Sulm" }).neq("id", k2.id).select("id");
  rezultati("Profilin e tjetrit s'e ndryshon", (data ?? []).length === 0);
}
{
  // Gabimi klasik: roli në user_metadata. Ne s'e lexojmë kurrë pas regjistrimit.
  await k1.k.auth.updateUser({ data: { lloji: "qender" } });
  const { data } = await k1.k.from("profiles").select("lloji").single();
  const { error } = await k1.k.rpc("numrat_e_qendres");
  rezultati("Ndryshimi i user_metadata s'jep të drejta", data?.lloji === "kerkues" && !!error, error?.message);
}

// ---------- Punët ----------
{
  const { data } = await k1.k.from("punet").select("id");
  rezultati("Me llogari: lexon punët", (data ?? []).length > 0, `${data?.length} punë`);
}
{
  const { error } = await k1.k.from("punet").insert({ titulli: "Sulm kerkues", kompania: "X Y", qyteti: "Pejë" });
  rezultati("Kërkuesi s'poston punë", !!error, error?.message);
}
let punaP1 = null;
{
  const { data, error } = await p1.k
    .from("punet")
    .insert({ titulli: "Test RLS punëdhënësi", kompania: "Test SH.P.K.", qyteti: "Mitrovicë" })
    .select("id, pronari_id")
    .single();
  punaP1 = data?.id ?? null;
  rezultati("Punëdhënësi poston; serveri vendos pronari_id", !error && data?.pronari_id === p1.id, error?.message);
}
{
  // Pa filtër në kod: RLS-i vendos çka kthehet.
  const { data } = await p2.k.from("punet").select("id, pronari_id");
  const lista = data ?? [];
  rezultati(
    "Punëdhënësi 2 s'i sheh punët e punëdhënësit 1",
    !lista.some((p) => p.id === punaP1) && lista.every((p) => p.pronari_id === p2.id),
    `${lista.length} punë`,
  );
}
{
  const { data } = await p1.k.from("punet").select("id, pronari_id");
  const lista = data ?? [];
  rezultati(
    "Punëdhënësi sheh vetëm punët e veta (pa filtër në kod)",
    lista.length > 0 && lista.every((p) => p.pronari_id === p1.id),
    `${lista.length} punë`,
  );
}
{
  const { data } = await k1.k.from("punet").select("id");
  rezultati("Kërkuesi e sheh punën e punëdhënësit", (data ?? []).some((p) => p.id === punaP1));
}
{
  const { error } = await p1.k
    .from("punet")
    .insert({ titulli: "Në emër të tjetrit", kompania: "X Y", qyteti: "Pejë", pronari_id: p2.id });
  rezultati("S'poston dot në emër të tjetrit", !!error, error?.message);
}
{
  const { error } = await p1.k
    .from("punet")
    .insert({ titulli: "Punë zyrtare e rreme", kompania: "X Y", qyteti: "Pejë", burimi: "seed" });
  rezultati("S'poston dot si 'seed'", !!error, error?.message);
}
{
  const { data } = await p2.k.from("punet").update({ titulli: "Sulm p2" }).eq("id", punaP1).select("id");
  rezultati("Punëdhënësi 2 s'e ndryshon punën e 1", (data ?? []).length === 0);
}
{
  const { data } = await p2.k.from("punet").delete().eq("id", punaP1).select("id");
  rezultati("Punëdhënësi 2 s'e fshin punën e 1", (data ?? []).length === 0);
}
{
  const { data } = await p1.k.from("punet").update({ titulli: "Sulm te seed" }).eq("id", "p1").select("id");
  rezultati("Shpalljet 'seed' s'i ndryshon askush", (data ?? []).length === 0);
}
{
  const { error } = await p1.k.from("punet").update({ pronari_id: p2.id }).eq("id", punaP1);
  rezultati("pronari_id s'ndryshohet nga app-i", !!error, error?.message);
}
{
  const { data, error } = await p1.k.from("punet").update({ titulli: "Test RLS (ndryshuar)" }).eq("id", punaP1).select("titulli");
  rezultati("Punëdhënësi e ndryshon punën e vet", !error && data?.[0]?.titulli === "Test RLS (ndryshuar)", error?.message);
}

// ---------- ⭐ Të ruajturat ----------
{
  const { error } = await k1.k.from("punet_e_ruajtura").insert({ puna_id: "p1" });
  rezultati("Kërkuesi 1 ruan një punë", !error, error?.message);
}
{
  const { data } = await k2.k.from("punet_e_ruajtura").select("puna_id");
  rezultati("Kërkuesi 2 s'i sheh të ruajturat e 1", (data ?? []).length === 0);
}
{
  const { data } = await k1.k.from("punet_e_ruajtura").select("puna_id, pronari_id");
  rezultati("Kërkuesi 1 i sheh të vetat (pa filtër në kod)", data?.length === 1 && data[0].pronari_id === k1.id);
}
{
  const { error } = await k2.k.from("punet_e_ruajtura").insert({ puna_id: "p2", pronari_id: k1.id });
  rezultati("S'ruan dot në emër të tjetrit", !!error, error?.message);
}
{
  const { data } = await k2.k.from("punet_e_ruajtura").delete().eq("puna_id", "p1").select("puna_id");
  rezultati("Kërkuesi 2 s'ia fshin yllin kërkuesit 1", (data ?? []).length === 0);
}
{
  const { error } = await p1.k.from("punet_e_ruajtura").insert({ puna_id: "p1" });
  rezultati("Punëdhënësi s'ka ⭐", !!error, error?.message);
}

// ---------- Qendra ----------
{
  const { error } = await p1.k.rpc("numrat_e_qendres");
  rezultati("Punëdhënësi s'i sheh numrat e qendrës", !!error, error?.message);
}
{
  const { error } = await anon.rpc("numrat_e_qendres");
  rezultati("Pa hyrë: s'i sheh numrat e qendrës", !!error, error?.message);
}

// ---------- Realtime: puna e re i shkon kërkuesit, jo atij pa llogari ----------
{
  const prit = (ms) => new Promise((r) => setTimeout(r, ms));
  const lidhu = (k, emri, teMarra) =>
    new Promise((gati) => {
      k.channel(emri)
        // Pa leje, serveri dërgon vetëm një njoftim "401 Unauthorized" pa të dhëna: numërojmë vetëm punët e marra.
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "punet" }, (e) => {
          if (e.new?.id) teMarra.push(e.new.id);
        })
        .subscribe((s) => s === "SUBSCRIBED" && gati());
    });
  const teKerkuesit = [];
  const teAnonit = [];
  const tePunedhenesit1 = [];
  await Promise.all([
    lidhu(k2.k, "rt-kerkues", teKerkuesit),
    lidhu(anon, "rt-anon", teAnonit),
    lidhu(p1.k, "rt-punedhenes1", tePunedhenesit1),
  ]);
  await prit(4000); // serveri e aktivizon abonimin pak sekonda pas "SUBSCRIBED"
  const { data } = await p2.k
    .from("punet")
    .insert({ titulli: "Test Realtime", kompania: "Test SH.P.K.", qyteti: "Prishtinë" })
    .select("id")
    .single();
  await prit(4000);
  rezultati("Realtime: kërkuesi e merr punën e re menjëherë", !!data && teKerkuesit.includes(data.id), `${teKerkuesit.length} ngjarje`);
  rezultati("Realtime: pa hyrë s'merr asgjë", teAnonit.length === 0, `${teAnonit.length} punë`);
  rezultati(
    "Realtime: punëdhënësi 1 s'e merr punën e punëdhënësit 2",
    tePunedhenesit1.length === 0,
    `${tePunedhenesit1.length} punë`,
  );
  if (data) await p2.k.from("punet").delete().eq("id", data.id);
  await k2.k.removeAllChannels();
  await anon.removeAllChannels();
  await p1.k.removeAllChannels();
}

// Pastrim i asaj që lejohet nga app-i (llogaritë fshihen nga SQL Editor-i).
if (punaP1) await p1.k.from("punet").delete().eq("id", punaP1);
await k1.k.from("punet_e_ruajtura").delete().eq("puna_id", "p1");

console.log(`\n${kaluan} kaluan, ${deshtuan} dështuan.`);
console.log(`Llogaritë e testit: rls-${koha}-*@karriera-test.com (id e qendrës për provë: ${qVete.id})`);
process.exit(deshtuan ? 1 : 0);
