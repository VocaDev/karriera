# Njoftimet dhe lokacioni · J10 (25.11.2026)

Kursi (J10, 09.12) kërkon kamerën, audion, lokacionin dhe njoftimet e telefonit. Kamera dhe audio ishin gati; ky dokument
mbulon dy të tjerat. Si provohen në telefon: [`lokacioni-njoftimet-provo.md`](lokacioni-njoftimet-provo.md).

## Çka ka tani

| Pjesa | Ku | Expo Go |
|---|---|---|
| "Afër meje" te Punët | `src/lib/qytetet.ts`, `src/lib/afer-meje.ts`, `src/app/pune/qyteti.tsx` | Po (iOS dhe Android) |
| "Praktiko sot", kujtesë ditore | `src/lib/kujtesat.ts`, `src/components/KujtesatRreshtat.tsx` | Po (njoftim lokal) |
| "Punë të reja për rolin tënd" | `useNjoftimiIPuneveTeReja` te `src/lib/kujtesat.ts` | Po (njoftim lokal) |
| Prekja e njoftimit → ekrani | `useHapjaNgaNjoftimi` te `src/app/_layout.tsx` | Po |
| Push nga serveri | `src/lib/push.ts`, flamuri `PUSH_NGA_SERVERI` (false) | **Jo në Android**; kërkon development build |

Paketat: `expo-location` (~58.0.22) dhe `expo-notifications` (~58.1.9), të shtuara me `npx expo install`. Konfigurimi te
`app.json`: teksti i lejes së lokacionit për iOS dhe ngjyra e njoftimeve (portokallia) për Android. Lokacioni në sfond s'është
ndezur (parazgjedhja e plugin-it: `false`).

### Lokacioni: privatësia

- Leja kërkohet vetëm kur prek "Afër meje" (ose "Përdor vendndodhjen time" te fleta). Fleta e shpjegon me një fjali para
  dritares së sistemit (bordi, ekrani 38).
- Vendndodhja lexohet një herë, me `Accuracy.Lowest` (~3 km), ose merret e fundit e njohur (deri 30 min). Qyteti më i afërt
  gjendet në telefon nga një tabelë me 37 komuna (`KOMUNAT`). Koordinatat s'ruhen dhe s'dërgohen askund.
- Ruhet vetëm emri i qytetit, në AsyncStorage (`karriera.punet.qyteti`), edhe për mysafirin. Pa llogari funksionon njësoj.
- Pa leje, me GPS të fikur ose jashtë Kosovës (> 40 km nga çdo komunë): qyteti zgjidhet me dorë nga e njëjta listë.
- Filtri: punët e qytetit tënd lart, pastaj ato nga distanca ("Remote", "Online", "Në distancë"…) dhe ato për gjithë
  Kosovën ("Kosovë"). Emrat normalizohen: "Prishtinë" = "Prishtina" = "Pristina", "Mitrovic" = "Mitrovicë".

### Njoftimet lokale

- Të dyja të fikura si parazgjedhje, te **Cilësimet → Njoftimet**. Leja e sistemit kërkohet vetëm kur ndez njërën.
  Në Android krijohet kanali `kujtesat` para lejes (Android 13 s'e shfaq dritaren pa kanal).
- **Praktiko sot:** njoftim `DAILY` në orën që zgjedh (parazgjedhja 18:00). Prekja hap `/intervista` (nisja e intervistës).
- **Punë të reja për rolin tënd:** kur app-i vjen në plan të parë, numëron te serveri punët publike aktive për rolin tënd që
  nga vizita e fundit te Punët (`numroPunetERe`, vetëm numri). Ndërsa është hapur, Realtime shton punët e reja. Kur e lë app-in
  dhe numri > 0, planifikohet një njoftim pas **2 minutash** (`VONESA_E_PUNEVE_TE_REJA_S`); nëse kthehesh para kësaj, anulohet.
  Hapja e Punëve e zeron numrin. Prekja hap `/pune`.
- Mysafiri s'i sheh (Cilësimet kërkojnë llogari). Kur del nga llogaria, të dyja fiken dhe anulohen në telefon.
- Njoftimi mund të hapë vetëm `/pune` ose `/intervista`; çdo vlerë tjetër te `data.rruga` injorohet.

## Push nga serveri: pse s'është ndezur

- **Android + Expo Go:** s'ka push që nga SDK 53. Paketa e thotë vetë: `getExpoPushTokenAsync` hedh gabim në Expo Go Android,
  dhe kur importohet shfaq një paralajmërim (i verdhë, vetëm në dev).
- **iOS + Expo Go:** paketa jep vetëm paralajmërim ("not fully supported"); dokumentacioni i SDK 58 s'e thotë qartë. S'u provua.
- Me development build (ose APK nga EAS) push punon në të dyja, me kredencialet e veta (FCM për Android, APNs për iOS).

Prandaj tani njoftimet janë vetëm lokale. Kodi për push është gati te `src/lib/push.ts` dhe s'thirret derisa
`PUSH_NGA_SERVERI = true` (`src/lib/vecorite.ts`).

## Hapat për ta ndezur push-in më vonë

1. **Development build.** `npx expo install expo-dev-client`, pastaj `eas build --profile development --platform android`
   (profili ekziston te `eas.json`). iOS kërkon llogari Apple Developer (me pagesë) për APNs.
2. **projectId i EAS.** Është tashmë te `app.json` → `extra.eas.projectId`. `push.ts` e lexon nga `Constants.expoConfig`.
3. **Kredencialet.** Android: projekt Firebase, `google-services.json` te rrënja + `"android.googleServicesFile"` te `app.json`,
   dhe çelësi FCM v1 (service account) i ngarkuar me `eas credentials`. iOS: çelësi APNs me `eas credentials`.
   Asnjë nga këto s'hyn në repo (repo-ja është publike).
4. **Tabela e token-ave** (migrim i ri; s'ekziston ende, s'është shkruar si skedar):
   ```sql
   create table public.push_tokenat (
     token text primary key,
     perdoruesi_id uuid not null default auth.uid() references auth.users on delete cascade,
     platforma text not null check (platforma in ('ios', 'android')),
     krijuar_me timestamptz not null default now()
   );
   alter table public.push_tokenat enable row level security;
   create policy push_tokenat_te_miat on public.push_tokenat
     for all to authenticated
     using (perdoruesi_id = (select auth.uid()))
     with check (perdoruesi_id = (select auth.uid()));
   ```
5. **Sender-i.** Një Edge Function (p.sh. `njofto-punet`) që, kur shtohet një punë (trigger ose webhook i bazës), gjen
   token-at e kërkuesve me atë rol dhe thërret `https://exp.host/--/api/v2/push/send` me `{ to, title, body, data: { rruga: "/pune" } }`.
   Token-at lexohen me çelësin e serverit, vetëm brenda funksionit. Token-at që kthejnë `DeviceNotRegistered` fshihen.
6. **Ndize.** `PUSH_NGA_SERVERI = true`. `_layout.tsx` thërret `regjistroPerPush()` pas hyrjes së kërkuesit. Prekja e njoftimit
   përdor të njëjtin `data.rruga` si njoftimet lokale, kështu që s'ndryshon asgjë tjetër.
