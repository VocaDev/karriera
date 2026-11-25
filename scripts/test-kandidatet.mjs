// Sulmojmë "Kandidatët" e punëdhënësit (migrimi 20261125110000_kandidatet_anonim.sql), në stilin e test-rls.mjs:
// vetëm me URL-në dhe çelësin publishable, pikërisht ato që janë brenda app-it.
//
// Nisja (nga rrënja e projektit, me .env lokal), PASI të jetë aplikuar migrimi:
//   node --env-file=.env scripts/test-kandidatet.mjs
// Fjalëkalimi i llogarive të testit krijohet rastësisht në çdo nisje dhe s'shkruhet askund.
// Krijon llogari kand-<koha>-...@karriera-test.com (Confirm email duhet të jetë i fikur).
//
// Çelësi sekret (opsional, vetëm në .env lokal, JO në app, pa EXPO_PUBLIC_): SUPABASE_SECRET_KEY ose
// SUPABASE_SERVICE_ROLE_KEY. Me të:
//   - rruga pozitive: skripti fut rreshta te gatishmeria (që i shkruan vetëm serveri) dhe provon çka sheh punëdhënësi;
//   - pastrimi në fund (finally): fshin rreshtat gatishmeria + dukshmeria dhe llogaritë e testit.
// Pa të: rruga pozitive kapërcehet (e provon testi SQL te migrimi) dhe skripti printon hapat e pastrimit.
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
const admin = SEKRETI ? klienti(SEKRETI) : null;

/** Çdo llogari e krijuar, për pastrimin në fund. */
const teKrijuarat = [];

async function llogari(emri, lloji) {
  const k = klienti();
  const email = `kand-${koha}-${emri}@karriera-test.com`;
  const { data, error } = await k.auth.signUp({
    email,
    password: FJALEKALIMI,
    options: { data: { emri: `Emri ${emri}`, lloji, organizata: lloji === "punedhenes" ? "Test SH.P.K." : "" } },
  });
  if (data?.user?.id) teKrijuarat.push(data.user.id);
  if (error || !data.session) throw new Error(`S'u krijua ${emri}: ${error?.message ?? "pa sesion (Confirm email ndezur?)"}`);
  return { k, id: data.user.id, email };
}

// Kolonat e vetme që lejohen të dalin te punëdhënësi (pa datë të saktë).
const KOLONAT_E_LEJUARA = [
  "burimi",
  "etiketa",
  "intervista_nota",
  "intervista_nr",
  "ke",
  "kodi",
  "llogaritur_kur",
  "mungon",
  "perqindja",
  "puna_id",
].join(",");

async function testi() {
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
  {
    const { error } = await k1.k.rpc("etiketat_e_aftesive", { p_lista: [] });
    rezultati("Ndihmësi i etiketave s'thirret nga app-i", !!error, error?.message);
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
  const shto = async (titulli) => {
    const { data, error } = await p1.k
      .from("punet")
      .insert({ titulli, kompania: "Test SH.P.K.", qyteti: "Mitrovicë", roli: "SWE" })
      .select("id")
      .single();
    rezultati(`Punëdhënësi 1 poston "${titulli}"`, !error && !!data?.id, error?.message);
    return data?.id ?? null;
  };
  const punaA = await shto("Test Kandidatët A");
  const punaB = await shto("Test Kandidatët B");
  if (!punaA || !punaB) return;

  // k-anonimiteti: 1 ⭐ (nën 5) s'del si numër.
  {
    const { error } = await k1.k.from("punet_e_ruajtura").insert({ puna_id: punaA });
    rezultati("Kërkuesi 1 e ruan punën A me ⭐", !error, error?.message);
  }
  {
    const { data, error } = await p1.k.rpc("numrat_e_pozitave");
    const r = (data ?? []).find((x) => x.puna_id === punaA);
    rezultati("Punëdhënësi 1 i sheh numrat e punës së vet", !error && !!r, error?.message);
    rezultati("1 ⭐ (nën 5) vjen null, jo 1", r?.ruajtur === null, `ruajtur = ${JSON.stringify(r?.ruajtur)}`);
    rezultati("Kontrollet nën 5 vijnë null", r?.kontrolluan === null, `kontrolluan = ${JSON.stringify(r?.kontrolluan)}`);
  }
  {
    const { data, error } = await p2.k.rpc("numrat_e_pozitave");
    rezultati("Punëdhënësi 2 s'i sheh numrat e punës së 1", !error && !(data ?? []).some((r) => r.puna_id === punaA), error?.message);
  }
  {
    const { data, error } = await p2.k.rpc("kandidatet_anonim", { p_puna_id: punaA });
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
  if (!admin) {
    for (const emri of [
      "Punëdhënësi sheh kandidatin e dukshëm, anonim",
      "Kodi ndryshon mes pozitave",
      "Koha vetëm si kovë, aftësitë vetëm etiketa të shkurtra",
      "Pas fikjes së pëlqimit zhduket",
    ]) {
      kaperce(emri, "s'ka SUPABASE_SECRET_KEY: përdor testin SQL te migrimi");
    }
    return;
  }
  const rresht = (user_id, puna_id, perqindja) => ({
    user_id,
    puna_id,
    burimi: "cv",
    perqindja,
    ke: [
      { aftesia: "React Native", deshmia: `Dëshmi sekrete e ${user_id}` },
      { aftesia: 'Punova te "Firma Sekrete" 2019-2023', deshmia: "x" },
      { aftesia: "Kontakt: emri@shembull.com", deshmia: "x" },
    ],
    mungon: [{ aftesia: "Testimi", pse: "x", si: "y" }],
    arsyeja: `Arsye me emrin Emri ${user_id}`,
    modeli: "test",
  });
  const k3 = await llogari("kerkues3", "kerkues"); // i dukshëm, por 40%
  await k3.k.rpc("vendos_dukshmerine", { p_anonim: true });
  const { error: gabimiFutjes } = await admin
    .from("gatishmeria")
    .insert([rresht(k1.id, punaA, 82), rresht(k1.id, punaB, 71), rresht(k2.id, punaA, 95), rresht(k3.id, punaA, 40)]);
  if (gabimiFutjes) throw new Error(`S'u fut gatishmëria e testit: ${gabimiFutjes.message}`);

  const { data, error } = await p1.k.rpc("kandidatet_anonim", { p_puna_id: punaA });
  const lista = data ?? [];
  rezultati(
    "Punëdhënësi sheh vetëm kandidatin e dukshëm ≥ 60%",
    !error && lista.length === 1 && lista[0]?.perqindja === 82,
    error?.message ?? `${lista.length} rreshta`,
  );
  const r = lista[0] ?? {};
  rezultati("Rreshti ka vetëm kolonat anonime (pa datë të saktë)", Object.keys(r).sort().join(",") === KOLONAT_E_LEJUARA, Object.keys(r).join(","));
  rezultati("Etiketa është anonime (Kandidati #X00)", /^Kandidati #[A-Z]\d{2}$/.test(r.etiketa ?? ""), r.etiketa);
  rezultati("Koha vjen si kovë", r.llogaritur_kur === "kete_jave", r.llogaritur_kur);
  const teksti = JSON.stringify(r);
  rezultati(
    "S'del asnjë id, email, emër, dëshmi, arsye apo citat",
    !teksti.includes(k1.id) && !teksti.includes(k1.email) && !/Emri |sekret|Arsye|shembull|2019/i.test(teksti),
  );
  rezultati("Vetëm etiketat e shkurtra të aftësive", JSON.stringify(r.ke) === '["React Native"]' && JSON.stringify(r.mungon) === '["Testimi"]', JSON.stringify(r.ke));

  {
    const { data: teGjitha } = await p1.k.rpc("kandidatet_anonim");
    const teK1 = (teGjitha ?? []).filter((x) => x.perqindja === 82 || x.perqindja === 71);
    rezultati(
      "I njëjti kandidat ka kod tjetër te çdo pozitë",
      teK1.length === 2 && teK1[0].kodi !== teK1[1].kodi,
      teK1.map((x) => x.etiketa).join(" / "),
    );
  }

  await k1.k.rpc("vendos_dukshmerine", { p_anonim: false });
  const { data: pas } = await p1.k.rpc("kandidatet_anonim");
  rezultati("Pas fikjes së pëlqimit, kandidati zhduket", (pas ?? []).length === 0);
}

/** Pastrimi: me çelësin sekret fshin gatishmeria + dukshmeria dhe llogaritë; pa të, tregon hapat (pa vlera). */
async function pastro() {
  if (teKrijuarat.length === 0) return;
  if (!admin) {
    console.log("\nPastrimi s'u bë vetë (mungon çelësi sekret). Në SQL Editor:");
    console.log("  1. delete from public.gatishmeria where user_id in (select id from auth.users where email like 'kand-%@karriera-test.com');");
    console.log("  2. delete from public.dukshmeria  where user_id in (select id from auth.users where email like 'kand-%@karriera-test.com');");
    console.log("  3. delete from auth.users where email like 'kand-%@karriera-test.com';  (punët, ⭐ dhe profilet ikin me cascade)");
    return;
  }
  let gabime = 0;
  for (const tabela of ["gatishmeria", "dukshmeria"]) {
    const { error } = await admin.from(tabela).delete().in("user_id", teKrijuarat);
    if (error) {
      gabime++;
      console.log(`⚠️  Pastrimi: ${tabela} s'u fshi (${error.message})`);
    }
  }
  for (const id of teKrijuarat) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      gabime++;
      console.log(`⚠️  Pastrimi: një llogari testi s'u fshi (${error.message})`);
    }
  }
  console.log(
    gabime
      ? "\nPastrimi la mbetje. Në SQL Editor: delete from auth.users where email like 'kand-%@karriera-test.com';"
      : `\n🧹 U fshinë ${teKrijuarat.length} llogaritë e testit dhe rreshtat e tyre.`,
  );
}

let gabimiKryesor = null;
try {
  await testi();
} catch (e) {
  gabimiKryesor = e;
  deshtuan++;
  console.log(`❌ Testi u ndërpre: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await pastro();
}

console.log(`\n${kaluan} kaluan, ${deshtuan} dështuan${kapercyen ? `, ${kapercyen} u kapërcyen` : ""}.`);
process.exit(deshtuan || gabimiKryesor ? 1 : 0);
