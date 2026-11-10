'use strict';

// Compatibility exports. Template-owned values live in storage/templates/ppt/default.
const { loadTemplate } = require('./template-loader');
const { SLIDE_HEIGHT, ASPECTS } = require('./geometry');
const template = loadTemplate('default');
const { FONT_STACK, FONT_STACKS } = template.html;
const { colors: COLORS, FONT_PPTX, FONT_PPTX_BY_LANG } = template;

module.exports = { COLORS, FONT_STACK, FONT_STACKS, FONT_PPTX, FONT_PPTX_BY_LANG, SLIDE_HEIGHT, ASPECTS };
