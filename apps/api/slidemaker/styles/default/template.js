'use strict';

const theme = require('./theme');
const { createLayout } = require('./layouts');

module.exports = {
  id: 'default',
  name: 'Default',
  colors: theme.COLORS,
  FONT_PPTX: theme.FONT_PPTX,
  FONT_PPTX_BY_LANG: theme.FONT_PPTX_BY_LANG,
  resolveFont: theme.resolveFont,
  createLayout,
  html: { FONT_STACK: theme.FONT_STACK, FONT_STACKS: theme.FONT_STACKS, FONT_FILES: theme.FONT_FILES, fontsDir: theme.fontsDir },
  examples: require('./examples.json'),
};
