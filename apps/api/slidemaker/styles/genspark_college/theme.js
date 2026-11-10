'use strict';

// Tokens sampled from the supplied college-course-ta-deck/shared.css.
const COLORS = {
  ink: '#1A1A1A', accent: '#0E3A5F', accentLight: '#E7EBED',
  secondary: '#9B8033', secondaryLight: '#EDE5CE', gray: '#54514B',
  grayLight: '#D9D2C5', paper: '#F4F1EC', canvas: '#ECE7DE',
  ok: '#2F7D5B', okLight: '#E8F0E9', warn: '#9B8033', warnLight: '#F0E8D2',
  danger: '#B5403A', dangerLight: '#F5E6E3',
  navy: '#0E3A5F', navyDeep: '#082743', navySoft: '#1B547F',
  gold: '#C8A951', goldDeep: '#9B8033', white: '#FFFFFF',
};

function resolveFont(deck, opts = {}) {
  return opts.font || process.env.SLIDEMAKER_GENSPARK_COLLEGE_FONT ||
    process.env.SLIDEMAKER_PPTX_FONT ||
    ({ zh: 'Songti SC', ja: 'Hiragino Mincho ProN', en: 'Georgia' }[deck.lang || 'en'] || 'Georgia');
}

module.exports = { COLORS, resolveFont };
