import test from "node:test";
import assert from "node:assert/strict";
import { coursewareHtml } from "../src/lib/coursewareHtml.js";
import { deckLayoutStyle } from "../../api/src/ai/deck-layout.ts";

test("saved courseware refreshes old layout without changing its published body or CSP", () => {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`;
  const oldStyles = "<style>section{aspect-ratio:16/9;overflow:hidden}</style>";
  const body =
    "<body><section><h1>Published &lt;title&gt;</h1><ul><li>Preserved snapshot &amp; evidence.</li></ul><footer>1 / 1</footer></section></body>";
  const source = `<!doctype html><html><head>${csp}${oldStyles}<style data-folio-courseware-layout>section{height:100px}</style></head>${body}</html>`;
  const rendered = coursewareHtml(source);
  assert.ok(rendered.includes(csp));
  assert.ok(rendered.includes(body));
  assert.ok(rendered.includes(`${oldStyles}${deckLayoutStyle}</head>`));
  assert.equal(rendered.match(/data-folio-courseware-layout/g)?.length, 1);
  assert.ok(!rendered.includes("section{height:100px}"));
  assert.equal(coursewareHtml(rendered), rendered);
});

test("courseware without a saved head keeps its body when display styles are added", () => {
  const source =
    "<section><h1>Saved lesson</h1><p>Original content</p></section>";
  assert.equal(coursewareHtml(source), `${deckLayoutStyle}${source}`);
  assert.equal(coursewareHtml(coursewareHtml(source)), coursewareHtml(source));
  assert.equal(coursewareHtml(""), "");
});
