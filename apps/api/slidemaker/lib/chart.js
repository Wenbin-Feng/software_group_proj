'use strict';

const { loadTemplate } = require('./template-loader');
const { units: strUnits } = require('./geometry');

// =============================================================
// SVG チャート生成。外部ライブラリなし。
//
// 仕組み: 各チャート種別が「図形プリミティブの配列 + anchors」を組み立て、
// toSvg() で直列化する。プリミティブは px 座標の rect / line / text /
// polyline / circle / path に揃えてあり、PPTX レンダラ（lib/render-pptx.js）
// からも同じジオメトリを消費できる（buildChart を使う）。
//
// 種別:
//   bar       縦棒。highlight（1本だけ accent・他はグレー）/ delta（差分矢印）対応
//   line      折れ線
//   hbar      横棒ランキング（カテゴリ名を左、値を棒の右端に）。highlight 対応
//   waterfall 増減の内訳。最初の値=開始値、以降=増減（負数で減少）、合計列を自動追加
//
// anchors は各データ点の位置（% 座標）。吹き出し（callouts)の配置に使う。
// =============================================================

const PAD = { l: 76, r: 36, t: 48, b: 56 };

function niceMax(maxValue) {
  if (maxValue <= 0) return 1;
  const raw = maxValue * 1.15;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * mag >= raw) return m * mag;
  }
  return 10 * mag;
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// ---- 図形プリミティブ ----
const R = (x, y, w, h, fill, rx = 0) => ({ kind: 'rect', x, y, w, h, fill, rx });
const L = (x1, y1, x2, y2, stroke, width = 1, dash = null) => ({ kind: 'line', x1, y1, x2, y2, stroke, width, dash });
const textPrimitive = (colors) => (x, y, text, o = {}) => ({ kind: 'text', x, y, text, size: o.size || 17, fill: o.fill || colors.gray, weight: o.weight || null, anchor: o.anchor || 'start' });
const PL = (points, stroke, width) => ({ kind: 'polyline', points, stroke, width });
const C = (cx, cy, r, fill, stroke, strokeWidth) => ({ kind: 'circle', cx, cy, r, fill, stroke, strokeWidth });
const P = (d, fill) => ({ kind: 'path', d, fill });

// Category labels shrink (18px → 12px) so neighbours never overlap in narrow bands.
const axisLabelSize = (label, bandW) => Math.max(12, Math.min(18, Math.floor((bandW * 0.94) / Math.max(1, strUnits(label)))));

// ---- 共通: 縦スケールのグリッド + Y軸ラベル ----
function vGrid(prims, width, yMax, unit, yOf, colors) {
  const T = textPrimitive(colors);
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (yMax / ticks) * i;
    const y = yOf(v);
    prims.push(L(PAD.l, y, width - PAD.r, y, colors.grayLight, i === 0 ? 2 : 1));
    prims.push(T(PAD.l - 12, y + 6, fmt(v), { anchor: 'end' }));
  }
  if (unit) prims.push(T(PAD.l - 12, PAD.t - 20, `(${unit})`, { size: 16, anchor: 'end' }));
}

// ---- 差分矢印（bar 用）: from の棒の上から to の棒の上へコの字 + 矢頭 + ラベル ----
function drawDelta(prims, delta, tops, vs, colors) {
  const T = textPrimitive(colors);
  const a = tops[delta.from];
  const b = tops[delta.to];
  if (!a || !b || delta.from === delta.to) return;
  const yTop = Math.max(Math.min(a.y, b.y) - 58, 26);
  const accent = colors.accent;
  prims.push(L(a.x, a.y - 34, a.x, yTop, accent, 3));
  prims.push(L(a.x, yTop, b.x, yTop, accent, 3));
  prims.push(L(b.x, yTop, b.x, b.y - 44, accent, 3));
  prims.push({ kind: 'tridown', x: b.x - 7, y: b.y - 46, w: 14, h: 14, fill: accent });
  let label = delta.label;
  if (!label) {
    const va = vs[delta.from];
    const vb = vs[delta.to];
    const pct = va ? Math.round(((vb - va) / Math.abs(va)) * 100) : 0;
    label = `${pct > 0 ? '+' : ''}${pct}%`;
  }
  prims.push(T((a.x + b.x) / 2, yTop - 12, label, { size: 22, fill: accent, weight: 700, anchor: 'middle' }));
}

// ---- 縦棒 ----
function buildBar({ labels, values, unit, width, height, highlight, delta }, colors) {
  const T = textPrimitive(colors);
  const n = values.length;
  const plotW = width - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;
  const yMax = niceMax(Math.max(...values, 0));
  const yOf = (v) => PAD.t + plotH * (1 - v / yMax);
  const bandW = plotW / n;
  const barW = bandW * 0.54;
  const prims = [];
  const anchors = [];
  const tops = [];
  vGrid(prims, width, yMax, unit, yOf, colors);
  values.forEach((v, i) => {
    const x = PAD.l + bandW * i + (bandW - barW) / 2;
    const y = yOf(v);
    const dim = highlight != null && highlight !== i;
    prims.push(R(x, y, barW, PAD.t + plotH - y, dim ? colors.chartDim || colors.gray : colors.accent, 4));
    prims.push(T(x + barW / 2, y - 12, fmt(v), { size: 19, fill: colors.ink, weight: 600, anchor: 'middle' }));
    tops.push({ x: x + barW / 2, y });
    anchors.push({ xPct: ((x + barW / 2) / width) * 100, yPct: (y / height) * 100 });
  });
  labels.forEach((label, i) => {
    prims.push(T(PAD.l + bandW * (i + 0.5), height - PAD.b + 30, label, { size: axisLabelSize(label, bandW), anchor: 'middle' }));
  });
  if (delta) drawDelta(prims, delta, tops, values, colors);
  return { prims, anchors };
}

// ---- 折れ線 ----
function buildLine({ labels, values, unit, width, height }, colors) {
  const T = textPrimitive(colors);
  const n = values.length;
  const plotW = width - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;
  const yMax = niceMax(Math.max(...values, 0));
  const yOf = (v) => PAD.t + plotH * (1 - v / yMax);
  const bandW = plotW / n;
  const prims = [];
  const anchors = [];
  vGrid(prims, width, yMax, unit, yOf, colors);
  const pts = values.map((v, i) => [PAD.l + bandW * (i + 0.5), yOf(v)]);
  prims.push(PL(pts, colors.accent, 4));
  pts.forEach(([x, y], i) => {
    prims.push(C(x, y, 7, colors.paper, colors.accent, 4));
    prims.push(T(x, y - 18, fmt(values[i]), { size: 19, fill: colors.ink, weight: 600, anchor: 'middle' }));
    anchors.push({ xPct: (x / width) * 100, yPct: (y / height) * 100 });
  });
  labels.forEach((label, i) => {
    prims.push(T(PAD.l + bandW * (i + 0.5), height - PAD.b + 30, label, { size: axisLabelSize(label, bandW), anchor: 'middle' }));
  });
  return { prims, anchors };
}

// ---- 横棒ランキング ----
function buildHbar({ labels, values, unit, width, height, highlight }, colors) {
  const T = textPrimitive(colors);
  const n = values.length;
  const labelW = Math.min(280, Math.round(Math.max(...labels.map((l) => strUnits(l)), 4) * 18) + 28);
  const top = 30;
  const bottom = 16;
  const plotW = width - labelW - 96; // 右側は値ラベル用の余白
  const plotH = height - top - bottom;
  const maxV = Math.max(...values, 0) || 1;
  const bandH = plotH / n;
  const barH = Math.min(bandH * 0.62, 42);
  const prims = [];
  const anchors = [];
  if (unit) prims.push(T(width - 8, 20, `(${unit})`, { size: 16, anchor: 'end' }));
  prims.push(L(labelW, top - 6, labelW, top + plotH + 6, colors.grayLight, 2));
  values.forEach((v, i) => {
    const cy = top + bandH * i + bandH / 2;
    const bw = Math.max(Math.round((v / maxV) * plotW), 2);
    const dim = highlight != null && highlight !== i;
    prims.push(T(labelW - 14, cy + 6, labels[i], { size: 18, fill: colors.ink, anchor: 'end' }));
    prims.push(R(labelW, cy - barH / 2, bw, barH, dim ? colors.chartDim || colors.gray : colors.accent, 4));
    prims.push(T(labelW + bw + 12, cy + 7, fmt(v), { size: 19, fill: colors.ink, weight: 600 }));
    anchors.push({ xPct: ((labelW + bw) / width) * 100, yPct: ((cy - barH / 2) / height) * 100 });
  });
  return { prims, anchors };
}

// ---- ウォーターフォール ----
function buildWaterfall({ labels, values, unit, width, height, totalLabel = '合計' }, colors) {
  const T = textPrimitive(colors);
  const deltas = values;
  const cum = [];
  deltas.reduce((acc, v, i) => (cum[i] = acc + v), 0);
  const total = cum[deltas.length - 1];
  const m = deltas.length + 1; // 合計列を足す
  const plotW = width - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;
  const yMax = niceMax(Math.max(...cum, 0));
  const yOf = (v) => PAD.t + plotH * (1 - Math.max(v, 0) / yMax);
  const bandW = plotW / m;
  const barW = bandW * 0.54;
  const prims = [];
  const anchors = [];
  vGrid(prims, width, yMax, unit, yOf, colors);
  const xOf = (i) => PAD.l + bandW * i + (bandW - barW) / 2;
  deltas.forEach((v, i) => {
    const lo = i === 0 ? 0 : Math.min(cum[i - 1], cum[i]);
    const hi = i === 0 ? cum[0] : Math.max(cum[i - 1], cum[i]);
    const x = xOf(i);
    const color = i === 0 ? colors.ink : v >= 0 ? colors.accent : colors.gray;
    prims.push(R(x, yOf(hi), barW, Math.max(yOf(lo) - yOf(hi), 2), color, 3));
    const labelText = i === 0 ? fmt(v) : `${v >= 0 ? '+' : '-'}${fmt(Math.abs(v))}`;
    prims.push(T(x + barW / 2, yOf(hi) - 12, labelText, { size: 18, fill: colors.ink, weight: 600, anchor: 'middle' }));
    anchors.push({ xPct: ((x + barW / 2) / width) * 100, yPct: (yOf(hi) / height) * 100 });
    // 次の棒へ点線コネクタ（最後の増減は合計列へ）
    const nextX = xOf(i + 1);
    prims.push(L(x + barW, yOf(cum[i]), nextX, yOf(cum[i]), colors.gray, 1.5, '5 5'));
  });
  const tx = xOf(deltas.length);
  prims.push(R(tx, yOf(total), barW, Math.max(yOf(0) - yOf(total), 2), colors.ink, 3));
  prims.push(T(tx + barW / 2, yOf(total) - 12, fmt(total), { size: 19, fill: colors.ink, weight: 700, anchor: 'middle' }));
  anchors.push({ xPct: ((tx + barW / 2) / width) * 100, yPct: (yOf(total) / height) * 100 });
  [...labels, totalLabel].forEach((label, i) => {
    prims.push(T(PAD.l + bandW * (i + 0.5), height - PAD.b + 30, label, { size: axisLabelSize(label, bandW), anchor: 'middle' }));
  });
  return { prims, anchors };
}

// ---- spec → プリミティブ（PPTX レンダラもここを使う） ----
function buildChart(spec, colors = loadTemplate('default').colors) {
  const type = spec.type || 'bar';
  const n = Math.min((spec.labels || []).length, (spec.values || []).length) || 1;
  const norm = {
    labels: (spec.labels || []).slice(0, n),
    values: (spec.values || []).slice(0, n).map(Number),
    unit: spec.unit || '',
    width: spec.width || 1080,
    height: spec.height || 460,
    highlight: Number.isInteger(spec.highlight) && spec.highlight >= 0 && spec.highlight < n ? spec.highlight : null,
    delta:
      spec.delta && Number.isInteger(spec.delta.from) && Number.isInteger(spec.delta.to) &&
      spec.delta.from >= 0 && spec.delta.from < n && spec.delta.to >= 0 && spec.delta.to < n
        ? spec.delta
        : null,
  };
  const build = { bar: buildBar, line: buildLine, hbar: buildHbar, waterfall: buildWaterfall }[type] || buildBar;
  const { prims, anchors } = build(norm, colors);
  return { prims, anchors, width: norm.width, height: norm.height };
}

// ---- SVG 直列化 ----
function toSvg({ prims, width, height }) {
  const parts = prims.map((p) => {
    switch (p.kind) {
      case 'rect':
        return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="${p.fill}"/>`;
      case 'line':
        return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke}" stroke-width="${p.width}"${p.dash ? ` stroke-dasharray="${p.dash}"` : ''}/>`;
      case 'text':
        return `<text x="${p.x}" y="${p.y}" text-anchor="${p.anchor}" font-size="${p.size}"${p.weight ? ` font-weight="${p.weight}"` : ''} fill="${p.fill}">${escXml(p.text)}</text>`;
      case 'polyline':
        return `<polyline points="${p.points.map((q) => q.join(',')).join(' ')}" fill="none" stroke="${p.stroke}" stroke-width="${p.width}" stroke-linejoin="round" stroke-linecap="round"/>`;
      case 'circle':
        return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth}"` : ''}/>`;
      case 'path':
        return `<path d="${p.d}" fill="${p.fill}"/>`;
      case 'tridown': // 下向き三角（差分矢印の矢頭）。PPTX では triangle + flipV に対応する
        return `<path d="M${p.x} ${p.y} L${p.x + p.w} ${p.y} L${p.x + p.w / 2} ${p.y + p.h} Z" fill="${p.fill}"/>`;
      default:
        return '';
    }
  });
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${parts.join('')}</svg>`;
}

function renderChart(spec, colors = loadTemplate('default').colors) {
  const geom = buildChart(spec, colors);
  return { svg: toSvg(geom), anchors: geom.anchors, geom };
}

function escXml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { renderChart, buildChart };
