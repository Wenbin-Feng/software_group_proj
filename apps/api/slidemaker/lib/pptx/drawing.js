'use strict';

const { IN, PT, estLines } = require('../geometry');

const hex = (c) => String(c).replace('#', '').toUpperCase();
const fillOf = (color, alpha) => (color ? { color: hex(color), ...(alpha != null ? { transparency: Math.round((1 - alpha) * 100) } : {}) } : undefined);
const lineOf = (o) => (o.line ? { color: hex(o.line), width: PT(o.lineW || 2), dashType: o.dash || 'solid', ...(o.lineAlpha != null ? { transparency: Math.round((1 - o.lineAlpha) * 100) } : {}) } : undefined);

// Estimated rendered height of a text box (CJK glyph = 1em; Latin ~0.55em).
function neededHeight(str, o) {
  const lines = String(str).split('\n').reduce((n, line) => n + estLines(line, o.size, o.w), 0);
  return lines * o.size * (o.lh || 1.3);
}

// onOverflow (optional) reports text that needs more height than its box, or that
// would run below `bottom` (the footer zone on body slides).
function createDrawing(slide, { colors: COLORS, font: FONT, onOverflow, bottom = Infinity }) {
  return {
    text(str, o) {
      if (onOverflow && String(str).trim() && !o.decor) {
        const need = neededHeight(str, o);
        const slack = Math.max(4, o.size * 0.25);
        if (need > o.h + slack) onOverflow({ kind: 'box', text: String(str), need: Math.round(need), h: Math.round(o.h), size: o.size, w: Math.round(o.w) });
        else if (o.y + Math.min(need, o.h) > bottom + slack) onOverflow({ kind: 'bottom', text: String(str), y: Math.round(o.y + Math.min(need, o.h)), bottom });
      }
      slide.addText(String(str), {
        x: IN(o.x), y: IN(o.y), w: IN(o.w), h: IN(o.h),
        fontSize: PT(o.size), fontFace: o.font || FONT, color: hex(o.color || COLORS.ink),
        bold: !!o.bold, align: o.align || 'left', valign: o.valign || 'top',
        lineSpacingMultiple: o.lh || 1.3, margin: 0,
        ...(o.alpha != null ? { transparency: Math.round((1 - o.alpha) * 100) } : {}),
        ...(o.charSpacing ? { charSpacing: o.charSpacing } : {}),
      });
    },
    rich(runs, o) {
      slide.addText(
        runs.map((r) => ({ text: r.text, options: { fontSize: PT(r.size), bold: r.bold !== false, color: hex(r.color || o.color || COLORS.ink) } })),
        {
          x: IN(o.x), y: IN(o.y), w: IN(o.w), h: IN(o.h), fontFace: FONT,
          align: o.align || 'left', valign: o.valign || 'top', lineSpacingMultiple: o.lh || 1.2, margin: 0,
        }
      );
    },
    rect(o) {
      slide.addShape(o.radius ? 'roundRect' : 'rect', {
        x: IN(o.x), y: IN(o.y), w: IN(o.w), h: IN(o.h),
        fill: fillOf(o.fill, o.alpha),
        line: lineOf(o),
        rectRadius: o.radius ? IN(Math.min(o.radius, o.w / 2, o.h / 2)) : undefined,
        ...(o.rotate ? { rotate: o.rotate } : {}),
      });
    },
    circle(o) {
      slide.addShape('ellipse', {
        x: IN(o.x), y: IN(o.y), w: IN(o.size), h: IN(o.size),
        fill: fillOf(o.fill, o.alpha),
        line: lineOf(o),
      });
    },
    // Generic preset shape (chevron, homePlate, trapezoid, ...).
    shape(type, o) {
      slide.addShape(type, {
        x: IN(o.x), y: IN(o.y), w: IN(o.w), h: IN(o.h),
        fill: fillOf(o.fill, o.alpha), line: lineOf(o),
        ...(o.flipV ? { flipV: true } : {}), ...(o.flipH ? { flipH: true } : {}),
        ...(o.rotate ? { rotate: o.rotate } : {}),
      });
    },
    seg(x1, y1, x2, y2, o) {
      slide.addShape('line', {
        x: IN(Math.min(x1, x2)), y: IN(Math.min(y1, y2)),
        w: IN(Math.abs(x2 - x1)), h: IN(Math.abs(y2 - y1)),
        flipV: (x2 - x1) * (y2 - y1) < 0,
        line: {
          color: hex(o.color), width: PT(o.width || 1), dashType: o.dash || 'solid',
          ...(o.alpha != null ? { transparency: Math.round((1 - o.alpha) * 100) } : {}),
          ...(o.endArrow ? { endArrowType: 'triangle' } : {}),
        },
      });
    },
    arrowRight(o) {
      slide.addShape('rightArrow', {
        x: IN(o.x), y: IN(o.y), w: IN(o.w), h: IN(o.h),
        fill: { color: hex(o.fill || COLORS.accent) },
      });
    },
    triDown(o) {
      slide.addShape('triangle', {
        x: IN(o.x), y: IN(o.y), w: IN(o.w), h: IN(o.h), flipV: true,
        fill: { color: hex(o.fill || COLORS.accent) },
      });
    },
    triUp(o) {
      slide.addShape('triangle', {
        x: IN(o.x), y: IN(o.y), w: IN(o.w), h: IN(o.h),
        fill: { color: hex(o.fill || COLORS.accent) },
      });
    },
    image(o) {
      slide.addImage({
        ...(o.res.data ? { data: o.res.data } : { path: o.res.path }),
        x: IN(o.x), y: IN(o.y), w: IN(o.w), h: IN(o.h),
        sizing: { type: o.fit || 'cover', w: IN(o.w), h: IN(o.h) },
        rounding: !!o.round,
      });
    },
    // Native, editable PowerPoint chart. `type` is a PptxGenJS chart type name.
    chart(type, data, o) {
      const { x, y, w, h, ...options } = o;
      slide.addChart(type, data, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fontFace: FONT, ...options });
    },
  };
}


module.exports = { createDrawing, hex, neededHeight };
