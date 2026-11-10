'use strict';

const { ASPECTS } = require('./theme');

// AI がコピーや画像・チャートを用意する前に参照する「事前情報」。
// 数値は lib/render.js の CSS から導出している。CSS を変えたらここも更新すること。
// 各フィールドの文字数上限は templates --json の fit に載っている（こちらは領域の寸法が主）。

const PADDING = { top: 52, right: 64, bottom: 60, left: 64 };
const HEADER_HEIGHT = 98; // タイトル行43 + 余白18 + 罫線3 + 下マージン34

function contentWidth(aspect) {
  return ASPECTS[aspect].width - PADDING.left - PADDING.right;
}

function buildLayout() {
  const aspects = {};
  for (const a of Object.keys(ASPECTS)) {
    const cw = contentWidth(a);
    const ch = ASPECTS[a].height - PADDING.top - PADDING.bottom;
    aspects[a] = {
      slide: ASPECTS[a],
      contentBox: { width: cw, height: ch },
      bodyBelowHeader: { width: cw, height: ch - HEADER_HEIGHT },
      slots: {
        // chart テンプレートの SVG 描画領域（高さ460px固定。points 指定時は幅が約60%になる）
        chart: { width: cw, height: 460 },
        // image-text テンプレートの画像表示領域（object-fit: cover）
        image: { width: Math.round((cw - 40) / 2), height: 460 },
      },
    };
  }
  return {
    unit: 'px',
    padding: PADDING,
    headerHeight: HEADER_HEIGHT,
    aspects,
    textRules: [
      '全角1文字の幅 ≈ フォントサイズ(px)。行あたり文字数 ≈ 領域幅 ÷ フォントサイズ',
      '各フィールドの具体的な上限（フォントpx・字数/行・行数）は templates --json の fit を参照',
      'fit の字数は 16:9 基準。4:3 では本文幅が約0.72倍になるので字数も×0.72する',
      '半角英数は全角の約半分の幅として数える',
    ],
    hardConstraints: [
      'スライド高さは720px固定で overflow:hidden — あふれた内容は警告なく切れる',
      'chart の吹き出し（callouts）は折返し不可。全角14字を超えるとはみ出す',
      '入りきらない内容は1枚に詰めず、スライドを分割する',
      '仕上げに screenshot コマンドで PNG 化し、目視確認するのが確実',
    ],
  };
}

function layoutText() {
  const L = buildLayout();
  const lines = [];
  lines.push('スライドのレイアウト情報（単位: px）\n');
  for (const [name, a] of Object.entries(L.aspects)) {
    lines.push(`[${name}]`);
    lines.push(`  スライド全体    : ${a.slide.width} × ${a.slide.height}`);
    lines.push(`  コンテンツ領域  : ${a.contentBox.width} × ${a.contentBox.height}（余白 上${L.padding.top}/左右${L.padding.left}/下${L.padding.bottom}）`);
    lines.push(`  ヘッダー下の本文: ${a.bodyBelowHeader.width} × ${a.bodyBelowHeader.height}（タイトル付きテンプレートの場合）`);
    lines.push(`  チャート描画領域: ${a.slots.chart.width} × ${a.slots.chart.height}`);
    lines.push(`  画像スロット    : ${a.slots.image.width} × ${a.slots.image.height}（image-text・object-fit:cover）`);
    lines.push('');
  }
  lines.push('文字数の目安:');
  for (const r of L.textRules) lines.push(`  - ${r}`);
  lines.push('\n制約:');
  for (const r of L.hardConstraints) lines.push(`  - ${r}`);
  return lines.join('\n');
}

module.exports = { buildLayout, layoutText };
