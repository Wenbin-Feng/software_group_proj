# Luma prototype screenshots

Owner: **WANG Jiahe** · Branch: **dev/WangJiahe**

This gallery contains **35 actual screenshots** of the running frontend, expanded from the original 13. Each image has a specific presentation point; no screenshot is a generated mockup. Desktop captures use a 1440 × 900 browser viewport and full-page capture. Scrollbars reduce some widths to 1425 pixels. Phone captures use a 390 × 844 viewport, with some 375 pixel content widths. The PDF capture was added after page rendering, navigation, and session recovery were verified.

The browser’s JPEG captures were exported to PNG without changing page content. Images reflect real demo state from the walkthrough, including additional memberships, notes and an uploaded file. Use **Reset demo data** to restore the original sample state.

The root [prototype README](../README.md) also embeds every screenshot. [catalog.json](catalog.json) contains the captions used here; `browser-checks.json` records the initial browser verification. [Integration checks](browser-checks-2026-10-16.json) record the 2026-10-16 development and production smoke checks. Run `node scripts/check-screenshot-links.mjs` from the project root to validate both galleries.

## Identity and workspace

### 01-sign-in.png — Demo Google sign-in

Choose an explicitly simulated Google identity for a student, instructor, or administrator.

![Demo Google sign-in](01-sign-in.png)

### 02-my-classes.png — Student learning workspace

Browse courses, materials, personal notes, and community ideas from one home.

![Student learning workspace](02-my-classes.png)

### 14-demo-identities.png — Switching perspectives

Move between the four demo identities while keeping their personal Wikis separate.

![Switching perspectives](14-demo-identities.png)

### 15-join-class.png — Join by invitation code

Enter the instructor’s class code in a focused join dialog.

![Join by invitation code](15-join-class.png)

### 16-join-validation.png — Invalid class-code feedback

An invalid code shows an actionable error without creating a membership.

![Invalid class-code feedback](16-join-validation.png)

### 17-workspace-search.png — Search across the workspace

Find accessible classes, personal notes, and community entries.

![Search across the workspace](17-workspace-search.png)

## Classroom and files

### 03-classroom-materials.png — Shared classroom materials

Browse instructor-provided guides and workshop activities.

![Shared classroom materials](03-classroom-materials.png)

### 18-classroom-members.png — Student view of the class roster

See the instructor and students who belong to the class.

![Student view of the class roster](18-classroom-members.png)

### 19-classroom-about.png — Course topics and context

Explain the learning goals, topics, and illustrative class schedule.

![Course topics and context](19-classroom-about.png)

### 25-instructor-materials.png — Instructor materials workspace

Teachers get upload and removal controls alongside the shared file list.

![Instructor materials workspace](25-instructor-materials.png)

### 26-upload-material-dialog.png — Upload and categorize a file

Choose a category and a local file, with supported preview behavior explained.

![Upload and categorize a file](26-upload-material-dialog.png)

### 27-instructor-roster.png — Instructor roster management

Teachers can remove a demo student while preserving the student’s personal Wiki.

![Instructor roster management](27-instructor-roster.png)

### 28-file-preview-reselection.png — Session-file recovery

Reloaded binary-file metadata leads to a clear reselection action rather than a broken preview.

![Session-file recovery](28-file-preview-reselection.png)

### 29-uploaded-pdf-preview.png - Canvas-rendered PDF preview

Read the actual uploaded PDF locally, move between its five pages, and restore the preview by reselection after a reload.

![Canvas-rendered PDF preview](29-uploaded-pdf-preview.png)

## AI explanations

### 04-ai-material-qa.png — Document-aware study conversation

Read a class document alongside a prepared explanation tied to the material.

![Document-aware study conversation](04-ai-material-qa.png)

### 05-interactive-animation.png — Waterfall and Agile animation

A real stepped animation with playback and reset controls.

![Waterfall and Agile animation](05-interactive-animation.png)

### 35-ai-demo-boundary.png — Honest AI scope fallback

An unsupported question receives a clear prepared-demo boundary instead of an invented answer.

![Honest AI scope fallback](35-ai-demo-boundary.png)

## Personal Wiki

### 06-personal-wiki.png — Personal note and connections

Preview Markdown, follow internal links, and inspect backlinks.

![Personal note and connections](06-personal-wiki.png)

### 07-wiki-editor.png — Markdown editing

Edit a personal note with automatic browser-local persistence.

![Markdown editing](07-wiki-editor.png)

### 08-knowledge-graph.png — Actual Wiki relationship graph

Nodes and lines are derived from the user’s stored note links.

![Actual Wiki relationship graph](08-knowledge-graph.png)

### 20-wiki-ai-suggestion.png — Review a prepared Wiki suggestion

AI suggestions are explicitly labeled and only applied after the learner chooses.

![Review a prepared Wiki suggestion](20-wiki-ai-suggestion.png)

### 21-new-wiki-note.png — Create a personal note

Name a new idea before writing and connecting it.

![Create a personal note](21-new-wiki-note.png)

### 22-wiki-title-validation.png — Duplicate-title validation

A duplicate title produces an inline error while preserving the note and dialog.

![Duplicate-title validation](22-wiki-title-validation.png)

## Wiki Market

### 09-wiki-market.png — Community note discovery

Browse free notes and filter them by topic.

![Community note discovery](09-wiki-market.png)

### 10-community-note.png — Publication preview and attribution

Read a snapshot, bookmark it, or copy it to a private Wiki.

![Publication preview and attribution](10-community-note.png)

### 23-bookmarked-notes.png — Saved community ideas

Revisit the notes bookmarked by the current learner.

![Saved community ideas](23-bookmarked-notes.png)

### 24-my-publications.png — Published personal snapshots

List the current user’s publications separately from private drafts.

![Published personal snapshots](24-my-publications.png)

## Management

### 11-instructor-management.png — Instructor class overview

Open each teaching space to manage its materials and members.

![Instructor class overview](11-instructor-management.png)

### 12-people-and-roles.png — Administrator account roles

Inspect local demo identities and change another account’s role.

![Administrator account roles](12-people-and-roles.png)

## Responsive layouts

### 13-mobile-market.png — Market on a phone

The community grid becomes a single-column reading flow.

![Market on a phone](13-mobile-market.png)

### 30-mobile-classrooms.png — Classrooms on a phone

Course cards and home content adapt to a narrow screen.

![Classrooms on a phone](30-mobile-classrooms.png)

### 31-mobile-material-ai.png — Reading and AI on a phone

Document and conversation panels stack while their controls remain available.

![Reading and AI on a phone](31-mobile-material-ai.png)

### 32-mobile-personal-wiki.png — Personal Wiki on a phone

Notes, Markdown content, and link panels remain accessible at a phone width.

![Personal Wiki on a phone](32-mobile-personal-wiki.png)

### 33-mobile-knowledge-graph.png — Knowledge graph on a phone

The graph has a note-list alternative for small-screen navigation.

![Knowledge graph on a phone](33-mobile-knowledge-graph.png)

### 34-mobile-instructor-materials.png — Instructor files on a phone

The instructor material table and upload controls adapt to narrow screens.

![Instructor files on a phone](34-mobile-instructor-materials.png)
