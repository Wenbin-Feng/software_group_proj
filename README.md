# Luma · Your learning, connected

**Owner: WANG Jiahe (`WangJiahe-polyu`) · Independent prototype branch: `dev/WangJiahe`.**

An English-language, frontend-only learning platform prototype. The demo connects classroom materials, a prepared AI study partner, interactive explanations, a personal Wiki, and community note sharing.

## 本机启动

在 VS Code 中打开本文件夹，打开 PowerShell 终端，运行：

```powershell
.\start-demo.ps1
```

浏览器访问 **http://127.0.0.1:5173/**。保持服务终端运行；停止时按 `Ctrl+C`。本机已安装依赖，启动脚本可以使用 Codex 自带的 Node.js。

首次在其他电脑运行，需要 Node.js 22.13 或更高版本和 pnpm 11.25.0：

```sh
pnpm install
pnpm dev
```

If PowerShell does not allow local script execution, use a terminal with Node.js available and run `node node_modules/vite/bin/vite.js --host 127.0.0.1`. No system policy changes are necessary.

## Demo identities

Choose an identity on the sign-in screen, then click **Continue with Google · Demo**. Switch identities through the avatar in the top bar.

| Identity         | Role          | Best way to explore                          |
| ---------------- | ------------- | -------------------------------------------- |
| Alex Morgan      | Student       | Three classes and a connected starter Wiki   |
| Jamie Chen       | Student       | Join another class and copy a community note |
| Dr. Sarah Wilson | Instructor    | Upload materials and manage class members    |
| Taylor Brooks    | Administrator | Inspect accounts and change demo roles       |

Class invitation codes: **SE2026**, **AI2026**, **DESIGN26**. See [the presentation walkthrough](docs/DEMO.md).

## What works

- Classroom browsing, code-based joining, material filtering, text/Markdown reading, PDF session preview, download, instructor upload/removal, and membership management.
- Contextual prepared AI explanations, source navigation, and saving explanations to the personal Wiki.
- Waterfall vs Agile animation with play, pause, next-step, and reset controls.
- Markdown note creation/editing, tags, search, unique titles, `[[Note Title]]` links, backlinks, linked-note creation, rename propagation, and an actual relationship graph.
- Community publication snapshots, explicit publication updates, unpublishing, search/tag filtering, bookmarks, and attributed independent copies.
- Local account roles, keyboard-friendly dialogs, narrow-screen navigation, persistent text data, and reset/recovery flows.

## Deliberate prototype boundaries

Google sign-in and AI are explicitly labeled simulations. There is no real OAuth, LLM request, file retrieval pipeline, backend, payment system, or cross-device synchronization. Unknown questions and newly uploaded files receive an honest demo fallback.

Small text records live in localStorage under `luma.demo.v1`. Binary file bytes are not persisted: a reload retains metadata and asks the user to reselect the original file. Markdown/text uploads retain their text. Treat this as a classroom demonstration, not storage for important or sensitive documents.

Use **Reset demo data** in the sidebar to restore sample content. This removes local demo edits and returns to sign-in. If saved data is malformed, the app offers an explicit sample-workspace recovery action.

## Code map

```text
src/
  data/seed.ts                English sample content
  lib/domain.ts               Types and pure knowledge-sharing operations
  lib/domain.test.ts          Ownership, snapshots, validation and recovery tests
  lib/store.tsx               Persistence, notices, identity and session files
  components/                Shell, dialogs, Markdown, assistant, animation, graph
  pages/                     Classes, reader, Wiki, Market and management
  styles/                    Feature styles and responsive overrides
docs/                        Design, plan, walkthrough and verification record
images/          Screenshots of the running app
```

Use small domain helpers for state transformations. Keep new feature behavior in its page/component and place its styles in the matching stylesheet. Frontend role controls illustrate intended behavior; they are not security enforcement.

## Checks and production build

```sh
pnpm test
pnpm run format:check
pnpm build
pnpm preview
```

The build output is `dist/`. Hash routing allows static hosting without server rewrite rules. No external fonts or remote image assets are required at runtime.

Browser verification was performed through the connected browser against the actual local app; [the verification record](docs/VERIFICATION.md) lists the exercised flows. [Screenshot index](images/README.md) maps images to presentation points.

## Branches and delivery

This prototype has its own orphan history on `dev/WangJiahe`. It does not inherit or merge `main` or Wenbin’s prototype. The reference branch was used to compare documentation and screenshot coverage; Luma retains its own implementation and scope.

The application is committed locally on `dev/WangJiahe`. CI configuration is maintained separately on `feature/wangjiahe-prototype-ci`: it checks formatting, tests, build and screenshot links, then archives the static build and screenshots. No branch has been pushed, and no GitHub-hosted CI run or deployment has been completed. The workflow and its usage guide are present on the feature branch.

## Development record and contribution

Wang Jiahe defined the product flow and prototype constraints, selected an English interface, requested actual presentation screenshots, and emphasized readable source code. Codex assisted with implementation, domain tests, browser verification and documentation. The source and prepared content were reviewed; the verification record documents defects found and fixed. No stakeholder interview or external usability study has been claimed.

The initial delivery contained 13 screenshots. This gallery expands coverage to **35 actual running-app screenshots**, including dialogs, validation, teacher controls and phone layouts. PDF.js now renders uploaded PDFs locally; page navigation and reload/reselection recovery were verified against the supplied five-page PDF.

## Prototype screenshots

Click any image to open its full resolution. Screenshots are embedded with repository-relative paths so they render on this branch in GitHub. Desktop images use a 1440 × 900 viewport with full-page capture; mobile images use 390 × 844. AI and sign-in remain explicitly simulated.

### Identity and workspace

| Demo Google sign-in                           | Student learning workspace                              |
| --------------------------------------------- | ------------------------------------------------------- |
| ![Demo Google sign-in](images/01-sign-in.png) | ![Student learning workspace](images/02-my-classes.png) |

| Switching perspectives                                   | Join by invitation code                              |
| -------------------------------------------------------- | ---------------------------------------------------- |
| ![Switching perspectives](images/14-demo-identities.png) | ![Join by invitation code](images/15-join-class.png) |

| Invalid class-code feedback                                   | Search across the workspace                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| ![Invalid class-code feedback](images/16-join-validation.png) | ![Search across the workspace](images/17-workspace-search.png) |

### Classroom and files

| Shared classroom materials                                       | Student view of the class roster                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| ![Shared classroom materials](images/03-classroom-materials.png) | ![Student view of the class roster](images/18-classroom-members.png) |

| Course topics and context                                   | Instructor materials workspace                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| ![Course topics and context](images/19-classroom-about.png) | ![Instructor materials workspace](images/25-instructor-materials.png) |

| Upload and categorize a file                                          | Instructor roster management                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| ![Upload and categorize a file](images/26-upload-material-dialog.png) | ![Instructor roster management](images/27-instructor-roster.png) |

| Session-file recovery                                            | Canvas-rendered PDF preview                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| ![Session-file recovery](images/28-file-preview-reselection.png) | ![Canvas-rendered PDF preview](images/29-uploaded-pdf-preview.png) |

### AI explanations

| Document-aware study conversation                                  | Waterfall and Agile animation                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| ![Document-aware study conversation](images/04-ai-material-qa.png) | ![Waterfall and Agile animation](images/05-interactive-animation.png) |

**Honest AI scope fallback**

![Honest AI scope fallback](images/35-ai-demo-boundary.png)

### Personal Wiki

| Personal note and connections                                 | Markdown editing                               |
| ------------------------------------------------------------- | ---------------------------------------------- |
| ![Personal note and connections](images/06-personal-wiki.png) | ![Markdown editing](images/07-wiki-editor.png) |

| Actual Wiki relationship graph                                   | Review a prepared Wiki suggestion                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| ![Actual Wiki relationship graph](images/08-knowledge-graph.png) | ![Review a prepared Wiki suggestion](images/20-wiki-ai-suggestion.png) |

| Create a personal note                                 | Duplicate-title validation                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| ![Create a personal note](images/21-new-wiki-note.png) | ![Duplicate-title validation](images/22-wiki-title-validation.png) |

### Wiki Market

| Community note discovery                               | Publication preview and attribution                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| ![Community note discovery](images/09-wiki-market.png) | ![Publication preview and attribution](images/10-community-note.png) |

| Saved community ideas                                    | Published personal snapshots                                   |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| ![Saved community ideas](images/23-bookmarked-notes.png) | ![Published personal snapshots](images/24-my-publications.png) |

### Management

| Instructor class overview                                         | Administrator account roles                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| ![Instructor class overview](images/11-instructor-management.png) | ![Administrator account roles](images/12-people-and-roles.png) |

### Responsive layouts

| Market on a phone                                 | Classrooms on a phone                                     |
| ------------------------------------------------- | --------------------------------------------------------- |
| ![Market on a phone](images/13-mobile-market.png) | ![Classrooms on a phone](images/30-mobile-classrooms.png) |

| Reading and AI on a phone                                      | Personal Wiki on a phone                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| ![Reading and AI on a phone](images/31-mobile-material-ai.png) | ![Personal Wiki on a phone](images/32-mobile-personal-wiki.png) |

| Knowledge graph on a phone                                          | Instructor files on a phone                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ![Knowledge graph on a phone](images/33-mobile-knowledge-graph.png) | ![Instructor files on a phone](images/34-mobile-instructor-materials.png) |

For image descriptions and individual full-size previews, see the [complete screenshot index](images/README.md).
