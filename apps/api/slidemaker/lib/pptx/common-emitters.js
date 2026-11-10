'use strict';

const { PAD, IN, PT, textW, estLines } = require('../geometry');
const { hex } = require('./drawing');
const { buildChart: buildChartGeometry } = require('../chart');
const { createDataEmitters } = require('./data-emitters');

// Templates can replace individual layouts without copying the shared render loop.
// Every text box is sized from the enforced field limits (lib/limits.js); flowing
// layouts distribute leftover space instead of using fixed gaps.
function createCommonEmitters({ colors: COLORS, font: FONT, header, helpers }) {
  const { placeholderBox, dotList, emitChartGeom, changeBadgeStyle } = helpers;
  const buildChart = (spec) => buildChartGeometry(spec, COLORS);
  const SURFACE = COLORS.surface || COLORS.grayLight;
  const hOf = (text, size, w, lh) => Math.round(estLines(text, size, w) * size * lh);
  const spread = (avail, used, n, min, max) => (n > 1 ? Math.max(min, Math.min(max, (avail - used) / (n - 1))) : 0);
  const noteBar = (d, ctx, text, w = ctx.cw) => {
    const noteH = hOf(text, 18, w - 16, 1.45);
    const ny = ctx.H - PAD.bottom - noteH;
    d.rect({ x: PAD.left, y: ny + 3, w: 3, h: noteH - 6, fill: COLORS.accent });
    d.text(text, { x: PAD.left + 14, y: ny, w: w - 14, h: noteH, size: 18, color: COLORS.gray, lh: 1.45 });
    return noteH;
  };

  const emitters = {
    agenda(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const n = f.items.length || 1;
      const rowH = Math.min(80, Math.floor(bodyH / n));
      const w = Math.min(ctx.cw, 920);
      const top = yBody + Math.max(0, Math.round((bodyH - rowH * n) / 2) - 10);
      f.items.forEach((it, i) => {
        const y = top + i * rowH;
        const cy = y + rowH / 2;
        d.rect({ x: PAD.left, y: cy - 22, w: 44, h: 44, radius: 10, fill: i === 0 ? COLORS.accent : COLORS.accentLight });
        d.text(String(i + 1).padStart(2, '0'), { x: PAD.left, y: cy - 22, w: 44, h: 44, size: 17, bold: true, color: i === 0 ? COLORS.paper : COLORS.accent, align: 'center', valign: 'middle', lh: 1 });
        d.text(it, { x: PAD.left + 68, y: cy - 20, w: w - 68, h: 40, size: 25, bold: true, valign: 'middle', lh: 1.2 });
        if (i < n - 1) d.rect({ x: PAD.left + 68, y: y + rowH - 1, w: w - 68, h: 1, fill: COLORS.grayLight });
      });
    },

    bullets(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const bodyH = ctx.H - PAD.bottom - yBody;
      // images 指定時: 挿絵付きの横並びブロック
      if (f.images.length) {
        const n = f.items.length || 1;
        const gap = 26;
        const cardW = Math.round((ctx.cw - gap * (n - 1)) / n);
        const visH = 150;
        const tx = 16;
        f.items.forEach((p, i) => {
          const x = PAD.left + i * (cardW + gap);
          const src = (f.images[i] || '').trim();
          const res = src && src !== '-' ? ctx.img[src] : null;
          if (res) d.image({ res, x, y: yBody, w: cardW, h: visH });
          else placeholderBox(d, { x, y: yBody, w: cardW, h: visH, lines: ['挿絵 / アイコン', '（あとで差し替え）'] });
          const hy = yBody + visH + 18;
          const headH = hOf(p.heading, 23, cardW - tx, 1.35);
          d.rect({ x, y: hy, w: 5, h: headH, fill: COLORS.accent });
          d.text(p.heading, { x: x + tx, y: hy, w: cardW - tx, h: headH, size: 23, bold: true, lh: 1.35 });
          if (p.body) {
            const bodyTH = hOf(p.body, 19, cardW - tx, 1.6);
            d.text(p.body, { x: x + tx, y: hy + headH + 10, w: cardW - tx, h: bodyTH, size: 19, color: COLORS.gray, lh: 1.6 });
          }
        });
        return;
      }
      const n = f.items.length;
      const grid = n === 4;
      const cols = grid ? 2 : 1;
      const gapX = 24;
      const cardW = Math.round((ctx.cw - gapX * (cols - 1)) / cols);
      const pad = 24;
      const innerW = cardW - pad * 2 - 8;
      const heights = f.items.map((p) => pad * 2 + hOf(p.heading, 24, innerW, 1.3) + (p.body ? 6 + hOf(p.body, 19, innerW, 1.5) : 0));
      const rows = grid ? [Math.max(heights[0], heights[1]), Math.max(heights[2], heights[3])] : heights;
      const used = rows.reduce((a, b) => a + b, 0);
      const gap = spread(bodyH, used, rows.length, 10, 22);
      let y = yBody;
      rows.forEach((rowH, r) => {
        for (let c = 0; c < cols; c++) {
          const p = f.items[r * cols + c];
          if (!p) continue;
          const x = PAD.left + c * (cardW + gapX);
          d.rect({ x, y, w: cardW, h: rowH, fill: SURFACE, radius: 10 });
          d.rect({ x, y: y + pad, w: 5, h: rowH - pad * 2, fill: COLORS.accent });
          const headH = hOf(p.heading, 24, innerW, 1.3);
          d.text(p.heading, { x: x + pad + 8, y: y + pad, w: innerW, h: headH, size: 24, bold: true, lh: 1.3 });
          if (p.body) d.text(p.body, { x: x + pad + 8, y: y + pad + headH + 6, w: innerW, h: hOf(p.body, 19, innerW, 1.5), size: 19, color: COLORS.gray, lh: 1.5 });
        }
        y += rowH + gap;
      });
    },

    'as-is-to-be'(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const gap = 20;
      const arrowW = 80;
      const avail = ctx.cw - arrowW - gap * 2;
      const asisW = Math.round(avail * (1 / 2.12));
      const tobeW = avail - asisW;
      // Panels hug their content (min 280px) and the pair is centred vertically.
      const listH = (items, w, px) => items.reduce((a, it) => a + hOf(it, px, w - 52 - 22, 1.5) + 16, 0);
      const imgH = (src) => (src ? 175 + 18 : 0);
      const panelH = Math.min(bodyH, Math.max(280, 88 + Math.max(
        listH(f.asIsItems, asisW, 19) + imgH(f.asIsImage), listH(f.toBeItems, tobeW, 20) + imgH(f.toBeImage)) + 20));
      const top = yBody + Math.round((bodyH - panelH) / 2);
      const panel = (x, w, label, items, imgSrc, tobe) => {
        d.rect({
          x, y: top, w, h: panelH, radius: 12,
          fill: tobe ? COLORS.accentLight : SURFACE,
          line: tobe ? COLORS.accent : undefined, lineW: tobe ? 2 : undefined,
        });
        d.rect({ x: x + 26, y: top + 26, w: 28, h: 4, fill: tobe ? COLORS.accent : COLORS.gray });
        d.text(label, { x: x + 26, y: top + 40, w: w - 52, h: 30, size: tobe ? 23 : 21, bold: true, lh: 1.3, color: tobe ? COLORS.accent : COLORS.gray });
        let cy = top + 40 + 30 + 18;
        if (imgSrc) {
          const vh = 175;
          const res = imgSrc !== '-' ? ctx.img[imgSrc] : null;
          if (res) d.image({ res, x: x + 26, y: cy, w: w - 52, h: vh });
          else placeholderBox(d, { x: x + 26, y: cy, w: w - 52, h: vh, lines: ['挿絵', '（あとで差し替え）'], color: tobe ? COLORS.accent : COLORS.gray });
          cy += vh + 18;
        }
        dotList(d, items, {
          x: x + 26, y: cy, w: w - 52,
          fontPx: tobe ? 20 : 19, lineH: 1.5, gap: 16, indent: 22, dotSize: 8, dotTop: 11,
          dotColor: tobe ? COLORS.accent : COLORS.gray, textColor: tobe ? COLORS.ink : COLORS.gray,
        });
      };
      panel(PAD.left, asisW, f.asIsLabel || ctx.t('asIs'), f.asIsItems, f.asIsImage, false);
      const ax = PAD.left + asisW + gap;
      const arrowY = yBody + Math.round(bodyH / 2) - 30 - (f.transition ? 18 : 0);
      d.circle({ x: ax + 6, y: arrowY - 4, size: 68, fill: COLORS.accent });
      d.arrowRight({ x: ax + 22, y: arrowY + 14, w: 36, h: 32, fill: COLORS.paper });
      if (f.transition) {
        d.text(f.transition, { x: ax - 10, y: arrowY + 74, w: 100, h: 50, size: 16, bold: true, color: COLORS.accent, align: 'center', lh: 1.3 });
      }
      panel(ax + arrowW + gap, tobeW, f.toBeLabel || ctx.t('toBe'), f.toBeItems, f.toBeImage, true);
    },

    'big-number'(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const gap = 56;
      const leftW = Math.round((ctx.cw - gap) * (1.1 / 2.1));
      const rightW = ctx.cw - gap - leftW;
      const capH = f.caption ? 18 + 29 : 0;
      const panelH = Math.min(48 + 165 + capH + 48, bodyH);
      const px = PAD.left + leftW + gap;
      const py = yBody + Math.max(0, Math.round((bodyH - panelH) / 2));
      d.rect({ x: px, y: py, w: rightW, h: panelH, fill: COLORS.accentLight, radius: 16 });
      d.circle({ x: px + rightW - 70, y: py - 26, size: 96, line: COLORS.secondary, lineW: 2, lineAlpha: 0.6 });
      d.circle({ x: px + rightW - 34, y: py + 30, size: 22, fill: COLORS.secondary });
      // Auto-fit the hero number (value + 40% unit) to the panel width.
      const valueSize = Math.min(150, Math.floor((rightW - 60) / Math.max(1, textW(f.value, 1) + (f.unit ? textW(f.unit, 0.4) + 0.1 : 0))));
      const runs = [{ text: f.value, size: valueSize }];
      if (f.unit) runs.push({ text: f.unit, size: Math.round(valueSize * 0.4) });
      d.rich(runs, { x: px + 10, y: py + 40, w: rightW - 20, h: 165, color: COLORS.accent, align: 'center', valign: 'middle', lh: 1 });
      if (f.caption) d.text(f.caption, { x: px + 10, y: py + 40 + 165 + 14, w: rightW - 20, h: 29, size: 21, color: COLORS.gray, align: 'center', lh: 1.3 });
      const descH = hOf(f.description, 23, leftW, 1.7);
      const ptHs = f.points.map((p) => hOf(p, 20, leftW - 22, 1.4));
      const blockH = descH + (f.points.length ? 30 + ptHs.reduce((a, b) => a + b, 0) + (f.points.length - 1) * 14 : 0);
      const ly = yBody + Math.max(0, Math.round((bodyH - blockH) / 2));
      d.text(f.description, { x: PAD.left, y: ly, w: leftW, h: descH, size: 23, lh: 1.7 });
      if (f.points.length) {
        dotList(d, f.points, {
          x: PAD.left, y: ly + descH + 30, w: leftW,
          fontPx: 20, lineH: 1.4, gap: 14, indent: 22, dotSize: 9, dotTop: 10,
          dotColor: COLORS.accent, square: true,
        });
      }
    },

    chart(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const split = f.points.length > 0;
      const chartW = split ? Math.round((ctx.cw - 40) * 0.62) : ctx.cw;
      const chartH = f.note ? 430 : 470;
      const hl = f.highlight === '' ? null : Number(f.highlight);
      const dp = f.delta ? String(f.delta).split('::').map((s) => s.trim()) : [];
      const delta = dp.length >= 2 ? { from: Number(dp[0]), to: Number(dp[1]), label: dp[2] || '' } : null;
      const geom = buildChart({
        type: f.chartType || 'bar', labels: f.labels, values: f.values, unit: f.unit,
        width: chartW, height: chartH, highlight: Number.isNaN(hl) ? null : hl, delta, totalLabel: ctx.t('total'),
      });
      emitChartGeom(d, geom, PAD.left, yBody);
      for (const c of f.callouts) {
        const a = geom.anchors[c.index];
        if (!a) continue;
        const axp = PAD.left + (a.xPct / 100) * chartW;
        const ayp = yBody + (a.yPct / 100) * chartH;
        const bw = textW(c.text, 17) + 32;
        const bx = Math.min(Math.max(axp - bw / 2, PAD.left), PAD.left + chartW - bw);
        const by = Math.max(ayp - 36 - 36, yBody - 10);
        d.rect({ x: bx, y: by, w: bw, h: 36, fill: COLORS.ink, radius: 8 });
        d.text(c.text, { x: bx, y: by, w: bw, h: 36, size: 17, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1 });
        d.triDown({ x: axp - 8, y: by + 35, w: 16, h: 8, fill: COLORS.ink });
      }
      if (split) {
        const sx = PAD.left + chartW + 40;
        const sw = ctx.cw - chartW - 40;
        d.rect({ x: sx, y: yBody, w: sw, h: chartH, fill: SURFACE, radius: 12 });
        d.text(ctx.t('insights'), { x: sx + 26, y: yBody + 24, w: sw - 52, h: 20, size: 15, bold: true, color: COLORS.accent, lh: 1, decor: true });
        const hs = f.points.map((p) => hOf(p, 19, sw - 52 - 34, 1.5));
        const gap = spread(chartH - 68 - 24, hs.reduce((a, b) => a + b, 0), f.points.length, 14, 28);
        let y = yBody + 64;
        f.points.forEach((p, i) => {
          d.circle({ x: sx + 26, y: y + 1, size: 24, fill: COLORS.accent });
          d.text(String(i + 1), { x: sx + 26, y: y + 1, w: 24, h: 24, size: 13, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1 });
          d.text(p, { x: sx + 26 + 34, y, w: sw - 52 - 34, h: hs[i], size: 19, lh: 1.5 });
          y += hs[i] + gap;
        });
      }
      if (f.note) noteBar(d, ctx, f.note, split ? chartW : ctx.cw);
    },

    gantt(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const noteH = f.note ? hOf(f.note, 18, ctx.cw - 16, 1.45) : 0;
      const areaH = bodyH - (noteH ? noteH + 16 : 0);
      const labelW = ctx.W < 1000 ? 220 : 300;
      const trackW = ctx.cw - labelW;
      const nCols = f.columns.length || 1;
      const cellW = trackW / nCols;
      const x0 = PAD.left + labelW;
      const headH = 44;
      const n = f.tasks.length || 1;
      const rowH = Math.min(70, Math.floor((areaH - headH) / n));
      const gridBottom = yBody + headH + n * rowH;
      d.rect({ x: x0, y: yBody, w: trackW, h: headH, fill: COLORS.navy || COLORS.ink, radius: 8 });
      f.columns.forEach((c, i) => {
        d.text(c, { x: x0 + i * cellW, y: yBody, w: cellW, h: headH, size: 16, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1 });
        if (i > 0) d.seg(x0 + i * cellW, yBody + headH, x0 + i * cellW, gridBottom, { color: COLORS.grayLight, width: 1, dash: 'dash' });
      });
      const palette = [COLORS.accent, COLORS.secondary];
      f.tasks.forEach((t, i) => {
        const start = Math.min(Math.max(Number(t.start) || 1, 1), nCols);
        const end = Math.min(Math.max(Number(t.end) || start, start), nCols);
        const ry = yBody + headH + i * rowH;
        if (i % 2 === 0) d.rect({ x: PAD.left, y: ry, w: ctx.cw, h: rowH, fill: SURFACE });
        d.text(t.name, { x: PAD.left + 16, y: ry, w: labelW - 30, h: rowH, size: 18, bold: true, valign: 'middle', lh: 1.3 });
        d.rect({ x: x0 + (start - 1) * cellW + 6, y: ry + rowH / 2 - 12, w: (end - start + 1) * cellW - 12, h: 24, fill: palette[i % 2], radius: 12 });
      });
      d.rect({ x: PAD.left, y: gridBottom, w: ctx.cw, h: 1, fill: COLORS.grayLight });
      if (f.note) noteBar(d, ctx, f.note);
    },

    'image-text'(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const gap = 40;
      const colW = Math.round((ctx.cw - gap) / 2);
      let ly = yBody;
      if (f.lead) {
        const leadH = hOf(f.lead, 21, colW, 1.7);
        d.text(f.lead, { x: PAD.left, y: ly, w: colW, h: leadH, size: 21, lh: 1.7 });
        ly += leadH + 24;
      }
      if (f.points.length) {
        dotList(d, f.points, {
          x: PAD.left, y: ly, w: colW,
          fontPx: 20, lineH: 1.4, gap: 14, indent: 22, dotSize: 9, dotTop: 10,
          dotColor: COLORS.accent, square: true,
        });
      }
      const ix = PAD.left + colW + gap;
      const iw = ctx.cw - colW - gap;
      const ih = f.caption ? 430 : 470;
      const res = f.imageSrc && f.imageSrc !== '-' ? ctx.img[f.imageSrc] : null;
      if (res) d.image({ res, x: ix, y: yBody, w: iw, h: ih });
      else placeholderBox(d, { x: ix, y: yBody, w: iw, h: ih, lines: [f.imageNote ? `ここに：${f.imageNote}` : '画像プレースホルダ', `推奨 ${iw}×${ih}px`] });
      if (f.caption) d.text(f.caption, { x: ix, y: yBody + ih + 12, w: iw, h: 24, size: 16, color: COLORS.gray, align: 'center', lh: 1.3 });
    },

    comparison(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const cols = [
        { heading: f.col1Heading, items: f.col1Items },
        { heading: f.col2Heading, items: f.col2Items },
        { heading: f.col3Heading, items: f.col3Items },
      ].filter((c) => c.heading);
      const n = cols.length;
      const colW = Math.round((ctx.cw - 24 * (n - 1)) / n);
      const headH = 64;
      const innerW = colW - 52 - 22;
      const ITEM_GAP = 30;
      const colsH = cols.map((c) => c.items.reduce((a, it) => a + hOf(it, 19, innerW, 1.5), 0) + (c.items.length - 1) * ITEM_GAP);
      const boxH = Math.min(bodyH, Math.max(300, headH + 28 + Math.max(...colsH) + 32));
      const top = yBody + Math.round((bodyH - boxH) / 2);
      cols.forEach((c, i) => {
        const x = PAD.left + i * (colW + 24);
        const hl = String(i + 1) === f.highlight;
        d.rect({ x, y: top, w: colW, h: boxH, radius: 12, fill: hl ? COLORS.paper : SURFACE, line: hl ? COLORS.accent : undefined, lineW: 2 });
        d.rect({ x: x + (hl ? 1 : 0), y: top + (hl ? 1 : 0), w: colW - (hl ? 2 : 0), h: headH, radius: 11, fill: hl ? COLORS.accent : COLORS.grayLight });
        d.rect({ x: x + (hl ? 1 : 0), y: top + headH - 14, w: colW - (hl ? 2 : 0), h: 14, fill: hl ? COLORS.accent : COLORS.grayLight });
        d.text(c.heading, { x, y: top, w: colW, h: headH, size: 23, bold: true, align: 'center', valign: 'middle', color: hl ? COLORS.paper : COLORS.ink, lh: 1.2 });
        const hs = c.items.map((it) => hOf(it, 19, innerW, 1.5));
        const gap = Math.min(ITEM_GAP, spread(boxH - headH - 60, hs.reduce((a, b) => a + b, 0), c.items.length, 18, ITEM_GAP));
        let y = top + headH + 28;
        c.items.forEach((it, j) => {
          d.circle({ x: x + 26, y: y + 8, size: 12, fill: hl ? COLORS.accent : COLORS.gray, alpha: hl ? 1 : 0.6 });
          d.text(it, { x: x + 26 + 22, y, w: innerW, h: hs[j], size: 19, lh: 1.5 });
          if (j < c.items.length - 1) d.rect({ x: x + 26, y: y + hs[j] + gap / 2, w: colW - 52, h: 1, fill: hl ? COLORS.accentLight : COLORS.grayLight });
          y += hs[j] + gap;
        });
      });
    },

    'key-points'(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const n = f.points.length;
      const cardW = Math.round((ctx.cw - 24 * (n - 1)) / n);
      const hasVisual = f.images.length > 0;
      const innerW0 = cardW - 56;
      const textCardH = Math.min(bodyH, Math.max(300, ...f.points.map((p) =>
        34 + 48 + 14 + hOf(p.heading, 24, innerW0, 1.35) + 12 + hOf(p.body, 19, innerW0, 1.55) + 34)));
      const top = hasVisual ? yBody : yBody + Math.round((bodyH - textCardH) / 2);
      f.points.forEach((p, i) => {
        const x = PAD.left + i * (cardW + 24);
        d.rect({ x, y: top, w: cardW, h: hasVisual ? bodyH : textCardH, fill: SURFACE, radius: 12 });
        const innerW = cardW - 56;
        const no = String(i + 1).padStart(2, '0');
        if (!hasVisual) {
          d.rect({ x, y: top, w: cardW, h: 6, fill: i === 0 ? COLORS.accent : i === 1 ? COLORS.secondary : COLORS.navy || COLORS.ink });
          d.text(no, { x: x + 28, y: top + 34, w: innerW, h: 48, size: 40, bold: true, color: COLORS.accent, lh: 1.2 });
          const headH = hOf(p.heading, 24, innerW, 1.35);
          d.text(p.heading, { x: x + 28, y: top + 34 + 48 + 14, w: innerW, h: headH, size: 24, bold: true, lh: 1.35 });
          const bodyY = top + 34 + 48 + 14 + headH + 12;
          d.text(p.body, { x: x + 28, y: bodyY, w: innerW, h: top + textCardH - bodyY - 20, size: 19, color: COLORS.gray, lh: 1.55 });
        } else {
          const headH = hOf(p.heading, 24, innerW, 1.4);
          const txtH = hOf(p.body, 19, innerW, 1.6);
          const vx = x + 22;
          const vw = cardW - 44;
          const vh = Math.max(bodyH - 22 - 10 - headH - 12 - txtH - 26, 180);
          const src = (f.images[i] || '').trim();
          const res = src && src !== '-' ? ctx.img[src] : null;
          if (res) d.image({ res, x: vx, y: yBody + 22, w: vw, h: vh });
          else placeholderBox(d, { x: vx, y: yBody + 22, w: vw, h: vh, lines: ['画像 / アイコン', '（あとで差し替え）'] });
          d.rect({ x: vx + 10, y: yBody + 32, w: 44, h: 28, fill: COLORS.accent, radius: 8 });
          d.text(no, { x: vx + 10, y: yBody + 32, w: 44, h: 28, size: 17, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1 });
          const hy = yBody + 22 + vh + 10;
          d.text(p.heading, { x: x + 28, y: hy, w: innerW, h: headH, size: 24, bold: true, lh: 1.4 });
          d.text(p.body, { x: x + 28, y: hy + headH + 12, w: innerW, h: txtH, size: 19, color: COLORS.gray, lh: 1.6 });
        }
      });
    },

    converge(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const cw = ctx.cw;
      const hasTag = !!f.conclusionLabel;
      const tagW = hasTag ? textW(f.conclusionLabel, 18) + 32 : 0;
      const concInnerW = cw - 60 - (hasTag ? tagW + 18 : 0);
      const concTextH = hOf(f.conclusion, 25, concInnerW, 1.4);
      const concH = Math.max(72, concTextH + 34);
      const funnelH = 32;
      const n = f.points.length || 1;
      const cardW = Math.round((cw - 22 * (n - 1)) / n);
      const innerW0 = cardW - 52;
      const maxCards = bodyH - 14 - funnelH - 14 - concH;
      const cardsH = Math.min(maxCards, Math.max(220, ...f.points.map((p) =>
        22 + 36 + 12 + hOf(p.heading, 22, innerW0, 1.35) + 8 + hOf(p.body, 18, innerW0, 1.5) + 28)));
      const yTop = yBody + Math.round((maxCards - cardsH) / 2);
      f.points.forEach((p, i) => {
        const x = PAD.left + i * (cardW + 22);
        d.rect({ x, y: yTop, w: cardW, h: cardsH, fill: SURFACE, radius: 12 });
        const innerW = cardW - 52;
        d.text(String(i + 1).padStart(2, '0'), { x: x + 26, y: yTop + 22, w: innerW, h: 36, size: 30, bold: true, color: COLORS.accent, lh: 1 });
        const headH = hOf(p.heading, 22, innerW, 1.35);
        d.text(p.heading, { x: x + 26, y: yTop + 22 + 36 + 12, w: innerW, h: headH, size: 22, bold: true, lh: 1.35 });
        const py = yTop + 22 + 36 + 12 + headH + 8;
        d.text(p.body, { x: x + 26, y: py, w: innerW, h: yTop + cardsH - py - 14, size: 18, color: COLORS.gray, lh: 1.5 });
      });
      const cx = PAD.left + Math.round(cw / 2);
      const fy = yTop + cardsH + 14;
      d.seg(cx - 18, fy + 2, cx, fy + 28, { color: COLORS.accent, width: 3 });
      d.seg(cx + 18, fy + 2, cx, fy + 28, { color: COLORS.accent, width: 3 });
      d.seg(cx, fy + 2, cx, fy + 28, { color: COLORS.accent, width: 3 });
      const cy = yTop + cardsH + 14 + funnelH + 14;
      d.rect({ x: PAD.left, y: cy, w: cw, h: concH, fill: COLORS.accent, radius: 12 });
      d.circle({ x: PAD.left + cw - 90, y: cy - 30, size: 120, line: COLORS.paper, lineW: 1.5, lineAlpha: 0.3 });
      let tx = PAD.left + 30;
      if (hasTag) {
        const ty = cy + Math.round((concH - 32) / 2);
        d.rect({ x: tx, y: ty, w: tagW, h: 32, fill: COLORS.paper, radius: 16 });
        d.text(f.conclusionLabel, { x: tx, y: ty, w: tagW, h: 32, size: 18, bold: true, color: COLORS.accent, align: 'center', valign: 'middle', lh: 1 });
        tx += tagW + 18;
      }
      d.text(f.conclusion, { x: tx, y: cy + (concH - concTextH) / 2, w: PAD.left + cw - tx - 30, h: concTextH, size: 25, bold: true, color: COLORS.paper, lh: 1.4 });
    },

    pyramid(d, f, ctx) {
      const yHead = header(d, ctx, f.title);
      const cw = ctx.cw;
      const hasTag = !!f.conclusionLabel;
      const tagW = hasTag ? textW(f.conclusionLabel, 18) + 32 : 0;
      const concInnerW = cw - 62 - (hasTag ? tagW + 18 : 0);
      const concTextH = hOf(f.conclusion, 26, concInnerW, 1.4);
      const concH = Math.max(84, concTextH + 40);
      // Cards hug their content (min 220px); the whole claim + support block is centred.
      const n0 = f.points.length || 1;
      const innerW0 = Math.round((cw - 22 * (n0 - 1)) / n0) - 52;
      const availH = ctx.H - PAD.bottom - yHead;
      const fixedH = concH + 12 + 26 + 14;
      const cardsH0 = Math.min(availH - fixedH, Math.max(220, ...f.points.map((p) =>
        38 + hOf(p.heading, 22, innerW0, 1.35) + 10 + hOf(p.body, 18, innerW0, 1.5) + 28)));
      const yBody = yHead + Math.round((availH - fixedH - cardsH0) / 2);
      d.rect({ x: PAD.left, y: yBody, w: cw, h: concH, fill: COLORS.navy || COLORS.accent, radius: 12 });
      d.rect({ x: PAD.left, y: yBody, w: 8, h: concH, fill: COLORS.secondary });
      let tx = PAD.left + 32;
      if (hasTag) {
        const ty = yBody + Math.round((concH - 32) / 2);
        d.rect({ x: tx, y: ty, w: tagW, h: 32, fill: COLORS.accent, radius: 16 });
        d.text(f.conclusionLabel, { x: tx, y: ty, w: tagW, h: 32, size: 18, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1 });
        tx += tagW + 18;
      }
      d.text(f.conclusion, { x: tx, y: yBody + (concH - concTextH) / 2, w: PAD.left + cw - tx - 30, h: concTextH, size: 26, bold: true, color: COLORS.paper, lh: 1.4 });
      const arrowH = 26;
      const cx = PAD.left + Math.round(cw / 2);
      d.triUp({ x: cx - 18, y: yBody + concH + 12, w: 36, h: arrowH, fill: COLORS.accent });
      const cardsTop = yBody + concH + 12 + arrowH + 14;
      const cardsH = cardsH0;
      const n = f.points.length || 1;
      const cardW = Math.round((cw - 22 * (n - 1)) / n);
      f.points.forEach((p, i) => {
        const x = PAD.left + i * (cardW + 22);
        d.rect({ x, y: cardsTop, w: cardW, h: cardsH, fill: COLORS.paper, line: COLORS.grayLight, lineW: 1.5, radius: 12 });
        d.rect({ x: x + 26, y: cardsTop + 22, w: 28, h: 4, fill: COLORS.accent });
        const innerW = cardW - 52;
        const headH = hOf(p.heading, 22, innerW, 1.35);
        d.text(p.heading, { x: x + 26, y: cardsTop + 38, w: innerW, h: headH, size: 22, bold: true, lh: 1.35 });
        const py = cardsTop + 38 + headH + 10;
        d.text(p.body, { x: x + 26, y: py, w: innerW, h: cardsTop + cardsH - py - 14, size: 18, color: COLORS.gray, lh: 1.5 });
      });
    },

    drivers(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const gap = 20;
      const arrowW = 80;
      const leftW = Math.round((ctx.cw - arrowW - gap * 2) * (1 / 2.05));
      const rightW = ctx.cw - arrowW - gap * 2 - leftW;
      const n = f.points.length || 1;
      const cardGap = 14;
      const cardH = Math.round((bodyH - cardGap * (n - 1)) / n);
      f.points.forEach((p, i) => {
        const y = yBody + i * (cardH + cardGap);
        d.rect({ x: PAD.left, y, w: leftW, h: cardH, fill: SURFACE, radius: 10 });
        d.rect({ x: PAD.left, y: y + 16, w: 4, h: cardH - 32, fill: COLORS.accent });
        const no = String(i + 1).padStart(2, '0');
        d.text(no, { x: PAD.left + 22, y: y + Math.round(cardH / 2) - 16, w: 46, h: 32, size: 26, bold: true, color: COLORS.accent, valign: 'middle', lh: 1 });
        const tx = PAD.left + 22 + 52;
        const innerW = leftW - (22 + 52) - 20;
        const headH = hOf(p.heading, 20, innerW, 1.35);
        const bH = p.body ? hOf(p.body, 16, innerW, 1.45) : 0;
        const blockH = headH + (p.body ? 6 + bH : 0);
        const ty = y + Math.max(0, Math.round((cardH - blockH) / 2));
        d.text(p.heading, { x: tx, y: ty, w: innerW, h: headH, size: 20, bold: true, lh: 1.35 });
        if (p.body) d.text(p.body, { x: tx, y: ty + headH + 6, w: innerW, h: bH, size: 16, color: COLORS.gray, lh: 1.45 });
      });
      const ax = PAD.left + leftW + gap;
      const arrowY = yBody + Math.round(bodyH / 2) - 30 - (f.arrowLabel ? 18 : 0);
      d.circle({ x: ax + 6, y: arrowY - 4, size: 68, fill: COLORS.accent });
      d.arrowRight({ x: ax + 22, y: arrowY + 14, w: 36, h: 32, fill: COLORS.paper });
      if (f.arrowLabel) {
        d.text(f.arrowLabel, { x: ax - 10, y: arrowY + 74, w: 100, h: 44, size: 16, bold: true, color: COLORS.accent, align: 'center', lh: 1.3 });
      }
      const rx = ax + arrowW + gap;
      d.rect({ x: rx, y: yBody, w: rightW, h: bodyH, fill: COLORS.accentLight, line: COLORS.accent, lineW: 2, radius: 12 });
      const pad = 28;
      const cpW = rightW - pad * 2;
      const contentH = (f.conclusionLabel ? 40 : 0) + hOf(f.conclusion, 26, cpW, 1.4) + 18 +
        (f.conclusionPoints || []).reduce((a, p) => a + hOf(p, 18, cpW - 20, 1.5) + 12, 0);
      let ry = yBody + Math.max(28, Math.round((bodyH - contentH) / 2));
      if (f.conclusionLabel) {
        d.text(f.conclusionLabel, { x: rx + pad, y: ry, w: rightW - pad * 2, h: 26, size: 20, bold: true, color: COLORS.accent, lh: 1 });
        ry += 26 + 14;
      }
      const concH = hOf(f.conclusion, 26, rightW - pad * 2, 1.4);
      d.text(f.conclusion, { x: rx + pad, y: ry, w: rightW - pad * 2, h: concH, size: 26, bold: true, lh: 1.4 });
      ry += concH + 18;
      if (f.conclusionPoints && f.conclusionPoints.length) {
        dotList(d, f.conclusionPoints, {
          x: rx + pad, y: ry, w: rightW - pad * 2,
          fontPx: 18, lineH: 1.5, gap: 12, indent: 20, dotSize: 8, dotTop: 10,
          dotColor: COLORS.accent,
        });
      }
    },

    timeline(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const n = f.milestones.length || 1;
      const itemW = ctx.cw / n;
      const hasLanes = f.lanes.length && f.bands.length;
      const bodyPx = hasLanes ? 16 : 17;
      const bodyLH = Math.round(bodyPx * 1.55);
      const maxBodyLines = Math.max(...f.milestones.map((m) => estLines(m.body, bodyPx, itemW - 40)), 1);
      const cardH = 24 + 29 + 10 + maxBodyLines * bodyLH + 22;
      const blockH = 30 + 8 + 22 + 22 + cardH;
      const top = hasLanes ? yBody + 4 : yBody + Math.max(0, Math.round((bodyH - blockH) / 2));
      const lineY = top + 30 + 8 + 11;
      d.rect({ x: PAD.left, y: lineY - 2, w: ctx.cw, h: 4, fill: COLORS.grayLight });
      d.rect({ x: PAD.left, y: lineY - 2, w: itemW * 0.5, h: 4, fill: COLORS.accent });
      f.milestones.forEach((m, i) => {
        const cx = PAD.left + itemW * (i + 0.5);
        const first = i === 0;
        d.text(m.label, { x: cx - itemW / 2 + 12, y: top, w: itemW - 24, h: 30, size: 18, bold: true, color: COLORS.accent, align: 'center', lh: 1.2 });
        d.circle({ x: cx - 11, y: lineY - 11, size: 22, fill: first ? COLORS.accent : COLORS.paper, line: COLORS.accent, lineW: 4 });
        const cy = lineY + 11 + 22;
        d.rect({ x: cx - itemW / 2 + 8, y: cy, w: itemW - 16, h: cardH, fill: first ? COLORS.accentLight : SURFACE, radius: 10 });
        d.triUp({ x: cx - 9, y: cy - 9, w: 18, h: 10, fill: first ? COLORS.accentLight : SURFACE });
        d.text(m.heading, { x: cx - itemW / 2 + 20, y: cy + 24, w: itemW - 40, h: 29, size: 21, bold: true, align: 'center', lh: 1.3 });
        d.text(m.body, { x: cx - itemW / 2 + 20, y: cy + 24 + 29 + 10, w: itemW - 40, h: maxBodyLines * bodyLH, size: bodyPx, color: COLORS.gray, align: 'center', lh: 1.55 });
      });
      if (!hasLanes) return;
      const rlTop = top + blockH + 22;
      d.seg(PAD.left, rlTop, PAD.left + ctx.cw, rlTop, { color: COLORS.grayLight, width: 1.5, dash: 'dash' });
      d.text(ctx.t('roles'), { x: PAD.left, y: rlTop + 16, w: 240, h: 20, size: 15, bold: true, color: COLORS.gray, lh: 1 });
      const rowsTop = rlTop + 16 + 20 + 10;
      const nameW = ctx.W < 1000 ? 96 : 120;
      const trackX = PAD.left + nameW;
      const trackW = ctx.cw - nameW;
      const cellW = trackW / n;
      const rowH = Math.min(46, Math.floor((ctx.H - PAD.bottom - rowsTop - 10 * (f.lanes.length - 1)) / f.lanes.length));
      const rowGap = 10;
      const bands = f.bands
        .map((b) => {
          const li = (Number(b.lane) || 1) - 1;
          const start = Math.min(Math.max(Number(b.start) || 1, 1), n);
          const end = Math.min(Math.max(Number(b.end) || start, start), n);
          return { li, start, end, label: b.label };
        })
        .filter((b) => b.li >= 0 && b.li < f.lanes.length);
      f.lanes.forEach((name, li) => {
        const ry = rowsTop + li * (rowH + rowGap);
        const isA = li === 0;
        d.text(name, { x: PAD.left, y: ry, w: nameW - 16, h: rowH, size: 17, bold: true, color: isA ? COLORS.accent : COLORS.ink, valign: 'middle', lh: 1.2 });
        d.rect({ x: trackX, y: ry, w: trackW, h: rowH, fill: SURFACE, radius: 8 });
        for (let c = 1; c < n; c++) d.seg(trackX + c * cellW, ry, trackX + c * cellW, ry + rowH, { color: COLORS.paper, width: 1.5 });
        bands.filter((b) => b.li === li).forEach((b) => {
          const bx = trackX + (b.start - 1) * cellW + 4;
          const bw = (b.end - b.start + 1) * cellW - 8;
          d.rect({ x: bx, y: ry + 6, w: bw, h: rowH - 12, fill: isA ? COLORS.accent : COLORS.navy || COLORS.ink, radius: 6 });
          if (b.label) d.text(b.label, { x: bx, y: ry + 6, w: bw, h: rowH - 12, size: 15, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1.2 });
        });
      });
    },

    quote(d, f, ctx) {
      const yBody = f.title ? header(d, ctx, f.title) : PAD.top;
      const bodyH = ctx.H - PAD.bottom - yBody;
      const hasImg = !!f.imageSrc;
      if (hasImg) {
        const innerPad = 24;
        const figW = ctx.W < 1000 ? 280 : 360;
        const colGap = 56;
        const figX = PAD.left + innerPad;
        const bodyX = figX + figW + colGap;
        const bodyW = ctx.cw - innerPad * 2 - figW - colGap;
        const logo = f.imageMode !== 'photo';
        const res = f.imageSrc !== '-' ? ctx.img[f.imageSrc] : null;
        if (res) {
          if (logo) {
            d.rect({ x: figX, y: yBody, w: figW, h: bodyH, fill: SURFACE, radius: 14 });
            d.image({ res, x: figX + 36, y: yBody + 36, w: figW - 72, h: bodyH - 72, fit: 'contain' });
          } else {
            d.image({ res, x: figX, y: yBody, w: figW, h: bodyH });
          }
        } else {
          placeholderBox(d, { x: figX, y: yBody, w: figW, h: bodyH, lines: ['お客様のロゴ', '／ 写真'] });
        }
        const qH = hOf(f.quote, 30, bodyW, 1.6);
        const attrH = 57;
        const top = yBody + Math.max(0, Math.round((bodyH - qH - 42 - attrH) / 2));
        d.text('“', { x: bodyX - 6, y: top - 24, w: 130, h: 150, size: 150, color: COLORS.accentLight, bold: true, font: 'Georgia', lh: 1, decor: true });
        d.text(f.quote, { x: bodyX, y: top, w: bodyW, h: qH, size: 30, bold: true, lh: 1.6 });
        const ay = top + qH + 42;
        d.text(f.name, { x: bodyX, y: ay, w: bodyW, h: 29, size: 23, bold: true, lh: 1.2 });
        if (f.role) d.text(f.role, { x: bodyX, y: ay + 29 + 4, w: bodyW, h: 24, size: 18, color: COLORS.gray, lh: 1.2 });
        return;
      }
      d.rect({ x: PAD.left, y: yBody, w: ctx.cw, h: bodyH, fill: SURFACE, radius: 16 });
      d.rect({ x: PAD.left, y: yBody + 40, w: 6, h: bodyH - 80, fill: COLORS.accent });
      const qx = PAD.left + 110;
      const qw = ctx.cw - 190;
      const qH = hOf(f.quote, 32, qw, 1.6);
      const attrH = 57;
      const top = yBody + Math.max(0, Math.round((bodyH - qH - 40 - attrH) / 2));
      d.text('“', { x: PAD.left + 30, y: top - 30, w: 90, h: 130, size: 130, color: COLORS.accent, bold: true, font: 'Georgia', lh: 1, decor: true });
      d.text(f.quote, { x: qx, y: top, w: qw, h: qH, size: 32, bold: true, lh: 1.6 });
      const ay = top + qH + 40;
      d.rect({ x: qx, y: ay + 13, w: 28, h: 3, fill: COLORS.accent });
      d.text(f.name, { x: qx + 42, y: ay, w: qw - 42, h: 29, size: 22, bold: true, lh: 1.2 });
      if (f.role) d.text(f.role, { x: qx + 42, y: ay + 29 + 4, w: qw - 42, h: 24, size: 17, color: COLORS.gray, lh: 1.2 });
    },

    'fact-profile'(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const hasLogo = !!f.logo;
      const hasImg = !!f.imageSrc;
      const hasSide = hasLogo || hasImg;
      const gap = 40;
      const sideW = hasSide ? (ctx.W < 1000 ? 340 : 440) : 0;
      const tableW = hasSide ? ctx.cw - sideW - gap : ctx.cw;
      const labelW = 170;
      const valueW = tableW - labelW - 44;
      const rowHs = f.facts.map((p) => Math.max(estLines(p.heading, 20, labelW - 40), estLines(p.body, 20, valueW)) * 29 + 34);
      const used = rowHs.reduce((a, b) => a + b, 0);
      const extra = Math.max(0, Math.min(12, (bodyH - used) / Math.max(1, f.facts.length)));
      let y = yBody;
      d.rect({ x: PAD.left, y, w: tableW, h: 3, fill: COLORS.accent });
      y += 3;
      f.facts.forEach((p, i) => {
        const rowH = Math.round(rowHs[i] + extra);
        const pad = (rowH - (rowHs[i] - 34)) / 2;
        d.rect({ x: PAD.left, y, w: labelW, h: rowH, fill: SURFACE });
        d.text(p.heading, { x: PAD.left + 20, y: y + pad, w: labelW - 40, h: rowH - pad * 2, size: 20, bold: true, color: COLORS.accent, lh: 1.45 });
        d.text(p.body, { x: PAD.left + labelW + 22, y: y + pad, w: valueW, h: rowH - pad * 2, size: 20, lh: 1.45 });
        d.rect({ x: PAD.left, y: y + rowH, w: tableW, h: 1, fill: COLORS.grayLight });
        y += rowH + 1;
      });
      if (!hasSide) return;
      const sx = PAD.left + tableW + gap;
      let sy = yBody;
      if (hasLogo) {
        const logoH = hasImg ? 150 : bodyH;
        const res = f.logo !== '-' ? ctx.img[f.logo] : null;
        d.rect({ x: sx, y: sy, w: sideW, h: logoH, fill: SURFACE, radius: 12 });
        if (res) d.image({ res, x: sx + 28, y: sy + 28, w: sideW - 56, h: logoH - 56, fit: 'contain' });
        else placeholderBox(d, { x: sx + 20, y: sy + 20, w: sideW - 40, h: logoH - 40, lines: ['お客様のロゴ'] });
        sy += logoH + 16;
      }
      if (hasImg) {
        const imgH = yBody + bodyH - sy;
        const res = f.imageSrc !== '-' ? ctx.img[f.imageSrc] : null;
        if (res) d.image({ res, x: sx, y: sy, w: sideW, h: imgH });
        else placeholderBox(d, { x: sx, y: sy, w: sideW, h: imgH, lines: ['写真プレースホルダ', '（社屋・利用風景など）'] });
      }
    },

    'case-summary'(d, f, ctx) {
      const yBody = header(d, ctx, f.title, '', f.meta);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const colBox = (x, w, h, head, items, kind, opt = {}) => {
        const yy = opt.y || yBody;
        d.rect({
          x, y: yy, w, h, radius: 12,
          fill: kind === 'challenge' ? SURFACE : kind === 'outcome' ? COLORS.accentLight : COLORS.paper,
          line: kind === 'solution' ? COLORS.grayLight : kind === 'outcome' ? COLORS.accent : undefined, lineW: 1.5,
        });
        const pad = opt.pad || 24;
        const hs = opt.headSize || 22;
        d.rect({ x: x + pad, y: yy + (opt.headTop || 24), w: 24, h: 4, fill: kind === 'outcome' ? COLORS.accent : kind === 'solution' ? COLORS.secondary : COLORS.gray });
        d.text(head, { x: x + pad, y: yy + (opt.headTop || 24) + 12, w: w - pad * 2, h: 29, size: hs, bold: true, lh: 1.3, color: kind === 'outcome' ? COLORS.accent : COLORS.ink });
        dotList(d, items, {
          x: x + pad, y: yy + (opt.headTop || 24) + 12 + 29 + (opt.headGap || 16), w: w - pad * 2,
          fontPx: opt.itemSize || 18, lineH: 1.5, gap: 12, indent: 18, dotSize: 8, dotTop: 10,
          dotColor: kind === 'outcome' ? COLORS.accent : COLORS.gray,
        });
      };
      const rich = f.logo || f.profile.length || f.features.length || f.metric || f.voice;
      if (!rich) {
        const colW = Math.round((ctx.cw - 12 * 4 - 30 * 2) / 3);
        const listH = (items) => items.reduce((a, it) => a + hOf(it, 18, colW - 48 - 18, 1.5) + 12, 0);
        const colH = Math.min(bodyH, Math.max(280, 24 + 12 + 29 + 16 + Math.max(listH(f.challenge), listH(f.solution), listH(f.outcome)) + 24));
        const y0 = yBody + Math.round((bodyH - colH) / 2);
        const arrow = (x) => d.arrowRight({ x, y: y0 + Math.round(colH / 2) - 15, w: 30, h: 30 });
        let x = PAD.left;
        colBox(x, colW, colH, ctx.t('challenge'), f.challenge, 'challenge', { y: y0 });
        x += colW + 12; arrow(x); x += 30 + 12;
        colBox(x, colW, colH, ctx.t('solution'), f.solution, 'solution', { y: y0 });
        x += colW + 12; arrow(x); x += 30 + 12;
        colBox(x, colW, colH, ctx.t('outcome'), f.outcome, 'outcome', { y: y0 });
        return;
      }
      const hasAside = f.logo || f.profile.length || f.features.length;
      const asideW = hasAside ? (ctx.W < 1000 ? 250 : 300) : -28;
      const asideGap = 28;
      const mainX = PAD.left + asideW + asideGap;
      const mainW = ctx.cw - asideW - asideGap;
      let sy = yBody;
      if (f.logo) {
        const logoH = 110;
        const res = f.logo !== '-' ? ctx.img[f.logo] : null;
        d.rect({ x: PAD.left, y: sy, w: asideW, h: logoH, fill: SURFACE, radius: 10 });
        if (res) d.image({ res, x: PAD.left + 20, y: sy + 18, w: asideW - 40, h: logoH - 36, fit: 'contain' });
        else placeholderBox(d, { x: PAD.left + 16, y: sy + 16, w: asideW - 32, h: logoH - 32, lines: ['LOGO'] });
        sy += logoH + 18;
      }
      if (f.profile.length) {
        for (const p of f.profile) {
          const vW = asideW - 80;
          const rH = hOf(p.body, 15, vW, 1.4) + 18;
          d.text(p.heading, { x: PAD.left, y: sy + 9, w: 72, h: rH - 18, size: 14, bold: true, color: COLORS.gray, lh: 1.4 });
          d.text(p.body, { x: PAD.left + 80, y: sy + 9, w: vW, h: rH - 18, size: 15, bold: true, lh: 1.4 });
          d.rect({ x: PAD.left, y: sy + rH, w: asideW, h: 1, fill: COLORS.grayLight });
          sy += rH + 1;
        }
        sy += 16;
      }
      if (f.features.length) {
        d.text(ctx.t('features'), { x: PAD.left, y: sy, w: asideW, h: 18, size: 14, bold: true, color: COLORS.gray, lh: 1 });
        let cx = PAD.left, cy = sy + 28;
        for (const x of f.features) {
          const cw = Math.min(textW(x, 15) + 28, asideW);
          if (cx + cw > PAD.left + asideW) { cx = PAD.left; cy += 28 + 8; }
          d.rect({ x: cx, y: cy, w: cw, h: 28, fill: COLORS.accentLight, radius: 14 });
          d.text(x, { x: cx, y: cy, w: cw, h: 28, size: 15, bold: true, color: COLORS.accent, align: 'center', valign: 'middle', lh: 1 });
          cx += cw + 8;
        }
      }
      const hasMetric = !!f.metric;
      const hasVoice = !!f.voice;
      const metricH = hasMetric ? 84 : 0;
      const voiceInnerW = mainW - 58 - 26;
      const voiceTextH = hasVoice ? hOf(f.voice, 18, voiceInnerW, 1.55) : 0;
      const voiceH = hasVoice ? 16 + voiceTextH + (f.voiceBy ? 6 + 20 : 0) + 14 : 0;
      const flowH = bodyH - (hasMetric ? metricH + 16 : 0) - (hasVoice ? voiceH + 16 : 0);
      const arrowW = 22, fgap = 8;
      const cW = Math.round((mainW - fgap * 4 - arrowW * 2) / 3);
      const flowArrow = (x) => d.arrowRight({ x, y: yBody + Math.round(flowH / 2) - 11, w: arrowW, h: 22 });
      const flowOpt = { headSize: 19, headTop: 18, headGap: 12, pad: 18, itemSize: 16 };
      let fx = mainX;
      colBox(fx, cW, flowH, ctx.t('challenge'), f.challenge, 'challenge', flowOpt);
      fx += cW + fgap; flowArrow(fx); fx += arrowW + fgap;
      colBox(fx, cW, flowH, ctx.t('solution'), f.solution, 'solution', flowOpt);
      fx += cW + fgap; flowArrow(fx); fx += arrowW + fgap;
      colBox(fx, cW, flowH, ctx.t('outcome'), f.outcome, 'outcome', flowOpt);
      let by = yBody + flowH + 16;
      if (hasMetric) {
        d.rect({ x: mainX, y: by, w: mainW, h: metricH, fill: COLORS.navy || COLORS.accent, radius: 12 });
        const numW = textW(f.metric, 48) + 10;
        d.text(f.metric, { x: mainX + 28, y: by, w: numW, h: metricH, size: 48, bold: true, color: COLORS.secondary, valign: 'middle', lh: 1 });
        if (f.metricLabel) d.text(f.metricLabel, { x: mainX + 28 + numW + 20, y: by, w: mainW - numW - 76, h: metricH, size: 18, bold: true, color: COLORS.paper, valign: 'middle', lh: 1.3 });
        by += metricH + 16;
      }
      if (hasVoice) {
        d.rect({ x: mainX, y: by, w: mainW, h: voiceH, fill: COLORS.accentLight, radius: 10 });
        d.rect({ x: mainX, y: by, w: 5, h: voiceH, fill: COLORS.accent });
        d.text('“', { x: mainX + 16, y: by + 6, w: 40, h: 48, size: 56, bold: true, color: COLORS.accent, lh: 1, decor: true });
        d.text(f.voice, { x: mainX + 58, y: by + 16, w: voiceInnerW, h: voiceTextH, size: 18, bold: true, lh: 1.55 });
        if (f.voiceBy) d.text('— ' + f.voiceBy, { x: mainX + 58, y: by + 16 + voiceTextH + 6, w: voiceInnerW, h: 20, size: 15, color: COLORS.gray, align: 'right', valign: 'middle', lh: 1.2 });
      }
    },

    pricing(d, f, ctx) {
      const yBody = header(d, ctx, f.title) + 14;
      const bodyH = ctx.H - PAD.bottom - yBody;
      const plans = [
        { name: f.plan1Name, price: f.plan1Price, note: f.plan1Note, items: f.plan1Items, no: '1' },
        { name: f.plan2Name, price: f.plan2Price, note: f.plan2Note, items: f.plan2Items, no: '2' },
        { name: f.plan3Name, price: f.plan3Price, note: f.plan3Note, items: f.plan3Items, no: '3' },
      ].filter((p) => p.name);
      const n = plans.length;
      const cardW = Math.round((ctx.cw - 26 * (n - 1)) / n);
      const itemsH = (items) => items.reduce((a, it) => a + hOf(it, 18, cardW - 56 - 30, 1.45) + 12, 0);
      const cardH = Math.min(bodyH, Math.max(360, 30 + 44 + 56 + 42 + 21 + Math.max(...plans.map((p) => itemsH(p.items))) + 24));
      const top = yBody + Math.round((bodyH - cardH) / 2);
      plans.forEach((p, i) => {
        const x = PAD.left + i * (cardW + 26);
        const hl = p.no === f.highlight;
        const yBody = top; // eslint-disable-line no-shadow
        d.rect({ x, y: yBody, w: cardW, h: cardH, radius: 14, fill: hl ? COLORS.navy || COLORS.accentLight : SURFACE });
        const ink = hl ? COLORS.paper : COLORS.ink;
        if (hl && f.badge) {
          const bw = textW(f.badge, 15) + 40;
          d.rect({ x: x + cardW / 2 - bw / 2, y: yBody - 16, w: bw, h: 32, fill: COLORS.secondary, radius: 16 });
          d.text(f.badge, { x: x + cardW / 2 - bw / 2, y: yBody - 16, w: bw, h: 32, size: 15, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1 });
        }
        let y = yBody + 30;
        d.text(p.name, { x: x + 10, y, w: cardW - 20, h: 32, size: 23, bold: true, color: ink, align: 'center', lh: 1.2 });
        y += 32 + 12;
        d.text(p.price, { x: x + 10, y, w: cardW - 20, h: 52, size: 44, bold: true, color: hl ? COLORS.secondary : COLORS.accent, align: 'center', lh: 1.1 });
        y += 52 + 4;
        d.text(p.note || '', { x: x + 10, y, w: cardW - 20, h: 24, size: 16, color: hl ? COLORS.paper : COLORS.gray, alpha: hl ? 0.75 : undefined, align: 'center', lh: 1.3 });
        y += 24 + 18;
        d.rect({ x: x + 28, y, w: cardW - 56, h: 1, fill: hl ? COLORS.paper : COLORS.grayLight, alpha: hl ? 0.25 : undefined });
        y += 1 + 20;
        for (const it of p.items) {
          const itemH = hOf(it, 18, cardW - 56 - 30, 1.45);
          d.circle({ x: x + 28, y: y + 3, size: 20, fill: hl ? COLORS.secondary : COLORS.accentLight });
          d.text('✓', { x: x + 28, y: y + 3, w: 20, h: 20, size: 12, bold: true, color: hl ? COLORS.paper : COLORS.accent, align: 'center', valign: 'middle', lh: 1 });
          d.text(it, { x: x + 28 + 30, y, w: cardW - 56 - 30, h: itemH, size: 18, color: ink, lh: 1.45 });
          y += itemH + 12;
        }
      });
    },

    stats(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const noteH = f.note ? hOf(f.note, 18, ctx.cw - 16, 1.45) : 0;
      const hasChart = f.chartType && f.chartValues.length && f.chartLabels.length;
      const statCard = (s, x, y, w, h, valPx, capPx, i) => {
        d.rect({ x, y, w, h, fill: i === 0 ? COLORS.accent : COLORS.accentLight, radius: 14 });
        const capLines = estLines(s.body, capPx, w - 32);
        const valH = Math.round(valPx * 1.15);
        const blockH = valH + 10 + capLines * Math.round(capPx * 1.4);
        const vy = y + Math.max(0, Math.round((h - blockH) / 2));
        d.text(s.heading, { x: x + 8, y: vy, w: w - 16, h: valH, size: valPx, bold: true, color: i === 0 ? COLORS.paper : COLORS.accent, align: 'center', valign: 'middle', lh: 1.1 });
        d.text(s.body, { x: x + 16, y: vy + valH + 10, w: w - 32, h: capLines * Math.round(capPx * 1.4), size: capPx, color: i === 0 ? COLORS.paper : COLORS.gray, align: 'center', lh: 1.4 });
      };
      if (hasChart) {
        const rowH = bodyH - (noteH ? noteH + 18 : 0);
        const cgap = 36;
        const chartW = Math.round((ctx.cw - cgap) * (1.7 / 2.7));
        const sideW = ctx.cw - cgap - chartW;
        const geom = buildChart({
          type: f.chartType, labels: f.chartLabels, values: f.chartValues, unit: f.chartUnit,
          width: chartW, height: rowH, highlight: f.chartValues.length - 1,
        });
        emitChartGeom(d, geom, PAD.left, yBody);
        const sx = PAD.left + chartW + cgap;
        const ns = Math.min(f.stats.length, 3) || 1;
        const cardGap = 16;
        const cardH = Math.round((rowH - cardGap * (ns - 1)) / ns);
        const valPx = ctx.W < 1000 ? 40 : 46;
        f.stats.slice(0, 3).forEach((s, i) => statCard(s, sx, yBody + i * (cardH + cardGap), sideW, cardH, valPx, 17, i));
        if (f.note) noteBar(d, ctx, f.note);
        return;
      }
      const gridH = Math.min(bodyH - (noteH ? noteH + 18 : 0), 300);
      const n = Math.min(f.stats.length, 4) || 1;
      const cardW = Math.round((ctx.cw - 24 * (n - 1)) / n);
      const narrow = ctx.W < 1000;
      const valPx = n <= 2 ? (narrow ? 64 : 80) : n === 3 ? (narrow ? 52 : 68) : narrow ? 40 : 56;
      const top = yBody + Math.max(0, Math.round((bodyH - (noteH ? noteH + 18 : 0) - gridH) / 2));
      f.stats.slice(0, 4).forEach((s, i) => statCard(s, PAD.left + i * (cardW + 24), top, cardW, gridH, valPx, 19, i));
      if (f.note) noteBar(d, ctx, f.note);
    },

    table(d, f, ctx, slide) {
      const yBody = header(d, ctx, f.title, f.lead);
      const hl = Number(f.highlight) || 0;
      const sym = (s) => /^[◎○◯〇●△▲×✕ー−-]$/.test(s);
      const nCols = f.columns.length || 1;
      const colWpx = ctx.cw / nCols;
      const head = COLORS.navy || COLORS.ink;
      const headRow = f.columns.map((c, i) => ({
        text: c,
        options: {
          bold: true, fontSize: PT(17), align: i === 0 ? 'left' : 'center',
          fill: { color: hex(i + 1 === hl ? COLORS.accent : head) },
          color: hex(COLORS.paper),
        },
      }));
      const rowHs = [Math.round((17 * 1.4 + 30) / 96 * 1000) / 1000];
      // Short tables breathe: body rows grow up to 64px to use the available height.
      const noteSpace = f.note ? hOf(f.note, 18, ctx.cw - 16, 1.45) + 20 : 0;
      const rowFloor = Math.min(64, (ctx.H - PAD.bottom - yBody - noteSpace - rowHs[0] * 96) / Math.max(1, f.rows.length));
      const bodyRows = f.rows.map((row, r) => {
        const cells = [...row];
        while (cells.length < nCols) cells.push('');
        const maxLines = Math.max(...cells.slice(0, nCols).map((c) => estLines(c, 16, colWpx - 30)), 1);
        rowHs.push(Math.max(maxLines * 16 * 1.4 + 26, rowFloor) / 96);
        return cells.slice(0, nCols).map((c, i) => ({
          text: c,
          options: {
            fontSize: sym(c) ? PT(24) : PT(16),
            bold: sym(c) || i === 0,
            align: i === 0 ? 'left' : 'center',
            color: hex(c === '◎' || (i + 1 === hl && !sym(c)) ? COLORS.accent : COLORS.ink),
            fill: { color: hex(i + 1 === hl ? COLORS.accentLight : r % 2 ? SURFACE : COLORS.paper) },
          },
        }));
      });
      slide.addTable([headRow, ...bodyRows], {
        x: IN(PAD.left), y: IN(yBody), w: IN(ctx.cw),
        colW: f.columns.map(() => IN(colWpx)),
        rowH: rowHs,
        border: { type: 'solid', color: hex(COLORS.grayLight), pt: 0.75 },
        fontFace: FONT, valign: 'middle', margin: [0.05, 0.13, 0.05, 0.13],
      });
      if (f.note) noteBar(d, ctx, f.note);
    },

    faq(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const qw = ctx.cw - 56;
      const items = f.items.map((p) => ({ ...p, qH: Math.max(36, hOf(p.heading, 22, qw, 1.3)), aH: hOf(p.body, 18, qw, 1.5) }));
      const used = items.reduce((a, p) => a + p.qH + 10 + p.aH, 0);
      const gap = spread(bodyH, used, items.length, 14, 34);
      let y = yBody;
      items.forEach((p, i) => {
        d.circle({ x: PAD.left, y, size: 36, fill: COLORS.accent });
        d.text('Q', { x: PAD.left, y, w: 36, h: 36, size: 18, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1 });
        d.text(p.heading, { x: PAD.left + 56, y, w: qw, h: p.qH, size: 22, bold: true, valign: p.qH === 36 ? 'middle' : 'top', lh: 1.3 });
        y += p.qH + 10;
        d.circle({ x: PAD.left, y: y - 2, size: 36, fill: COLORS.accentLight });
        d.text('A', { x: PAD.left, y: y - 2, w: 36, h: 36, size: 18, bold: true, color: COLORS.accent, align: 'center', valign: 'middle', lh: 1 });
        d.text(p.body, { x: PAD.left + 56, y: y + 4, w: qw, h: p.aH, size: 18, color: COLORS.gray, lh: 1.5 });
        y += Math.max(p.aH, 36);
        if (i < items.length - 1) d.rect({ x: PAD.left + 56, y: y + gap / 2, w: qw, h: 1, fill: COLORS.grayLight });
        y += gap;
      });
    },

    'changelog-list'(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const badgeW = 90, gap = 18;
      const mainX = PAD.left + badgeW + gap;
      const rows = f.items.map((it, i) => {
        const when = (f.timings[i] || '').trim();
        const whenW = when ? textW(when, 15) + 28 : 0;
        const mainW = ctx.cw - badgeW - gap - (when ? whenW + 14 : 0);
        const tagW = 48;
        const impW = mainW - tagW - 10;
        const headH = hOf(it.heading, 21, mainW, 1.35);
        const impH = it.body ? hOf(it.body, 17, impW, 1.45) : 0;
        return { it, when, whenW, mainW, tagW, impW, headH, impH, rowH: Math.max(headH + (it.body ? 7 + impH : 0), 34) };
      });
      const used = rows.reduce((a, r) => a + r.rowH, 0);
      const step = spread(bodyH, used, rows.length, 18, 40);
      let y = yBody;
      rows.forEach((r, i) => {
        const st = changeBadgeStyle(r.it.label);
        const badgeH = 32;
        const by = y + (r.rowH - badgeH) / 2;
        d.rect({ x: PAD.left, y: by, w: badgeW, h: badgeH, radius: 16, fill: st.fill, line: st.line, lineW: st.line ? 1.5 : undefined });
        d.text(r.it.label || ctx.t('change'), { x: PAD.left, y: by, w: badgeW, h: badgeH, size: 15, bold: true, color: st.color, align: 'center', valign: 'middle', lh: 1.3 });
        d.text(r.it.heading, { x: mainX, y, w: r.mainW, h: r.headH, size: 21, bold: true, lh: 1.35 });
        if (r.it.body) {
          const iy = y + r.headH + 7;
          d.rect({ x: mainX, y: iy + 1, w: r.tagW, h: 22, radius: 4, fill: COLORS.accentLight });
          d.text(ctx.t('impact'), { x: mainX, y: iy + 1, w: r.tagW, h: 22, size: 13, bold: true, color: COLORS.accent, align: 'center', valign: 'middle', lh: 1 });
          d.text(r.it.body, { x: mainX + r.tagW + 10, y: iy, w: r.impW, h: r.impH, size: 17, color: COLORS.gray, lh: 1.45 });
        }
        if (r.when) {
          const cx = ctx.W - PAD.right - r.whenW;
          const cyy = y + (r.rowH - 28) / 2;
          d.rect({ x: cx, y: cyy, w: r.whenW, h: 28, radius: 14, fill: SURFACE, line: COLORS.grayLight, lineW: 1 });
          d.text(r.when, { x: cx, y: cyy, w: r.whenW, h: 28, size: 15, color: COLORS.gray, align: 'center', valign: 'middle', lh: 1 });
        }
        if (i < rows.length - 1) d.rect({ x: PAD.left, y: y + r.rowH + step / 2, w: ctx.cw, h: 1, fill: COLORS.grayLight });
        y += r.rowH + step;
      });
    },

    'change-detail'(d, f, ctx) {
      const cw = ctx.cw;
      const yBody = header(d, ctx, f.title, '', f.badge);
      const metaItems = [
        f.timing ? { label: ctx.t('timing'), val: f.timing } : null,
        f.scope ? { label: ctx.t('scope'), val: f.scope } : null,
      ].filter(Boolean);
      const metaH = metaItems.length ? 48 : 0;
      const colsTop = yBody;
      const colsH = ctx.H - PAD.bottom - colsTop - (metaItems.length ? metaH + 18 : 0);
      const gap = 26;
      const ctxW = Math.round((cw - gap) * (1 / 2.05));
      const keyW = cw - gap - ctxW;
      const keyX = PAD.left + ctxW + gap;
      let cy = colsTop;
      const ctxBlock = (label, text) => {
        if (!text) return;
        d.rect({ x: PAD.left, y: cy + 2, w: 4, h: 18, fill: COLORS.accent });
        d.text(label, { x: PAD.left + 14, y: cy, w: ctxW - 14, h: 22, size: 17, bold: true, color: COLORS.accent, valign: 'middle', lh: 1 });
        cy += 22 + 10;
        const pH = hOf(text, 19, ctxW - 14, 1.7);
        d.text(text, { x: PAD.left + 14, y: cy, w: ctxW - 14, h: pH, size: 19, lh: 1.7 });
        cy += pH + 22;
      };
      ctxBlock(ctx.t('what'), f.what);
      ctxBlock(ctx.t('background'), f.background);
      const cardGap = 16;
      const cardH = Math.round((colsH - cardGap) / 2);
      const card = (yy, fill, line, labelColor, label, items, dotColor) => {
        d.rect({ x: keyX, y: yy, w: keyW, h: cardH, radius: 12, fill, line, lineW: line ? 1.5 : undefined });
        d.text(label, { x: keyX + 24, y: yy + 20, w: keyW - 48, h: 26, size: 20, bold: true, color: labelColor, lh: 1 });
        dotList(d, items, { x: keyX + 24, y: yy + 20 + 26 + 14, w: keyW - 48, fontPx: 19, lineH: 1.5, gap: 10, indent: 24, dotSize: 9, dotTop: 9, dotColor, square: false });
      };
      card(colsTop, COLORS.accentLight, COLORS.accent, COLORS.accent, ctx.t('impactLong'), f.impact, COLORS.accent);
      card(colsTop + cardH + cardGap, SURFACE, undefined, COLORS.ink, ctx.t('actionLong'), f.action, COLORS.gray);
      if (metaItems.length) {
        const my = ctx.H - PAD.bottom - metaH;
        d.rect({ x: PAD.left, y: my, w: cw, h: metaH, radius: 10, fill: SURFACE });
        let mx = PAD.left + 22;
        for (const m of metaItems) {
          const lblW = textW(m.label, 16) + 14;
          d.text(m.label, { x: mx, y: my, w: lblW, h: metaH, size: 16, bold: true, color: COLORS.accent, valign: 'middle', lh: 1 });
          const valW = textW(m.val, 16) + 12;
          d.text(m.val, { x: mx + lblW, y: my, w: valW, h: metaH, size: 16, valign: 'middle', lh: 1 });
          mx += lblW + valW + 32;
        }
      }
    },

    'talk-track'(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const sitW = 290, gap = 22;
      const sayX = PAD.left + sitW + gap;
      const sayW = ctx.cw - sitW - gap;
      const rows = f.items.map((it) => {
        const goodH = hOf(it.heading, 20, sayW - 42, 1.5);
        const badH = it.body ? hOf(it.body, 17, sayW - 42, 1.45) : 0;
        const sayH = goodH + (it.body ? 14 + badH : 0);
        const sitTextH = hOf(it.label, 19, sitW - 40, 1.4);
        return { it, goodH, badH, sayH, sitTextH, rowH: Math.max(sayH, sitTextH + 44 + 18) };
      });
      const used = rows.reduce((a, r) => a + r.rowH, 0);
      const step = spread(bodyH, used, rows.length, 18, 36);
      let y = yBody;
      rows.forEach((r, i) => {
        d.rect({ x: PAD.left, y, w: sitW, h: r.rowH, radius: 10, fill: SURFACE });
        d.text(ctx.t('when'), { x: PAD.left + 20, y: y + 16, w: sitW - 40, h: 18, size: 14, bold: true, color: COLORS.accent, lh: 1 });
        d.text(r.it.label, { x: PAD.left + 20, y: y + 42, w: sitW - 40, h: r.sitTextH, size: 19, bold: true, lh: 1.4 });
        const sy = y + Math.max(0, Math.round((r.rowH - r.sayH) / 2));
        d.circle({ x: sayX, y: sy, size: 28, fill: COLORS.ok || COLORS.accent });
        d.text('✓', { x: sayX, y: sy, w: 28, h: 28, size: 15, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1 });
        d.text(r.it.heading, { x: sayX + 42, y: sy, w: sayW - 42, h: r.goodH, size: 20, lh: 1.5 });
        if (r.it.body) {
          const by = sy + r.goodH + 14;
          d.circle({ x: sayX, y: by, size: 28, fill: COLORS.danger || COLORS.gray });
          d.text('✕', { x: sayX, y: by, w: 28, h: 28, size: 15, bold: true, color: COLORS.paper, align: 'center', valign: 'middle', lh: 1 });
          d.text(r.it.body, { x: sayX + 42, y: by, w: sayW - 42, h: r.badH, size: 17, color: COLORS.gray, lh: 1.45 });
        }
        if (i < rows.length - 1) d.rect({ x: PAD.left, y: y + r.rowH + step / 2, w: ctx.cw, h: 1, fill: COLORS.grayLight });
        y += r.rowH + step;
      });
    },
  };
  return { ...emitters, ...createDataEmitters({ colors: COLORS, font: FONT, header, helpers, noteBar, hOf, spread }) };
}

module.exports = { createCommonEmitters };
