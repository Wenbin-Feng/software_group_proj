'use strict';

// Default style: white body slides with a brand tab, section kicker and page
// footer; navy cover/section/closing canvases with geometric decoration.
function createLayout({ colors: C, geometry }) {
  const { PAD, textW, estLines } = geometry;
  const lineH = (text, size, w, lh) => Math.round(estLines(text, size, w) * size * lh);

  // ---- decoration primitives ----
  function dotGrid(d, x, y, cols, rows, gap, color, alpha, size = 5) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      d.circle({ x: x + c * gap, y: y + r * gap, size, fill: color, alpha });
    }
  }
  function ring(d, cx, cy, r, color, alpha, width = 2) {
    d.circle({ x: cx - r, y: cy - r, size: r * 2, line: color, lineW: width, lineAlpha: alpha });
  }
  function disc(d, cx, cy, r, color, alpha) {
    d.circle({ x: cx - r, y: cy - r, size: r * 2, fill: color, alpha });
  }
  function brandMark(d, x, y, onDark = false) {
    d.rect({ x, y, w: 12, h: 12, fill: C.accent, radius: 3 });
    d.rect({ x: x + 16, y, w: 12, h: 12, fill: C.secondary, radius: 3 });
    d.rect({ x: x + 32, y, w: 12, h: 12, fill: onDark ? C.paper : C.navy, radius: 3, alpha: onDark ? 0.85 : 1 });
  }

  // ---- body slide chrome ----
  function header(d, ctx, title, lead, chip) {
    const cw = ctx.cw;
    if (ctx.section && ctx.section.title) {
      const no = ctx.section.number ? `${String(ctx.section.number).padStart(2, '0')}  ` : '';
      d.text(`${no}${ctx.section.title}`, { x: PAD.left, y: 24, w: cw - 80, h: 18, size: 13, bold: true, color: C.accent, lh: 1, decor: true });
    }
    brandMark(d, ctx.W - PAD.right - 44, 27);
    const tH = lineH(title, 33, cw, 1.3);
    d.rect({ x: 0, y: PAD.top + 6, w: 10, h: Math.min(tH, 43) - 12, fill: C.accent });
    d.text(title, { x: PAD.left, y: PAD.top, w: cw, h: tH, size: 33, bold: true, lh: 1.3 });
    if (chip) {
      const chipW = textW(chip, 16) + 32;
      const chipX = Math.min(PAD.left + textW(title, 33) + 18, PAD.left + cw - chipW);
      d.rect({ x: chipX, y: PAD.top + 6, w: chipW, h: 30, fill: C.accentLight, radius: 15 });
      d.text(chip, { x: chipX, y: PAD.top + 6, w: chipW, h: 30, size: 16, bold: true, color: C.accent, align: 'center', valign: 'middle', lh: 1 });
    }
    let y = PAD.top + tH;
    if (lead) {
      const lH = lineH(lead, 21, cw, 1.5);
      d.text(lead, { x: PAD.left, y: y + 10, w: cw, h: lH, size: 21, color: C.gray, lh: 1.5 });
      y += 10 + lH;
    }
    y += 18;
    d.rect({ x: PAD.left, y: y + 1, w: cw, h: 1, fill: C.grayLight });
    d.rect({ x: PAD.left, y, w: 72, h: 3, fill: C.accent });
    d.rect({ x: PAD.left + 76, y, w: 16, h: 3, fill: C.secondary });
    return y + 3 + 34;
  }

  function footer(d, ctx, index) {
    const y = ctx.H - 36;
    d.rect({ x: PAD.left, y: y - 12, w: ctx.cw, h: 1, fill: C.grayLight });
    d.rect({ x: PAD.left, y: y + 4, w: 8, h: 8, fill: C.accent, radius: 2 });
    d.text(String(ctx.deckTitle || '').replace(/\s+/g, ' '), { x: PAD.left + 18, y, w: ctx.cw - 160, h: 16, size: 13, color: C.gray, lh: 1, decor: true });
    d.rich([
      { text: String(index + 1).padStart(2, '0'), size: 14, color: C.ink },
      { text: `  /  ${String(ctx.total).padStart(2, '0')}`, size: 13, color: C.gray, bold: false },
    ], { x: ctx.W - PAD.right - 120, y: y - 1, w: 120, h: 18, align: 'right', lh: 1 });
  }

  // ---- special pages ----
  function coverArt(d, ctx, mirrored = false) {
    const { W, H } = ctx;
    const panelX = mirrored ? 0 : Math.round(W * 0.66);
    const panelW = mirrored ? Math.round(W * 0.34) : W - panelX;
    d.rect({ x: panelX, y: 0, w: panelW, h: H, fill: C.navy });
    const cx = panelX + panelW * 0.62;
    ring(d, cx, H * 0.30, 190, C.secondary, 0.55, 2);
    ring(d, cx, H * 0.30, 128, C.paper, 0.18, 1.5);
    disc(d, panelX + panelW * 0.30, H * 0.80, 120, C.accent, 0.95);
    disc(d, panelX + panelW * 0.30 + 150, H * 0.80 - 100, 30, C.secondary, 1);
    dotGrid(d, panelX + 36, 44, 6, 4, 22, C.paper, 0.35);
    d.rect({ x: mirrored ? panelX + panelW - 8 : panelX, y: 0, w: 8, h: H, fill: C.secondary });
  }

  return { header, footer, emitters: {
    title(d, f, ctx) {
      const { H } = ctx;
      coverArt(d, ctx);
      const w = Math.round(ctx.W * 0.66) - PAD.left - 56;
      brandMark(d, PAD.left, 64);
      const tH = lineH(f.title, 48, w, 1.28);
      const sH = f.subtitle ? lineH(f.subtitle, 22, w, 1.5) : 0;
      const blockH = 6 + 30 + tH + (f.subtitle ? 22 + sH : 0);
      let y = Math.round((H - blockH) / 2) - 20;
      d.rect({ x: PAD.left, y, w: 64, h: 6, fill: C.accent });
      d.rect({ x: PAD.left + 70, y, w: 18, h: 6, fill: C.secondary });
      y += 6 + 30;
      d.text(f.title, { x: PAD.left, y, w, h: tH, size: 48, bold: true, lh: 1.28 });
      y += tH;
      if (f.subtitle) d.text(f.subtitle, { x: PAD.left, y: y + 22, w, h: sH, size: 22, color: C.gray, lh: 1.5 });
      const meta = [f.presenter, f.date].filter(Boolean);
      if (meta.length) {
        const my = H - 112;
        d.rect({ x: PAD.left, y: my - 22, w, h: 1, fill: C.grayLight });
        let x = PAD.left;
        if (f.presenter) {
          const pw = Math.min(textW(f.presenter, 18) + 8, w);
          d.text(f.presenter, { x, y: my, w: pw, h: 26, size: 18, bold: true, valign: 'middle', lh: 1.2 });
          x += pw + 20;
        }
        if (f.presenter && f.date) { d.rect({ x, y: my + 5, w: 2, h: 16, fill: C.accent }); x += 22; }
        if (f.date) d.text(f.date, { x, y: my, w: PAD.left + w - x, h: 26, size: 16, color: C.gray, valign: 'middle', lh: 1.2 });
      }
    },

    section(d, f, ctx) {
      const { W, H } = ctx;
      d.rect({ x: 0, y: 0, w: W, h: H, fill: C.navy });
      ring(d, W - 120, H + 40, 260, C.secondary, 0.45, 2);
      ring(d, W - 120, H + 40, 190, C.paper, 0.12, 1.5);
      dotGrid(d, W - PAD.right - 5 * 22 - 5, 48, 6, 3, 22, C.paper, 0.3);
      d.rect({ x: 0, y: 0, w: 8, h: H, fill: C.secondary });
      const hasNav = f.chapters.length > 0;
      const navW = hasNav ? (W < 1000 ? 230 : 300) : 0;
      const navX = W - PAD.right - navW;
      const numW = f.number ? textW(f.number, 140) + 12 : 0;
      const titleX = PAD.left + (f.number ? numW + 44 : 0);
      const tw = (hasNav ? navX - 56 : W - PAD.right) - titleX;
      const tH = lineH(f.title, 44, tw, 1.3);
      const sH = f.subtitle ? lineH(f.subtitle, 20, tw, 1.5) : 0;
      const blockH = 22 + 14 + tH + (f.subtitle ? 18 + sH : 0);
      const top = Math.round((H - Math.max(blockH, 150)) / 2);
      if (f.number) {
        d.text(f.number, { x: PAD.left, y: top + (Math.max(blockH, 150) - 150) / 2, w: numW, h: 150, size: 140, bold: true, color: C.secondary, valign: 'middle', lh: 1 });
        d.rect({ x: PAD.left + numW + 20, y: top + 10, w: 2, h: Math.max(blockH, 150) - 20, fill: C.paper, alpha: 0.25 });
      }
      let y = top + Math.round((Math.max(blockH, 150) - blockH) / 2);
      d.text(ctx.t('chapter') + (f.number ? ` ${f.number}` : ''), { x: titleX, y, w: tw, h: 22, size: 14, bold: true, color: C.secondary, lh: 1, charSpacing: 3, decor: true });
      y += 22 + 14;
      d.text(f.title, { x: titleX, y, w: tw, h: tH, size: 44, bold: true, color: C.paper, lh: 1.3 });
      y += tH;
      if (f.subtitle) d.text(f.subtitle, { x: titleX, y: y + 18, w: tw, h: sH, size: 20, color: C.paper, alpha: 0.72, lh: 1.5 });
      if (hasNav) {
        const current = parseInt(f.number, 10) || 0;
        const n = f.chapters.length;
        const itemH = 44;
        const navH = n * itemH;
        let ny = Math.round((H - navH) / 2);
        d.rect({ x: navX, y: ny, w: 2, h: navH, fill: C.paper, alpha: 0.2 });
        f.chapters.forEach((c, i) => {
          const cur = i + 1 === current;
          if (cur) d.rect({ x: navX - 1, y: ny + 8, w: 4, h: itemH - 16, fill: C.secondary });
          d.text(String(i + 1).padStart(2, '0'), { x: navX + 22, y: ny, w: 30, h: itemH, size: 14, bold: true, color: cur ? C.secondary : C.paper, alpha: cur ? 1 : 0.45, valign: 'middle', lh: 1 });
          d.text(c, { x: navX + 60, y: ny, w: navW - 60, h: itemH, size: 18, bold: cur, color: C.paper, alpha: cur ? 1 : 0.55, valign: 'middle', lh: 1.2 });
          ny += itemH;
        });
      }
    },

    closing(d, f, ctx) {
      const { W, H } = ctx;
      d.rect({ x: 0, y: 0, w: W, h: H, fill: C.navy });
      ring(d, W - 200, 170, 240, C.secondary, 0.5, 2);
      ring(d, W - 200, 170, 160, C.paper, 0.14, 1.5);
      disc(d, W - 90, H - 80, 150, C.accent, 0.95);
      disc(d, W - 270, H - 150, 26, C.secondary, 1);
      dotGrid(d, PAD.left, H - 100, 8, 2, 22, C.paper, 0.25);
      d.rect({ x: 0, y: 0, w: 8, h: H, fill: C.secondary });
      const w = Math.min(860, W - PAD.left - 300);
      const mH = lineH(f.message, 44, w, 1.3);
      const sH = f.submessage ? lineH(f.submessage, 20, w, 1.55) : 0;
      const blockH = 20 + 22 + mH + (f.submessage ? 20 + sH : 0) + (f.contact ? 40 + 40 : 0);
      let y = Math.round((H - blockH) / 2) - 10;
      d.text(ctx.t('thanks'), { x: PAD.left, y, w, h: 20, size: 14, bold: true, color: C.secondary, lh: 1, charSpacing: 4, decor: true });
      y += 20 + 22;
      d.text(f.message, { x: PAD.left, y, w, h: mH, size: 44, bold: true, color: C.paper, lh: 1.3 });
      y += mH;
      if (f.submessage) { d.text(f.submessage, { x: PAD.left, y: y + 20, w, h: sH, size: 20, color: C.paper, alpha: 0.75, lh: 1.55 }); y += 20 + sH; }
      if (f.contact) {
        const cw = Math.min(textW(f.contact, 17) + 44, w);
        d.rect({ x: PAD.left, y: y + 40, w: cw, h: 40, radius: 20, line: C.paper, lineW: 1.2, lineAlpha: 0.45 });
        d.text(f.contact, { x: PAD.left + 22, y: y + 40, w: cw - 44, h: 40, size: 17, color: C.paper, valign: 'middle', lh: 1 });
      }
    },
  } };
}

module.exports = { createLayout };
