# AGENTS.md — Karriera

## 0\. The idea in one page (from EKIPI.md, BISEDAT.md, HARTA.md)

- **Team:** Genti (@VocaDev) and Edonik (@ed0n1k). Course 302-CSE Mobile App Development, UMIB. **Path 1 · personal use:** we are the first users, final-year students looking for a first internship or job.
- **The one job (HARTA):** *"Ta dish sa je gati për një punë konkrete dhe ta praktikosh intervistën derisa të bëhesh gati."* Know how ready you are for one concrete job, and practise the interview until you are ready.
- **Main flow (5 screens):** CV (upload once, AI reads it) → Punët (jobs from Kosovo portals + "bring your link") → A jam gati? (readiness %, what you have, what is missing) → Intervista (avatar asks by voice: Albanian / English / German) → Rezultatet (feedback per answer, new readiness), then practise again.
- **In for the course:** MVP 18.11 = account + role (SWE or Asistent/PR), job listings, CV upload, data in Supabase. AI 02.12 = CV analysis, "A jam gati?", text interview with structured output. Phone 09.12 = voice interview, 3D avatar, camera, notifications. Demo Day 13.01 = body language, integrity signals, streak, learning videos.
- **Out until after Demo Day:** CV builder without a CV, roles beyond SWE and Asistent/PR, the abroad module, "Lidhja", levels and leaderboards, daily question and social sharing, reading LinkedIn automatically, full-duplex conversation, App Store and payments.
- **What the user conversations taught us (BISEDAT):** one candidate lost 4 months on a job he would not apply to again ("mos me aplikue fare"), so fit must be known **before** applying; another wanted to know what the job really asks of a candidate; the third (call centre, outside IT) said the hardest part was fitting the CV to the company.
- **Design board vs HARTA:** `design/karriera-ui.html` also shows the employer and career-centre accounts, simulations and the daily plan. That is the product vision; **HARTA defines what we build in the course.** When they differ, follow HARTA unless the task says otherwise.
- **Current backend state (J5, 04.11):** table `public.punet` (job listings) with RLS: anyone can read, the app may insert only with `burimi = 'perdoruesi'`, no update or delete from the app. Migration: `supabase/migrations/20261104120000_punet.sql`. All Supabase calls go through `src/lib/punet.ts`; the client is `src/lib/supabase.ts`. No login yet (Supabase Auth comes in J6).

---


## 1\. Project Overview

**Karriera** is an AI-powered career preparation mobile application designed primarily for students, graduates, and early-career professionals.

The product helps users prepare for employment through:

- **CV Review:** AI-assisted CV analysis, feedback, and improvement suggestions.
- **Job Discovery:** Finding relevant jobs, internships, and early-career opportunities, with a focus on Kosovo.
- **Job Fit Assessment:** Evaluating how well a user's experience and skills match a job opportunity.
- **AI Interview Practice:** Simulated interviews using an AI interviewer, including avatar, camera, and voice-based interactions.
- **Multilingual Support:** Albanian, English, and German interview experiences.
- **Learning Resources:** Career-related learning materials and resources that help users improve their employability.

The application should feel like a polished, trustworthy career product—not a generic AI chatbot or a collection of unrelated utilities.

### Product principles

1.  **Practical over flashy:** Every feature should help users make measurable progress toward employment.
2.  **Trustworthy AI:** AI feedback must be useful, understandable, and honest about its limitations.
3.  **Accessible to beginners:** The experience should work for students and people with limited professional experience.
4.  **Clear next steps:** Users should understand what to do after every assessment, review, or interview.
5.  **Local relevance:** Kosovo's job market and multilingual context are important product considerations.
6.  **Consistent experience:** Navigation, typography, spacing, components, and interaction patterns should feel like one cohesive application.

---

## 2\. Technology Stack

Use the existing project dependencies and architecture as the source of truth.

| Area              | Technology                                                             |
| ----------------- | ---------------------------------------------------------------------- |
| Framework         | React Native                                                           |
| Platform          | Expo SDK 58                                                            |
| Language          | TypeScript                                                             |
| Navigation        | Expo Router                                                            |
| Backend           | Supabase                                                               |
| Authentication    | Supabase Auth                                                          |
| Database          | Supabase PostgreSQL                                                    |
| Database security | PostgreSQL Row Level Security (RLS)                                    |
| File storage      | Supabase Storage                                                       |
| Server-side logic | Supabase Edge Functions                                                |
| Animations        | React Native Reanimated                                                |
| UI primitives     | React Native and `@expo/ui` where appropriate                          |
| Styling / UI      | Native React Native components and the established project conventions |

Important dependency versions currently include:

- Expo: `~58.0.16`
- React Native: `0.88.0`
- React: `19.3.0`
- Expo Router: `~58.0.24`
- TypeScript: `~6.0.3`
- React Native Reanimated: `4.7.1`
- `@expo/ui`: `~58.0.21`

These are reference versions, not permission to upgrade dependencies.

### Documentation-first development

Before implementing or changing Expo, React Native, Expo Router, or native functionality:

1.  Check the official documentation for the installed SDK version.
2.  Prefer version-specific Expo documentation: [https://docs.expo.dev/versions/v58.0.0/](https://docs.expo.dev/versions/v58.0.0/)
3.  Check the official documentation for the relevant library.
4.  Verify API compatibility with the installed package version.
5.  Avoid using APIs from older tutorials or examples without checking compatibility.

Do not assume that APIs from Expo SDK 50–57 behave identically in SDK 58.

---

## 3\. Project Structure and Architecture

Follow the existing project structure. Do not reorganize the application unnecessarily.

### Architecture principles

- Keep screens focused on presentation and user interaction.
- Move reusable business logic into appropriate utilities, hooks, or service modules.
- Keep API and Supabase operations out of large UI components.
- Reuse components rather than duplicating similar implementations.
- Keep TypeScript types explicit and consistent.
- Avoid unnecessary abstraction for simple functionality.
- Do not introduce a new state-management library unless there is a clear need.
- Prefer the existing Expo Router navigation conventions.

### Expo Router

- Follow the file-based routing structure.
- Use appropriate layouts for shared navigation and screen structure.
- Keep route-specific logic close to the relevant screen.
- Use typed routes where supported by the existing configuration.
- Avoid unnecessary navigation wrappers or competing navigation systems.

### React Native requirements

This is a native mobile application.

- Use React Native components rather than HTML elements.
- Use `View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Image`, and other appropriate native components.
- Use `StyleSheet` or the styling conventions already established in the project.
- Do not introduce web-only CSS, DOM APIs, or browser-specific dependencies into native screens.
- Do not embed the HTML design prototype inside a WebView as a substitute for implementing the actual interface.
- **Exception:** the AI interview avatar (TalkingHead 3D + MediaPipe face tracking) intentionally runs in a WebView with camera and microphone. Do not "fix" it into native code. Prototype: branch `spike/avatar`, file `spike/avatar.html`.
- Account for safe areas, keyboard behavior, device dimensions, and platform differences.

### Component organization

Prefer small, reusable components with clear responsibilities.

Examples include:

- Buttons and icon buttons
- Text fields and form controls
- Cards and list items
- Status indicators
- Progress indicators
- Navigation elements
- Empty states
- Loading states
- Error states
- Modal and bottom-sheet components

Avoid creating a separate component for every trivial element. Reuse should improve consistency, not make the code unnecessarily complicated.

---

## 4\. Design System and UI Guidelines

The reference design is located at:

`design/karriera-ui.html`

**This file is the visual design reference for the application.**

It contains four design directions: `dir-a` (Qartë), `dir-b` (Leja), `dir-c` (Ritëm) and `dir-d` (Gjurmimi). Each has light and dark variations.

**`dir-d` · Gjurmimi is the proposed direction** (the board opens in it): one orange accent used only for progress, everything else neutral, readiness shown as a route (CV → Përputhja → Intervista → Mëso → Gati). Confirm with the team before large UI work. The app icon is **Unaza** (the ring).

Before making substantial UI changes:

1.  Inspect the relevant design direction.
2.  Understand its colors, typography, spacing, component shapes, and hierarchy.
3.  Check how the same component behaves in light and dark mode.
4.  Reproduce the intended visual language using native React Native components.
5.  Keep the implementation consistent with the selected direction.

Do not arbitrarily combine different design directions.

### Design consistency

Maintain consistency in:

- Typography and font weights
- Heading hierarchy
- Spacing and layout rhythm
- Border radii
- Button dimensions
- Card styling
- Input fields
- Icons
- Colors
- Shadows and elevation
- Loading and disabled states
- Light and dark appearances

Avoid introducing random values when an existing design token or component can be reused.

### Visual quality

The application should feel modern, polished, and production-ready.

Avoid:

- Generic template-like interfaces
- Excessive gradients
- Unnecessary decorative elements
- Inconsistent corner radii
- Randomly mixed icon styles
- Excessive shadows
- Overcrowded screens
- Unnecessary animations
- Inconsistent spacing
- Excessive use of cards when a simpler layout works better

Prioritize readability, clear hierarchy, and purposeful whitespace.

### Light and dark themes

Both appearances matter.

- Use the existing theme conventions and design tokens.
- Do not hardcode colors throughout individual screens.
- Ensure text, icons, borders, inputs, and surfaces remain readable in both themes.
- Avoid using opacity or color combinations that make content inaccessible.
- Test important screens in both appearances.

### Responsive layouts

Account for different mobile screen sizes.

- Avoid fixed dimensions where flexible layouts are more appropriate.
- Handle safe areas correctly.
- Prevent text clipping and horizontal overflow.
- Ensure buttons and interactive elements are comfortably touchable.
- Consider keyboard visibility when building forms.

---

## 5\. Core Product Features

When implementing product functionality, preserve the intended user experience of each feature.

### CV Review

The CV review experience should:

- Allow users to provide their CV through the supported input method.
- Clearly communicate the review process.
- Present understandable feedback and actionable improvements.
- Avoid presenting AI-generated feedback as guaranteed hiring outcomes.
- Preserve the user's original information unless they explicitly choose to edit it.
- Handle unsupported files and processing errors gracefully.

### Job Discovery

The job discovery experience should:

- Present opportunities in a clear, scannable format.
- Display relevant information such as title, company, location, employment type, and application details when available.
- Support useful filtering and search.
- Distinguish between internships, entry-level roles, and other opportunities.
- Avoid inventing job information or displaying unverified opportunities as real.

Kosovo is an important target market. Consider local terminology, locations, and employment context when implementing job-related functionality.

### Job Fit Assessment

Job-fit functionality should:

- Compare available job requirements with the user's actual profile and experience.
- Explain why a job may or may not be a good match.
- Identify missing skills and potential improvements.
- Avoid presenting a numerical score without meaningful context.
- Make recommendations understandable and actionable.

### AI Interview Practice

Interview practice is one of Karriera's important differentiating features.

The experience may include:

- AI interviewer interaction
- Avatar presentation
- Camera access
- Microphone access
- Voice input and output
- Interview questions
- Interview responses
- Interview feedback
- Interview summaries and progress

Important implementation considerations:

- Request camera and microphone permissions only when needed.
- Explain why permissions are required.
- Handle permission denial gracefully.
- Provide clear recording and listening states.
- Give users appropriate controls to start, pause, stop, and leave an interview.
- Handle network interruptions and failed AI responses.
- Prevent accidental duplicate submissions.
- Keep the interface responsive during audio and video operations.
- Clearly distinguish between the AI interviewer speaking and the user's microphone being active.

Support the intended Albanian, English, and German experience. Do not assume that language-specific speech recognition or voice capabilities are interchangeable.

### Learning Resources

Learning content should be easy to discover and understand.

Where appropriate, include:

- Categories
- Progress indicators
- Completion states
- Useful descriptions
- Clear navigation to the next learning activity

Gamification only where it measures real progress: readiness per job, streak, verified badges. No points or rewards that are not tied to an actual action (practice, interview, simulation).

---

## 6\. Supabase and Backend Guidelines

Supabase is the application's backend.

Use the existing Supabase integration and follow its established patterns.

### Authentication

- Use Supabase Auth for authentication.
- Handle loading, authenticated, and unauthenticated states correctly.
- Do not assume a session exists immediately when the application starts.
- Protect authenticated routes and user-specific data.
- Handle expired sessions and authentication failures gracefully.

### Database

- Use clear and consistent table and column naming.
- Maintain explicit TypeScript types for database-related data.
- Avoid unnecessary duplicate data.
- Use appropriate relationships and constraints.
- Consider query performance and pagination when retrieving larger datasets.

### Row Level Security

**RLS is mandatory for protecting user-specific data.**

- Enable RLS on tables containing private or user-specific information.
- Ensure users can access only the records they are authorized to access.
- Never rely exclusively on frontend checks for authorization.
- Verify ownership in policies.
- Be especially careful with CVs, interview recordings, personal profiles, assessments, and saved opportunities.

### Supabase Storage

- Keep private user files in appropriately protected storage locations.
- Use storage policies to control access.
- Avoid exposing private file URLs unnecessarily.
- Validate uploaded file types and sizes.
- Handle upload and download failures.

### Edge Functions

Use Supabase Edge Functions for server-side operations that should not run in the mobile application.

Examples include:

- AI API requests
- AI CV analysis
- Interview processing
- Job-fit calculations
- Secure third-party API integrations
- Operations requiring protected credentials

Never expose secret API keys or privileged service credentials in the React Native application.

Never place the Supabase service-role key in frontend code.

Use environment variables and the project's existing secret-management approach.

---

## 7\. AI Integration Guidelines

AI functionality must be reliable, useful, and secure.

- Prefer server-side AI requests through Supabase Edge Functions.
- Never expose provider API keys in client code.
- Validate inputs before sending them to an AI service.
- Handle malformed responses and provider errors.
- Use structured output where the application expects structured data.
- Validate AI responses before using them in the UI or database.
- Avoid trusting AI-generated content as authoritative factual information.
- Provide useful loading, retry, and error states.
- Avoid unnecessary repeated requests that increase latency or API costs.

### AI feedback quality

AI-generated career advice should be:

- Specific to the user's information
- Constructive
- Actionable
- Clearly explained
- Honest about uncertainty

Avoid generic feedback such as "improve your communication skills" without explaining why or how.

---

## 8\. TypeScript and Code Quality

Use TypeScript consistently.

- Avoid `any` unless there is a documented and justified reason.
- Prefer explicit types for component props, function parameters, and returned data.
- Use discriminated unions for complex state where appropriate.
- Handle nullable values explicitly.
- Avoid unsafe type assertions.
- Keep functions focused and understandable.
- Remove unused imports, variables, and dependencies.
- Avoid unnecessary nested conditional expressions.

### React practices

- Use hooks according to React's rules.
- Avoid unnecessary state.
- Derive values when they do not need to be stored separately.
- Use stable keys when rendering lists.
- Avoid unnecessary re-renders when they materially affect performance.
- Clean up subscriptions, listeners, and asynchronous operations when appropriate.
- Keep effects focused on synchronization with external systems.

### Error handling

Do not silently ignore errors.

Provide appropriate handling for:

- Network failures
- Authentication failures
- Supabase errors
- Invalid user input
- AI provider failures
- File upload failures
- Permission errors
- Unexpected application states

Show understandable messages to users and keep technical details in appropriate development logs.

Never expose secrets, tokens, or sensitive personal information in logs.

---

## 9\. Performance and User Experience

Karriera should feel responsive, even when performing AI-heavy operations.

- Avoid blocking the UI during network requests.
- Use loading indicators for longer operations.
- Avoid unnecessary large data fetches.
- Use pagination or incremental loading where appropriate.
- Optimize images and other media.
- Avoid expensive rendering operations in frequently updated components.
- Use Reanimated only where it provides a meaningful interaction or performance benefit.
- Avoid excessive animations that interfere with usability.
- Ensure lists remain performant as data grows.

For longer-running AI operations, communicate progress where possible rather than leaving users looking at an unexplained spinner.

---

## 10\. Accessibility and Internationalization

### Accessibility

- Use accessible labels for interactive elements.
- Maintain sufficient color contrast.
- Ensure touch targets are appropriately sized.
- Do not communicate important information through color alone.
- Support readable text sizes.
- Make important actions understandable without relying exclusively on icons.

### Language support

The product targets Albanian, English, and German experiences.

- Do not hardcode user-facing text throughout the application when an existing localization approach is available.
- Keep translations consistent.
- Avoid mixing languages unintentionally within one screen.
- Use appropriate date, time, and number formatting.
- Consider longer German translations when designing layouts.
- Ensure Albanian characters render correctly.

Do not assume that every feature must support all three languages immediately. Follow the actual feature requirements and existing implementation.

---

## 11\. Security and Privacy

Karriera processes potentially sensitive personal information, including CVs, employment history, interview responses, and camera or microphone data.

Treat this information carefully.

- Collect only information required by the feature.
- Never expose private user data to other users.
- Never commit secrets or credentials.
- Do not store sensitive information unnecessarily.
- Use secure backend authorization.
- Follow Supabase RLS and Storage policies.
- Avoid logging CV contents, interview transcripts, access tokens, or private user information.
- Request device permissions only when required.
- Clearly communicate camera and microphone usage.
- Do not assume that a frontend-only authorization check is sufficient.

When modifying authentication, storage, or database access, consider the security implications before implementing the change.

---

## 12\. Dependency and Configuration Management

Before adding a dependency:

1.  Check whether the functionality already exists in the project.
2.  Check whether Expo or React Native provides a suitable built-in solution.
3.  Verify compatibility with Expo SDK 58.
4.  Prefer packages compatible with the existing architecture.
5.  Avoid adding large dependencies for small features.

For Expo-compatible native dependencies, prefer:

`npx expo install package-name`

Do not blindly use `npm install` for native packages without checking compatibility.

### Important rules

- Do not upgrade Expo SDK or React Native without an explicit requirement.
- Do not randomly change package versions.
- Do not modify native configuration without understanding its impact.
- Do not remove existing dependencies simply because they appear unused without checking their purpose.
- Preserve the existing lockfile and package manager conventions.
- Do not create a second lockfile for another package manager.
- Do not modify `app.json` or native configuration unnecessarily.

---

## 13\. Commands and Verification

The existing project scripts include:

```
npx expo start              # dev server (at uni WiFi: npx expo start --tunnel)
npx expo start --web
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # dependency and config issues
npx expo install <package>  # always instead of npm install for Expo/native packages
npx expo install --fix      # fix incompatible versions
```

For Expo APIs, read the versioned docs (`https://docs.expo.dev/versions/v58.0.0/`) and `https://docs.expo.dev/llms.txt`, which lists common LLM misconceptions about Expo.

Before considering a change complete:

1.  Run the relevant lint checks.
2.  Check TypeScript errors where possible.
3.  Test the affected screen or feature.
4.  Verify navigation and interaction behavior.
5.  Check loading, empty, and error states.
6.  Check light and dark appearances when UI is affected.
7.  Verify that existing functionality has not been unintentionally broken.

Do not claim that a test passed if it was not actually executed.

If a command cannot run because of missing dependencies, environment limitations, or unavailable credentials, report that clearly.

---

## 14\. Git and Change Management

- Keep changes focused on the requested task.
- Avoid unrelated refactoring.
- Do not overwrite user changes.
- Do not reset, force-push, or delete branches without explicit authorization.
- Do not commit secrets, generated credentials, or private user data.
- Use clear commit messages.
- Review the final diff before committing.
- Do not claim a change has been committed or pushed unless the operation actually succeeded.

For documentation-only changes, avoid modifying application code unless required.

---

## 15\. Instructions for AI Coding Agents

When working on Karriera, follow this workflow:

### Before making changes

1.  Read this `AGENTS.md`.
2.  Inspect the relevant existing implementation.
3.  Check `package.json` and the installed dependency versions.
4.  Inspect `design/karriera-ui.html` before making significant UI changes.
5.  Understand the existing patterns before introducing new ones.
6.  Identify the smallest reasonable implementation that solves the task.

### While implementing

- Prefer existing components and utilities.
- Keep the implementation aligned with the product's design language.
- Use TypeScript.
- Respect Expo SDK 58 compatibility.
- Keep backend authorization secure.
- Avoid unnecessary dependencies.
- Do not introduce placeholder functionality that looks complete but does not work.
- Do not invent backend fields, API responses, or database tables without verifying the existing schema.
- Ask for clarification when a requirement is genuinely ambiguous and making an assumption could cause significant rework.

### After implementing

1.  Review the modified files.
2.  Run relevant checks.
3.  Fix issues introduced by the change.
4.  Summarize what was changed.
5.  Mention any remaining limitations or unverified behavior.
6.  Do not claim successful testing, deployment, or Git operations without evidence.

### Decision-making priority

When instructions or implementation choices conflict, prioritize:

1.  Explicit user requirements for the current task.
2.  Security and data integrity.
3.  Existing application architecture and conventions.
4.  This `AGENTS.md`.
5.  Official documentation for the installed technology versions.
6.  General coding preferences.

---

## 16\. Final Principle

**Build Karriera as a real career-development product, not just an attractive mobile UI.**

Every screen, interaction, AI feature, and backend operation should contribute to a consistent, secure, accessible, and genuinely useful experience for people preparing to enter the job market.

Prioritize product quality, maintainability, and user trust over unnecessary complexity.
