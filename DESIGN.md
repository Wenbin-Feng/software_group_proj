# Folio design notes

## Direction

A calm university knowledge workspace: an editorial reading experience with clear application navigation. The work is guided by the installed `ui-ux-pro-max` skill and its Swiss Modernism guidance for knowledge workspaces. Its initial playful education match was rejected because it targeted a younger audience.

The application balances warm paper-like learning moments with a precise, functional interface. The overview uses an original SVG paper-and-ideas illustration; graphs, publication covers and interactive scenes are code-native visuals.

## Tokens

| Role | Choice |
| --- | --- |
| Primary action | Cobalt `#3156d3` |
| Main ink | Navy `#202d44` |
| Canvas | White |
| Navigation | Cool off-white `#f9fafc` |
| Teaching surfaces | Warm paper, pale blue and muted sage |
| Interface type | DM Sans, locally bundled |
| Editorial type | Instrument Serif, locally bundled |
| Shape | Fine borders, 8–14 px corners, restrained shadows |

## Interaction decisions

- Course is the outer context; material selection narrows learning context further.
- Students have separate sessions and knowledge pages. Teacher mode reviews course activity without altering student conversations.
- Source references open the relevant document page. Uploaded PDF originals are available alongside extracted text.
- HTML explanations have explicit playback controls and alternate scenarios; motion is used to explain a process.
- Wiki pages accumulate learning outcomes. Market publishing creates selected, independent snapshots.
- Importing a topic collection creates new page IDs and remaps its internal links, preserving author attribution.
- Demo behavior is disclosed without interrupting the learning flow.

## Accessibility and adaptation

Use semantic buttons and form labels, visible focus, keyboard-accessible SVG graph nodes, labelled icon controls, Escape and Tab support for dialogs, and reduced-motion overrides. On small screens the persistent sidebar becomes an explicit menu, and multi-column workspaces stack. Sources and private/teacher visibility are communicated with text as well as icons and color.
