import pptxgen from "pptxgenjs";
import { deckLayoutStyle } from "./deck-layout.js";
export type DeckSlide = {
  title: string;
  body: string[];
  layout: "content" | "two-column" | "table" | "process";
  secondary: string[];
  table: string[][];
  notes: string;
  sources: { materialId: string; page: number }[];
};
export type SlideDeck = {
  title: string;
  language: string;
  slides: DeckSlide[];
};
export const deckSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "language", "slides"],
  properties: {
    title: { type: "string", maxLength: 160 },
    language: { type: "string", maxLength: 40 },
    slides: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "body",
          "layout",
          "secondary",
          "table",
          "notes",
          "sources",
        ],
        properties: {
          title: { type: "string", maxLength: 140 },
          body: {
            type: "array",
            maxItems: 6,
            items: { type: "string", maxLength: 350 },
          },
          layout: {
            type: "string",
            enum: ["content", "two-column", "table", "process"],
          },
          secondary: {
            type: "array",
            maxItems: 6,
            items: { type: "string", maxLength: 350 },
          },
          table: {
            type: "array",
            maxItems: 7,
            items: {
              type: "array",
              maxItems: 5,
              items: { type: "string", maxLength: 120 },
            },
          },
          notes: { type: "string", maxLength: 4000 },
          sources: {
            type: "array",
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["materialId", "page"],
              properties: {
                materialId: { type: "string", maxLength: 120 },
                page: { type: "integer", minimum: 1 },
              },
            },
          },
        },
      },
    },
  },
};
const text = (value: unknown, max: number, field: string) => {
  if (typeof value !== "string" || value.length > max)
    throw Object.assign(
      new Error(
        `Invalid courseware field ${field}: use text up to ${max} characters.`,
      ),
      { statusCode: 400 },
    );
  return value;
};
export function validateDeck(input: any): SlideDeck {
  if (
    !input ||
    !Array.isArray(input.slides) ||
    input.slides.length < 1 ||
    input.slides.length > 20
  )
    throw Object.assign(
      new Error("A deck must contain between 1 and 20 slides."),
      { statusCode: 400 },
    );
  return {
    title: text(input.title, 160, "title"),
    language: text(input.language, 40, "language"),
    slides: input.slides.map((s: any, slideIndex: number) => {
      const field = `slides[${slideIndex}]`;
      if (
        !s ||
        !["content", "two-column", "table", "process"].includes(s.layout)
      )
        throw Object.assign(new Error("Unsupported slide layout."), {
          statusCode: 400,
        });
      const list = (value: any, label: string) => {
        if (!Array.isArray(value) || value.length > 6)
          throw Object.assign(
            new Error("A slide accepts at most six text items."),
            { statusCode: 400 },
          );
        return value.map((item: any, index: number) =>
          text(item, 350, `${field}.${label}[${index}]`),
        );
      };
      if (
        !Array.isArray(s.table) ||
        s.table.length > 7 ||
        s.table.some((row: any) => !Array.isArray(row) || row.length > 5)
      )
        throw Object.assign(
          new Error("Tables accept at most seven rows and five columns."),
          { statusCode: 400 },
        );
      const table = s.table.map((row: any[], rowIndex: number) =>
        row.map((cell, columnIndex) =>
          text(cell, 120, `${field}.table[${rowIndex}][${columnIndex}]`),
        ),
      );
      if (
        s.layout === "table" &&
        (!table.length ||
          !table[0].length ||
          table.some((row: any[]) => row.length !== table[0].length))
      )
        throw Object.assign(
          new Error("A table needs equal-width, non-empty rows."),
          { statusCode: 400 },
        );
      if (!Array.isArray(s.sources) || s.sources.length > 12)
        throw Object.assign(
          new Error(
            `Invalid courseware field ${field}.sources: use up to twelve references.`,
          ),
          { statusCode: 400 },
        );
      const sources = s.sources.map((source: any, index: number) => ({
        materialId: text(
          source.materialId,
          120,
          `${field}.sources[${index}].materialId`,
        ),
        page: Number(source.page),
      }));
      if (
        sources.some(
          (source: any) => !Number.isInteger(source.page) || source.page < 1,
        )
      )
        throw Object.assign(new Error("Invalid source page."), {
          statusCode: 400,
        });
      return {
        title: text(s.title, 140, `${field}.title`),
        body: list(s.body, "body"),
        layout: s.layout,
        secondary: list(s.secondary || [], "secondary"),
        table,
        notes: text(s.notes || "", 4000, `${field}.notes`),
        sources,
      };
    }),
  };
}
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export const sandboxCsp =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; media-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; navigate-to 'none'";
export function deckHtml(deck: SlideDeck) {
  const list = (items: string[]) =>
    `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${sandboxCsp}"><meta name="viewport" content="width=device-width,initial-scale=1">${deckLayoutStyle}</head><body>${deck.slides.map((s, i) => `<section><h1>${escapeHtml(s.title)}</h1>${s.layout === "two-column" ? `<div class="columns">${list(s.body)}${list(s.secondary)}</div>` : s.layout === "table" ? `<table>${s.table.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</table>` : s.layout === "process" ? `<ol class="process">${s.body.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : list(s.body)}<footer><span>${escapeHtml(deck.title)}</span><span>${i + 1} / ${deck.slides.length}</span></footer></section>`).join("")}</body></html>`;
}
export function sandboxHtml(html: string) {
  // A model cannot weaken the first CSP. The iframe caller MUST also use sandbox="allow-scripts" without allow-same-origin.
  const clean = html
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${sandboxCsp}"></head><body>${clean}</body></html>`;
}

export async function deckPptx(deck: SlideDeck): Promise<Buffer> {
  // PptxGenJS 4 publishes CJS-shaped declarations for its ESM entry point.
  const Pptx = pptxgen as unknown as { new (): any };
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Folio";
  pptx.subject = "Teacher courseware";
  pptx.title = deck.title;
  pptx.lang = /zh[-_]?(HK|TW|Hant)|繁體|繁体/i.test(deck.language)
    ? "zh-TW"
    : /^zh|中文|Chinese|简体|簡體/i.test(deck.language)
      ? "zh-CN"
      : "en-GB";
  pptx.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
    lang: pptx.lang,
  };
  for (const [index, item] of deck.slides.entries()) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.65,
      y: 0.5,
      w: 0.65,
      h: 0.06,
      line: { color: "3156D3" },
      fill: { color: "3156D3" },
    });
    slide.addText(item.title, {
      x: 0.65,
      y: 0.85,
      w: 12,
      h: 0.85,
      fontSize: 30,
      bold: true,
      color: "202D44",
      breakLine: false,
      margin: 0,
      fit: "shrink",
    });
    const addList = (items: string[], x: number, w: number) => {
      items.forEach((line, i) =>
        slide.addText(line, {
          x,
          y: 2 + i * 0.78,
          w,
          h: 0.75,
          fontSize: 21,
          color: "202D44",
          breakLine: false,
          margin: 0,
          fit: "shrink",
          bullet: { indent: 16 },
          hanging: 3,
        }),
      );
    };
    if (item.layout === "table")
      slide.addTable(
        item.table.map((row, index) =>
          row.map((cell) => ({
            text: cell,
            options: {
              fill: index === 0 ? "3156D3" : "F5F7FC",
              color: index === 0 ? "FFFFFF" : "202D44",
              bold: index === 0,
            },
          })),
        ),
        {
          x: 0.65,
          y: 2,
          w: 12,
          h: 3.8,
          fontSize: 18,
          border: { color: "DCE2ED", pt: 1 },
          color: "202D44",
          fill: "F5F7FC",
          margin: 0.12,
          rowH: 0.55,
          autoPage: false,
        },
      );
    else if (item.layout === "two-column") {
      addList(item.body, 0.65, 5.7);
      addList(item.secondary, 7, 5.7);
    } else if (item.layout === "process") {
      const w = Math.min(
        3.7,
        (12 - Math.max(0, item.body.length - 1) * 0.2) /
          Math.max(1, item.body.length),
      );
      item.body.forEach((line, i) => {
        const x = 0.65 + i * (w + 0.2);
        slide.addShape(pptx.ShapeType.roundRect, {
          x,
          y: 2.3,
          w,
          h: 2.6,
          radius: 0.1,
          fill: { color: "EDF1FC" },
          line: { color: "EDF1FC" },
        });
        slide.addText(`${i + 1}\n${line}`, {
          x: x + 0.14,
          y: 2.55,
          w: w - 0.28,
          h: 2.1,
          fontSize: 21,
          color: "202D44",
          margin: 0,
          fit: "shrink",
        });
      });
    } else addList(item.body, 0.65, 12);
    slide.addText(deck.title, {
      x: 0.65,
      y: 6.95,
      w: 10,
      h: 0.2,
      fontSize: 9,
      color: "758098",
      margin: 0,
    });
    slide.addText(`${index + 1} / ${deck.slides.length}`, {
      x: 11.7,
      y: 6.95,
      w: 1,
      h: 0.2,
      align: "right",
      fontSize: 9,
      color: "758098",
      margin: 0,
    });
    slide.addNotes(
      `${item.notes}\n\nSources: ${item.sources.map((source) => `${source.materialId}, page ${source.page}`).join("; ")}`,
    );
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
