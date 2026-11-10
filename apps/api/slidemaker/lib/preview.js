'use strict';

// Folio addition: an HTML preview that draws exactly what the PPTX contains.
// The style's emitters run unchanged against a recorder with PptxGenJS's slide
// API, and each recorded call becomes an absolutely positioned element at the
// same coordinates, so colours, fonts and decoration match the download.

const { drawDeck } = require('./pptx/core');

const PX = 96; // inches → CSS px
const px = (inches) => +(Number(inches || 0) * PX).toFixed(2);
const fontPx = (pt) => +(Number(pt || 12) / 0.75).toFixed(2);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const colour = (hex, transparency) => {
  if (!hex) return 'transparent';
  const value = String(hex).replace('#', '');
  if (transparency == null) return `#${value}`;
  const n = parseInt(value, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${+(1 - transparency / 100).toFixed(3)})`;
};
const SERIF = /georgia|times|serif|song|mincho|ming/i;
const family = (face) =>
  `${face ? `'${String(face).replace(/'/g, '')}', ` : ''}${
    SERIF.test(face || '')
      ? "Georgia, 'Songti SC', 'Noto Serif SC', 'Noto Serif CJK SC', 'Hiragino Mincho ProN', serif"
      : "Arial, 'Helvetica Neue', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans', 'Microsoft YaHei', sans-serif"
  }`;
const box = (o) =>
  `left:${px(o.x)}px;top:${px(o.y)}px;width:${px(o.w)}px;height:${px(o.h)}px;`;
const VALIGN = { top: 'flex-start', middle: 'center', mid: 'center', ctr: 'center', bottom: 'flex-end', bot: 'flex-end' };
const DASH = { dash: '8 5', sysDash: '6 3', sysDot: '2 3', dot: '2 3', lgDash: '12 6', dashDot: '8 4 2 4' };

function recorder() {
  const slides = [];
  return {
    slides,
    defineLayout() {},
    addSlide() {
      const ops = [];
      const slide = {
        ops,
        background: null,
        notes: '',
        addText: (text, options) => ops.push({ kind: 'text', text, options: options || {} }),
        addShape: (shape, options) => ops.push({ kind: 'shape', shape, options: options || {} }),
        addTable: (rows, options) => ops.push({ kind: 'table', rows, options: options || {} }),
        addImage: (options) => ops.push({ kind: 'image', options: options || {} }),
        addChart: (type, data, options) => ops.push({ kind: 'chart', type, data, options: options || {} }),
        addNotes: (notes) => { slide.notes = notes; },
      };
      slides.push(slide);
      return slide;
    },
  };
}

function textHtml(text, o, fontFace) {
  const runs = Array.isArray(text) ? text : [{ text, options: {} }];
  const base = {
    size: fontPx(o.fontSize),
    color: colour(o.color, o.transparency),
    bold: !!o.bold,
  };
  const spans = runs
    .map((run) => {
      const r = run.options || {};
      const style = [
        r.fontSize ? `font-size:${fontPx(r.fontSize)}px` : '',
        r.color ? `color:${colour(r.color)}` : '',
        r.bold != null ? `font-weight:${r.bold ? 700 : 400}` : '',
      ].filter(Boolean).join(';');
      return style ? `<span style="${style}">${esc(run.text)}</span>` : esc(run.text);
    })
    .join('');
  const style = [
    box(o),
    `font-family:${family(o.fontFace || fontFace)}`,
    `font-size:${base.size}px`,
    `color:${base.color}`,
    `font-weight:${base.bold ? 700 : 400}`,
    `text-align:${o.align || 'left'}`,
    `justify-content:${VALIGN[o.valign] || 'flex-start'}`,
    `line-height:${o.lineSpacingMultiple || 1.2}`,
    o.charSpacing ? `letter-spacing:${+(o.charSpacing / 0.75).toFixed(2)}px` : '',
  ].filter(Boolean).join(';');
  return `<div class="t" style="${style}"><div>${spans}</div></div>`;
}

function shapeHtml(shape, o) {
  const fill = o.fill ? colour(o.fill.color, o.fill.transparency) : 'transparent';
  const line = o.line && o.line.color ? o.line : null;
  const stroke = line ? colour(line.color, line.transparency) : 'none';
  const strokeW = line ? +((line.width || 1) / 0.75).toFixed(2) : 0;
  const rotate = o.rotate ? `transform:rotate(${o.rotate}deg);` : '';
  if (shape === 'rect' || shape === 'roundRect' || shape === 'ellipse') {
    const radius = shape === 'ellipse' ? '50%' : shape === 'roundRect' ? `${px(o.rectRadius)}px` : '0';
    const border = line ? `border:${strokeW}px ${line.dashType && line.dashType !== 'solid' ? 'dashed' : 'solid'} ${stroke};` : '';
    return `<div class="s" style="${box(o)}background:${fill};border-radius:${radius};${border}${rotate}"></div>`;
  }
  const w = px(o.w), h = px(o.h);
  const flip = `${o.flipH ? 'scaleX(-1) ' : ''}${o.flipV ? 'scaleY(-1)' : ''}`.trim();
  const transform = [flip, o.rotate ? `rotate(${o.rotate}deg)` : ''].filter(Boolean).join(' ');
  const wrap = (inner) =>
    `<svg class="s" style="${box(o)}overflow:visible;${transform ? `transform:${transform};` : ''}" viewBox="0 0 ${w || 1} ${h || 1}" preserveAspectRatio="none">${inner}</svg>`;
  if (shape === 'line') {
    const dash = DASH[line && line.dashType] ? ` stroke-dasharray="${DASH[line.dashType]}"` : '';
    const marker = line && line.endArrowType
      ? `<defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${stroke}"/></marker></defs>`
      : '';
    return wrap(`${marker}<line x1="0" y1="0" x2="${w}" y2="${h}" stroke="${stroke}" stroke-width="${strokeW}"${dash}${marker ? ' marker-end="url(#a)"' : ''}/>`);
  }
  const points = {
    triangle: `${w / 2},0 ${w},${h} 0,${h}`,
    rightArrow: `0,${h * 0.25} ${w * 0.6},${h * 0.25} ${w * 0.6},0 ${w},${h / 2} ${w * 0.6},${h} ${w * 0.6},${h * 0.75} 0,${h * 0.75}`,
    chevron: `0,0 ${w * 0.6},0 ${w},${h / 2} ${w * 0.6},${h} 0,${h} ${w * 0.4},${h / 2}`,
    homePlate: `0,0 ${w * 0.8},0 ${w},${h / 2} ${w * 0.8},${h} 0,${h}`,
    trapezoid: `${w * 0.2},0 ${w * 0.8},0 ${w},${h} 0,${h}`,
    diamond: `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`,
  }[shape] || `0,0 ${w},0 ${w},${h} 0,${h}`;
  return wrap(`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`);
}

function tableHtml(rows, o, fontFace) {
  const margin = Array.isArray(o.margin) ? o.margin : [0.05, 0.1, 0.05, 0.1];
  const pad = margin.map((m) => `${px(m)}px`).join(' ');
  const border = o.border ? `${+((o.border.pt || 1) / 0.75).toFixed(2)}px solid ${colour(o.border.color)}` : 'none';
  const cols = (o.colW || []).map((w) => `<col style="width:${px(w)}px">`).join('');
  const body = rows
    .map((row, r) => {
      const height = o.rowH && o.rowH[r] != null ? `height:${px(o.rowH[r])}px;` : '';
      const cells = row
        .map((cell) => {
          const c = (cell && cell.options) || {};
          const style = [
            `padding:${pad}`,
            `border:${border}`,
            c.fill ? `background:${colour(c.fill.color)}` : '',
            c.color ? `color:${colour(c.color)}` : '',
            `font-size:${fontPx(c.fontSize || o.fontSize || 12)}px`,
            `font-weight:${c.bold ? 700 : 400}`,
            `text-align:${c.align || 'left'}`,
            `vertical-align:${{ middle: 'middle', bottom: 'bottom' }[c.valign || o.valign] || 'top'}`,
          ].filter(Boolean).join(';');
          return `<td style="${style}">${esc(cell && typeof cell === 'object' ? cell.text : cell)}</td>`;
        })
        .join('');
      return `<tr style="${height}">${cells}</tr>`;
    })
    .join('');
  return `<table class="tb" style="left:${px(o.x)}px;top:${px(o.y)}px;width:${px(o.w)}px;font-family:${family(o.fontFace || fontFace)}"><colgroup>${cols}</colgroup>${body}</table>`;
}

const fmt = (n) => (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-US') : String(+Number(n).toFixed(2)));

function chartHtml(type, data, o, fontFace) {
  const W = px(o.w), H = px(o.h);
  const palette = (o.chartColors || ['2571FF', '00AADF', 'F2A93B', '0F1B33']).map((c) => colour(c));
  const labelColour = colour(o.catAxisLabelColor || '6B7280');
  const font = `font-family:${family(fontFace)}`;
  const svg = (inner) =>
    `<svg class="c" style="${box(o)}${font}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;
  if (type === 'doughnut') {
    const series = data[0] || { values: [] };
    const total = series.values.reduce((a, v) => a + (Number(v) || 0), 0) || 1;
    const r = Math.min(W, H) / 2, cx = W / 2, cy = H / 2;
    const width = r * (1 - (o.holeSize || 50) / 100);
    const radius = r - width / 2, circ = 2 * Math.PI * radius;
    let offset = 0;
    const rings = series.values
      .map((v, i) => {
        const len = ((Number(v) || 0) / total) * circ;
        const ring = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${palette[i % palette.length]}" stroke-width="${width}" stroke-dasharray="${Math.max(0, len - 2)} ${circ}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
        offset += len;
        return ring;
      })
      .join('');
    return svg(rings);
  }
  const labels = (data[0] && data[0].labels) || [];
  const legendH = o.showLegend && data.length > 1 ? 28 : 0;
  const left = 46, bottom = 30, top = 10 + legendH, right = 12;
  const plotW = Math.max(1, W - left - right), plotH = Math.max(1, H - top - bottom);
  const stacked = o.barGrouping === 'stacked';
  const horizontal = type === 'bar' && o.barDir === 'bar';
  const totals = labels.map((_, i) =>
    stacked ? data.reduce((a, s) => a + Math.max(0, Number(s.values[i]) || 0), 0) : Math.max(...data.map((s) => Number(s.values[i]) || 0)),
  );
  // Round axis steps (1, 2, 2.5 or 5 × 10^n), as PowerPoint picks them.
  const peak = Math.max(1e-9, ...totals);
  const raw = peak / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= raw);
  const ticks = Math.ceil(peak / step);
  const max = step * ticks;
  const grid = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = (max / ticks) * i;
    if (horizontal) {
      const x = left + (plotW * i) / ticks;
      return `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + plotH}" stroke="${colour((o.valGridLine && o.valGridLine.color) || 'E5E7EB')}"/><text x="${x}" y="${H - 8}" font-size="11" fill="${labelColour}" text-anchor="middle">${fmt(value)}</text>`;
    }
    const y = top + plotH - (plotH * i) / ticks;
    return `<line x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}" stroke="${colour((o.valGridLine && o.valGridLine.color) || 'E5E7EB')}"/><text x="${left - 8}" y="${y + 4}" font-size="11" fill="${labelColour}" text-anchor="end">${fmt(value)}</text>`;
  }).join('');
  const band = (horizontal ? plotH : plotW) / Math.max(1, labels.length);
  const cats = labels
    .map((label, i) =>
      horizontal
        ? `<text x="${left - 8}" y="${top + band * i + band / 2 + 4}" font-size="12" fill="${labelColour}" text-anchor="end">${esc(label)}</text>`
        : `<text x="${left + band * i + band / 2}" y="${top + plotH + 18}" font-size="12" fill="${labelColour}" text-anchor="middle">${esc(label)}</text>`,
    )
    .join('');
  let marks = '';
  if (type === 'bar') {
    const groups = stacked ? 1 : data.length;
    const inner = band * (1 - Math.min(0.8, (o.barGapWidthPct || 60) / 200));
    const bar = inner / groups;
    labels.forEach((_, i) => {
      let stack = 0;
      data.forEach((s, k) => {
        const v = Math.max(0, Number(s.values[i]) || 0);
        const size = (v / max) * (horizontal ? plotW : plotH);
        const offset = band * i + (band - inner) / 2 + (stacked ? 0 : bar * k);
        const fill = palette[(data.length > 1 ? k : i) % palette.length];
        const rect = horizontal
          ? `<rect x="${left + stack}" y="${top + offset}" width="${size}" height="${bar}" fill="${fill}"/>`
          : `<rect x="${left + offset}" y="${top + plotH - stack - size}" width="${bar}" height="${size}" fill="${fill}"/>`;
        const value = o.showValue && stacked && size > 14
          ? horizontal
            ? `<text x="${left + stack + size / 2}" y="${top + offset + bar / 2 + 4}" font-size="11" fill="${colour(o.dataLabelColor || 'FFFFFF')}" text-anchor="middle">${fmt(v)}</text>`
            : `<text x="${left + offset + bar / 2}" y="${top + plotH - stack - size / 2 + 4}" font-size="11" fill="${colour(o.dataLabelColor || 'FFFFFF')}" text-anchor="middle">${fmt(v)}</text>`
          : o.showValue && !stacked
          ? horizontal
            ? `<text x="${left + stack + size + 4}" y="${top + offset + bar / 2 + 4}" font-size="11" fill="${colour(o.dataLabelColor || '1F2933')}">${fmt(v)}</text>`
            : `<text x="${left + offset + bar / 2}" y="${top + plotH - stack - size - 5}" font-size="11" fill="${colour(o.dataLabelColor || '1F2933')}" text-anchor="middle">${fmt(v)}</text>`
          : '';
        marks += rect + value;
        if (stacked) stack += size;
      });
    });
  } else {
    data.forEach((s, k) => {
      const pts = labels.map((_, i) => [left + band * i + band / 2, top + plotH - ((Number(s.values[i]) || 0) / max) * plotH]);
      const fill = palette[k % palette.length];
      const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');
      if (type === 'area')
        marks += `<path d="${path}L${pts.at(-1)[0]},${top + plotH}L${pts[0][0]},${top + plotH}Z" fill="${fill}" fill-opacity="${1 - (o.chartColorsOpacity || 55) / 100 || 0.45}"/>`;
      marks += `<path d="${path}" fill="none" stroke="${fill}" stroke-width="${type === 'line' ? (o.lineSize || 2) : 2}"/>`;
      if (type === 'line')
        marks += pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${(o.lineDataSymbolSize || 6) / 2}" fill="${fill}"/>`).join('');
    });
  }
  const legend = legendH
    ? data
        .map((s, k) => `<rect x="${left + k * 140}" y="6" width="12" height="12" fill="${palette[k % palette.length]}"/><text x="${left + k * 140 + 18}" y="16" font-size="13" fill="${colour(o.legendColor || '1F2933')}">${esc(s.name)}</text>`)
        .join('')
    : '';
  const axis = `<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="${colour(o.catAxisLineColor || 'D1D5DB')}"/>`;
  return svg(grid + axis + marks + cats + legend);
}

function imageHtml(o) {
  const src = o.data ? (String(o.data).startsWith('data:') ? o.data : `data:${o.data}`) : '';
  if (!src) return '';
  const fit = o.sizing && o.sizing.type === 'contain' ? 'contain' : 'cover';
  return `<img class="s" style="${box(o)}object-fit:${fit};${o.rounding ? 'border-radius:50%;' : ''}" src="${esc(src)}" alt="">`;
}

async function renderDeckPreview(deck, opts = {}) {
  const pptx = recorder();
  const { font, W, H } = await drawDeck(pptx, deck, opts);
  const slides = pptx.slides
    .map((slide, index) => {
      const bg = slide.background && slide.background.color ? colour(slide.background.color) : '#fff';
      const content = slide.ops
        .map((op) =>
          op.kind === 'text'
            ? textHtml(op.text, op.options, font)
            : op.kind === 'shape'
              ? shapeHtml(op.shape, op.options)
              : op.kind === 'table'
                ? tableHtml(op.rows, op.options, font)
                : op.kind === 'chart'
                  ? chartHtml(op.type, op.data, op.options, font)
                  : imageHtml(op.options),
        )
        .join('');
      return `<section class="slide" id="slide-${index + 1}" style="background:${bg}">${content}</section>`;
    })
    .join('\n');
  const lang = deck.lang === 'zh' ? 'zh-Hans' : deck.lang || 'en';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${W + 56}">
<meta name="generator" content="slidemaker">
<meta name="slidemaker-preview" content="pptx">
<title>${esc(deck.title || 'Slides')}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #dde2e8; display: flex; flex-direction: column; align-items: center; gap: 28px; padding: 28px 0; }
.slide { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; box-shadow: 0 2px 10px rgba(31,41,51,.18); }
.t, .s, .c, .tb { position: absolute; }
.t { display: flex; flex-direction: column; white-space: pre-wrap; overflow-wrap: break-word; }
.tb { border-collapse: collapse; table-layout: fixed; }
.tb td { overflow-wrap: break-word; line-height: 1.3; }
</style>
</head>
<body>
${slides}
</body>
</html>`;
}

module.exports = { renderDeckPreview };
