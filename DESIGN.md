# Folio design notes

## Direction

A minimal glass workspace with a consistent sans-serif type system and clear application navigation. The work is guided by the installed `ui-ux-pro-max` skill and its Swiss Modernism guidance for knowledge workspaces. Its initial playful education match was rejected because it targeted a younger audience.

The application balances warm paper-like learning moments with a precise, functional interface. Course cards use original SVG subject artwork; graphs, publication covers and interactive scenes are code-native visuals.

## Tokens

| Role | Choice |
| --- | --- |
| Primary action | Cobalt `#3156d3` |
| Main ink | Navy `#202d44` |
| Canvas | Cool mist with blue, lavender and sage ambient gradients |
| Navigation | Cool off-white `#f9fafc` |
| Teaching surfaces | Warm paper, pale blue and muted sage |
| Interface type | Inter, locally bundled; system CJK fallback |
| Heading type | Inter, same family; 500–600 weight |
| Shape | Translucent panels, 20–28 px corners, white edges and restrained shadows |

## Course-first layout

- Student navigation contains Courses, My wiki, Wiki market and Inbox. Course selection happens through course cards.
- Entering a course replaces the large global sidebar with a focused, full-height workspace. A compact top bar provides a return to Courses and wiki destinations.
- Left: a collapsible file tree with shared course materials, personal uploads, and LLM Wiki pages.
- Middle: a ChatGPT-style conversation with a compact session selector and a fixed composer.
- Right: documents, wiki pages, and HTML explanations open as independent tabs. New animations leave existing course materials open.
- On tablets, the file tree becomes a drawer; on phones, Files, Chat, and Preview switch between the same three panels.

## Interaction decisions

- Course is the outer context; material selection narrows learning context further.
- Students have separate sessions and knowledge pages. Teacher mode reviews course activity without altering student conversations.
- Source references open the relevant document page. Uploaded PDF originals are available alongside extracted text.
- HTML explanations have explicit playback controls and alternate scenarios; motion is used to explain a process.
- Wiki pages accumulate learning outcomes. Market publishing creates selected, independent snapshots.
- Importing a topic collection creates new page IDs and remaps its internal links, preserving author attribution.
- Demo behavior is disclosed without interrupting the learning flow.

## Personal wiki library and vault

- Classroom `LLM_wiki/` contains only that student's notes in the current course. Global My wiki collects their notes across every course, one note per card in three desktop columns (two on tablets, one on phones).
- Opening a card enters a focused Obsidian-inspired dark workspace: compact tool ribbon, course/folder explorer, note tabs and Markdown reader/editor, and a connections inspector. The global sidebar gives way to this workspace, with an explicit return to My wiki.
- Outgoing links, backlinks and graph edges are derived from Markdown links, including aliases, headings and `.md` paths. Code examples do not create edges. Missing targets are labelled; unlinked notes remain visible in the graph.
- Local graph shows the active note and its neighbours; Graph view expands all personal notes and supports a course filter, zoom, pan, keyboard selection and a note-list alternative. Editing a link updates all three representations after saving.
- Private vaults are student-only; teachers browse published snapshots in their course market. Publishing stays within the active note's course even while the personal explorer spans courses. On narrow screens, Files, Note/Graph and Links expose the same panels.

## Teaching workspace and private Inbox

- Teacher navigation is Courses and Inbox. Teaching course cards open Overview; a course tab bar separates Overview, Materials, Students and Wiki market. Student navigation adds Inbox to Courses, My wiki and Wiki market.
- Overview uses roster, recent session activity and pending message counts. It avoids inferred mastery or risk scores. Student records include inactive enrolled learners and link into a focused, read-only session review that preserves the prior list context.
- Teachers can view course sessions, personal uploads and published Wiki snapshots. Private Wiki titles, counts, notes, links and graphs stay out of the teacher shell, search and deep links. Market curation never borrows a student identity.
- Inbox threads are private to a course teacher and the initiating student. Teacher replies are separate from AI sessions. A unified list provides course/status/search filters; the reading panel shows human participants, messages and a reply box. On phones, list and detail become two explicit levels.
- Unread dots supplement text/status badges; opening a thread marks it read. A student follow-up reopens a resolved conversation. No out-of-app delivery is implied by this browser-local demo.
- Archiving a public document removes it from new learning context without deleting original files or breaking old citations. Teacher uploads, renames and archive actions are attributed to the teacher identity.

## Accessibility and adaptation

Use semantic buttons and form labels, visible focus, keyboard-accessible SVG graph nodes, labelled icon controls, Escape and Tab support for dialogs, and reduced-motion overrides. On small screens the global sidebar becomes an explicit menu, while the course workspace provides Files, Chat, and Preview panel controls. Sources and private/teacher visibility are communicated with text as well as icons and color.

## Glass refinement · 29 October 2026

Built on `origin/release` at `6d30ee3` in local branch `ui/glass-refinement`. Floating frosted navigation, translucent cards and toolbars share the tokens in `apps/web/src/glass.css`. Static ambient gradients supply depth; no continuous decorative motion is used. Reading surfaces retain more opacity for legibility. The dark Wiki remains a focused knowledge workspace with the same typography. Code blocks retain monospace.

Inter replaces mixed display/serif families throughout the UI. Headings use a restrained scale and mostly 600 weight, controls use 500, and reading text uses 400. Existing responsive geometry, authentication, course permissions and AI flows remain intact. Unsupported backdrop-filter falls back to solid light surfaces.

Screenshots in `docs/screenshots/glass/` use isolated local fixture accounts and sample content, not production data. The strict UI audit checks 164 views across phone, tablet and desktop widths, with no geometry regressions or runtime errors. No deployment or publishing is part of this change.
