'use strict';
const { COLORS, resolveFont } = require('./theme');
const { createLayout } = require('./layouts');
module.exports = {
  id: 'genspark_college',
  name: 'Genspark College',
  description: '学院蓝与哑金、暖灰纸底、衬线标题和课堂进度条。参考大学助教课件。',
  colors: COLORS,
  resolveFont,
  createLayout,
};
