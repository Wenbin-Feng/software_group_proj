'use strict';

const path = require('path');

const COLORS = {
  ink: '#0F1B33', // headings and body text (deep navy-black)
  accent: '#2571FF', // brand blue: emphasis, primary series, key marks
  accentDeep: '#1747C9', // pressed/darker brand blue
  accentLight: '#EAF1FF', // tinted surface for emphasis
  secondary: '#00AADF', // cyan: second series and decorative counterpoint
  secondaryLight: '#E3F6FC',
  gray: '#5A6478', // secondary text
  grayLight: '#E3E8F0', // hairlines, tracks, neutral fills
  surface: '#F4F7FB', // neutral card surface
  paper: '#FFFFFF', // slide background
  navy: '#0B1D45', // dark canvas for cover/section/closing
  navySoft: '#16306B',
  canvas: '#DDE2E8', // preview background outside the slide
  // Ordered categorical palette for data-driven charts.
  chart: ['#2571FF', '#00AADF', '#0B1D45', '#8FB3FF', '#5ED3F3', '#A3ADBF'],
  chartDim: '#C3CCDA', // de-emphasised bars next to a highlighted one
  // ステータス色（RAG）。ダッシュボード等で「順調/注意/危険」を機能的に色分けする時だけ使う。
  // ブランドの主役は青のままで、これらは状態シグナル専用（装飾に使わない）。
  ok: '#16A34A', okLight: '#E7F6EC', // 順調（緑）
  warn: '#D97706', warnLight: '#FBEFE0', // 注意（橙）
  danger: '#DC2626', dangerLight: '#FBE9E9', // 危険（赤）
};

// ブランド書体の混植: 欧文=Inter（En）/ 和文=Aoto Gothic（Ja）。
// グリフ単位フォールバックで、ラテン文字・数字は Inter、日本語は Aoto に解決される。
// いずれも未配置の環境では後続の日本語ゴシックへフォールバックする。
const FONT_STACK =
  "'Inter', 'Aoto Gothic', 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', Meiryo, sans-serif";

// 言語別フォントスタック。deck.lang で選ぶ（render.js）。デフォルトは ja。
// 漢字はグリフ単位で「最初にその字を持つフォント」が勝つため、簡体字を正しい字形で
// 出すには SC フォントを Aoto Gothic より前に置く必要がある。そのため zh では
// Aoto（和文字形）を外し、欧文=Inter / 漢字=Noto Sans SC の組み合わせにする。
// Noto Sans SC は Inter / Aoto Gothic と相性のよいヒューマニスト系オープンフォント（OFL）。
const FONT_STACKS = {
  ja: FONT_STACK,
  zh: "'Inter', 'Noto Sans SC', 'Noto Sans CJK SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  en: "'Inter', 'Helvetica Neue', Arial, sans-serif",
};

// PPTX 用フォント名。PowerPoint は font-stack を持てないため単一名で指定する。
// 開く側に指定フォントが無い場合は PowerPoint が自動代替する（ベストエフォート）。
const FONT_PPTX = 'OT-PAoto Gothic StdN';
const FONT_PPTX_BY_LANG = {
  ja: FONT_PPTX,
  zh: 'Noto Sans SC',
  en: 'Arial', // universally installed, so PowerPoint never substitutes it and line breaks stay predictable
};

const FONT_FILES = [
  // family, weight → /fonts/<file>.woff2
  { family: 'Inter', weights: { 400: 'Inter-400', 500: 'Inter-500', 600: 'Inter-600', 700: 'Inter-700' } },
  { family: 'Aoto Gothic', weights: { 400: 'AotoGothicStdN-Regular', 500: 'AotoGothicStdN-Medium', 600: 'AotoGothicStdN-DeBold', 700: 'AotoGothicStdN-Bold' } },
  // 簡体字（deck.lang="zh"）用。欧文は Inter、漢字はこの Noto Sans SC で描画する。
  { family: 'Noto Sans SC', weights: { 400: 'NotoSansSC-400', 500: 'NotoSansSC-500', 700: 'NotoSansSC-700' } },
];

const fontsDir = path.join(__dirname, 'assets', 'fonts');

function resolveFont(deck, opts = {}) {
  return opts.font || process.env.SLIDEMAKER_PPTX_FONT || FONT_PPTX_BY_LANG[deck.lang || 'ja'] || FONT_PPTX;
}

module.exports = { COLORS, FONT_STACK, FONT_STACKS, FONT_PPTX, FONT_PPTX_BY_LANG, FONT_FILES, fontsDir, resolveFont };
