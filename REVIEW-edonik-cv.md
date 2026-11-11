# Review: Edonik's CV analyzer + CV builder (`origin/edonik/cv`)

Reviewed 11.11.2026, read-only. Nothing was edited, committed, pushed or commented on GitHub. Main = `b74b6b3`.

## Verdict: **needs rework before merge**

The server half is real and mostly well done: a migration with owner-only RLS, a private Storage bucket and two Edge Functions with validated structured output. **But nothing in the app calls them.** `src/lib/cv.ts` is still the mock contract, so the screens show fake data. The builder throws away the user's 5 answers and shows a sample CV ("Student Shembull", Mitrovicë, the Karriera GitHub link) as if it were theirs. The branch also does not merge cleanly into main (2 conflicts), fails `npx expo lint` (1 error), and ships mojibake Albanian on the analysis screen. About half of it (the builder, 6 formats, EN rewrite, roast share card) is listed as **out until after Demo Day** in HARTA.

## 1. What he built

- **Branch:** `origin/edonik/cv`. **No PR** (`gh pr list --state all` only shows PR #1 `edonik/lista`, merged 29.10).
- **Merge base with main:** `c7c91a5`. The branch is missing main's `e050312`, `7088bff` and `b74b6b3` (design rules, J6 login/roles/RLS).
- **Edonik's commits** (all 11.11):

| Commit | What | Files |
|---|---|---|
| `d368789` | Job search + role filter chips on Punët | `src/app/(tabs)/pune.tsx` (+260/−49) |
| `0a2878e` | CV screens + mock tweaks | `src/app/cv/{index,ndertoje,analiza,dokumenti,ndaje}.tsx`, `src/lib/cv.ts`, `src/app/_layout.tsx`, `src/lib/vecorite.ts`, `app.json`, `package.json` (+`expo-document-picker`, `expo-print`, `expo-sharing`), `tsconfig.json` |
| `69cf1dc` | AI Edge Functions + migration | `supabase/functions/_shared/cv-ai.ts`, `supabase/functions/cv-review/index.ts`, `supabase/functions/cv-create/index.ts`, `supabase/functions/README.md`, `supabase/migrations/20261111000000_cv.sql`, `scripts/test-cv-ai.ts`, `deno.lock` (5,692 lines) |

  The branch also contains Genti's `c864ce2` and `adf58ab` (the CV contract) and two merges of main from 05.11.
- **Live Supabase** (project `karriera`, read-only MCP): tables `punet`, `profiles`, `punet_e_ruajtura`. **No `cvs` or `cv_reviews` table, no `cv` bucket (0 buckets), no Edge Functions deployed.** `list_migrations` is empty: migrations are applied by hand in the SQL editor. So none of his backend runs yet.

## 2. Checks (real output, on `origin/edonik/cv` after `npm ci`)

`npx tsc --noEmit` passes (exit 0). His `tsconfig.json` excludes `supabase/functions` and `scripts/test-cv-ai.ts`, so the Deno code is **not type-checked at all**. Deno is not installed here, so `deno check` was not run.

`npx expo lint` fails (exit 1):

```
src\app\cv\analiza.tsx
   1:1  warning  Unexpected Unicode BOM (Byte Order Mark)          unicode-bom
  42:7  error    Error: Calling setState synchronously within an effect can trigger cascading renders
  > 42 |       setGabim(true);                                       react-hooks/set-state-in-effect
✖ 2 problems (1 error, 1 warning)
```

The merge dry-run (`git merge-tree --write-tree origin/main origin/edonik/cv`) exits 1:

```
CONFLICT (content): Merge conflict in src/app/(tabs)/pune.tsx
CONFLICT (content): Merge conflict in src/app/_layout.tsx
```

`app.json`, `package.json`, `package-lock.json` and `vecorite.ts` auto-merge.

## 3. Findings, most severe first

### Critical: does not work or misleads the user

1. **The app never calls the backend. Every CV function is still a mock.** See `src/lib/cv.ts:57-145`: `ngarkoCV` and `analizoCV` only `await prit(...)` and return `SHEMBULL_ANALIZE`, a fixed score of 64. They never touch Storage, `cvs` or `cv-review`. Any uploaded PDF gets the same fake 64/100 analysis. Versions live in a module variable (`let versionet`, line 58) and vanish on restart. Meanwhile `src/lib/vecorite.ts` changes the CV feature from `{ lloji: "ndertim", kush: "Edoniku" }` to `{ lloji: "gati" }`, so the home screen advertises it as ready. That breaks the AGENTS.md rule "no placeholder functionality that looks complete but does not work".
2. **The builder discards the user's answers and shows sample data as their CV.** `ndertoje.tsx:78` calls `krijoCV({ pergjigjet }, "ks", "sq")`. The mock at `cv.ts:105-106` uses `"cv" in burimi ? burimi.cv : SHEMBULL_CV`, so the answers are ignored. The user lands on `/cv/dokumenti` with "Student Shembull", `student@example.com`, UMIB, "Asistent për procese biznesi" and `github.com/VocaDev/karriera`, and can **export it as a PDF** (`dokumenti.tsx:207-231`).
3. **Switching to English overwrites the user's title with invented text.** `cv.ts:114-117` sets `titulli` to `"Computer Engineering student"` for any `gjuha === "en"`. It stays that way after switching back to Shqip, and "Ruaje versionin" saves it. Changing the format or language never rewrites anything (no AI call).
4. **The analysis screen shows mojibake Albanian.** `src/app/cv/analiza.tsx` was saved double-encoded with a BOM: 14 lines contain `Ã«`, `âœ“` or `ðŸ”¥`. Examples: `:22` "aftÃ«sitÃ« dhe pÃ«rvojÃ«n", `:86`, `:106` "CV-nÃ« tÃ«nde", `:129` and `:273` "âœ“" instead of ✓, `:199` "ðŸ”¥ Roast". Users will see garbage text. The other four screens are clean UTF-8.

### High: security and backend

5. **The Edge Functions do not check who calls them, and nothing limits use.** `cv-review/index.ts` and `cv-create/index.ts` never read the `Authorization` header or call `auth.getUser()`, never check `lloji_im() = 'kerkues'`, and have no per-user limit. Any signed-up account, employers included, can call them in a loop and spend the Anthropic key. The only protection is the gateway's `verify_jwt` default, and there is no `supabase/config.toml`. Note: the app uses a **publishable** key (`src/lib/supabase.ts:10`). Check how `verify_jwt` behaves with the new key type before relying on it.
6. **`cv-review` does not match the contract or Storage.** It takes `pdf_base64` in the body (`cv-review/index.ts:68-103`), while the contract is `analizoCV(cvId)`. It does not read the uploaded file from the `cv` bucket and does not write to `cv_reviews`. That leaves the client to (a) re-send up to ~6.7 MB of base64 and (b) insert the review row itself.
7. **The client can write its own score.** In the migration (`20261111000000_cv.sql`, `cv_reviews_shto_own` policy plus `grant select, insert on public.cv_reviews to authenticated`), `cv_reviews.nota` and `analiza` are inserted by the app. A user can store any score. It only affects their own data, but readiness ("A jam gati?") will build on it. The review row should be written by the Edge Function (service role, server-side only), and `insert` revoked from `authenticated`.
8. **The migration is valid but not aligned with J6 conventions.** These are not blockers:
   - The `cvs` policies allow any account type. J6 restricts seeker data with `public.lloji_im() = 'kerkues'` (`supabase/j6-hyrja-rls.sql:127`).
   - There is no `revoke all ... from anon` like J6 does. RLS still blocks anon, so this is defence in depth only.
   - J6 lives in `supabase/j6-hyrja-rls.sql` (not in `migrations/`). His migration is dated `20261111000000` and must run **after** the J6 file only if it starts referencing `lloji_im()`. Today it is independent, so there is no conflict.
   - The good parts: owner-only `select/insert/update/delete` on `cvs`, the composite FK `(cv_id, user_id) → cvs(id, user_id)` (which stops a review from pointing at someone else's CV), and a private bucket with `file_size_limit 5242880` and `allowed_mime_types ['application/pdf']`. The Storage policies scope every operation to the `{auth.uid()}/...` folder.

### Medium: AI and correctness

9. **The structured output is done correctly.** `cv-ai.ts:95-127` uses `client.messages.parse` + `zodOutputFormat` and checks `stop_reason` `max_tokens`, `refusal` and missing `parsed_output`. This matches the current SDK docs. The prompts say never to invent facts and to ignore instructions inside the PDF. The logs never contain CV text (`cv-review/index.ts:150`). The PDF is checked for `%PDF-` and 5 MB on the server. Smaller issues:
   - `MODELI = "claude-sonnet-5"` (`cv-ai.ts:78`) is a valid but previous-generation ID; the current Sonnet is `claude-sonnet-5-5`.
   - `npm:@anthropic-ai/sdk` and `npm:zod` are **unpinned** (`cv-ai.ts:2-4`), so a deploy can pull a breaking major. Pin them, e.g. `npm:@anthropic-ai/sdk@1.7.0` and `npm:zod@4.6.7`, the versions in his `deno.lock`.
   - Errors are told apart by string-matching the message (`error.message === "Mungon çelësi i AI-së."`) rather than with typed `Anthropic.*Error`, so 429 and 5xx failures all become a generic 500 with no retry hint.
   - `cv-review` decodes the whole base64 with `atob` before the size check. The length can be checked from `pdfBase64.length` first.
10. **The roast and the score: honest feedback.** The UI shows `nota/100` with no explanation of what it measures. The score is AI-generated (and today fake), with no note that it is an estimate. AGENTS.md says "Avoid presenting a numerical score without meaningful context."
11. **Lint error** `analiza.tsx:42` (`setGabim(true)` inside the effect). Derive the error from `!id` instead.
12. **The merge conflicts are not trivial.**
    - `_layout.tsx`: main now wraps screens in `Stack.Protected` by account type. His five `cv/*` screens are added **unguarded** (`_layout.tsx:48-55` on his branch). If they are pasted outside a `Stack.Protected guard={lloji === "kerkues"}`, employers and logged-out users can reach `/cv`.
    - `pune.tsx`: main removed the seeker's "Shto punë" button (adding jobs is employer-only since J6), added saved jobs and realtime. His version keeps the shto `Link`, now with an **array style on `Link asChild`** (`pune.tsx:99-113`), the exact pattern AGENTS.md says throws ("pass `StyleSheet.flatten`").
    - His search and filter logic (`normalizo`, `useMemo` filter) is fine and worth keeping, but it has to be re-applied on top of main's file, not merged line by line.

### Low: UI and project rules

13. **Design and native feel (AGENTS.md checklist):**
    - No haptics via `src/lib/prekja.ts` (success after upload or analysis, error on validation).
    - No `Prekshme` press feedback; buttons use opacity.
    - No `levizja.ts` motion, and the progress bars animate `width` (`ndertoje.tsx:104`, `analiza.tsx:173`) instead of `translateX`.
    - `Alert.alert` is used for successes ("U ruajt") instead of `useNjoftim()` toasts.
    - The search icon is `IKONAT.linku` (a link icon).
    - The role filter is chips, not the `@expo/ui` segmented control (checklist item 6, which names Edonik as owner).
    - Manual back buttons with "←" text (`ndaje.tsx:98-100`, `dokumenti.tsx:279-281`) duplicate the native header back button the Stack already shows.
14. **Hardcoded colours and dark mode:**
    - `dokumenti.tsx:511` `borderBottomColor: "#141414"` is nearly invisible on the dark card.
    - `analiza.tsx:126,195` hardcode `"#FFFFFF"`.
    - The share card (`ndaje.tsx:112-216`) uses `#E8590C`, which is not the theme orange (`#F2611D` / `#FF7A3D`), and prints `KARRIERA.APP`, a domain we don't appear to own.
    - Several `Pressable`s have no `accessibilityRole` or label.
15. **Repo hygiene:**
    - `deno.lock` (5,692 lines) at the **repo root** locks the whole Expo tree. It was created by running the test script with `--node-modules-dir=auto`. Drop it, or keep a small one under `supabase/functions/`.
    - The `tsconfig.json` exclude block is mis-indented and excludes a non-existent `karriera` folder.
    - `analiza.tsx` and `scripts/test-cv-ai.ts` start with a BOM.
    - Leftover mock code: `cv.ts:128` `void cv; void formati;` after `cv` is already used.

## 4. Scope vs HARTA

- **In (keep):** CV upload (MVP 18.11) and AI analysis (AI 02.12): `cv/index.tsx` (upload), `cv/analiza.tsx`, `cv-review`, the `cvs`/`cv_reviews` tables and the `cv` bucket.
- **Out until after Demo Day:**
  - **"Ndërto CV-në me AI (pa CV)"** (`HARTA.md:43`): `cv/ndertoje.tsx`, `cv-create`, plus the 6 formats and EN rewrite in `cv/dokumenti.tsx`.
  - **"ndarja e rezultateve në rrjete sociale"** (`HARTA.md:47`): `cv/ndaje.tsx`, the roast share card.

  In fairness, Genti's own contract (`c864ce2`) already defined `krijoCV`, `FormatiCV` and `fjalia_roast`, so Edonik built what the contract described. **Decision for Genti:** either hide these behind an "after Demo Day" status (the `vecorite` pattern) and keep the code, or move them to a separate branch. Either way, the builder must not ship as mock data.
- The Punët role filter adds a `"Tjetër"` chip; HARTA keeps only SWE and Asistent/PR for now. Minor.

## 5. Concrete fixes (in order)

1. Wire `src/lib/cv.ts` to the real backend, without changing names or types:
   - `ngarkoCV`: upload to `cv/{uid}/{uuid}.pdf` and insert into `cvs`.
   - `analizoCV(cvId)`: call `cv-review` with `{ cv_id }`. The function reads the file from Storage as the user, writes `cv_reviews` with the service role, and returns the analysis.
   - `listoVersionet` and `analizaEFundit`: select from `cvs` and `cv_reviews`.
   - Set `vecorite` back to `ndertim` until this works on a phone.
2. In both Edge Functions:
   - Verify the caller (`auth.getUser()` with the request's JWT) and require `lloji_im() = 'kerkues'`.
   - Add a simple per-user daily limit (e.g. count today's `cv_reviews`).
   - Pin the `npm:` versions.
   - Use the typed SDK errors.
3. Migration:
   - Revoke `insert` on `cv_reviews` from `authenticated`, since the function writes it.
   - Add `lloji_im() = 'kerkues'` to the `cvs` and bucket insert policies.
   - `revoke all ... from anon`.
   - Apply it after `j6-hyrja-rls.sql`.
4. Re-save `src/app/cv/analiza.tsx` as UTF-8 without BOM and retype the Albanian strings. Fix the lint error at `:42`.
5. Rebase `edonik/cv` onto current `main`:
   - Put the `cv/*` screens inside `Stack.Protected guard={lloji === "kerkues"}`.
   - Re-apply search and filter on main's `pune.tsx` with no shto button for seekers. Use `StyleSheet.flatten` under any `Link asChild`, and the `@expo/ui` segmented control for the role filter.
6. Builder and roast share: hide them as "pas Demo Day" (or split them to their own branch) per HARTA. Never fall back to `SHEMBULL_CV`.
7. UI pass on the five CV screens:
   - `prekja.sukses` / `prekja.gabim`, `useNjoftim()` for successes, `Prekshme`.
   - Progress via `translateX`, theme tokens instead of the hardcoded colours.
   - Native header back only, `accessibilityRole` on buttons.
   - One line under the score saying it is an AI estimate and what it measures.
8. Delete the root `deno.lock` and tidy the `tsconfig.json` excludes.

---
*Method:* `git fetch --all`, `git log --all --author=Edonik`, `gh pr list --state all`, `git diff origin/main...origin/edonik/cv`, read every changed file. Then `npm ci` + `npx tsc --noEmit` + `npx expo lint` on a detached checkout of `69cf1dc` in this worktree, `git merge-tree` against `origin/main`, and Supabase MCP `list_projects` / `list_tables` / `list_migrations` / `list_edge_functions` (read-only). Not done: running the app on a device, `deno check`, calling the AI functions.

---

# Fixes (11.11, branch `cv-fixes`)

Genti approved the fixes through the coordinator session. All work is on the **local** branch `cv-fixes`, which starts at `origin/edonik/cv` (`69cf1dc`) with current `origin/main` (`b74b6b3`) merged in, not rebased, so Edonik's commits stay intact.

Nothing was pushed, `main` and `edonik/cv` were not touched (`origin/edonik/cv` = `69cf1dc`, `main` = `b74b6b3`), and nothing was posted to GitHub. The migration was not applied, no function was deployed, and no secret was set.

## Commits on `cv-fixes` (after `69cf1dc`)

| Commit | What |
|---|---|
| `d3f2c12` | Merge `origin/main` into cv-fixes; resolves the `_layout.tsx` and `(tabs)/pune.tsx` conflicts |
| `4d59df3` | fix(cv): lock down CV tables, Storage and AI functions |
| `d8570d8` | fix(cv): real upload and analysis, no sample data, UI pass |
| `ee14a82` | chore(cv): drop root `deno.lock`, tidy `tsconfig.json`, strip BOM |
| `2b6e66f` | docs(cv): Edge Functions API, limits and go-live steps |

## Status of the 8 fixes

| # | Fix | Status | Where |
|---|---|---|---|
| 1 | Connect `cv.ts` to Storage, `cvs` and `cv-review`; CV feature stays "in progress" | **Done** in code; not run against a live backend | `src/lib/cv.ts:154` `ngarkoCV` (upload to `cv/{uid}/…pdf` + `cvs` row, removes the file if the insert fails), `:197` `analizoCV` → `functions.invoke("cv-review", { cv_id })`, `:206` `analizaPerCV`, `:221` `analizaEFundit`, `:242` `listoVersionet`, `:73`/`:96` runtime checks of AI answers. `SHEMBULL_CV`/`SHEMBULL_ANALIZE` deleted (no matches for `SHEMBULL` left). `src/lib/vecorite.ts`: CV = `ndertim` |
| 2 | Edge Functions: verify the caller, require `kerkues`, daily limit, pinned versions, typed errors | **Done**; not type-checked (no Deno), not deployed | `supabase/functions/_shared/thirresi.ts:80` `auth.getUser`, `:86` `rpc("lloji_im")` → 403, then a 24-hour count on `cv_ai_thirrjet` → 429. `cv-review/index.ts:22` limit 5, `cv-create/index.ts:21` limit 10. `_shared/cv-ai.ts:1-3` pinned `@anthropic-ai/sdk@1.7.0` / `zod@4.6.7`, `thirresi.ts:8` `supabase-js@2.118.0`, `cv-ai.ts:80` `claude-haiku-5-5` (was `claude-sonnet-5-5`; Genti switched it in `874b905`), `:105` typed `Anthropic.*Error` mapped to an Albanian message and HTTP status |
| 2b | `cv-review` reads the file from Storage and writes `cv_reviews` itself | **Done** | `cv-review/index.ts:118` downloads with the user's JWT (RLS = ownership), `:173` inserts into `cv_reviews` with the secret key |
| 3 | Migration: no client insert into `cv_reviews`; `kerkues` on inserts; `revoke … from anon` | **Done**; not applied | `20261111000000_cv.sql:57` `revoke all on cvs`, `:70` insert needs `lloji_im() = 'kerkues'`, `:102-111` `cv_reviews` is select-only for the app, `:128` `cv_ai_thirrjet` has no app access, `:156` Storage insert needs `kerkues`. No update on `cvs` or the bucket (every change is a new version); the server sets `user_id` and `versioni` (trigger) |
| 4 | `analiza.tsx`: clean UTF-8, lint error | **Done** | Rewritten without a BOM; no mojibake left anywhere in `src`, `supabase` or `scripts`. The effect no longer calls `setState` synchronously. A saved analysis opens without calling the AI again |
| 5 | Merge main; CV screens behind the job-seeker guard; `pune.tsx` on main's version | **Done** | `src/app/_layout.tsx:92` `cv/index` and `cv/analiza` inside `Stack.Protected guard={lloji === "kerkues"}`; `:96` builder, formats and share card behind `kerkues && CV_PAS_DEMO_DAY_HAPUR`. `(tabs)/pune.tsx`: main's file + Edonik's search (`normalizo`) + the `@expo/ui` segmented control `:158` (Të gjitha / SWE / Zyrë), a "Pastro filtrat" empty state, no "Shto" for job seekers, no `Link asChild` on array styles |
| 6 | Builder, 6 formats, English rewrite, roast share card hidden until after Demo Day | **Done** | `src/lib/vecorite.ts:59` `CV_PAS_DEMO_DAY_HAPUR = false`; the screens are unreachable through the guard; `cv/index.tsx` shows the builder as a locked row ("Vjen pas Demo Day-t", shake + light haptic). The hidden screens now call the real functions and never fall back to sample data |
| 7 | UI pass | **Done** in code; not seen on a device | `prekja` haptics (success / error / selection), `useNjoftim` toasts instead of `Alert`, `Prekshme` on every button with `accessibilityRole`, `Progresi` (translateX) instead of animated width, theme tokens (no hardcoded colours except the deliberately dark share poster), native back only, skeletons and error/retry on `cv/index`. One line under the score: "Vlerësim i AI-së … jo garanci punësimi. Mund të gabojë." (`analiza.tsx:200`) |
| 8 | Delete root `deno.lock`, tidy `tsconfig.json` | **Done** | `deno.lock` removed and `/deno.lock` added to `.gitignore`; `tsconfig.json` exclude fixed (the non-existent `karriera` path replaced by `node_modules`); BOM removed from `scripts/test-cv-ai.ts` |

**One extra change outside the CV files.** `src/components/RreshtiVecorise.tsx` now opens a feature that is "in progress" and has a screen **only in development builds (`__DEV__`)**. Otherwise you could not test the CV flow on a phone while it stays locked. Real builds still show it locked.

## Checks (real output on `cv-fixes`, after `npm ci`)

```
npx tsc --noEmit   → exit 0, no output
npx expo lint      → exit 0, no output
git merge-tree --write-tree --name-only origin/main HEAD → ddf4bb8b…, exit 0 (no conflicts)
deno --version     → "deno: command not found"
```

Deno is not installed, so **the Edge Functions and `scripts/test-cv-ai.ts` are not type-checked**.

## Still unverified

- **No device test.** Upload with `fetch(uri).arrayBuffer()` (the pattern from the Supabase Expo guide), the segmented controls, haptics, toasts and dark mode were never seen on a phone.
- **No live backend.** The migration is not applied and the functions are not deployed, so `cvs`, `cv_reviews`, the bucket, the 401/403/429 paths and the AI call were never run. `scripts/test-rls.mjs` was not extended to cover CVs.
- **No Deno type-check.** It is not verified that SDK 1.7.0 accepts `output_config.effort` together with `format`, or that `claude-sonnet-5-5` works with that SDK version (the model is a plain string, so it should).
- **No refusal fallback.** The server-side refusal fallback (`fallbacks`) is not enabled: a refusal returns a 422 with a clear message instead.

## Go-live checklist (needs Genti's OK; details in `supabase/functions/README.md` §3)

1. In the SQL Editor, **after** `supabase/j6-hyrja-rls.sql` (already applied), run `supabase/migrations/20261111000000_cv.sql`.
2. Run `supabase secrets set ANTHROPIC_API_KEY=…`. The platform provides `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS`.
3. Run `supabase functions deploy cv-review --no-verify-jwt --project-ref mlnfamjdkmyszvxxhddr`. Use **`verify_jwt = false`** because the new publishable/secret keys are not JWTs; the function verifies the user itself. Deploy `cv-create` only after Demo Day.
4. Test with the demo accounts:
   - A job seeker uploads and gets an analysis.
   - An employer gets 403.
   - One account cannot see another's CV.
   - The 6th analysis within 24 hours gets 429.
5. Only after it works on a phone: set CV to `gati` in `vecorite.ts`, then push `cv-fixes` and open a PR.
