# "A jam gati?": definition of done

Goal (Genti, 24.11): *"A jam gati" fully finished.* Courses / learning links ("Mëso") are **out**, they come later.
Spec sources: `AGENTS.md` §5 *Job Fit Assessment*, §7 (AI), §9 (UX); `HARTA.md` step 3; board screens 11, 12, 25 and 09.
Status key: **done** (file:line) · **missing** (to build in this branch) · **phone** (needs a real device or Genti).

## A. Job Fit rules (AGENTS.md §5)

| # | Requirement | Status |
|---|---|---|
| A1 | Compares the job's *real* requirements with the user's *real* CV | **done**: job block `supabase/functions/gati/index.ts:319-331`, structured `punet.kerkesat` `:142-156`, CV (JSON or PDF, no contact data) `:273-299`, prompt rules `:45-53` |
| A2 | Explains why it is, or isn't, a match | **done**: `arsyeja` rule `index.ts:64-66`, card "Pse ky numër" `src/app/gati/[id].tsx:486-493` |
| A3 | Missing skills, each tied to one requirement, with why and how | **done**: prompt `index.ts:54-59`, "Çka të mungon" card `[id].tsx:529-574` |
| A4 | Actionable improvements (week-sized steps, real buttons) | **done**: prompt `index.ts:67-72`, steps card `[id].tsx:576-596`, buttons from the step text `gati.ts:321` (`veprimiIHapit`) |
| A5 | Never a bare number: verdict sentence, reason, and *what the number is based on* | **missing**: verdict `gati.ts:297` + reason done; the "based on" line (N requirements / description only / skills only) is not shown |
| A6 | Honest about limits (not a hiring probability, AI can be wrong) | **done**: `[id].tsx:598-600`, prompt `index.ts:60-63` |
| A7 | Structured output validated on both sides, haiku, 10 calls / 24 h | **done**: Zod `index.ts:29-36`, `pastro` `:112-129`, client check `gati.ts:72-91`, limit `index.ts:22,217-228` |

## B. Which jobs work

| # | Requirement | Status |
|---|---|---|
| B1 | Portal job with `kerkesat` | **done** `index.ts:142-156,327` |
| B2 | Portal job *without* `kerkesat` (falls back to description + skills), and the user is told the number is less certain | **missing**: fallback works `index.ts:244-246,329`; the screen does not say that the basis is thin |
| B3 | Private "Sill linkun tënd" job with posting text | **done**: `pershkrimi` is used (`index.ts:329`), text sheet `src/app/pune/teksti.tsx` |
| B4 | Private job with no text, or any job with nothing usable: a clear state with the way out ("Shto tekstin" / "Hape shpalljen"), no AI call, no limit used | **missing**: server answers 422 `index.ts:247-252`, the app shows a generic "S'u llogarit" + useless "Provo përsëri" |

## C. CV

| # | Requirement | Status |
|---|---|---|
| C1 | No CV: clear path to **upload** | **done** `[id].tsx:244-259` |
| C2 | No CV: clear path to **build one** ("Nuk kam CV") | **missing**: only the upload button is offered |
| C3 | CV newer than the result: tells the user to re-check | **done** `[id].tsx:389-392,477-484` |

## D. History and change over time

| # | Requirement | Status |
|---|---|---|
| D1 | Result is stored per job and re-opened without a new AI call | **done** `[id].tsx:126-145`, `gati.ts:193-204` |
| D2 | Past checks strip + "+12 from last time" | **done** `GatiPjeset.tsx:225-262,265-277`, `gati.ts:217-234` |
| D3 | Interview results show up in the same history (`burimi = intervista`) | **done** `[id].tsx:386,185-202` (written by the interview session, read here) |
| D4 | Steps can be ticked off, kept on the phone only | **done** `gati-hapat.ts`, `[id].tsx:394-410` |

## E. Practise the gaps (interview link)

| # | Requirement | Status |
|---|---|---|
| E1 | "Praktiko intervistën" opens the interview for *this* job | **done** `[id].tsx:412,602-604`, step button `:417-418` |
| E2 | The interview actually targets the missing skills | **done, server side**: `intervista-nis/index.ts:215-229` reads the newest `gatishmeria.mungon` for the job and `_shared/intervista-ai.ts:350-352` uses it as objectives. No client change needed |
| E3 | The screen says so (the user knows the gaps are what gets practised) | **missing**: no sentence next to the button |

## F. States

| # | Requirement | Status |
|---|---|---|
| F1 | Loading stages while AI works (same layout as the result) | **done** `GatiPjeset.tsx:84-161` |
| F2 | Board 25 route strip (CV → Përputhja → …) on the waiting screen | **missing** (small) |
| F3 | AI error + retry, "taking longer" copy | **done** `[id].tsx:304-342`, `mesazhet.ts:VONON.gati` |
| F4 | Session expired | **done** `gati.ts:136-151` |
| F5 | Offline, result already on screen: banner, "Kontrollo përsëri" locked with the reason | **done** `[id].tsx:458-460,609-620` |
| F6 | Offline, screen *opened* offline: show the last result saved on the phone | **missing**: the snapshot is written (`snapshot.ts:208`) but this screen never reads it, it shows the error |
| F7 | Daily limit reached: when it frees up, last result still reachable | **done** `[id].tsx:274-302,438-453` |
| F8 | No internet when it comes back: screen re-reads by itself | **done** `[id].tsx:165-172`; extended to the cached result in F6 |

## G. Entry points and visibility (board 09 and 11)

| # | Requirement | Status |
|---|---|---|
| G1 | Job detail has the "A jam gati për këtë?" entry | **done** `pune/[id].tsx:312-323` |
| G2 | The entry and the route card show the true state (last %, next step) instead of always "Tani: CV" | **missing** `pune/[id].tsx:395-405` |
| G3 | Job cards in the list show the readiness % and the right route step | **missing** `KartaPunes.tsx:99-106` always says "Tani: CV" |

## H. Look and feel (needs a phone to be proven)

| # | Requirement | Status |
|---|---|---|
| H1 | Light / dark: colours only from `useTema` | **phone**: code uses tokens (one white check icon on a green dot); each state still has to be looked at in both themes |
| H2 | Dynamic Type 130 %: no clipping, ring number capped | **phone**: ring has `maxFontSizeMultiplier` (`GatiPjeset.tsx:67`), the rest has to be checked on the device |
| H3 | Reduce Motion: ring fills at once, skeleton static, no slide | **phone**: ring `GatiPjeset.tsx:34-40`, `Skeleti.tsx:20`, `Prekshme.tsx:15`; behaviour only visible on a device |
| H4 | Board 12: ring, Çka ke, Çka të mungon, numbered steps, "Praktiko intervistën" | **done** `[id].tsx:458-626` |
| H5 | Board 12: "Mëso çka të mungon" button | **out** (courses later, Genti 24.11) |
| H6 | Board 25: skills pop in one by one while AI works | **not possible**: the function answers once at the end, nothing to stream. The honest time-based stages stay |
| H7 | Haptics: success when a result arrives, error on failure | **done** `[id].tsx:101,108` |
| H8 | Whole flow on a real phone (nothing was tested on a phone yet) | **phone / Genti** |

## I. Out of scope

Courses, learning videos, the "Mëso" step content, CV builder without a CV beyond the existing `/cv/ndertoje`, levels, anything in the interview files.
