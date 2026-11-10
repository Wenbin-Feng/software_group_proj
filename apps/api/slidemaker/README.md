# SlideMaker runtime (vendored)

Renders structured slide decks into editable PPTX (PptxGenJS) and an HTML preview.
Folio uses it for teacher courseware through `src/ai/slides.ts`.

Copied from the `senko_word_project` SlideMaker runtime (`backend/slidemaker_runtime`
and `backend/storage/templates/ppt`). Not included: CLI, web playground, screenshot
and stress tooling, tests, and the bundled web fonts.

Local changes:

- `lib/template-loader.js` loads styles from `./styles` next to the runtime.
- `lib/pptx/core.js` writes `slide.notes` as PowerPoint speaker notes and takes an
  `author` option.
- `package.json` marks this folder as CommonJS inside the ESM API workspace.

`vendor/pptxgen.cjs.js` is PptxGenJS (MIT, see `vendor/PPTXGENJS-LICENSE`); it loads
`jszip` from the workspace dependencies. Style packages are trusted local code.
`prompt.md` is the authoring prompt; Folio adds courseware rules in `routes.ts`.
