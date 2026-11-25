# Si ta provosh në telefon · lokacioni dhe njoftimet (J10)

Me Expo Go (SDK 58), iPhone ose Android: `npx expo start` (në WiFi-n e universitetit: `npx expo start --tunnel`), skano QR-në.
Në Expo Go del një paralajmërim i verdhë nga `expo-notifications` ("not fully supported in Expo Go"): është normal, vetëm push-i
mungon; njoftimet lokale punojnë.

## 1. Afër meje (edhe si mysafir)

1. Hap **Punët**. Prek chip-in **Afër meje** nën SWE / Zyrë.
2. Del fleta "Punë afër teje?". Prek **Përdor vendndodhjen time** → sistemi pyet për lejen → **Lejo**.
   - Pritet: fleta mbyllet, njoftimi "Afër meje: Prishtinë" (ose qyteti yt), chip-i i zi, lista vetëm me punët e qytetit lart
     dhe pastaj ato "Kosovë" / nga distanca. Numri te chip-i = sa punë dalin.
3. Prek chip-in sërish: fiket, kthehet lista e plotë. Prek përsëri: ndizet menjëherë, pa pyetur (qyteti është ruajtur).
4. Prek **Qyteti · Ndrysho** → zgjidh një qytet tjetër me dorë (p.sh. Mitrovicë) → lista ndryshon.
5. **Pa leje:** fshi app-in nga Expo Go (ose te Cilësimet e telefonit hiqi lejen Expo Go-së), provo sërish dhe prek **Mos lejo**.
   Pritet: "Pa leje vendndodhjeje. Zgjidh qytetin tënd më poshtë." dhe lista e qyteteve punon.
6. **Pa GPS:** fik Location Services dhe prek "Përdor vendndodhjen time". Pritet mesazhi "S'e gjetëm vendndodhjen…", jo ngecje.
7. Provo në temë të çelët dhe të errët.

## 2. Praktiko sot (me llogari)

1. **Profili → Cilësimet → Njoftimet**. Ndiz **Praktiko sot** → sistemi pyet për njoftimet → **Lejo**.
   - Pritet: njoftimi "Kujtesa çdo ditë në 18:00" dhe rreshti **Ora**.
2. Ndrysho orën në 2 minuta nga tani (iPhone: prek orën; Android: prek orën → dritarja → Ruaj).
3. Mbylle app-in (ose lëre në sfond) dhe prit. Pritet njoftimi "Praktiko sot".
4. Prek njoftimin. Pritet: app-i hapet te **Intervista** (zgjedhja e punës dhe gjuhës).
5. Fike çelësin: s'del më.

## 3. Punë të reja për rolin tënd (me llogari)

1. Te Cilësimet ndiz **Punë të reja për rolin tënd**.
2. Hap **Punët** një herë (kjo është "vizita e fundit"), pastaj shko te **Sot**.
3. Nga një llogari punëdhënësi (telefon tjetër ose web) posto një punë me **të njëjtin rol** si kërkuesi.
4. Te kërkuesi: lëre app-in në sfond (Home). Prit **2 minuta**. Pritet njoftimi "Një punë e re për rolin tënd".
5. Prek njoftimin → hapet **Punët**.
6. Kontrollo anulimin: përsërit, por kthehu në app para 2 minutave → s'del njoftim (shenja te Punët e tregon).

## 4. Dalja nga llogaria

Me kujtesat ndezur, **Dil**. Pritet: asnjë kujtesë s'del më (anulohen), dhe pas hyrjes sërish janë të fikura.

## Çka s'provohet në Expo Go

- Push nga serveri (njoftim kur app-i s'është hapur dhe s'ka pasur asgjë të planifikuar): kërkon development build,
  shih [`njoftimet.md`](njoftimet.md).
- Teksti i lejes së lokacionit te iOS (`locationWhenInUsePermission` te `app.json`) dhe ngjyra e njoftimeve në Android
  dalin vetëm në build; në Expo Go del teksti i Expo Go-së.
