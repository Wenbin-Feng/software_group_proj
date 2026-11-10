import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  advertised,
  PREVIEW_MARK,
  slidesContext,
  slidesHtml,
  slidesIssues,
  slidesPptx,
  validateSlidemakerDeck,
} from "../src/ai/slides.js";
import { slideDeck } from "./slide-deck.js";

test("generation context offers only renderable layouts with notes and citations", () => {
  const context = slidesContext("genspark_college", "en", 5);
  assert.ok(context.layouts.some((layout) => layout.id === "process"));
  assert.equal(context.schema.properties.slides.minItems, 5);
  const bullets = context.variants.bullets;
  assert.deepEqual(bullets.required, ["template", "fields", "notes", "sources"]);
  const cap = bullets.properties.fields.properties.title.maxLength;
  assert.ok(advertised(bullets).properties.fields.properties.title.maxLength < cap);
});

test("issues name the field to shorten and the required first and last layouts", () => {
  const context = slidesContext("default", "en", 3);
  assert.deepEqual(slidesIssues(slideDeck(3), context), []);
  const long = slidesIssues(slideDeck(3, { text: "x".repeat(400) }), context);
  assert.match(long[0], /^slides\.1\.fields\.lead: 400 chars, too long/);
  const order = slideDeck(3);
  order.slides.reverse();
  assert.match(slidesIssues(order, context).join(" "), /first slide must use title/);
  assert.match(slidesIssues({ ...slideDeck(3), lang: "zh" }, context)[0], /lang/);
});

test("saved decks render escaped HTML and editable PPTX with speaker notes", async () => {
  const deck = validateSlidemakerDeck({
    ...slideDeck(3, { text: "<script>alert(1)</script>", notes: "Ask about lost updates" }),
    style: "genspark_college",
  });
  const html = await slidesHtml(deck);
  assert.match(html, /^<!DOCTYPE html>\s*<html[^>]*>\s*<head><meta http-equiv="Content-Security-Policy"/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.ok(html.includes(PREVIEW_MARK));
  // The preview draws the College style, not the default look.
  assert.match(html, /background:#F4F1EC/i);
  assert.match(html, /Georgia/);
  const zip = await JSZip.loadAsync(await slidesPptx(deck));
  const notes = await Promise.all(
    Object.keys(zip.files)
      .filter((name) => /notesSlide\d+\.xml$/.test(name))
      .map((name) => zip.file(name)!.async("string")),
  );
  assert.ok(notes.some((xml) => xml.includes("Ask about lost updates")));
  assert.throws(
    () => validateSlidemakerDeck({ ...slideDeck(3), slides: [{ template: "nope", fields: {} }] }),
    /layout "nope" does not exist/,
  );
});
