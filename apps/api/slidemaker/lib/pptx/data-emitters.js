'use strict';

const { PAD, textW } = require('../geometry');
const { hex } = require('./drawing');

// Data-driven layouts. Every chart is computed from the deck values: doughnut and
// series charts are native (editable) PowerPoint charts; KPI sparklines, progress
// bars, funnels and matrices are vector shapes.
function createDataEmitters({ colors: C, font: FONT, header, noteBar, hOf, spread }) {
  const SURFACE = C.surface || C.grayLight;
  const NAVY = C.navy || C.ink;
  const PALETTE = C.chart || [C.accent, C.secondary, C.ink, C.accentLight, C.gray];
  const fmt = (n) => (n == null || Number.isNaN(n) ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const pct = (n) => `${(Math.round(n * 1000) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
  const toneColor = (tone) => (tone === 'good' ? C.ok || C.accent : tone === 'bad' ? C.danger || C.ink : C.gray);
  const toneLight = (tone) => (tone === 'good' ? C.okLight || C.accentLight : tone === 'bad' ? C.dangerLight || SURFACE : SURFACE);

  // Shared axis / label styling for native charts.
  const axisStyle = () => ({
    catAxisLabelColor: hex(C.gray), valAxisLabelColor: hex(C.gray),
    catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
    catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
    catAxisLineShow: true, catAxisLineColor: hex(C.grayLight),
    valAxisLineShow: false,
    valGridLine: { color: hex(C.grayLight), size: 1 },
    catGridLine: { style: 'none' },
    valAxisLabelFormatCode: 'General', dataLabelFormatCode: 'General',
    legendFontFace: FONT, legendFontSize: 13, legendColor: hex(C.ink),
    dataLabelFontFace: FONT, dataLabelFontSize: 11, dataLabelColor: hex(C.ink),
  });

  // Numbered insight list on a surface card. Height = insightHeight(...) when compact.
  const INSIGHT_SIZE = 17;
  function insightHeight(points, w) {
    return 52 + points.reduce((a, p) => a + hOf(p, INSIGHT_SIZE, w - 48 - 32, 1.5), 0) + (points.length - 1) * 10 + 18;
  }
  function insightPanel(d, ctx, x, y, w, h, points, title) {
    d.rect({ x, y, w, h, fill: SURFACE, radius: 12 });
    d.text(title || ctx.t('insights'), { x: x + 24, y: y + 20, w: w - 48, h: 20, size: 15, bold: true, color: C.accent, lh: 1, decor: true });
    const hs = points.map((p) => hOf(p, INSIGHT_SIZE, w - 48 - 32, 1.5));
    const gap = spread(h - 52 - 18, hs.reduce((a, b) => a + b, 0), points.length, 10, 26);
    let py = y + 52;
    points.forEach((p, i) => {
      d.circle({ x: x + 24, y: py + 1, size: 22, fill: C.accent });
      d.text(String(i + 1), { x: x + 24, y: py + 1, w: 22, h: 22, size: 12, bold: true, color: C.paper, align: 'center', valign: 'middle', lh: 1 });
      d.text(p, { x: x + 24 + 32, y: py, w: w - 48 - 32, h: hs[i], size: INSIGHT_SIZE, lh: 1.5 });
      py += hs[i] + gap;
    });
  }

  return {
    'kpi-cards'(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const noteH = f.note ? hOf(f.note, 18, ctx.cw - 16, 1.45) + 18 : 0;
      const bodyH = ctx.H - PAD.bottom - yBody - noteH;
      const n = f.kpis.length || 1;
      const gap = 24;
      const cardW = Math.round((ctx.cw - gap * (n - 1)) / n);
      const inner = cardW - 48;
      const base = n <= 2 ? 76 : n === 3 ? 66 : 56;
      const anySeries = f.kpis.some((k) => k.series.length >= 3);
      const anyNote = f.kpis.some((k) => k.note);
      const anyDelta = f.kpis.some((k) => k.delta);
      const valueSize = Math.min(base, ...f.kpis.map((k) => Math.floor((inner - 6) / Math.max(0.5, textW(k.value, 1) + (k.unit ? textW(k.unit, 0.42) + 0.15 : 0)))));
      const valH = Math.round(valueSize * 1.15);
      const cardH = Math.min(bodyH, 30 + 24 + 16 + valH + (anyDelta ? 14 + 30 : 0) + (anyNote ? 16 + 44 : 0) + (anySeries ? 26 + 64 : 0) + 30);
      const top = yBody + Math.max(0, Math.round((bodyH - cardH) / 2));
      f.kpis.forEach((k, i) => {
        const x = PAD.left + i * (cardW + gap);
        const lead = i === 0;
        d.rect({ x, y: top, w: cardW, h: cardH, fill: lead ? NAVY : SURFACE, radius: 14 });
        d.rect({ x: x + 24, y: top + 24, w: 28, h: 4, fill: lead ? C.secondary : C.accent });
        let y = top + 36;
        d.text(k.label, { x: x + 24, y, w: inner, h: 24, size: 17, bold: true, color: lead ? C.paper : C.gray, alpha: lead ? 0.85 : undefined, lh: 1.3 });
        y += 24 + 16;
        const runs = [{ text: k.value, size: valueSize, color: lead ? C.paper : C.ink }];
        if (k.unit) runs.push({ text: ` ${k.unit}`, size: Math.round(valueSize * 0.42), color: lead ? C.secondary : C.accent });
        d.rich(runs, { x: x + 24, y, w: inner, h: valH, valign: 'bottom', lh: 1 });
        y += valH;
        if (anyDelta) {
          y += 14;
          if (k.delta) {
            const tone = k.tone || (k.trend === 'up' ? 'good' : k.trend === 'down' ? 'bad' : 'neutral');
            const arrow = k.trend === 'up' ? '▲ ' : k.trend === 'down' ? '▼ ' : '';
            const label = arrow + k.delta;
            const pw = textW(label, 15) + 24;
            d.rect({ x: x + 24, y, w: pw, h: 30, radius: 15, fill: lead ? C.paper : toneLight(tone), alpha: lead ? 0.14 : undefined });
            d.text(label, { x: x + 24, y, w: pw, h: 30, size: 15, bold: true, color: lead ? C.paper : toneColor(tone), align: 'center', valign: 'middle', lh: 1 });
          }
          y += 30;
        }
        if (anyNote) {
          y += 16;
          if (k.note) d.text(k.note, { x: x + 24, y, w: inner, h: 44, size: 15, color: lead ? C.paper : C.gray, alpha: lead ? 0.7 : undefined, lh: 1.45 });
          y += 44;
        }
        if (k.series.length >= 3) {
          const sx = x + 24, sw = inner, sh = 56, sy = top + cardH - 30 - sh;
          const min = Math.min(...k.series), max = Math.max(...k.series);
          const span = max - min || 1;
          const pts = k.series.map((v, j) => [sx + (j / (k.series.length - 1)) * sw, sy + sh - ((v - min) / span) * sh]);
          d.seg(sx, sy + sh + 6, sx + sw, sy + sh + 6, { color: lead ? C.paper : C.grayLight, width: 1, alpha: lead ? 0.25 : undefined });
          for (let j = 1; j < pts.length; j++) d.seg(pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], { color: lead ? C.secondary : C.accent, width: 2.5 });
          const last = pts[pts.length - 1];
          d.circle({ x: last[0] - 5, y: last[1] - 5, size: 10, fill: lead ? C.secondary : C.accent, line: lead ? NAVY : C.paper, lineW: 2 });
        }
      });
      if (f.note) noteBar(d, ctx, f.note);
    },

    donut(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const size = Math.min(bodyH, 430);
      const cx = PAD.left + 10;
      const cy = yBody + Math.round((bodyH - size) / 2);
      const total = f.segments.reduce((a, s) => a + (s.value || 0), 0);
      d.chart('doughnut', [{ name: f.title, labels: f.segments.map((s) => s.label), values: f.segments.map((s) => s.value || 0) }], {
        x: cx, y: cy, w: size, h: size, holeSize: 62,
        chartColors: PALETTE.map(hex), showLegend: false, showValue: false, showPercent: false, showLabel: false, showTitle: false,
        dataBorder: { pt: 2, color: hex(C.paper) }, firstSliceAng: 0,
      });
      const centerValue = f.centerValue || fmt(total);
      const cvSize = Math.min(42, Math.floor((size * 0.34) / Math.max(1, textW(centerValue, 1))));
      d.text(centerValue, { x: cx + size * 0.2, y: cy + size / 2 - cvSize * 0.9, w: size * 0.6, h: cvSize * 1.15, size: cvSize, bold: true, align: 'center', valign: 'middle', lh: 1 });
      d.text(f.centerLabel || (f.unit ? `${ctx.t('total')}（${f.unit}）` : ctx.t('total')), { x: cx + size * 0.2, y: cy + size / 2 + cvSize * 0.35, w: size * 0.6, h: 22, size: 15, color: C.gray, align: 'center', valign: 'middle', lh: 1 });
      const rx = PAD.left + size + 64;
      const rw = ctx.cw - size - 64;
      const rowH = f.segments.length > 4 && f.points.length ? 46 : 52;
      const legendH = f.segments.length * rowH;
      const insH = f.points.length ? insightHeight(f.points, rw) : 0;
      const gapLI = f.points.length ? 20 : 0;
      let y = yBody + Math.max(0, Math.round((bodyH - legendH - gapLI - insH) / 2));
      const maxShare = Math.max(...f.segments.map((s) => (total ? s.value / total : 0)), 0.0001);
      f.segments.forEach((s, i) => {
        const share = total ? s.value / total : 0;
        const color = PALETTE[i % PALETTE.length];
        d.rect({ x: rx, y: y + 6, w: 14, h: 14, radius: 3, fill: color });
        d.text(s.label, { x: rx + 26, y, w: rw - 26 - 200, h: 26, size: 18, bold: true, valign: 'middle', lh: 1.2 });
        d.text(`${fmt(s.value)}${f.unit ? ` ${f.unit}` : ''}`, { x: rx + rw - 200, y, w: 110, h: 26, size: 15, color: C.gray, align: 'right', valign: 'middle', lh: 1 });
        d.text(pct(share), { x: rx + rw - 84, y, w: 84, h: 26, size: 19, bold: true, color: i === 0 ? C.accent : C.ink, align: 'right', valign: 'middle', lh: 1 });
        d.rect({ x: rx + 26, y: y + 32, w: rw - 26, h: 6, radius: 3, fill: C.grayLight });
        d.rect({ x: rx + 26, y: y + 32, w: Math.max(6, (rw - 26) * (share / maxShare)), h: 6, radius: 3, fill: color });
        y += rowH;
      });
      if (f.points.length) insightPanel(d, ctx, rx, y + gapLI, rw, insH, f.points);
    },

    'chart-series'(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const noteH = f.note ? hOf(f.note, 18, ctx.cw - 16, 1.45) + 14 : 0;
      const bodyH = ctx.H - PAD.bottom - yBody - noteH;
      const split = f.points.length > 0;
      const chartW = split ? Math.round((ctx.cw - 32) * 0.66) : ctx.cw;
      const multi = f.series.length > 1;
      const type = f.chartType || 'bar';
      const unitH = f.unit ? 22 : 0;
      if (f.unit) d.text(`(${f.unit})`, { x: PAD.left, y: yBody - 8, w: 200, h: 20, size: 13, color: C.gray, lh: 1 });
      const data = f.series.map((s) => ({ name: s.name, labels: f.categories, values: s.values }));
      const fewPoints = f.categories.length <= 8;
      const common = {
        x: PAD.left - 6, y: yBody + unitH - 6, w: chartW + 6, h: bodyH - unitH + 6,
        chartColors: PALETTE.map(hex), showLegend: multi, legendPos: 't', showTitle: false,
        ...axisStyle(),
      };
      if (type === 'line') {
        d.chart('line', data, { ...common, lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 8, showValue: !multi && fewPoints, dataLabelPosition: 't' });
      } else if (type === 'area') {
        d.chart('area', data, { ...common, chartColorsOpacity: 55, showValue: false });
      } else {
        const stacked = type === 'stacked';
        d.chart('bar', data, {
          ...common, barDir: type === 'hbar' ? 'bar' : 'col', barGrouping: stacked ? 'stacked' : 'clustered',
          barGapWidthPct: multi && !stacked ? 70 : 55, ...(stacked ? { barOverlapPct: 100 } : {}),
          showValue: (!multi && fewPoints) || (stacked && fewPoints && f.series.length <= 3),
          dataLabelPosition: stacked ? 'ctr' : 'outEnd',
          ...(stacked ? { dataLabelColor: hex(C.paper) } : {}),
          ...(type === 'hbar' ? { catAxisOrientation: 'maxMin' } : {}),
        });
      }
      if (split) insightPanel(d, ctx, PAD.left + chartW + 32, yBody, ctx.cw - chartW - 32, bodyH, f.points);
      if (f.note) noteBar(d, ctx, f.note);
    },

    progress(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const noteH = f.note ? hOf(f.note, 18, ctx.cw - 16, 1.45) + 18 : 0;
      const bodyH = ctx.H - PAD.bottom - yBody - noteH;
      const n = f.items.length || 1;
      const anyNote = f.items.some((it) => it.note);
      const rowH = Math.min(anyNote ? 84 : 70, Math.floor(bodyH / n));
      const labelW = 330;
      const valW = 190;
      const trackX = PAD.left + labelW + 24;
      const trackW = ctx.cw - labelW - 24 - valW - 24;
      const top = yBody + Math.max(0, Math.round((bodyH - rowH * n) / 2));
      f.items.forEach((it, i) => {
        const y = top + i * rowH;
        const target = it.target > 0 ? it.target : 100;
        const ratio = Math.max(0, (it.value || 0) / target);
        const done = ratio >= 1;
        const color = done ? C.ok || C.accent : C.accent;
        const textH = 26 + (it.note ? 22 : 0);
        const ty = y + Math.round((rowH - textH) / 2);
        d.text(it.label, { x: PAD.left, y: ty, w: labelW, h: 26, size: 19, bold: true, valign: 'middle', lh: 1.2 });
        if (it.note) d.text(it.note, { x: PAD.left, y: ty + 27, w: labelW, h: 20, size: 14, color: C.gray, lh: 1.3 });
        const by = y + rowH / 2 - 8;
        d.rect({ x: trackX, y: by, w: trackW, h: 16, radius: 8, fill: C.grayLight });
        d.rect({ x: trackX, y: by, w: Math.max(16, trackW * Math.min(1, ratio)), h: 16, radius: 8, fill: color });
        if (ratio > 1) d.circle({ x: trackX + trackW - 16, y: by - 6, size: 28, fill: color, line: C.paper, lineW: 3 });
        const shown = it.display || pct(ratio);
        d.text(shown, { x: PAD.left + ctx.cw - valW, y: y + rowH / 2 - 16, w: valW, h: 32, size: 20, bold: true, color: done ? color : C.ink, align: 'right', valign: 'middle', lh: 1 });
        if (i < n - 1) d.rect({ x: PAD.left, y: y + rowH, w: ctx.cw, h: 1, fill: C.grayLight });
      });
      if (f.note) noteBar(d, ctx, f.note);
    },

    funnel(d, f, ctx) {
      const yBody = header(d, ctx, f.title, f.lead);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const split = f.points.length > 0;
      const areaW = split ? Math.round((ctx.cw - 32) * 0.64) : ctx.cw;
      const n = f.stages.length;
      const convH = 28;
      const barH = Math.min(64, Math.floor((bodyH - convH * (n - 1)) / n));
      const labelW = 210;
      const barsX = PAD.left + labelW + 20;
      const barsW = areaW - labelW - 20;
      const maxV = Math.max(...f.stages.map((s) => s.value || 0), 1);
      const colors = [NAVY, C.accentDeep || C.accent, C.accent, PALETTE[3] || C.accentLight, C.secondary, PALETTE[4] || C.secondaryLight];
      const totalH = n * barH + (n - 1) * convH;
      let y = yBody + Math.max(0, Math.round((bodyH - totalH) / 2));
      f.stages.forEach((s, i) => {
        const w = Math.max(barsW * 0.32, barsW * Math.sqrt((s.value || 0) / maxV));
        const x = barsX + (barsW - w) / 2;
        const color = colors[Math.min(i, colors.length - 1)];
        d.rect({ x, y, w, h: barH, radius: 8, fill: color });
        const valueText = `${fmt(s.value)}${f.unit ? ` ${f.unit}` : ''}`;
        const light = i >= 3;
        d.text(valueText, { x, y, w, h: barH, size: 20, bold: true, color: light ? NAVY : C.paper, align: 'center', valign: 'middle', lh: 1 });
        const textH = 26 + (s.note ? 20 : 0);
        d.text(s.label, { x: PAD.left, y: y + (barH - textH) / 2, w: labelW, h: 26, size: 18, bold: true, valign: 'middle', lh: 1.2 });
        if (s.note) d.text(s.note, { x: PAD.left, y: y + (barH - textH) / 2 + 26, w: labelW, h: 20, size: 13, color: C.gray, lh: 1.3 });
        if (i < n - 1) {
          const next = f.stages[i + 1];
          const rate = s.value ? next.value / s.value : 0;
          const cyy = y + barH;
          d.triDown({ x: barsX + barsW / 2 - 7, y: cyy + 8, w: 14, h: 10, fill: C.grayLight });
          d.text(pct(rate), { x: barsX + barsW / 2 + 14, y: cyy + 4, w: 120, h: convH - 8, size: 14, bold: true, color: C.accent, valign: 'middle', lh: 1 });
        }
        y += barH + convH;
      });
      if (split) {
        const px = PAD.left + areaW + 32;
        const pw = ctx.cw - areaW - 32;
        const overall = f.stages[0].value ? f.stages[n - 1].value / f.stages[0].value : 0;
        const panelH = 148;
        d.rect({ x: px, y: yBody, w: pw, h: panelH, fill: NAVY, radius: 12 });
        d.text(ctx.t('conversion'), { x: px + 24, y: yBody + 20, w: pw - 48, h: 20, size: 15, bold: true, color: C.secondary, lh: 1 });
        d.text(pct(overall), { x: px + 24, y: yBody + 48, w: pw - 48, h: 52, size: 46, bold: true, color: C.paper, lh: 1 });
        d.text(`${f.stages[0].label} → ${f.stages[n - 1].label}`, { x: px + 24, y: yBody + 110, w: pw - 48, h: 20, size: 13, color: C.paper, alpha: 0.7, lh: 1.2 });
        insightPanel(d, ctx, px, yBody + panelH + 16, pw, bodyH - panelH - 16, f.points);
      }
    },

    matrix(d, f, ctx) {
      const yBody = header(d, ctx, f.title);
      const bodyH = ctx.H - PAD.bottom - yBody;
      const axisW = 30;
      const axisH = f.xLabel ? 34 : 18;
      const topH = f.yLabel ? 30 : 0;
      const gx = PAD.left + axisW;
      const gw = ctx.cw - axisW;
      const gy = yBody + topH;
      const gh = bodyH - axisH - topH;
      const gap = 14;
      const qw = (gw - gap) / 2;
      const qh = (gh - gap) / 2;
      // Axes: arrows along the left and bottom edges.
      d.seg(PAD.left + 10, gy + gh + 10, PAD.left + 10, yBody - 4, { color: C.gray, width: 1.5, endArrow: true });
      d.seg(PAD.left + 10, gy + gh + 10, PAD.left + ctx.cw, gy + gh + 10, { color: C.gray, width: 1.5, endArrow: true });
      if (f.yLabel) d.text(f.yLabel, { x: PAD.left + 24, y: yBody - 6, w: 300, h: 22, size: 14, bold: true, color: C.gray, lh: 1.2 });
      if (f.xLabel) d.text(f.xLabel, { x: PAD.left + ctx.cw - 340, y: gy + gh + 16, w: 330, h: 20, size: 14, bold: true, color: C.gray, align: 'right', lh: 1.2 });
      const hl = Number(f.highlight) || 0;
      f.quadrants.slice(0, 4).forEach((q, i) => {
        const x = gx + (i % 2) * (qw + gap);
        const y = gy + Math.floor(i / 2) * (qh + gap);
        const on = hl === i + 1;
        d.rect({ x, y, w: qw, h: qh, radius: 14, fill: on ? C.accent : SURFACE });
        d.text(String(i + 1).padStart(2, '0'), { x: x + qw - 90, y: y + 18, w: 66, h: 40, size: 34, bold: true, color: on ? C.paper : C.accent, alpha: on ? 0.35 : 0.25, align: 'right', lh: 1, decor: true });
        d.text(q.heading, { x: x + 28, y: y + 26, w: qw - 130, h: 32, size: 23, bold: true, color: on ? C.paper : C.ink, lh: 1.3 });
        d.rect({ x: x + 28, y: y + 26 + 38, w: 28, h: 3, fill: on ? C.secondary : C.accent });
        if (q.body) d.text(q.body, { x: x + 28, y: y + 26 + 38 + 16, w: qw - 56, h: qh - 26 - 38 - 16 - 20, size: 18, color: on ? C.paper : C.gray, lh: 1.55 });
      });
    },

    process(d, f, ctx) {
      const yHead = header(d, ctx, f.title, f.lead);
      const concH = f.conclusion ? hOf(f.conclusion, 21, ctx.cw - 80, 1.4) + 30 : 0;
      const availH = ctx.H - PAD.bottom - yHead;
      const n = f.steps.length;
      const colW = ctx.cw / n;
      const circle = 52;
      // Cards hug their content (min 200px); circles + cards + conclusion are centred.
      const cardH = Math.min(availH - circle - 22 - (concH ? concH + 22 : 0), Math.max(200, ...f.steps.map((s) =>
        36 + hOf(s.heading, 21, colW - 56, 1.3) + 10 + (s.body ? hOf(s.body, 16, colW - 56, 1.55) : 0) + 24)));
      const blockH = circle + 22 + cardH + (concH ? 22 + concH : 0);
      const yBody = yHead + Math.round((availH - blockH) / 2);
      const lineY = yBody + circle / 2;
      d.rect({ x: PAD.left + colW / 2, y: lineY - 1.5, w: colW * (n - 1), h: 3, fill: C.grayLight });
      const cardTop = yBody + circle + 22;
      f.steps.forEach((s, i) => {
        const cx = PAD.left + colW * (i + 0.5);
        const first = i === 0;
        d.circle({ x: cx - circle / 2, y: yBody, size: circle, fill: first ? C.accent : C.paper, line: C.accent, lineW: 3 });
        d.text(String(i + 1).padStart(2, '0'), { x: cx - circle / 2, y: yBody, w: circle, h: circle, size: 18, bold: true, color: first ? C.paper : C.accent, align: 'center', valign: 'middle', lh: 1 });
        if (i < n - 1) d.shape('chevron', { x: cx + colW / 2 - 7, y: lineY - 8, w: 14, h: 16, fill: C.accent });
        const x = PAD.left + colW * i + 8;
        const w = colW - 16;
        d.rect({ x, y: cardTop, w, h: cardH, radius: 12, fill: first ? C.accentLight : SURFACE });
        d.rect({ x: x + 20, y: cardTop + 22, w: 24, h: 4, fill: first ? C.accent : C.secondary });
        const headH = hOf(s.heading, 21, w - 40, 1.3);
        d.text(s.heading, { x: x + 20, y: cardTop + 36, w: w - 40, h: headH, size: 21, bold: true, lh: 1.3 });
        if (s.body) d.text(s.body, { x: x + 20, y: cardTop + 36 + headH + 10, w: w - 40, h: cardH - 36 - headH - 10 - 18, size: 16, color: C.gray, lh: 1.55 });
      });
      if (f.conclusion) {
        const y = cardTop + cardH + 22;
        d.rect({ x: PAD.left, y, w: ctx.cw, h: concH, radius: 12, fill: NAVY });
        d.rect({ x: PAD.left, y, w: 8, h: concH, fill: C.secondary });
        d.text(f.conclusion, { x: PAD.left + 40, y: y + 15, w: ctx.cw - 80, h: concH - 30, size: 21, bold: true, color: C.paper, valign: 'middle', lh: 1.4 });
      }
    },
  };
}

module.exports = { createDataEmitters };
