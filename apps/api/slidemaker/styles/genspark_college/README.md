# Genspark College

根据用户提供的 `college-course-ta-deck/previews` 13 张参考图建立的学院课堂风格。不是将参考截图铺成幻灯片：标题、正文、表格、图表及装饰均由 SlideMaker 生成，PPTX 内保持可编辑。

## 设计与边界

- 学院蓝 `#0E3A5F`、深蓝 `#082743`、哑金 `#C8A951`、暖灰纸底 `#F4F1EC`。
- 英文 Georgia，中文 Songti SC，日文 Hiragino Mincho ProN。字体优先级：渲染 `font` → `SLIDEMAKER_GENSPARK_COLLEGE_FONT` → `SLIDEMAKER_PPTX_FONT` → `lang` 默认字体。PPTX 不嵌入字体。
- 深色封面、章节页、结束页；正文使用金色小标签、短横线、大号衬线标题和白色/深蓝面板。
- 页脚沿用参考图的分段进度视觉，但按实际页数推进，不固定绑定原课程的 50 分钟计时。
- 所有 26 个 PPTX layout 沿用公共字段协议。覆盖 `title`、`section`、`closing`、`agenda`、`key-points`、`quote`、`comparison`、`image-text`、`change-detail` 的视觉排布；其他 17 个正文 layout 复用 runtime 实现。
- 新的信息结构仍在公共 `lib/templates.js` 和 `lib/pptx/common-emitters.js` 扩展；本包只提供风格与特定排版。

## 文件

```text
genspark_college/
├── template.js          # style 入口、名称和说明
├── theme.js             # 配色与字体选择
├── layouts.js           # 页眉、页脚和现有 layout 的风格覆盖
├── examples/deck.json   # 12 页可直接生成的中文课堂示例
├── assets/preview.png   # 实际生成 PPTX 转 PDF 后的封面缩略图
└── README.md
```

示例内容为关系代数讨论课，图表数据明确标记为教学演示。封面左栏使用 `deck.title` 作为课程标识；建议使用短课程代码，详细标题放在 `title` 页的 `fields.title`。

## 使用与验收

前端打开 `http://localhost:3000/ppt`，选择 Genspark College，加载示例并生成。切换为 Default 可以用同一份 JSON 比较风格。

从项目根目录执行：

```sh
node backend/slidemaker_runtime/bin/slidemaker.js pptx \
  backend/storage/templates/ppt/genspark_college/examples/deck.json \
  --template genspark_college \
  -o backend/slidemaker_runtime/out/genspark_college/slides.pptx
```

验收文件位于 runtime 的 `out/genspark_college`：12 页示例 `slides.pptx` / `slides.pdf`；全部 26 个布局 `all-layouts.pptx` / `all-layouts.pdf`。设计以 16:9 为主；4:3 可以生成，但密集内容应单独检查。公共 layout 的容量提示仍需遵守，系统没有自动拆页。
