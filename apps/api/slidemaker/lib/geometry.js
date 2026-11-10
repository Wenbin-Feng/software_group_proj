'use strict';

// Shared canvas geometry; all coordinates are CSS pixels at 96 dpi.
const SLIDE_HEIGHT = 720;
const ASPECTS = {
  '16:9': { width: 1280, height: SLIDE_HEIGHT },
  '4:3': { width: 960, height: SLIDE_HEIGHT },
};
const PAD = { top: 52, right: 64, bottom: 60, left: 64 };
const IN = (px) => +(px / 96).toFixed(4); // px → インチ
const PT = (px) => +(px * 0.75).toFixed(2); // フォント px → ポイント

// Width estimate: full-width = 1em, half-width = 0.55em (same unit as lib/limits.js).
function units(s) {
  let u = 0;
  for (const ch of String(s ?? '')) u += ch.charCodeAt(0) <= 0xff || /[｡-ﾟ]/.test(ch) ? 0.55 : 1;
  return u;
}
// Box width for single-line labels/chips, with a little room for font substitution.
const textW = (s, fontPx) => Math.ceil(units(s) * fontPx * 1.04 + fontPx * 0.2);
// Greedy line-break simulation: CJK characters break anywhere, Latin text breaks at
// spaces (a word longer than the line is split). Narrow boxes such as "01" badges
// count as one line.
function estLines(s, fontPx, boxWPx) {
  const text = String(s ?? '');
  const cjkOnly = !/[\x00-\xff]/.test(text);
  if (cjkOnly) return Math.max(1, Math.ceil(units(text) / Math.max(1, Math.floor(boxWPx / fontPx))));
  // 5% margin: bold Latin glyphs run wider than the regular-weight average.
  const maxU = Math.max(1, (boxWPx / fontPx) * 0.95);
  const tokens = text.match(/[\x00-\xff][^\s\u0080-\uffff]*|[^\x00-\xff]/g) || [];
  let lines = 1;
  let line = 0;
  for (const raw of tokens) {
    const space = /^\s/.test(raw);
    const word = space ? raw.slice(1) : raw;
    const lead = space && line > 0 ? 0.28 : 0;
    let w = units(word);
    if (line + lead + w <= maxU + 0.01) { line += lead + w; continue; }
    if (line > 0) { lines++; line = 0; }
    while (w > maxU) { lines++; w -= maxU; }
    line = w;
  }
  return Math.max(1, lines);
}


module.exports = { SLIDE_HEIGHT, ASPECTS, PAD, IN, PT, units, textW, estLines };
