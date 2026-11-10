import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { sandboxCsp } from "./deck.js";

// SlideMaker renders structured decks into editable PPTX with a choice of
// global styles. It is vendored CommonJS next to src/ and dist/.
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../slidemaker",
);
const load = createRequire(path.join(root, "package.json"));
const runtime = {
  deck: load("./lib/deck.js"),
  preview: load("./lib/preview.js"),
  pptx: load("./lib/render-pptx.js"),
  templates: load("./lib/templates.js"),
  loader: load("./lib/template-loader.js"),
};
export const slidesPrompt = readFileSync(path.join(root, "prompt.md"), "utf8");

export const SLIDE_STYLES = [
  { id: "default", name: "Clean" },
  { id: "genspark_college", name: "College" },
] as const;
export const SLIDE_LANGS = ["en", "zh", "ja"] as const;
export type SlideLang = (typeof SLIDE_LANGS)[number];
export type SlideSource = { materialId: string; page: number };
export type SlidemakerSlide = {
  template: string;
  fields: Record<string, unknown>;
  notes: string;
  sources: SlideSource[];
};
export type SlidemakerDeck = {
  format: "slidemaker";
  title: string;
  lang: SlideLang;
  aspect: "16:9";
  style: string;
  slides: SlidemakerSlide[];
};

export const isSlidemakerDeck = (deck: any): deck is SlidemakerDeck =>
  deck?.format === "slidemaker";
const badRequest = (message: string) =>
  Object.assign(new Error(message), { statusCode: 400 });
export const slideStyle = (value: unknown) =>
  SLIDE_STYLES.some((style) => style.id === value)
    ? (value as string)
    : "default";
export const slideLang = (value: unknown): SlideLang =>
  SLIDE_LANGS.includes(value as SlideLang) ? (value as SlideLang) : "en";

const NOTES_MAX = 1500;
const sourcesSchema = {
  type: "array",
  maxItems: 6,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["materialId", "page"],
    properties: {
      materialId: { type: "string", maxLength: 120 },
      page: { type: "integer", minimum: 1 },
    },
  },
};

// The renderer's own registry decides which layouts and caps exist. Each slide
// also carries teacher notes and course citations, which Folio keeps.
export function slidesContext(style: string, lang: SlideLang, slideCount: number) {
  const offered: string[] = runtime.pptx.supportedTemplates({ templateId: style });
  const schema = runtime.deck.deckSchema({ lang, aspect: "16:9", generation: true });
  const variants: Record<string, any> = {};
  schema.properties.slides.items.oneOf = schema.properties.slides.items.oneOf.filter(
    (variant: any) => offered.includes(variant.properties.template.const),
  );
  for (const variant of schema.properties.slides.items.oneOf) {
    variant.required = ["template", "fields", "notes", "sources"];
    variant.additionalProperties = false;
    variant.properties.fields.additionalProperties = false;
    variant.properties.notes = {
      type: "string",
      maxLength: NOTES_MAX,
      description: "Speaker notes for the teacher: what to say, ask or check.",
    };
    variant.properties.sources = sourcesSchema;
    variants[variant.properties.template.const] = variant;
  }
  schema.required = ["title", "aspect", "lang", "slides"];
  schema.additionalProperties = false;
  schema.properties.lang.const = lang;
  schema.properties.aspect.const = "16:9";
  schema.properties.slides.minItems = schema.properties.slides.maxItems = slideCount;
  const layouts = Object.keys(variants).map((id) => {
    const spec = runtime.templates.getTemplate(id);
    const example = runtime.templates.exampleSlide(id);
    const keys = spec.fields.filter((field: any) => field.generate).map((field: any) => field.key);
    if (example)
      example.fields = Object.fromEntries(
        Object.entries(example.fields).filter(([key]) => keys.includes(key)),
      );
    return { id, group: spec.group, use: spec.use, example };
  });
  return { schema, variants, layouts };
}

// The model sees caps with headroom; validation keeps the renderer's real caps,
// so a small overrun passes instead of costing a repair round.
const ADVERTISED = 0.85;
export function advertised(value: any): any {
  if (Array.isArray(value)) return value.map(advertised);
  if (!value || typeof value !== "object") return value;
  const out: any = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, advertised(item)]),
  );
  if (Number.isInteger(value.maxLength))
    out.maxLength = Math.max(1, Math.floor(value.maxLength * ADVERTISED));
  if (typeof value.description === "string")
    out.description = value.description.replace(
      /(max|=)\s?(\d+) chars/g,
      (_: string, word: string, count: string) =>
        `${word}${word === "max" ? " " : ""}${Math.max(1, Math.floor(Number(count) * ADVERTISED))} chars`,
    );
  return out;
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const compiled = new WeakMap<object, any>();
const check = (schema: object, value: unknown) => {
  let validate = compiled.get(schema);
  if (!validate) compiled.set(schema, (validate = ajv.compile(schema)));
  validate(value);
  return (validate.errors || []) as any[];
};
const describe = (error: any, value: any) => {
  const at = String(error.instancePath || "")
    .split("/")
    .filter(Boolean)
    .reduce((node: any, key: string) => node?.[key], value);
  if (error.keyword === "maxLength" && typeof at === "string")
    return `${at.length} chars, too long. Shorten it to at most ${Math.floor(error.params.limit * ADVERTISED)} chars.`;
  if (["maxItems", "minItems"].includes(error.keyword) && Array.isArray(at))
    return `has ${at.length} items, ${error.keyword === "maxItems" ? "max" : "min"} ${error.params.limit}.`;
  return error.message;
};
const pointer = (error: any) =>
  String(error.instancePath || "")
    .split("/")
    .filter(Boolean)
    .join(".");

// Repair feedback for one generated deck, empty when it is ready to render.
export function slidesIssues(
  deck: any,
  context: ReturnType<typeof slidesContext>,
): string[] {
  const { schema, variants } = context;
  const envelope = {
    ...schema,
    properties: {
      ...schema.properties,
      slides: {
        type: "array",
        minItems: schema.properties.slides.minItems,
        maxItems: schema.properties.slides.maxItems,
      },
    },
  };
  const errors = check(envelope, deck).map(
    (error) => `${pointer(error)}: ${error.message}`,
  );
  if (errors.length) return errors.slice(0, 12);
  deck.slides.forEach((slide: any, index: number) => {
    const variant = variants[slide?.template];
    if (!variant) {
      errors.push(`slides.${index}.template must be one of ${Object.keys(variants).join(", ")}`);
      return;
    }
    for (const error of check(variant, slide))
      errors.push(`slides.${index}.${pointer(error)}: ${describe(error, slide)}`);
  });
  if (errors.length) return errors.slice(0, 12);
  if (deck.slides[0].template !== "title" || deck.slides.at(-1).template !== "closing")
    errors.push("The first slide must use title and the last slide must use closing (both count toward the total).");
  errors.push(...runtime.deck.validateDeck(deck, { strict: true }));
  return errors.slice(0, 12);
}

const sourceList = (value: unknown): SlideSource[] =>
  (Array.isArray(value) ? value : []).slice(0, 6).map((source: any) => {
    const page = Number(source?.page);
    if (typeof source?.materialId !== "string" || !Number.isInteger(page) || page < 1)
      throw badRequest("Each slide source needs a material and a page.");
    return { materialId: source.materialId.slice(0, 120), page };
  });

// The runtime reports structural problems in Japanese; teachers see English.
const english = (message: string) =>
  message
    .replace(/必須フィールド "([^"]+)"（[^）]*）が空です/, '"$1" is required')
    .replace(/template "([^"]*)" は存在しません。.*/, 'layout "$1" does not exist');

// Accepts a saved or edited deck and keeps only what Folio stores.
export function validateSlidemakerDeck(input: any): SlidemakerDeck {
  if (!input || !Array.isArray(input.slides) || !input.slides.length || input.slides.length > 30)
    throw badRequest("A deck must contain between 1 and 30 slides.");
  const deck: SlidemakerDeck = {
    format: "slidemaker",
    title: String(input.title || "").trim().slice(0, 160) || "Courseware",
    lang: slideLang(input.lang),
    aspect: "16:9",
    style: slideStyle(input.style),
    slides: input.slides.map((slide: any) => {
      if (!slide || typeof slide.template !== "string" || !slide.fields || typeof slide.fields !== "object")
        throw badRequest("Each slide needs a layout and its fields.");
      return {
        template: slide.template,
        fields: slide.fields,
        notes: String(slide.notes || "").slice(0, NOTES_MAX),
        sources: sourceList(slide.sources),
      };
    }),
  };
  const errors = (runtime.deck.validateDeck(deck) as string[]).map(english);
  if (errors.length)
    throw badRequest(`This deck cannot be rendered: ${errors.slice(0, 3).join("; ")}`);
  return deck;
}

// The preview replays the same PPTX drawing as HTML, so it shows the chosen
// style exactly. It runs in a sandboxed frame, so the sandbox policy goes first.
export const PREVIEW_MARK = '<meta name="slidemaker-preview" content="pptx">';
export async function slidesHtml(deck: SlidemakerDeck): Promise<string> {
  const html: string = await runtime.preview.renderDeckPreview(deck, {
    templateId: slideStyle(deck.style),
  });
  return html.replace(
    /<head>/i,
    `<head><meta http-equiv="Content-Security-Policy" content="${sandboxCsp}">`,
  );
}

export async function slidesPptx(deck: SlidemakerDeck): Promise<Buffer> {
  return runtime.pptx.renderDeckPptx(deck, {
    templateId: slideStyle(deck.style),
    author: "Folio",
  });
}

const leaves = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : typeof value === "number"
      ? [String(value)]
      : Array.isArray(value)
        ? value.flatMap(leaves)
        : value && typeof value === "object"
          ? Object.values(value).flatMap(leaves)
          : [];
export const slideText = (slide: SlidemakerSlide) =>
  leaves(slide.fields).filter(Boolean).join("\n");
