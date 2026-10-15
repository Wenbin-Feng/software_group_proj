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
5. **My wiki:** browse your personal notes from all courses in a three-column card library. Each card opens one note in an Obsidian-inspired workspace with a course/folder tree, note tabs, Markdown editing, outline, outgoing links and backlinks. A local graph and an expandable full graph use actual `[[wiki links]]`; select nodes to open notes, zoom, pan or use the keyboard-accessible note list. Course workspaces keep `LLM_wiki/` limited to the current course.
6. **Wiki market:** browse versioned course publications, save them, and import independently editable copies with remapped internal links. Publications can contain one note or several pages from the same course. The market has a course selector; the personal library defaults to all courses with an optional filter.
7. **Instructor view:** switch to Richard Lui (Software Engineering) or Emily Chan (Web Application Development). Teachers have **Courses / Inbox** navigation. Each teaching space contains **Overview / Materials / Students / Wiki market**. Statistics come from actual local records and the course roster, including learners with no activity. Student detail exposes sessions, uploaded files and published Wiki snapshots. Session review is read-only and preserves the original list/search on return; private Wiki notes are unavailable to teachers.
8. **Inbox:** students can message their course teacher from Inbox or **Ask teacher** inside a course, optionally linking an own session. Teachers reply from a unified private inbox. Both sides have unread indicators; teachers can resolve threads and a student follow-up reopens them. Messages are text-only and stay in this browser.
9. **Course library:** teachers can upload, preview, download, rename, archive and restore public materials. Archived documents leave new learning source lists while their original files and historical citations remain readable. Teachers can feature published Wiki snapshots; students see these under **Teacher picks**.

### Suggested five-minute demo

- Open **Courses**, choose **Software Engineering**, and inspect the three file folders.
- Open a course document and a personal file; switch their right-side tabs.
- Select **Visualize** under the existing explanation. The animation opens in its own tab while the document stays open.
- Compare inventory with and without a lock. Ask a follow-up, save its explanation to Wiki, and find the new page in `LLM_wiki/`.
- Open **My wiki** to see notes from both courses. Choose a card, follow its links, inspect backlinks and open the full graph from the left ribbon.
- Edit a note with `[[Note title|label]]`, save, and watch the graph and connections update. Publish a page or a connected collection to its course market.
- Send a question with **Ask teacher**, switch to its course instructor, reply in Inbox and mark it resolved. Switch back to the student and follow up to reopen it.
- In teacher mode, open **Students**, search a learner and review a session; return to the same student and search. Manage course documents and feature a published Wiki in the course market.

## Prototype boundaries

- **No live LLM is connected.** The tutor performs local keyword retrieval and uses prepared teaching explanations for supported concepts. Other questions return matching source excerpts or a clear no-match response. “Demo responses” is visible in the studio.
- **Animations are authored interactive HTML/React scenes.** The prototype demonstrates where an AI-generated explanation would appear; it does not generate arbitrary HTML from a model.
- **Identity and permissions are demonstrated in the UI.** Course ownership, enrollment, private messages and teacher read-only boundaries are checked in client logic, including actions and direct links. The role switcher is not authentication. All example users share one browser-local data store. A production system needs authenticated server-side membership, authorization, and storage.
- **Browser-local persistence:** workspace records are in `localStorage` (`folio-workspace-v1`); uploaded original files are in IndexedDB (`folio-original-files`). There is no multi-device or multi-user synchronization. Clearing browser site data removes the workspace and uploads.
- **Inbox is a local interaction demo:** switching identities in the same browser lets you demonstrate sending and replying; it does not deliver messages to another person's device or email. The selected demo identity persists across refreshes. Older workspace records are migrated without resetting existing materials, sessions, notes or stored originals.
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
    Teacher.jsx           Teaching courses, overview, materials and students
    Inbox.jsx             Private course threads, replies and unread status
    WikiLibrary.jsx       All-course personal note cards and filters
    Wiki.jsx              Obsidian-inspired note workspace and publishing
    WikiGraph.jsx         Interactive local/full graph from actual links
    Market.jsx            Published collections and independent imports
    ui.jsx                Shared accessible dialog and avatar
  lib/
    files.js              File validation and text extraction
    originals.js          IndexedDB original-file storage
    navigation.js         Course-aware routing and legacy link handling
    wikiLinks.js          Wiki link parsing, resolution, forward/backlinks
    access.js             Course membership and identity permission checks
    workspaceData.js      Compatible local-data migration and demo teachers
    inbox.js              Authorized message and read-state transitions
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
- All-course wiki cards, course-scoped classroom notes, cross-course aliases/backlinks, live graph updates, graph keyboard navigation/zoom, note creation/editing, scoped publishing, private-note filtering and phone panel switching were exercised in the revised wiki.
- Teacher course ownership, roster filtering, private Wiki exclusion, Inbox send/reply/resolve/follow-up/unread flows, cross-identity denials, read-only session return navigation, real PDF upload/rename, archive/historical citation/restore, and teacher Wiki picks were exercised in the UI.

Run `npm run check` for persistent domain assertions covering identity boundaries, membership, compatible migration, Inbox transitions and route round-trips. UI and responsive verification covers 375, 768, 1024 and 1440 pixel widths.

Visual and interaction decisions are documented in [DESIGN.md](DESIGN.md). Screenshots live in `docs/screenshots/`.
