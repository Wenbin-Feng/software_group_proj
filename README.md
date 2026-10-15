# Folio

**Make it make sense.** A course companion that turns materials into conversations, visual explanations, and connected knowledge.

Wenbin’s independent first-stage prototype, built in React on `dev/wenbin`. This branch started from an empty orphan commit and has no shared history or files with `main`.

## Run locally

Use Node.js 22.12 or later and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite, normally <http://127.0.0.1:5173>.

```bash
npm run build
npm run preview
```

The production preview normally runs at <http://127.0.0.1:4173>. The built `dist/` directory is a static site; no API keys or environment variables are required.

## Explore the prototype

1. **Courses:** browse your courses as cards, search by name/code/instructor, then open a course.
2. **Course workspace:** a full-height three-column learning environment. The left file tree contains `course_material/`, `personal_material/`, and `LLM_wiki/`; the middle is your conversation; the right is a tabbed reader for documents, wiki pages, and HTML animations.
3. **Documents and animations:** clicking a file opens or reuses its tab. Cited sources jump to the relevant page. Animations open in additional tabs, leaving your documents available. Tabs can be closed, switched with the keyboard, and retain their individual page state.
4. **Uploads:** the file-tree plus button accepts PDF, Markdown and text files up to 10 MB. Student uploads go to personal materials; instructor uploads go to shared course materials. Original PDFs and extracted text can be read and downloaded from the right panel.
5. **My wiki:** edit connected Markdown pages in the reader or use the full wiki view to explore backlinks, publish a page or a topic collection, and manage notes.
6. **Wiki market:** browse versioned publications, save them, and import independently editable copies with remapped internal links. My wiki and Wiki market have an explicit course selector.
7. **Instructor view:** switch role from the top bar, select a course, then use **Students** to review activity. Open a student session in the same workspace, with that student's files and wiki in read-only mode.

### Suggested five-minute demo

- Open **Courses**, choose **Software Engineering**, and inspect the three file folders.
- Open a course document and a personal file; switch their right-side tabs.
- Select **Visualize** under the existing explanation. The animation opens in its own tab while the document stays open.
- Compare inventory with and without a lock. Ask a follow-up, save its explanation to Wiki, and find the new page in `LLM_wiki/`.
- Open a Wiki page, follow its internal links in additional reader tabs, or use **My wiki** to publish a topic collection.
- Switch to another student to explore the course market, then to the instructor to review student sessions.

## Prototype boundaries

- **No live LLM is connected.** The tutor performs local keyword retrieval and uses prepared teaching explanations for supported concepts. Other questions return matching source excerpts or a clear no-match response. “Demo responses” is visible in the studio.
- **Animations are authored interactive HTML/React scenes.** The prototype demonstrates where an AI-generated explanation would appear; it does not generate arbitrary HTML from a model.
- **Identity and permissions are demonstrated in the UI.** The role switcher is not authentication. All example users share one browser-local data store. A production system needs authenticated server-side membership, authorization, and storage.
- **Browser-local persistence:** workspace records are in `localStorage` (`folio-workspace-v1`); uploaded original files are in IndexedDB (`folio-original-files`). There is no multi-device or multi-user synchronization. Clearing browser site data removes the workspace and uploads.
- **PDF extraction is text-based:** scanned/image-only PDFs need OCR elsewhere. Empty, oversized, encrypted, unsupported, and unreadable files show errors. Seed course documents are original sample text, rather than uploaded copies of actual lecture slides.
- **Wiki behavior is Obsidian-inspired:** Markdown pages, internal links, backlinks, folders and source references. Native Obsidian plugin compatibility, vault synchronization and automatic LLM maintenance are not implemented.
- **Market publications are snapshots:** later private edits do not silently update published content. A new publication creates a new version. Only selected content is shared; private attachment and session metadata are excluded from publication records.
- Student numbers, the other student identities, course codes and lecture content are example data. Wenbin is the prototype owner. Instructor names are demo labels rather than connected accounts.

## Implementation

- React + Vite, plain CSS, Lucide icons, locally bundled DM Sans and Instrument Serif fonts.
- PDF.js for browser-local PDF text extraction; IndexedDB for original files.
- Hash navigation supports direct links to sessions and wiki notes.
- Responsive layouts, visible keyboard focus, modal focus containment, reduced-motion styles, and labelled interactive controls.

```text
src/
  App.jsx                 Course-first shell, role switcher, routing and search
  context.jsx             Shared application state
  data.js                 Original example courses and learning content
  components/
    Courses.jsx           Course card grid, search and filters
    CourseWorkspace.jsx   File tree, conversation and preview tabs
    WorkspacePreview.jsx  PDF, Markdown, wiki and animation readers
    Studio.jsx            Embedded learning conversation demo
    Animation.jsx         Interactive concurrency and browser explanations
    Teacher.jsx           Course activity and read-only session review
    Wiki.jsx              Markdown notes, links, graph and publishing
    Market.jsx            Published collections and independent imports
    ui.jsx                Shared accessible dialog and avatar
  lib/
    files.js              File validation and text extraction
    originals.js          IndexedDB original-file storage
    navigation.js         Course-aware routing and legacy link handling
```

## Validation

The first prototype was built and exercised on 15 October 2026:

- Production build passed.
- Real five-page PDF uploaded, extracted, persisted, opened as original PDF and downloaded; text references remained readable.
- Student workspace isolation, instructor read-only access and student file visibility were exercised through the UI.
- Animation results differed correctly: two accepted orders without a lock, one accepted order with a lock.
- Session-to-wiki save, versioned two-page publication, bookmark, cross-student import and remapped internal links were exercised.
- Course-aware routing and legacy session links were checked; the revised course grid and workspace are validated at phone, tablet and desktop widths.
- File and animation tabs, source page navigation, uploads, wiki links and instructor read-only access were exercised in the revised workspace.

Visual and interaction decisions are documented in [DESIGN.md](DESIGN.md). Screenshots live in `docs/screenshots/`.
