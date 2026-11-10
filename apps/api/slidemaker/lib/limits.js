'use strict';

// =============================================================
// Enforced content capacity for every PPTX layout.
//
// Budgets are measured in "width units": one CJK / full-width character = 1,
// one Latin letter, digit, space or half-width symbol = 0.55. They are derived
// from each layout's 16:9 geometry (font size x box width x allowed lines) and
// verified by rendering a deck that fills every field to its maximum.
// 4:3 decks scale text budgets by WIDTH_4_3; item counts stay the same.
//
// Field limit shapes (by field type):
//   text / textarea  : number (max units)
//   lines / csv      : { min, max, each }
//   numbers          : { min, max }
//   pairs            : { min, max, heading, body }
//   steps            : { min, max, label, heading, body }
//   callouts         : { min, max, text }
//   objects / rows   : { min, max, props: { key: units } } / { min, max, cell }
// `media` lists image-only fields that the image-free generation workflow drops.
// `generate: false` keeps a layout out of AI generation (image-centric).
// =============================================================

// Average Latin glyph width relative to a CJK glyph (Arial, mixed case incl. spaces).
// Verified by the English stress deck (word wrapping included) rendering without overflow.
const LATIN_UNIT = 0.55;
const WIDTH_4_3 = 0.72;

function budget(value) {
  let units = 0;
  for (const ch of String(value ?? '')) {
    if (ch === '\n' || ch === '\r') continue;
    units += ch.charCodeAt(0) <= 0xff || /[｡-ﾟ]/.test(ch) ? LATIN_UNIT : 1;
  }
  return Math.round(units * 10) / 10;
}

const T = 30; // body slide title: one line at 33px across the 1152px content width
const LEAD = 50; // lead: one line at 21px
const NOTE = 56; // bottom note: one line at 19px

const LIMITS = {
  title: { title: 28, subtitle: 50, presenter: 20, date: 16 },
  section: { number: 2, title: 22, subtitle: 30, chapters: { min: 0, max: 6, each: 12 } },
  closing: { message: 28, submessage: 60, contact: 36 },
  agenda: { title: T, items: { min: 3, max: 6, each: 28 } },
  bullets: {
    title: T, lead: LEAD,
    items: { min: 2, max: 4, heading: 34, body: 90 },
    images: { min: 0, max: 4, each: 4000 },
    media: ['images'],
  },
  'as-is-to-be': {
    title: T, asIsLabel: 10, toBeLabel: 10, transition: 8,
    asIsItems: { min: 2, max: 4, each: 38 }, toBeItems: { min: 2, max: 4, each: 38 },
    media: ['asIsImage', 'toBeImage'],
  },
  'big-number': {
    title: T, value: 4, unit: 3, caption: 22, description: 84,
    points: { min: 0, max: 3, each: 26 },
  },
  chart: {
    title: T, unit: 4, highlight: 2, delta: 16, note: NOTE,
    labels: { min: 2, max: 8, each: 6 }, values: { min: 2, max: 8 },
    callouts: { min: 0, max: 2, text: 10 },
    points: { min: 0, max: 4, each: 30 },
  },
  gantt: {
    title: T, note: NOTE,
    columns: { min: 3, max: 8, each: 5 },
    tasks: { min: 2, max: 7, props: { name: 14 } },
  },
  'image-text': {
    title: T, lead: 96, caption: 30, imageNote: 20, imageAlt: 60,
    points: { min: 0, max: 4, each: 48 },
    media: ['imageSrc', 'imageAlt', 'imageNote', 'caption'], generate: false,
  },
  comparison: {
    title: T, col1Heading: 16, col2Heading: 16, col3Heading: 16,
    col1Items: { min: 2, max: 4, each: 30 }, col2Items: { min: 2, max: 4, each: 30 },
    col3Items: { min: 0, max: 4, each: 30 },
  },
  'key-points': {
    title: T, points: { min: 2, max: 4, heading: 14, body: 60 },
    images: { min: 0, max: 4, each: 4000 }, media: ['images'],
  },
  timeline: {
    title: T,
    milestones: { min: 3, max: 5, label: 9, heading: 9, body: 40 },
    lanes: { min: 0, max: 3, each: 6 },
    bands: { min: 0, max: 8, props: { label: 8 } },
  },
  quote: {
    title: T, quote: 80, name: 16, role: 30,
    media: ['imageSrc', 'imageMode'],
  },
  'fact-profile': {
    title: T, lead: LEAD, facts: { min: 3, max: 6, heading: 6, body: 44 },
    caption: 30, imageAlt: 60, media: ['logo', 'imageSrc', 'imageAlt', 'caption'],
  },
  'case-summary': {
    title: 24, meta: 12,
    profile: { min: 0, max: 3, heading: 4, body: 12 },
    features: { min: 0, max: 4, each: 7 },
    challenge: { min: 1, max: 3, each: 22 }, solution: { min: 1, max: 3, each: 22 },
    outcome: { min: 1, max: 3, each: 22 },
    metric: 5, metricLabel: 24, voice: 56, voiceBy: 20,
    media: ['logo'],
  },
  pricing: {
    title: T, badge: 8,
    plan1Name: 10, plan1Price: 6, plan1Note: 16, plan1Items: { min: 2, max: 4, each: 28 },
    plan2Name: 10, plan2Price: 6, plan2Note: 16, plan2Items: { min: 0, max: 4, each: 28 },
    plan3Name: 10, plan3Price: 6, plan3Note: 16, plan3Items: { min: 0, max: 4, each: 28 },
  },
  stats: {
    title: T, lead: LEAD, note: NOTE, chartUnit: 4,
    stats: { min: 2, max: 4, heading: 4, body: 24 },
    chartLabels: { min: 0, max: 6, each: 6 }, chartValues: { min: 0, max: 6 },
  },
  table: {
    title: T, lead: LEAD, note: NOTE,
    columns: { min: 2, max: 5, each: 10 },
    // Per-cell budget depends on the column count (equal widths, two lines at 16px).
    rows: { min: 2, max: 5, cell: { 2: 60, 3: 40, 4: 28, 5: 20 } },
  },
  faq: { title: T, items: { min: 2, max: 4, heading: 40, body: 100 } },
  'changelog-list': {
    title: T, lead: LEAD,
    items: { min: 2, max: 5, label: 4, heading: 36, body: 46 },
    timings: { min: 0, max: 5, each: 7 },
  },
  'change-detail': {
    title: 26, badge: 4, timing: 14, scope: 20, what: 78, background: 52,
    impact: { min: 1, max: 3, each: 24 }, action: { min: 1, max: 3, each: 24 },
  },
  'talk-track': {
    title: T, lead: LEAD,
    items: { min: 2, max: 3, label: 20, heading: 60, body: 36 },
  },
  converge: {
    title: T, lead: LEAD, conclusionLabel: 4, conclusion: 60,
    points: { min: 2, max: 4, heading: 12, body: 40 },
  },
  drivers: {
    title: T, arrowLabel: 8, conclusionLabel: 8, conclusion: 50,
    points: { min: 2, max: 4, heading: 18, body: 40 },
    conclusionPoints: { min: 0, max: 3, each: 24 },
  },
  pyramid: {
    title: T, conclusionLabel: 4, conclusion: 60,
    points: { min: 2, max: 4, heading: 12, body: 40 },
  },
  'kpi-cards': {
    title: T, lead: LEAD, note: NOTE,
    kpis: { min: 2, max: 4, props: { label: 12, value: 5, unit: 3, delta: 7, note: 24 } },
  },
  donut: {
    title: T, lead: LEAD, unit: 4, centerLabel: 8, centerValue: 5,
    segments: { min: 2, max: 6, props: { label: 10 } },
    points: { min: 0, max: 3, each: 30 },
  },
  'chart-series': {
    title: T, lead: LEAD, unit: 6, note: NOTE,
    categories: { min: 2, max: 12, each: 6 },
    series: { min: 1, max: 4, props: { name: 10 } },
    points: { min: 0, max: 3, each: 30 },
  },
  progress: {
    title: T, lead: LEAD, note: NOTE,
    items: { min: 2, max: 6, props: { label: 14, display: 9, note: 20 } },
  },
  funnel: {
    title: T, lead: LEAD, unit: 4,
    stages: { min: 3, max: 6, props: { label: 10, note: 14 } },
    points: { min: 0, max: 3, each: 30 },
  },
  matrix: {
    title: T, xLabel: 14, yLabel: 10, highlight: 1,
    quadrants: { min: 4, max: 4, props: { heading: 12, body: 52 } },
  },
  process: {
    title: T, lead: LEAD, conclusion: 54,
    steps: { min: 3, max: 6, props: { heading: 9, body: 34 } },
  },
};

const unitsFor = (max, aspect) => (aspect === '4:3' ? Math.floor(max * WIDTH_4_3 * 10) / 10 : max);

// Characters allowed in JSON Schema terms: CJK decks count characters 1:1,
// English decks may use the narrower Latin width.
function maxChars(max, lang, aspect) {
  const units = unitsFor(max, aspect);
  return Math.max(1, Math.floor(lang === 'en' ? units / LATIN_UNIT : units));
}

function limitOf(templateName, key) {
  const entry = LIMITS[templateName];
  return entry ? entry[key] : undefined;
}

function isMedia(templateName, key) {
  const entry = LIMITS[templateName];
  return !!(entry && entry.media && entry.media.includes(key));
}

function generationEnabled(templateName) {
  const entry = LIMITS[templateName];
  return !!entry && entry.generate !== false;
}

function tableCellLimit(limit, columns) {
  const n = Math.min(Math.max(columns, 2), 5);
  return limit.cell[n];
}

// Human/LLM-readable capacity guidance derived from the enforced limit.
function describe(spec, limit) {
  if (limit == null) return spec.fit;
  const u = (n) => `≤${n}字`;
  const count = (l) => (l.min === l.max ? `${l.max}项` : `${l.min}–${l.max}项`);
  if (typeof limit === 'number') return `${u(limit)}（中日文1字=1，英数≈0.55）`;
  const parts = [count(limit)];
  if (limit.each) parts.push(`每项${u(limit.each)}`);
  for (const k of ['label', 'heading', 'body', 'text']) if (limit[k]) parts.push(`${k}${u(limit[k])}`);
  if (limit.props) for (const [k, v] of Object.entries(limit.props)) parts.push(`${k}${u(v)}`);
  if (limit.cell) parts.push(`每格: ${Object.entries(limit.cell).map(([c, v]) => `${c}列${u(v)}`).join(' / ')}`);
  return parts.join('，');
}

// ---- validation ----

// Rendering enforces maxima (anything that would overflow the layout). Minimum item
// counts are authoring guidance: the generation schema enforces them, and strict
// validation can be requested explicitly.
function validateLimits(template, fields, { aspect = '16:9', path = '', strict = false } = {}) {
  const errors = [];
  const entry = LIMITS[template.name];
  if (!entry) return errors;
  // English messages: they are fed back to the LLM in the generation repair loop.
  const over = (where, value, max) => {
    const allowed = unitsFor(max, aspect);
    const used = budget(value);
    if (used <= allowed) return;
    const latinOnly = !/[^\x00-\xff]/.test(String(value));
    errors.push(latinOnly
      ? `${path}${where}: text too long (${String(value).length} chars, max ${Math.floor(allowed / LATIN_UNIT)}). Shorten it.`
      : `${path}${where}: text too long (${used} width units, max ${allowed}; CJK char = 1, Latin char = 0.55). Shorten it.`);
  };
  const count = (where, arr, l) => {
    if (strict && l.min != null && arr.length < l.min && (l.min > 0)) errors.push(`${path}${where}: needs at least ${l.min} items (has ${arr.length})`);
    if (l.max != null && arr.length > l.max) errors.push(`${path}${where}: allows at most ${l.max} items (has ${arr.length})`);
  };
  for (const spec of template.fields) {
    const limit = entry[spec.key];
    if (limit == null) continue;
    const v = fields[spec.key];
    const key = spec.key;
    switch (spec.type) {
      case 'text':
      case 'textarea':
      case 'select':
        if (typeof limit === 'number' && v) over(key, v, limit);
        break;
      case 'lines':
      case 'csv':
        if (v.length || spec.required) count(key, v, limit);
        if (limit.each) v.forEach((item, i) => over(`${key}[${i}]`, item, limit.each));
        break;
      case 'numbers':
        if (v.length || spec.required) count(key, v, limit);
        break;
      case 'pairs':
      case 'steps':
      case 'callouts':
        if (v.length || spec.required) count(key, v, limit);
        v.forEach((item, i) => {
          for (const k of ['label', 'heading', 'body', 'text']) if (limit[k] && item[k]) over(`${key}[${i}].${k}`, item[k], limit[k]);
        });
        break;
      case 'objects':
        if (v.length || spec.required) count(key, v, limit);
        v.forEach((item, i) => {
          for (const [k, max] of Object.entries(limit.props || {})) if (item[k]) over(`${key}[${i}].${k}`, item[k], max);
        });
        break;
      case 'rows': {
        if (v.length || spec.required) count(key, v, limit);
        const n = (fields.columns || []).length;
        const cellMax = tableCellLimit(limit, n);
        v.forEach((row, i) => {
          if (n && row.length !== n) errors.push(`${path}${key}[${i}]: row has ${row.length} cells but there are ${n} columns`);
          row.forEach((cell, j) => over(`${key}[${i}][${j}]`, cell, cellMax));
        });
        break;
      }
      default:
        break;
    }
  }
  return errors;
}

module.exports = {
  LIMITS, LATIN_UNIT, WIDTH_4_3, budget, maxChars, limitOf, isMedia, generationEnabled,
  tableCellLimit, describe, validateLimits, unitsFor,
};
