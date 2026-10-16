# Learning Platform Prototype Design

Date: 2026-10-15
Status: Approved and implemented

## Purpose and agreed constraints

Build a locally runnable, English-language frontend prototype for a classroom presentation. Demonstrate a connected learning journey: classroom materials -> AI explanation -> interactive animation -> personal Wiki -> community sharing. This iteration does not implement the entire assignment described in the source PDF.

The user accepts simulated AI. Screenshots must be captured from the running application and delivered as PNG files suitable for presentation slides. Upload to GitHub only after the user supplies the destination.

## Product scope

### Identity and navigation

- English interface and English seeded content throughout.
- Login screen with a Google-styled demo sign-in entry, explicitly labeled as demo sign-in. No real Google authentication, password entry, or Google consent imitation.
- Seeded Student, Instructor, and Admin identities; easy role switching for presentation.
- Sidebar: My Classes, My Wiki, Wiki Market, and role-appropriate management links.
- Desktop-first layout; usable narrow-screen layout. Main presentation target: 1440 x 900.

### Classes and materials

- Class cards, course overview, join-by-code flow, materials, and member list.
- Main seeded course: Software Engineering Fundamentals. Include coherent material on software development lifecycles, requirements, and Agile development.
- Students view class materials and open a reading workspace.
- Instructors add, categorize, search, and remove materials and manage class members in local demo state.
- Bundled materials have readable previews. Newly selected PDF and plain-text/Markdown files can be previewed locally; unsupported formats show metadata and a clear preview limitation.
- Binary uploads are session-only and labeled accordingly. Persist their metadata; after reload, request reselection rather than presenting a broken preview. Seeded materials remain available after reload.
- Join-code validation, empty states, upload errors, and confirmation for material removal.

### Classroom AI and animations

- Contextual chat alongside the selected material, with suggested questions, loading feedback, and streamed-style presentation of prepared responses.
- Responses to supported demo prompts are consistent with the selected seeded document. Source references open the relevant material or passage; never fabricate real retrieval for arbitrary uploads.
- Unknown prompts receive an honest demo fallback and suggested supported prompts.
- A visible, unobtrusive Demo AI indicator explains that responses are simulated.
- Main animation: Waterfall vs Agile, built with HTML/CSS/SVG and browser scripting, with play, pause, reset, and step controls. Show meaningful changes over time, with explanatory captions.
- Animations are prepared interactive content, not live model-generated code. No arbitrary script execution.
- Save a supported explanation to My Wiki with title, Markdown content, and material attribution.

### Personal Wiki

- Browser-based Obsidian-inspired experience, not an integration with the Obsidian desktop application.
- Create, rename, edit, search, and delete notes. Markdown editing and preview; safe rendering without arbitrary raw HTML execution.
- Resolve [[Note Title]] links, show backlinks, and render a relationship graph derived from actual note links. Missing targets have a clear create-note action.
- Graph nodes open their notes. Define unique note titles to avoid ambiguous links.
- Demo AI can suggest structure or related notes for the seeded content; suggestions require an explicit apply action before changing a note.

### Wiki Market

- Free community sharing; no payments.
- Search, tag filtering, note preview, bookmarks, publish/unpublish, and copy to My Wiki.
- Publishing creates a snapshot so editing the private note does not silently modify the published version. Republishing explicitly updates it.
- Copied notes preserve author attribution and receive a unique title if a title already exists.
- Seeded community content and interactions are local simulations, not cross-user synchronization.

### Management

- Instructors manage the seeded class roster and materials.
- Admins view demo accounts and change local demo roles.
- Role-specific controls demonstrate intended behavior; frontend controls do not provide security enforcement.

## Experience and visual direction

Use a restrained academic workspace: light background, dark readable typography, blue/teal accents, clear spacing, and consistent icons. Three-column reading view: navigation, document, AI panel. Wiki emphasizes readable editing and an accessible graph view. Market uses concise content cards with real sample excerpts.

Avoid blank dashboard filler, misleading capability claims, or decorative metrics that do not reflect demo data. Include useful empty, success, loading, and error states. Support keyboard navigation, visible focus, labeled form controls, and readable contrast.

## Technical design

- React, TypeScript, and Vite with client-side routing.
- Modules: identity, classes/materials, assistant/animations, Wiki, Market, management, and shared UI.
- Central typed demo data and a versioned local persistence layer. Modules communicate through explicit application actions rather than editing each other's storage.
- Core entities: User, Course, Membership, Material, Conversation, Note, PublishedNote, and Bookmark. Notes and publications retain author IDs; course membership links user and course IDs.
- Use localStorage for small text records; object URLs for session file previews, revoked when no longer needed. Handle storage failures with visible feedback. Recover malformed stored data through an offered reset instead of crashing.
- A one-click Reset Demo Data action restores a coherent starting state after confirmation.
- No backend, external AI calls, real OAuth, shared database, or real-time multi-user features in this iteration. No secrets in frontend code.

## Demonstration script

1. Enter as instructor and inspect or add a course material.
2. Switch to student, join the class with a demo code, and open the lifecycle material.
3. Ask how Waterfall differs from Agile; inspect source context.
4. Open and operate the comparison animation.
5. Save the explanation as a Wiki note; edit it and link to Requirements Analysis and Iterative Development.
6. Open the graph and navigate between linked notes.
7. Publish the note to Wiki Market.
8. Switch to another student and copy the published note into that student's Wiki.
9. Inspect instructor and admin management views.

## Validation and screenshot acceptance

- Build and type checks pass. Verify key data operations and the complete demo journey in the running browser.
- Verify local text persistence after reload, session-file limitations, role switching, publish snapshot behavior, and reset.
- Verify animation controls visibly change the visualization; graph links reflect stored note links.
- Capture actual running pages at a consistent desktop viewport, with no dialogs, clipped text, browser errors, or incomplete loading states.
- Required PNG captures: classroom overview, material plus AI explanation and source, animation at a meaningful frame, Wiki editor, knowledge graph, Market listing/detail, and instructor management. Include the demo AI indicator where applicable.
- Save final captures under images with descriptive filenames and a brief index mapping each image to a presentation point.
- Check a narrow viewport for overflow and usable navigation.

## Implementation sequence and deliverables

After design review, prepare an implementation plan. Build the shell and seeded state; classes and identity; contextual assistant and animation; Wiki and graph; Market and management; then validate and capture screenshots.

Deliver runnable source, startup instructions, feature/simulation boundaries, a short demo guide, and screenshot PNGs. Prepare a clean Git repository with generated files excluded and no credentials; push only when the user provides the GitHub destination.
