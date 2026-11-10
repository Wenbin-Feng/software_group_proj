'use strict';

const PptxGenJS = require('../../vendor/pptxgen.cjs.js');
const geometry = require('../geometry');
const { getTemplate, normalizeFields } = require('../templates');
const { validateDeck } = require('../deck');
const { loadTemplate } = require('../template-loader');
const { createCommonEmitters } = require('./common-emitters');
const { createDrawing, hex } = require('./drawing');
const { resolveSlideImages, createHelpers } = require('./helpers');
const { translator } = require('../i18n');

function createContext(deck, opts) {
  const template = loadTemplate(opts.templateId === undefined ? 'default' : opts.templateId, { templatesRoot: opts.templatesRoot });
  const colors = template.colors;
  const font = template.resolveFont(deck, opts);
  const helpers = createHelpers({ colors });
  const context = { colors, font, helpers, geometry };
  const layout = template.createLayout(context);
  const common = createCommonEmitters({ ...context, header: layout.header });
  // Keep the original title/closing/section order, with private overrides first.
  const emitters = { ...layout.emitters };
  for (const [name, emit] of Object.entries(common)) {
    if (!Object.hasOwn(emitters, name)) emitters[name] = emit;
  }
  return { colors, font, footer: layout.footer, emitters };
}

function supportedTemplates(opts = {}) {
  return Object.keys(createContext({}, opts).emitters);
}

async function renderDeckPptx(deck, opts = {}) {
  const errors = validateDeck(deck);
  if (errors.length) {
    const err = new Error('deck の検証に失敗しました:\n  - ' + errors.join('\n  - '));
    err.validation = errors;
    throw err;
  }
  const { colors, font, footer, emitters } = createContext(deck, opts);
  const { ASPECTS, PAD } = geometry;
  const aspect = deck.aspect || '16:9';
  const { width: W, height: H } = ASPECTS[aspect];
  const unsupported = [...new Set(deck.slides.map((s) => s.template).filter((name) => !emitters[name]))];
  if (unsupported.length) {
    throw new Error(
      `PPTX 出力が未対応のテンプレートが含まれています: ${unsupported.join(', ')}\n` +
        `対応済み: ${Object.keys(emitters).join(', ')}`
    );
  }
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SLIDEMAKER', width: +(W / 96).toFixed(5), height: H / 96 });
  pptx.layout = 'SLIDEMAKER';
  pptx.author = opts.author || 'slidemaker';
  pptx.company = opts.author || 'slidemaker';
  pptx.title = deck.title || 'Slides';
  const lang = ['ja', 'zh', 'en'].includes(deck.lang) ? deck.lang : 'ja';
  const baseCtx = {
    aspect, W, H, cw: W - PAD.left - PAD.right, deckTitle: deck.title || '', total: deck.slides.length,
    lang, t: translator(lang),
  };
  const special = ['title', 'section', 'closing'];
  let section = null;
  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    const template = getTemplate(slide.template);
    const fields = normalizeFields(template, slide.fields);
    if (template.name === 'section') section = { number: fields.number, title: fields.title };
    const sl = pptx.addSlide();
    sl.background = { color: hex(colors.paper) };
    const ctx = { ...baseCtx, slideIndex: i, layoutName: template.name, section, img: await resolveSlideImages(fields) };
    const onOverflow = opts.onOverflow ? (info) => opts.onOverflow({ slide: i, template: template.name, ...info }) : undefined;
    const bottom = special.includes(template.name) ? H : H - 46;
    const drawing = createDrawing(sl, { colors, font, onOverflow, bottom });
    emitters[template.name](drawing, fields, ctx, sl);
    if (!special.includes(template.name)) footer(createDrawing(sl, { colors, font }), ctx, i);
    // Folio: teacher notes travel as PowerPoint speaker notes.
    if (typeof slide.notes === 'string' && slide.notes.trim()) sl.addNotes(slide.notes);
  }
  return pptx.write({ outputType: 'nodebuffer' });
}

module.exports = { renderDeckPptx, supportedTemplates };
