'use strict';

const { PAD, textW, estLines } = require('../geometry');

// Standard title rule and page counter, reusable by any template.
function createStandardChrome({ colors: COLORS }) {
  function header(d, ctx, title, lead, chip) {
    const cw = ctx.cw;
    const tH = Math.round(estLines(title, 33, cw) * 33 * 1.3);
    d.text(title, { x: PAD.left, y: PAD.top, w: cw, h: tH, size: 33, bold: true, lh: 1.3 });
    if (chip) {
      const chipW = textW(chip, 17) + 32;
      const chipX = Math.min(PAD.left + textW(title, 33) + 16, PAD.left + cw - chipW);
      d.rect({ x: chipX, y: PAD.top + 5, w: chipW, h: 31, fill: COLORS.accentLight, radius: 15 });
      d.text(chip, { x: chipX, y: PAD.top + 5, w: chipW, h: 31, size: 17, bold: true, color: COLORS.accent, align: 'center', valign: 'middle', lh: 1 });
    }
    let y = PAD.top + tH;
    if (lead) {
      const lH = Math.round(estLines(lead, 21, cw) * 21 * 1.5);
      d.text(lead, { x: PAD.left, y: y + 12, w: cw, h: lH, size: 21, color: COLORS.gray, lh: 1.5 });
      y += 12 + lH;
    }
    y += 18;
    d.rect({ x: PAD.left, y, w: cw, h: 3, fill: COLORS.grayLight });
    d.rect({ x: PAD.left, y, w: 96, h: 3, fill: COLORS.accent });
    return y + 3 + 34;
  }

  function footer(d, ctx, index) {
    const y = ctx.H - 22 - 20;
    d.text(ctx.deckTitle, { x: PAD.left, y, w: ctx.cw - 120, h: 20, size: 15, color: COLORS.gray, lh: 1.2 });
    d.text(`${index + 1} / ${ctx.total}`, { x: ctx.W - PAD.right - 120, y, w: 120, h: 20, size: 15, color: COLORS.gray, align: 'right', lh: 1.2 });
  }
  return { header, footer };
}

module.exports = { createStandardChrome };
