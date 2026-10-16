# Luma - Your learning, connected

**Owner: WANG Jiahe (`WangJiahe-polyu`) | Prototype branch: `dev/WangJiahe`**

An English frontend prototype for students and instructors: shared classroom files, a prepared AI study partner, interactive explanations, a personal linked Wiki, and free community notes.

## Screenshot delivery

This package contains **34 screenshots captured from the actual running frontend**. It contains presentation images, not the runnable application source. Open `gallery.html` locally for a grouped visual index; click an image to see its original resolution. The PNG images are in `images/`.

Image numbers preserve their capture sequence. The unverified PDF preview capture is excluded. No generated interface mockups are included.

## Intended users and demonstration flow

A student selects a demo identity, opens a class, reads a teacher-provided document, asks a prepared question, explores the Waterfall/Agile animation, connects an idea in their personal Wiki, and browses a community note. Instructor and administrator views illustrate file, membership, and account-role management.

## Technical context and limits

The application uses React, TypeScript, Vite, Markdown, and browser-local storage. These screenshots require no runtime, installation, environment variables, credentials, or network connection to view. The application source and its full build verification will be delivered separately.

Google sign-in and AI answers are explicitly simulated. There is no backend, live OAuth or LLM, payment flow, or cross-device synchronization. Screenshots document frontend demo behavior; role controls do not establish server-side security.

## Validation and contribution

WANG Jiahe defined the product scope, selected English, and requested presentation evidence and readable code. Codex assisted with implementation, browser checks, and this screenshot package. Images cover normal flows, validation errors, multiple roles, and phone layouts. No external usability study or remote CI run is claimed. Final application validation and PDF preview work remain pending.

The images below use repository-relative paths, so they render in this branch's GitHub README. This is an independent prototype contribution; do not merge it into `main`. Future CI work belongs on a separate feature branch and will check, build, and archive artifacts without deployment.

## Screenshot gallery


### Identity and workspace


**Demo Google sign-in** - `01-sign-in.png` (1440 x 900)

Choose an explicitly simulated Google identity for a student, instructor, or administrator.

![Demo Google sign-in](images/01-sign-in.png)


**Student learning workspace** - `02-my-classes.png` (1425 x 1192)

Browse courses, materials, personal notes, and community ideas from one home.

![Student learning workspace](images/02-my-classes.png)


**Switching perspectives** - `14-demo-identities.png` (1440 x 1192)

Move between the four demo identities while keeping their personal Wikis separate.

![Switching perspectives](images/14-demo-identities.png)


**Join by invitation code** - `15-join-class.png` (1440 x 1192)

Enter the instructor’s class code in a focused join dialog.

![Join by invitation code](images/15-join-class.png)


**Invalid class-code feedback** - `16-join-validation.png` (1440 x 1192)

An invalid code shows an actionable error without creating a membership.

![Invalid class-code feedback](images/16-join-validation.png)


**Search across the workspace** - `17-workspace-search.png` (1440 x 1192)

Find accessible classes, personal notes, and community entries.

![Search across the workspace](images/17-workspace-search.png)


### Classroom and files


**Shared classroom materials** - `03-classroom-materials.png` (1425 x 1135)

Browse instructor-provided guides and workshop activities.

![Shared classroom materials](images/03-classroom-materials.png)


**Student view of the class roster** - `18-classroom-members.png` (1440 x 900)

See the instructor and students who belong to the class.

![Student view of the class roster](images/18-classroom-members.png)


**Course topics and context** - `19-classroom-about.png` (1440 x 900)

Explain the learning goals, topics, and illustrative class schedule.

![Course topics and context](images/19-classroom-about.png)


**Instructor materials workspace** - `25-instructor-materials.png` (1425 x 1135)

Teachers get upload and removal controls alongside the shared file list.

![Instructor materials workspace](images/25-instructor-materials.png)


**Upload and categorize a file** - `26-upload-material-dialog.png` (1440 x 1135)

Choose a category and a local file, with supported preview behavior explained.

![Upload and categorize a file](images/26-upload-material-dialog.png)


**Instructor roster management** - `27-instructor-roster.png` (1440 x 900)

Teachers can remove a demo student while preserving the student’s personal Wiki.

![Instructor roster management](images/27-instructor-roster.png)


**Session-file recovery** - `28-file-preview-reselection.png` (1425 x 965)

Reloaded binary-file metadata leads to a clear reselection action rather than a broken preview.

![Session-file recovery](images/28-file-preview-reselection.png)


### AI explanations


**Document-aware study conversation** - `04-ai-material-qa.png` (1425 x 965)

Read a class document alongside a prepared explanation tied to the material.

![Document-aware study conversation](images/04-ai-material-qa.png)


**Waterfall and Agile animation** - `05-interactive-animation.png` (1440 x 965)

A real stepped animation with playback and reset controls.

![Waterfall and Agile animation](images/05-interactive-animation.png)


**Honest AI scope fallback** - `35-ai-demo-boundary.png` (1425 x 965)

An unsupported question receives a clear prepared-demo boundary instead of an invented answer.

![Honest AI scope fallback](images/35-ai-demo-boundary.png)


### Personal Wiki


**Personal note and connections** - `06-personal-wiki.png` (1425 x 1164)

Preview Markdown, follow internal links, and inspect backlinks.

![Personal note and connections](images/06-personal-wiki.png)


**Markdown editing** - `07-wiki-editor.png` (1425 x 1118)

Edit a personal note with automatic browser-local persistence.

![Markdown editing](images/07-wiki-editor.png)


**Actual Wiki relationship graph** - `08-knowledge-graph.png` (1425 x 1113)

Nodes and lines are derived from the user’s stored note links.

![Actual Wiki relationship graph](images/08-knowledge-graph.png)


**Review a prepared Wiki suggestion** - `20-wiki-ai-suggestion.png` (1440 x 1164)

AI suggestions are explicitly labeled and only applied after the learner chooses.

![Review a prepared Wiki suggestion](images/20-wiki-ai-suggestion.png)


**Create a personal note** - `21-new-wiki-note.png` (1440 x 1164)

Name a new idea before writing and connecting it.

![Create a personal note](images/21-new-wiki-note.png)


**Duplicate-title validation** - `22-wiki-title-validation.png` (1440 x 1164)

A duplicate title produces an inline error while preserving the note and dialog.

![Duplicate-title validation](images/22-wiki-title-validation.png)


### Wiki Market


**Community note discovery** - `09-wiki-market.png` (1425 x 1889)

Browse free notes and filter them by topic.

![Community note discovery](images/09-wiki-market.png)


**Publication preview and attribution** - `10-community-note.png` (1440 x 1889)

Read a snapshot, bookmark it, or copy it to a private Wiki.

![Publication preview and attribution](images/10-community-note.png)


**Saved community ideas** - `23-bookmarked-notes.png` (1425 x 1120)

Revisit the notes bookmarked by the current learner.

![Saved community ideas](images/23-bookmarked-notes.png)


**Published personal snapshots** - `24-my-publications.png` (1425 x 1131)

List the current user’s publications separately from private drafts.

![Published personal snapshots](images/24-my-publications.png)


### Management


**Instructor class overview** - `11-instructor-management.png` (1425 x 997)

Open each teaching space to manage its materials and members.

![Instructor class overview](images/11-instructor-management.png)


**Administrator account roles** - `12-people-and-roles.png` (1425 x 1076)

Inspect local demo identities and change another account’s role.

![Administrator account roles](images/12-people-and-roles.png)


### Responsive layouts


**Market on a phone** - `13-mobile-market.png` (375 x 3577)

The community grid becomes a single-column reading flow.

![Market on a phone](images/13-mobile-market.png)


**Classrooms on a phone** - `30-mobile-classrooms.png` (375 x 2085)

Course cards and home content adapt to a narrow screen.

![Classrooms on a phone](images/30-mobile-classrooms.png)


**Reading and AI on a phone** - `31-mobile-material-ai.png` (375 x 1717)

Document and conversation panels stack while their controls remain available.

![Reading and AI on a phone](images/31-mobile-material-ai.png)


**Personal Wiki on a phone** - `32-mobile-personal-wiki.png` (375 x 2007)

Notes, Markdown content, and link panels remain accessible at a phone width.

![Personal Wiki on a phone](images/32-mobile-personal-wiki.png)


**Knowledge graph on a phone** - `33-mobile-knowledge-graph.png` (375 x 1125)

The graph has a note-list alternative for small-screen navigation.

![Knowledge graph on a phone](images/33-mobile-knowledge-graph.png)


**Instructor files on a phone** - `34-mobile-instructor-materials.png` (375 x 1326)

The instructor material table and upload controls adapt to narrow screens.

![Instructor files on a phone](images/34-mobile-instructor-materials.png)
