'use strict';

// Style-specific arrangements reuse the common field protocol and drawing API.
function createLayout({ colors: C, geometry }) {
  const { PAD, units } = geometry;
  const p = PAD.left;
  const labelFont = 'Georgia';
  function textHeight(text, size, width, leading = 1.25) {
    return String(text || '').split('\n').reduce((n, line) =>
      n + Math.max(1, Math.ceil(units(line) * size / Math.max(1, width))), 0) * size * leading;
  }
  function fitted(d, text, box, { size = 28, min = 15, ...options } = {}) {
    let actual = size;
    // Leave room for font substitution and PowerPoint/LibreOffice line spacing.
    while (actual > min && textHeight(text, actual, box.w * 0.9, 1.5) > box.h - 4) actual--;
    d.text(text, { ...box, size: actual, lh: 1.25, ...options });
  }
  function label(d, text, x, y, w, dark = false) {
    d.text(text, { x, y, w, h: 21, size: 13, bold: true, font: labelFont,
      color: dark ? C.gold : C.goldDeep, lh: 1 });
  }
  function pageNumber(d, ctx, dark = false) {
    d.text(`${String((ctx.slideIndex || 0) + 1).padStart(2, '0')} / ${String(ctx.total).padStart(2, '0')}`,
      { x: ctx.W - p - 95, y: 33, w: 95, h: 18, size: 12, font: 'Courier New',
        color: dark ? C.paper : C.ink, align: 'right', lh: 1 });
  }
  function footer(d, ctx, index = ctx.slideIndex || 0, dark = false) {
    const y = ctx.H - 47;
    d.rect({ x: 0, y, w: ctx.W, h: 47, fill: dark ? C.navyDeep : C.white });
    d.seg(0, y, ctx.W, y, { color: dark ? C.navySoft : C.grayLight, width: 1 });
    fitted(d, (ctx.deckTitle || 'COURSE NOTES').replace(/\s+/g, ' '), { x: p, y: y + 6, w: ctx.cw - 125, h: 16 },
      { size: 11, min: 9, color: dark ? C.gold : C.goldDeep, bold: true });
    d.text(`${index + 1} / ${ctx.total}`, { x: ctx.W - p - 100, y: y + 6, w: 100, h: 16,
      size: 11, color: dark ? C.paper : C.navy, align: 'right', lh: 1 });
    const count = Math.max(1, ctx.total);
    const gap = count > 60 ? 0 : 2;
    const w = (ctx.cw - gap * (count - 1)) / count;
    for (let i = 0; i < count; i++) d.rect({ x: p + i * (w + gap), y: ctx.H - 19,
      w, h: 10, fill: i <= index ? (dark ? C.gold : C.navy) : (dark ? C.navySoft : C.canvas) });
  }
  function header(d, ctx, title, lead, chip) {
    const key = String(ctx.layoutName || 'course notes').replace(/-/g, ' ').toUpperCase();
    label(d, `${String((ctx.slideIndex || 0) + 1).padStart(2, '0')}  ·  ${key}${chip ? `  ·  ${chip}` : ''}`,
      p, 33, ctx.cw - 115);
    pageNumber(d, ctx);
    d.rect({ x: p, y: 64, w: 80, h: 3, fill: C.gold });
    const size = units(title) > 47 ? 35 : 44;
    const h = Math.min(105, textHeight(title, size, ctx.cw) + 4);
    fitted(d, title, { x: p, y: 88, w: ctx.cw, h }, { size, min: 27, bold: true, color: C.navy });
    let y = 88 + h + 27;
    if (lead) {
      const hLead = Math.min(66, textHeight(lead, 21, ctx.cw) + 4);
      fitted(d, lead, { x: p, y, w: ctx.cw, h: hLead }, { size: 21, min: 17, color: C.gray });
      y += hLead + 18;
    }
    return y;
  }
  function darkCanvas(d, ctx) {
    d.rect({ x: 0, y: 0, w: ctx.W, h: ctx.H, fill: C.navy });
    d.rect({ x: 0, y: 0, w: ctx.W, h: 6, fill: C.gold });
    pageNumber(d, ctx, true);
  }
  const emitters = {
    title(d, f, ctx) {
      darkCanvas(d, ctx);
      const rail = Math.round(ctx.W * 0.285);
      const x = rail + 58;
      const w = ctx.W - x - p;
      d.rect({ x: 0, y: 6, w: rail, h: ctx.H - 53, fill: C.navyDeep });
      label(d, 'COLLEGE  /  SEMINAR', p, 95, rail - p - 20, true);
      fitted(d, ctx.deckTitle || 'COURSE\nNOTES', { x: p, y: 165, w: rail - p - 26, h: 225 },
        { size: 68, min: 28, bold: true, color: C.paper });
      fitted(d, f.presenter, { x: p, y: 474, w: rail - p - 22, h: 62 },
        { size: 19, color: C.paper });
      fitted(d, f.date, { x: p, y: 550, w: rail - p - 22, h: 50 }, { size: 17, color: C.gold });
      label(d, 'DISCUSSION  SECTION', x, 129, w, true);
      fitted(d, f.title, { x, y: 181, w, h: 235 }, { size: 62, min: 30, bold: true, color: C.paper });
      d.rect({ x, y: 459, w: 82, h: 4, fill: C.gold });
      fitted(d, f.subtitle, { x, y: 493, w, h: 121 }, { size: 28, min: 19, color: C.gold });
      footer(d, ctx, ctx.slideIndex, true);
    },
    closing(d, f, ctx) {
      darkCanvas(d, ctx);
      label(d, 'REFLECTION  /  NEXT STEPS', p, 69, ctx.cw - 100, true);
      fitted(d, f.message, { x: p, y: 144, w: ctx.cw, h: 220 }, { size: 68, min: 32, bold: true, color: C.paper });
      d.rect({ x: p, y: 408, w: ctx.cw, h: 174, fill: C.navySoft });
      d.rect({ x: p, y: 408, w: 7, h: 174, fill: C.gold });
      fitted(d, f.submessage, { x: p + 28, y: 435, w: ctx.cw - 56, h: 112 }, { size: 28, min: 20, color: C.paper });
      fitted(d, f.contact, { x: p, y: 611, w: ctx.cw, h: 37 }, { size: 18, color: C.gold });
      footer(d, ctx, ctx.slideIndex, true);
    },
    section(d, f, ctx) {
      darkCanvas(d, ctx);
      label(d, 'CHAPTER  /  DISCUSSION', p, 69, ctx.cw - 100, true);
      const numberW = f.number ? 160 : 0;
      if (f.number) fitted(d, f.number, { x: p, y: 170, w: 142, h: 147 }, { size: 110, min: 48, bold: true, color: C.gold });
      fitted(d, f.title, { x: p + numberW, y: 161, w: ctx.cw - numberW, h: 171 }, { size: 57, min: 30, bold: true, color: C.paper });
      fitted(d, f.subtitle, { x: p + numberW, y: 354, w: ctx.cw - numberW, h: 80 }, { size: 27, min: 20, color: C.gold });
      if (f.chapters.length) {
        const cols = Math.min(4, f.chapters.length);
        const rows = Math.ceil(f.chapters.length / cols);
        const gap = 14, w = (ctx.cw - gap * (cols - 1)) / cols;
        const h = (175 - gap * (rows - 1)) / rows;
        f.chapters.forEach((item, i) => {
          const x = p + (i % cols) * (w + gap), y = 463 + Math.floor(i / cols) * (h + gap);
          d.rect({ x, y, w, h, fill: C.navySoft });
          fitted(d, `${String(i + 1).padStart(2, '0')}  ${item}`, { x: x + 16, y: y + 16, w: w - 32, h: h - 28 },
            { size: 22, min: 14, color: C.paper });
        });
      }
      footer(d, ctx, ctx.slideIndex, true);
    },
    agenda(d, f, ctx) {
      const y = header(d, ctx, f.title);
      const step = Math.min(91, (ctx.H - 73 - y) / Math.max(1, f.items.length));
      f.items.forEach((item, i) => {
        d.text(String(i + 1).padStart(2, '0'), { x: p, y: y + i * step, w: 64, h: step - 12,
          size: Math.min(38, step * 0.55), bold: true, color: C.gold, lh: 1 });
        fitted(d, item, { x: p + 84, y: y + i * step + 2, w: ctx.cw - 84, h: step - 17 },
          { size: 28, min: 17, color: C.navy, bold: true });
        d.seg(p, y + (i + 1) * step - 8, ctx.W - p, y + (i + 1) * step - 8, { color: C.grayLight });
      });
    },
    'key-points'(d, f, ctx) {
      const y = header(d, ctx, f.title);
      const cols = Math.min(3, Math.max(1, f.points.length)), rows = Math.ceil(f.points.length / cols);
      const gap = 20, w = (ctx.cw - gap * (cols - 1)) / cols;
      const h = (ctx.H - 81 - y - gap * (rows - 1)) / Math.max(1, rows);
      f.points.forEach((item, i) => {
        const x = p + (i % cols) * (w + gap), top = y + Math.floor(i / cols) * (h + gap);
        d.rect({ x, y: top, w, h, fill: C.white, line: C.grayLight, lineW: 1 });
        d.rect({ x, y: top, w, h: 5, fill: C.gold });
        const image = ctx.img[f.images[i]];
        if (image) d.image({ res: image, x: x + 22, y: top + 20, w: w - 44, h: h * 0.27, fit: 'contain' });
        else d.text(String(i + 1).padStart(2, '0'), { x: x + 25, y: top + 24, w: w - 50, h: Math.min(70, h * 0.23),
          size: Math.min(52, h * 0.2), bold: true, color: C.gold, lh: 1 });
        fitted(d, item.heading, { x: x + 25, y: top + h * 0.32, w: w - 50, h: h * 0.23 },
          { size: 27, min: 17, bold: true, color: C.navy });
        fitted(d, item.body, { x: x + 25, y: top + h * 0.61, w: w - 50, h: h * 0.31 },
          { size: 22, min: 15, color: C.gray });
      });
    },
    quote(d, f, ctx) {
      const y = header(d, ctx, f.title);
      const h = ctx.H - 160 - y;
      const image = ctx.img[f.imageSrc];
      d.rect({ x: p, y, w: ctx.cw, h, fill: C.navy });
      d.rect({ x: p, y, w: 9, h, fill: C.gold });
      const imageW = image ? Math.min(220, ctx.cw * 0.25) : 0;
      fitted(d, f.quote, { x: p + 37, y: y + 33, w: ctx.cw - 74 - imageW, h: h - 66 },
        { size: 39, min: 23, color: C.paper });
      if (image) d.image({ res: image, x: ctx.W - p - imageW - 22, y: y + 28, w: imageW - 16, h: h - 56, fit: 'contain' });
      fitted(d, [f.name, f.role].filter(Boolean).join(' · '), { x: p, y: y + h + 22, w: ctx.cw, h: 40 },
        { size: 20, min: 16, color: C.goldDeep });
    },
    'image-text'(d, f, ctx) {
      const y = header(d, ctx, f.title), gap = 36;
      const w = (ctx.cw - gap) / 2, h = ctx.H - 83 - y;
      const leadH = f.lead ? Math.min(h * 0.4, textHeight(f.lead, 24, w) + 12) : 0;
      if (f.lead) fitted(d, f.lead, { x: p, y, w, h: leadH }, { size: 24, color: C.navy });
      const top = y + leadH + (f.lead ? 20 : 0);
      const step = Math.min(90, (y + h - top) / Math.max(1, f.points.length));
      f.points.forEach((item, i) => {
        d.rect({ x: p, y: top + i * step + 6, w: 5, h: 16, fill: C.gold });
        fitted(d, item, { x: p + 20, y: top + i * step, w: w - 20, h: step - 10 },
          { size: 22, min: 16, color: C.ink });
      });
      const x = p + w + gap, imageH = h - (f.caption ? 42 : 0), image = ctx.img[f.imageSrc];
      d.rect({ x, y, w, h: imageH, fill: C.white, line: C.grayLight, lineW: 1 });
      if (image) d.image({ res: image, x: x + 12, y: y + 12, w: w - 24, h: imageH - 24, fit: 'contain' });
      else fitted(d, f.imageNote || 'IMAGE', { x: x + 25, y: y + imageH / 2 - 35, w: w - 50, h: 70 },
        { size: 23, color: C.gray, align: 'center' });
      if (f.caption) fitted(d, f.caption, { x, y: y + imageH + 13, w, h: 28 },
        { size: 17, min: 13, color: C.gray, align: 'center' });
    },
    'change-detail'(d, f, ctx) {
      const y = header(d, ctx, f.title, '', f.badge);
      const meta = [f.timing, f.scope].filter(Boolean).join('  ·  ');
      const h = ctx.H - 81 - y - (meta ? 55 : 0), gap = 24, w = (ctx.cw - gap) / 2;
      const blockH = (h - gap) / 2;
      const context = [['WHAT CHANGES', f.what], ['BACKGROUND', f.background]];
      context.forEach(([heading, body], i) => {
        const top = y + i * (blockH + gap);
        label(d, heading, p, top, w);
        fitted(d, body, { x: p, y: top + 36, w, h: blockH - 40 }, { size: 24, min: 16, color: C.ink });
      });
      [['IMPACT', f.impact], ['ACTION', f.action]].forEach(([heading, items], i) => {
        const top = y + i * (blockH + gap), x = p + w + gap;
        d.rect({ x, y: top, w, h: blockH, fill: i === 0 ? C.navy : C.white, line: C.grayLight, lineW: 1 });
        d.rect({ x, y: top, w: 5, h: blockH, fill: C.gold });
        label(d, heading, x + 23, top + 19, w - 46, i === 0);
        fitted(d, items.map(item => `•  ${item}`).join('\n'),
          { x: x + 23, y: top + 54, w: w - 46, h: blockH - 70 },
          { size: 21, min: 15, color: i === 0 ? C.paper : C.ink });
      });
      if (meta) {
        d.seg(p, y + h + 17, ctx.W - p, y + h + 17, { color: C.grayLight });
        fitted(d, meta, { x: p, y: y + h + 28, w: ctx.cw, h: 27 }, { size: 17, color: C.goldDeep });
      }
    },
    comparison(d, f, ctx) {
      const y = header(d, ctx, f.title);
      const cols = [1, 2, 3].filter(i => f[`col${i}Heading`]);
      const w = (ctx.cw - 24 * (cols.length - 1)) / Math.max(1, cols.length);
      const h = ctx.H - 81 - y;
      cols.forEach((id, index) => {
        const dark = Number(f.highlight) === id, x = p + index * (w + 24);
        d.rect({ x, y, w, h, fill: dark ? C.navy : C.white, line: C.grayLight, lineW: 1 });
        d.rect({ x, y, w, h: 7, fill: C.gold });
        fitted(d, f[`col${id}Heading`], { x: x + 25, y: y + 32, w: w - 50, h: 85 },
          { size: 29, min: 19, bold: true, color: dark ? C.paper : C.navy });
        const items = f[`col${id}Items`], step = Math.min(83, (h - 150) / Math.max(1, items.length));
        items.forEach((item, i) => {
          d.circle({ x: x + 27, y: y + 139 + i * step, size: 6, fill: C.gold });
          fitted(d, item, { x: x + 45, y: y + 132 + i * step, w: w - 68, h: step - 12 },
            { size: 23, min: 16, color: dark ? C.paper : C.ink });
        });
      });
    },
  };
  return { header, footer, emitters };
}
module.exports = { createLayout };
