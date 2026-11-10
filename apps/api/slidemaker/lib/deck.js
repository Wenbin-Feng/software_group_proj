'use strict';

const { ASPECTS } = require('./geometry');
const { TEMPLATES, getTemplate, templateNames, normalizeFields } = require('./templates');
const { validateLimits, maxChars, tableCellLimit } = require('./limits');

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

// Data consistency that a JSON Schema cannot express (lengths, index ranges, sums).
const CHECKS = {
  chart(f, err) {
    if (f.labels.length !== f.values.length) err(`labels (${f.labels.length}) and values (${f.values.length}) must have the same length`);
    const n = f.values.length;
    if (f.highlight !== '' && !(Number(f.highlight) >= 0 && Number(f.highlight) < n)) err(`highlight must be a data index from 0 to ${n - 1}, or empty`);
    f.callouts.forEach((c, i) => { if (!(c.index >= 0 && c.index < n)) err(`callouts[${i}].index must be 0 to ${n - 1}`); });
    if (f.delta) {
      const [a, b] = String(f.delta).split('::').map((s) => Number(s.trim()));
      if (!(a >= 0 && a < n && b >= 0 && b < n)) err(`delta must be "fromIndex :: toIndex" with indexes 0 to ${n - 1}`);
    }
  },
  stats(f, err) {
    if (f.chartType && f.chartLabels.length !== f.chartValues.length) err('chartLabels and chartValues must have the same length');
    if (f.chartType && f.chartLabels.length < 2) err('chartType needs at least 2 data points');
  },
  gantt(f, err) {
    const n = f.columns.length;
    f.tasks.forEach((t, i) => {
      if (!t.name) err(`tasks[${i}].name is empty`);
      if (!(t.start >= 1 && t.end >= t.start && t.end <= n)) err(`tasks[${i}]: start/end must be column numbers 1 to ${n} with start <= end`);
    });
  },
  timeline(f, err) {
    const n = f.milestones.length;
    f.bands.forEach((b, i) => {
      if (!(b.lane >= 1 && b.lane <= f.lanes.length)) err(`bands[${i}].lane must be 1 to ${f.lanes.length}`);
      if (!(b.start >= 1 && b.end >= b.start && b.end <= n)) err(`bands[${i}]: start/end must be milestone numbers 1 to ${n} with start <= end`);
    });
  },
  table(f, err) {
    if (f.highlight && Number(f.highlight) > f.columns.length) err(`highlight must be a column number 1 to ${f.columns.length}`);
  },
  comparison(f, err) {
    if (f.col3Items.length && !f.col3Heading) err('col3Items requires col3Heading');
    if (f.highlight === '3' && !f.col3Heading) err('highlight=3 requires a third column');
  },
  pricing(f, err) {
    for (const n of [2, 3]) {
      // A plan is shown only when it has a name; then it needs a price and items.
      if (f[`plan${n}Name`] && !(f[`plan${n}Price`] && f[`plan${n}Items`].length)) err(`plan${n} needs Name, Price and Items`);
    }
    if (f.highlight && !f[`plan${f.highlight}Name`]) err(`highlight=${f.highlight} refers to a missing plan`);
  },
  'kpi-cards'(f, err) {
    f.kpis.forEach((k, i) => {
      if (!k.label || !k.value) err(`kpis[${i}]: label and value are required`);
      // Fewer than 3 sparkline points simply draws no sparkline.
      if (k.series.length > 12) err(`kpis[${i}].series allows at most 12 numbers`);
    });
  },
  donut(f, err) {
    f.segments.forEach((s, i) => { if (!s.label || !isNum(s.value) || s.value < 0) err(`segments[${i}]: needs a label and a value >= 0`); });
    if (!(f.segments.reduce((a, s) => a + (s.value || 0), 0) > 0)) err('segments must sum to more than 0');
  },
  'chart-series'(f, err) {
    const n = f.categories.length;
    f.series.forEach((s, i) => {
      if (!s.name) err(`series[${i}].name is empty`);
      if (s.values.length !== n) err(`series[${i}].values (${s.values.length}) must have one value per category (${n})`);
    });
    if (f.chartType === 'hbar' && n > 8) err('hbar allows at most 8 categories');
  },
  progress(f, err) {
    f.items.forEach((it, i) => {
      if (!it.label || !isNum(it.value) || it.value < 0) err(`items[${i}]: needs a label and a value >= 0`);
      if (it.target != null && !(it.target > 0)) err(`items[${i}].target must be positive`);
    });
  },
  funnel(f, err) {
    f.stages.forEach((s, i) => { if (!s.label || !isNum(s.value) || s.value < 0) err(`stages[${i}]: needs a label and a value >= 0`); });
    if (!(f.stages.length && f.stages[0].value > 0)) err('the first stage value must be greater than 0');
  },
  matrix(f, err) {
    f.quadrants.forEach((q, i) => { if (!q.heading) err(`quadrants[${i}].heading is empty`); });
  },
  process(f, err) {
    f.steps.forEach((s, i) => { if (!s.heading) err(`steps[${i}].heading is empty`); });
  },
};

// limits=false skips capacity checks (HTML preview); strict=true also enforces minimum item counts.
function validateDeck(deck, { strict = false, limits = true } = {}) {
  const errors = [];
  if (!deck || typeof deck !== 'object') return ['deck が JSON オブジェクトではありません'];
  const aspect = deck.aspect || '16:9';
  if (!ASPECTS[aspect]) {
    errors.push(`aspect "${aspect}" は不正です。使用可能: ${Object.keys(ASPECTS).join(', ')}`);
  }
  if (!Array.isArray(deck.slides) || deck.slides.length === 0) {
    errors.push('slides は1枚以上のスライドを含む配列にしてください');
    return errors;
  }
  deck.slides.forEach((slide, i) => {
    const t = slide && getTemplate(slide.template);
    if (!t) {
      errors.push(`slides[${i}]: template "${slide && slide.template}" は存在しません。使用可能: ${templateNames().join(', ')}`);
      return;
    }
    const fields = normalizeFields(t, slide.fields);
    for (const spec of t.fields) {
      if (!spec.required) continue;
      const v = fields[spec.key];
      const empty = Array.isArray(v) ? v.length === 0 : !v;
      if (empty) errors.push(`slides[${i}] (${t.name}): 必須フィールド "${spec.key}"（${spec.label}）が空です`);
    }
    const prefix = `slides[${i}] (${t.name}).`;
    if (limits) errors.push(...validateLimits(t, fields, { aspect: ASPECTS[aspect] ? aspect : '16:9', path: prefix, strict }));
    if (CHECKS[t.name]) CHECKS[t.name](fields, (message) => errors.push(prefix + message));
  });
  return errors;
}

// JSON Schema for decks. Options:
//   lang / aspect : size maxLength for the deck's language and aspect ratio
//   generation    : strict authoring schema (no image fields, no image-centric or
//                   HTML-only layouts, no undeclared properties)
function deckSchema(opts = {}) {
  const { lang = 'zh', aspect = '16:9', generation = false } = opts;
  const chars = (n) => maxChars(n, lang, aspect);
  const str = (max, extra = {}) => ({ type: 'string', ...(max ? { maxLength: chars(max) } : {}), ...extra });
  const counts = (l) => (l ? { ...(l.min ? { minItems: l.min } : {}), ...(l.max != null ? { maxItems: l.max } : {}) } : {});
  const strict = generation ? { additionalProperties: false } : {};
  const typeToSchema = (spec) => {
    const l = spec.limit;
    switch (spec.type) {
      case 'lines':
      case 'csv':
        return { type: 'array', items: str(l && l.each), ...counts(l) };
      case 'numbers':
        return { type: 'array', items: { type: 'number' }, ...counts(l) };
      case 'pairs':
        return { type: 'array', ...counts(l), items: { type: 'object', properties: { heading: str(l && l.heading), body: str(l && l.body) }, required: ['heading'], ...strict } };
      case 'steps':
        return { type: 'array', ...counts(l), items: { type: 'object', properties: { label: str(l && l.label), heading: str(l && l.heading), body: str(l && l.body) }, required: ['heading'], ...strict } };
      case 'callouts':
        return { type: 'array', ...counts(l), items: { type: 'object', properties: { index: { type: 'integer', minimum: 0 }, text: str(l && l.text) }, required: ['index', 'text'], ...strict } };
      case 'rows': {
        const widest = l ? tableCellLimit(l, 2) : 0;
        return {
          type: 'array', ...counts(l),
          items: { type: 'array', items: str(widest), minItems: 2, maxItems: 5 },
          description: l ? `Array of rows; each row is an array of cells, one per column. Cell caps: ${Object.entries(l.cell).map(([n, v]) => `${n} cols=${chars(v)} chars`).join(', ')}` : undefined,
        };
      }
      case 'objects': {
        const props = {};
        for (const [key, p] of Object.entries(spec.props)) {
          const max = l && l.props && l.props[key];
          if (p.type === 'number') props[key] = { type: 'number', ...(p.description ? { description: p.description } : {}) };
          else if (p.type === 'numbers') props[key] = { type: 'array', items: { type: 'number' }, ...(p.description ? { description: p.description } : {}) };
          else props[key] = str(max, { ...(p.enum ? { enum: p.enum } : {}), ...(p.description ? { description: p.description } : {}) });
        }
        const required = Object.entries(spec.props).filter(([, p]) => p.required).map(([k]) => k);
        return { type: 'array', ...counts(l), items: { type: 'object', properties: props, required, ...strict } };
      }
      case 'select':
        return { type: 'string', enum: spec.options };
      case 'raw':
        return {}; // 任意のネスト構造（discussion-map のノード・リンク等）
      default:
        return str(typeof l === 'number' ? l : 0);
    }
  };
  const templates = generation ? TEMPLATES.filter((t) => t.generate) : TEMPLATES;
  const fieldsOf = (t) => (generation ? t.fields.filter((s) => s.generate) : t.fields);
  // Generation descriptions are English authoring guidance plus the concrete cap.
  const capText = (spec) => {
    const l = spec.limit;
    if (l == null) return '';
    if (typeof l === 'number') return `max ${chars(l)} chars`;
    const parts = [];
    if (l.max != null) parts.push(l.min && l.min === l.max ? `exactly ${l.max} items` : `${l.min || 0}-${l.max} items`);
    if (l.each) parts.push(`each max ${chars(l.each)} chars`);
    for (const k of ['label', 'heading', 'body', 'text']) if (l[k]) parts.push(`${k} max ${chars(l[k])} chars`);
    if (l.props) for (const [k, v] of Object.entries(l.props)) parts.push(`${k} max ${chars(v)} chars`);
    if (l.cell) parts.push(`cell max chars by column count: ${Object.entries(l.cell).map(([n, v]) => `${n} cols=${chars(v)}`).join(', ')}`);
    return parts.join('; ');
  };
  const describeField = (s) => (generation
    ? [s.guide || s.label, capText(s)].filter(Boolean).join(' — ')
    : [s.label, s.fit].filter(Boolean).join(' — '));
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'slidemaker deck',
    type: 'object',
    required: ['slides'],
    properties: {
      title: { type: 'string', maxLength: chars(40), description: '資料タイトル（フッターに表示）' },
      aspect: { type: 'string', enum: Object.keys(ASPECTS), default: '16:9', description: 'アスペクト比' },
      lang: { type: 'string', enum: ['ja', 'zh', 'en'], default: 'ja', description: '言語（フォント字形を切替。ja=和文Aoto Gothic / zh=簡体字Noto Sans SC / en=Inter）' },
      meta: {
        type: 'object',
        description: '型の記録（任意・再生成用。レンダリングには影響しない）。SKILL の4骨格を保存しておくと同条件で組み直せる',
        properties: {
          intent: { type: 'string', enum: ['proposal', 'review', 'report', 'decision'], description: '用途: 社外提案 / 社外定例 / 社内報告 / 社内意思決定' },
          size: { type: 'string', enum: ['brief', 'standard', 'full'], description: 'ボリューム: 〜5枚 / 8〜12枚 / 15枚〜' },
          audience: { type: 'string', enum: ['external', 'internal'], description: 'intent から自動（proposal/review=external, report/decision=internal）' },
        },
        additionalProperties: true,
      },
      slides: {
        type: 'array',
        minItems: 1,
        items: {
          oneOf: templates.map((t) => ({
            type: 'object',
            description: generation && t.use ? t.use : `${t.label}: ${t.description}`,
            required: generation ? ['template', 'fields'] : ['template'],
            properties: {
              template: { const: t.name },
              fields: {
                type: 'object',
                properties: Object.fromEntries(fieldsOf(t).map((s) => [s.key, { ...typeToSchema(s), description: describeField(s) }])),
                required: fieldsOf(t).filter((s) => s.required).map((s) => s.key),
                ...strict,
              },
            },
            ...strict,
          })),
        },
      },
    },
  };
}

module.exports = { validateDeck, deckSchema };
