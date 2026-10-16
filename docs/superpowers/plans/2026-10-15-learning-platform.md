# Luma Learning Platform Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Track verified outcomes below.

**Goal:** Deliver a polished English frontend prototype and screenshots of its running learning journey.

**Architecture:** A React single-page application with feature pages, a shared shell, and a typed local demo store. Pure domain functions own note identity, publication snapshots, course joining, source-aware prepared answers, and state recovery. UI actions use those functions; no external services or credentials.

**Tech Stack:** React, TypeScript, Vite, React Router, Lucide icons, React Markdown, Vitest, Playwright.

**Spec:** ../specs/2026-10-15-learning-platform-design.md (approved by user instruction to start on 2026-10-15).

## Global Constraints

- English interface and English seeded content throughout.
- Main presentation target: 1440 x 900.
- No backend, external AI calls, real OAuth, shared database, or real-time multi-user features in this iteration. No secrets in frontend code.
- Screenshots must be captured from the running application and delivered as PNG files suitable for presentation slides.
- Upload to GitHub only after the user supplies the destination.

## Review Focus

- Invalid or incompatible saved browser data: show a recoverable reset state rather than crash.
- Duplicate, blank, renamed, and deleted Wiki titles: no ambiguous identity or accidental cross-user editing.
- Newly uploaded files after reload: explain session-only previews and allow reselection.
- Published note edited privately: snapshot remains unchanged until republishing.
- Changing identity while viewing private content: resolve to the new identity's own records.

## File responsibilities

- `src/data/seed.ts`: consistent English courses, people, materials, notes and Market entries.
- `src/lib/domain.ts`, `src/lib/domain.test.ts`: types and independently testable state transformations.
- `src/lib/store.tsx`: local persistence, application actions, preview URL lifecycle, notices.
- `src/components/`: shell, accessible dialogs, shared cards, Markdown, animation, graph, assistant.
- `src/pages/`: login, classes, course workspace, Wiki, Market, management.
- `src/styles.css`: shared design tokens, page layout, responsive behavior.
- `scripts/browser-check.mjs`: browser journey validation and screenshot capture.
- `README.md`, `docs/DEMO.md`, `images/`: startup, demonstration and deliverables.

### Task 1: Typed demo state and reliable domain operations

**Files:** package/configuration, `src/data/seed.ts`, `src/lib/domain.ts`, `src/lib/domain.test.ts`.

**Interfaces:** Export `DemoState`, `Note`, `Material`, `Course`, `User`, `Publication`; functions `uniqueTitle`, `publishNote`, `copyPublication`, `wikiLinks`, `renameNote`, `joinCourse`, `restoreState`, `answerQuestion`.

- [x] Write tests for publication snapshots, attributed copies, title collision handling, case-insensitive link resolution, scoped rename, invalid join codes, unknown AI prompts, uploaded-file AI limitations, and corrupt state recovery.
- [x] Run `pnpm test`; expected initial missing-domain failure, then implement pure domain functions and coherent seed data.
- [x] Run `pnpm test`; expected all assertions passing.

### Task 2: Application shell, identity and classroom materials

**Files:** `src/lib/store.tsx`, `src/App.tsx`, `src/main.tsx`, `src/components/Shell.tsx`, `src/components/UI.tsx`, `src/pages/Login.tsx`, `src/pages/Classes.tsx`, `src/pages/Course.tsx`, `src/styles.css`.

**Interfaces:** `useApp()` exposes current user, state, session file URLs, update actions, notices and reset. Hash routes map to page components and preserve direct navigation without host rewrites.

- [x] Implement English demo sign-in, identity switcher, responsive navigation and persistent state with explicit recovery.
- [x] Implement course joining, class tabs, material search, upload/reselection, preview, removal confirmation and roster access.
- [x] Run type/build checks; expected successful build. Verify actual browser login and join/preview flow.

### Task 3: Contextual assistant and working animation

**Files:** `src/components/Assistant.tsx`, `src/components/LifecycleAnimation.tsx`, `src/pages/Course.tsx`.

**Interfaces:** `Assistant({material, course})` uses `answerQuestion`; source buttons open document sections; save-to-Wiki creates a user-owned note. Animation has controlled play, pause, step and reset.

- [x] Implement prepared context-bound answers with simulated streaming, visible Demo AI indicator, source actions and honest fallbacks.
- [x] Implement Waterfall/Agile animation and note-saving transition.
- [x] Verify browser controls advance/pause/reset and explanation becomes an editable Wiki note.

### Task 4: Personal Wiki and derived graph

**Files:** `src/pages/Wiki.tsx`, `src/components/Markdown.tsx`, `src/components/KnowledgeGraph.tsx`.

**Interfaces:** Markdown callbacks resolve [[titles]] against current user's notes; graph derives edges with `wikiLinks`. Rename uses `renameNote` and preserves links within the owner scope.

- [x] Implement unique-title note creation, editing/preview, search, backlinks, missing-target creation, deletion confirmation, explicit AI suggestion apply, and note publishing.
- [x] Implement clickable graph with a list alternative for keyboard use.
- [x] Verify browser persistence, rename/link navigation, deletion and user switching.

### Task 5: Market and management

**Files:** `src/pages/Market.tsx`, `src/pages/Management.tsx`, shared store actions.

**Interfaces:** Market consumes immutable snapshots via `publishNote` and attributed user-owned copies via `copyPublication`; management changes local state with role-aware controls.

- [x] Implement search, tags, bookmarks, publication detail, copying, explicit republish/unpublish.
- [x] Implement instructor material/member controls and admin demo role management.
- [x] Run domain suite and browser journey; expected immutable snapshots and correct per-user actions.

### Task 6: Verification, screenshots and handoff

**Files:** `scripts/browser-check.mjs`, `README.md`, `docs/DEMO.md`, `images/README.md`.

- [x] Run production build and full unit suite, inspect output, fix material issues.
- [x] Run browser journey on local app: join, ask, animate, save, edit/link, publish, switch student, copy, reload, upload/reselect, manage and reset.
- [x] Inspect and capture consistent desktop PNGs and a narrow layout; require no page errors and no horizontal overflow.
- [x] Document one-command startup, demo codes, role identities, simulated boundaries and screenshot index.
- [x] Prepare local Git repository and ignore generated files; do not set invented human author identity or push.

## Execution record

- User authorized starting development and asked to use the existing local VS Code workspace. Execute inline and preserve this folder; no worktree needed for a fresh project.
- Plan reviewed against the approved spec; all modules consume the same domain IDs and types.
- Git author identity is not configured. Prepare repository without inventing identity; defer commits until an author is available.

## Final outcomes

- Tasks 1–6: complete. Final checks: 10/10 unit tests; TypeScript, Vite build and Prettier all pass.
- Read-only independent review found two material issues; both reproduced and fixed. Duplicate/blank rename browser regression passed; invalid reference/duplicate ID/date restoration tests went from failing to passing.
- Ruling: keep the user-requested VS Code folder rather than create a worktree — this is a fresh local project, and all changes remain visible where requested.
- Ruling: use connected browser verification and record its actual journey instead of maintaining a second browser runner — avoids duplicate tooling; the result is recorded in docs/VERIFICATION.md and images/browser-checks.json.
- Ruling: prepare Git without inventing an author identity or remote — commits and upload wait for user-provided GitHub details.
- Deferred minors: none identified by the independent reviewer beyond greeting/sidebar wording, which were corrected.
- Screenshots: 13 PNGs in images; index and ZIP provided.
