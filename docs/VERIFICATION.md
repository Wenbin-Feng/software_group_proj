# Verification record

Date: 2026-10-16, Asia/Shanghai.

## Current local integration result

The complete application was integrated into the fresh clone on the independent `dev/WangJiahe` history. The source backup remains in the original prototype folder. No branch has been pushed, no deployment has occurred, and no GitHub-hosted Actions run has been executed.

The local runtime is Node **24.19.0** and pnpm **11.25.0**. Locked installation, formatting, domain tests, TypeScript/Vite production build, and screenshot checks passed. The suite has **10 tests**, and the gallery has **35 PNG screenshots**. PDF.js is pinned to **6.4.299**, with a local worker asset in the production build. PDF and other vendor code are placed in separate chunks; the final build has no chunk-size warning.

## Reproduced integration issues and fixes

1. The interrupted PDF dependency installation left `pdfjs-dist` unresolved. The initial new-clone build failed with TS2307. Installing the public-registry dependency and committing its lockfile resolved the import.
2. TypeScript also identified a nullable page container captured by a hoisted async function. Using an async arrow after the null guard preserved narrowing; the subsequent TypeScript build passed.
3. Screenshot checks initially failed because they still referenced the old `output/screenshots` location. The new clone keeps one canonical `images/` directory. The checker now validates both READMEs, PNG signatures and dimensions, the catalog, and the offline gallery.
4. The previous browser-native PDF iframe could appear blank. PDF.js now paints each page to its own canvas and cancels/disposes previous tasks. A stable scrollbar gutter prevents resize/render feedback on Windows. Real page content was visually inspected before adding capture 29.

## Automated checks

All commands below completed successfully in the new clone:

```sh
pnpm install --frozen-lockfile
pnpm run format:check
pnpm test
pnpm build
pnpm run docs:check
```

The Vitest suite exercises publication immutability, independent attributed copies, case-insensitive title collisions, actual Wiki links, owner-scoped rename propagation, invitation codes, malformed saved-data recovery, prepared AI boundaries, broken saved references, duplicate IDs, and invalid note dates.

Formatting covers application code, scripts, documentation, gallery HTML and supported configuration files. Dependency directories, build output, lockfile formatting, and local scratch files are excluded as appropriate.

## Browser checks against the integrated source

The development application ran at `http://127.0.0.1:5173/`. The supplied five-page PDF was reselected through the visible recovery control. Its actual first and second pages rendered, Previous was disabled on the first page, and a reload followed by reselection restored the preview. The first page was captured as `images/29-uploaded-pdf-preview.png`.

The built application ran separately through `pnpm preview` at `http://127.0.0.1:4173/`, starting with a fresh browser-local workspace. Verified:

- Alex's explicitly simulated Google sign-in and classroom document reading.
- A prepared Waterfall/Agile answer, source attribution and the Demo AI label.
- Opening the actual HTML animation, advancing from step 1 to step 2, and resetting it.
- Saving that explanation to the personal Wiki, reloading, and retaining the seventh note.
- The derived graph showing 7 ideas and 15 links.
- At a 390 px phone viewport, graph content measured 375 px with no page-wide horizontal overflow.
- Community Market displaying its 6 seeded entries.
- Switching to the instructor, uploading the supplied PDF, and rendering pages 1 and 2 through the built worker asset.
- Switching to the administrator and opening People & roles, with the current administrator's own role disabled.
- The production browser console had no error or warning entries when checked after PDF rendering.

![Verified local PDF preview](../images/29-uploaded-pdf-preview.png)

## Independent review

A fresh read-only reviewer inspected the integrated source, package/lockfile compatibility, PDF lifecycle, image paths, and orphan history. It reran the domain suite, format check and screenshot check. No material delivery defect remained. A separate PDF review checked task destruction, render cancellation, independent canvases, observer cleanup and file URL lifetime.

## Earlier walkthrough and limitations

The initial 2026-10-15 walkthrough also covered invalid class codes, joining as Jamie, note editing, missing-link creation, rename propagation, publication snapshots, copying with attribution, bookmarks, and local role changes. Domain tests cover the important data invariants. The first screenshot set contained 13 images; the expanded set now contains 35.

The earlier iframe check verified metadata and reselection behavior, but did not establish reliable PDF page rendering. The canvas checks above replace that incomplete evidence. No external usability study or full accessibility certification is claimed.

Sign-in, AI and account roles remain frontend demonstrations. There is no backend, live LLM, real OAuth, server-side access enforcement, payment flow, or cross-device synchronization. Binary bytes remain session-only; new uploads receive an honest prepared-AI fallback.

## Branch and CI boundary

The application is saved locally on `dev/WangJiahe`, descended from its own empty root commit. It does not inherit or merge `main` or `dev/wenbin`; the assignment PDF and main rule files are not copied into this branch.

CI configuration is kept on the separate `feature/wangjiahe-prototype-ci` branch. Local command results above do not constitute a GitHub-hosted Linux/Node 22 run. That execution remains pending a later authorized push. CI is limited to checking, building, and archiving artifacts, with no deployment.
