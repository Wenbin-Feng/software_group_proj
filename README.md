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

1. **Overview:** enter a course, resume a session, open shared materials, or explore the course community.
2. **Learning studio:** ask about selected course and personal materials, follow document/page references, and save an explanation to your wiki.
3. **Interactive explanations:** step through concurrent requests competing for one item; compare results with and without a lock. The second course includes a browser request-cycle animation. Playback, pause, step, restart, and stage selection work.
4. **Course materials:** upload PDF, Markdown or text files up to 10 MB. Text is extracted locally; uploaded originals can be previewed and downloaded. Student uploads belong to that student; teacher uploads join the shared course library.
5. **My wiki:** create and edit Markdown knowledge pages, follow `[[internal links]]`, explore backlinks and a small knowledge graph, and revisit saved animations.
6. **Wiki market:** select a page or topic collection, publish a versioned snapshot, browse/search/filter publications, save or appreciate them, and import an editable copy. Multi-page collections keep their internal links after import.
7. **Instructor view:** use the profile switcher at the bottom left, or the view control at the top, to choose Richard Lui. Explore course activity, filter students, review all course sessions in read-only mode, and open student files. Switch to another student to inspect their separate workspace.

### Suggested five-minute demo

- Open **Learning studio** and the “Why does the last item sell twice?” session.
- Step through the animation without a lock, then enable **Protect with a lock** and compare the outcome.
- Ask “How does a database lock prevent a race condition?”, open a cited source, and select **Save to Wiki**.
- Open **My wiki**, edit a page, follow a connected concept, and publish two linked pages as a topic collection.
- Switch to another student, find the collection in **Wiki market**, and import it. Its pages are independent copies with working internal links.
- Switch to the instructor to review student sessions and attachments.

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
  App.jsx                 Workspace shell, overview, role/course switcher and search
  context.jsx             Shared application state
  data.js                 Original example courses and learning content
  components/
    Studio.jsx            Source-grounded learning conversation demo
    Animation.jsx         Interactive concurrency and browser explanations
    Materials.jsx         Shared and personal files, upload workflow
    Teacher.jsx           Course activity and read-only session review
    Wiki.jsx              Markdown notes, links, graph and publishing
    Market.jsx            Published collections and independent imports
    ui.jsx                Shared accessible dialog and avatar
  lib/
    files.js              File validation and text extraction
    originals.js          IndexedDB original-file storage
```

## Validation

The first prototype was built and exercised on 15 October 2026:

- Production build passed.
- Real five-page PDF uploaded, extracted, persisted, opened as original PDF and downloaded; text references remained readable.
- Student workspace isolation, instructor read-only access and student file visibility were exercised through the UI.
- Animation results differed correctly: two accepted orders without a lock, one accepted order with a lock.
- Session-to-wiki save, versioned two-page publication, bookmark, cross-student import and remapped internal links were exercised.
- Overview, studio, materials, wiki and market were checked at 375, 768, 1024 and 1440 CSS pixels with no horizontal overflow or runtime errors during the checks.

Visual and interaction decisions are documented in [DESIGN.md](DESIGN.md). Screenshots live in `docs/screenshots/`.
