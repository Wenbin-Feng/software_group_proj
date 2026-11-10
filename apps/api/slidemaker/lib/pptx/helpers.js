'use strict';

const fs = require('fs');
const path = require('path');
const { textW, estLines } = require('../geometry');
const { createStandardChrome } = require('./chrome');

async function resolveImage(src) {
  if (!src || src === '-') return null;
  if (src.startsWith('data:')) return { data: src.replace(/^data:/, '') };
  if (/^https?:\/\//.test(src)) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const mime = (res.headers.get('content-type') || 'image/png').split(';')[0];
      const buf = Buffer.from(await res.arrayBuffer());
      return { data: `${mime};base64,${buf.toString('base64')}` };
    } catch (e) {
      console.error(`画像を取得できませんでした（プレースホルダにします）: ${src} (${e.message})`);
      return null;
    }
  }
  const abs = path.resolve(src);
  if (fs.existsSync(abs)) return { path: abs };
  console.error(`画像ファイルが見つかりません（プレースホルダにします）: ${src}`);
  return null;
}

// スライド内の画像系フィールドを集めて先に解決しておく（エミッタは同期のまま）
async function resolveSlideImages(f) {
  const img = {};
  const srcs = [];
  if (f.imageSrc) srcs.push(f.imageSrc);
  for (const k of ['asIsImage', 'toBeImage', 'logo']) if (f[k]) srcs.push(f[k]);
  if (Array.isArray(f.images)) srcs.push(...f.images.filter(Boolean));
  for (const s of srcs) {
    if (!(s in img)) img[s] = await resolveImage(s);
  }
  return img;
}


// Capture this render's palette, keeping asynchronous renders independent.
function createHelpers({ colors: COLORS }) {
  function placeholderBox(d, { x, y, w, h, lines, color }) {
    const c = color || COLORS.gray;
    d.rect({ x, y, w, h, fill: COLORS.paper, line: c, lineW: 2, dash: 'dash', radius: 8 });
    d.text(lines.join('\n'), { x: x + 10, y: y + h / 2 - 34, w: w - 20, h: 68, size: 16, color: c, align: 'center', valign: 'middle', lh: 1.6 });
  }

  function dotList(d, items, { x, y, w, fontPx, lineH, gap, indent, dotSize, dotTop, dotColor, square, textColor }) {
    for (const it of items) {
      const h = Math.round(estLines(it, fontPx, w - indent) * fontPx * lineH);
      if (square) d.rect({ x, y: y + dotTop, w: dotSize, h: dotSize, fill: dotColor });
      else d.circle({ x, y: y + dotTop, size: dotSize, fill: dotColor });
      d.text(it, { x: x + indent, y, w: w - indent, h, size: fontPx, lh: lineH, color: textColor || COLORS.ink });
      y += h + gap;
    }
    return y;
  }

  function emitChartGeom(d, geom, ox, oy) {
    for (const p of geom.prims) {
      switch (p.kind) {
        case 'rect':
          d.rect({ x: ox + p.x, y: oy + p.y, w: p.w, h: p.h, fill: p.fill, radius: p.rx || 0 });
          break;
        case 'line':
          d.seg(ox + p.x1, oy + p.y1, ox + p.x2, oy + p.y2, { color: p.stroke, width: p.width, dash: p.dash ? 'dash' : 'solid' });
          break;
        case 'polyline':
          for (let i = 1; i < p.points.length; i++) {
            d.seg(ox + p.points[i - 1][0], oy + p.points[i - 1][1], ox + p.points[i][0], oy + p.points[i][1], { color: p.stroke, width: p.width });
          }
          break;
        case 'circle':
          d.circle({ x: ox + p.cx - p.r, y: oy + p.cy - p.r, size: p.r * 2, fill: p.fill, line: p.stroke, lineW: p.strokeWidth });
          break;
        case 'tridown':
          d.triDown({ x: ox + p.x, y: oy + p.y, w: p.w, h: p.h, fill: p.fill });
          break;
        case 'text': {
          // SVG の text は (x, y)=ベースライン基準。テキストボックスに近似変換する
          const bw = Math.max(textW(p.text, p.size) + 16, 40);
          const bx = p.anchor === 'middle' ? p.x - bw / 2 : p.anchor === 'end' ? p.x - bw : p.x;
          d.text(p.text, {
            x: ox + bx, y: oy + p.y - p.size * 1.05, w: bw, h: p.size * 1.5,
            size: p.size, color: p.fill, bold: p.weight >= 600,
            align: p.anchor === 'middle' ? 'center' : p.anchor === 'end' ? 'right' : 'left',
            valign: 'middle', lh: 1,
          });
          break;
        }
      }
    }
  }

  function changeBadgeStyle(label) {
    const s = String(label || '');
    if (/廃止|終了|削除|停止|deprecat|remov|sunset/i.test(s)) return { fill: COLORS.ink, color: COLORS.paper };
    if (/新機能|新規|追加|new|リリース/i.test(s)) return { fill: COLORS.accent, color: COLORS.paper };
    if (/改善|改良|向上|強化|更新|improve|enhance/i.test(s)) return { fill: COLORS.secondary, color: COLORS.paper };
    return { fill: COLORS.accentLight, color: COLORS.accent, line: COLORS.accent };
  }
  return { placeholderBox, dotList, emitChartGeom, changeBadgeStyle, standardChrome: createStandardChrome({ colors: COLORS }) };
}

module.exports = { resolveImage, resolveSlideImages, createHelpers };
