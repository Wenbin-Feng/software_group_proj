'use strict';

const { ASPECTS } = require('./geometry');
const { loadTemplate } = require('./template-loader');
const { validateDeck, deckSchema } = require('./deck');
const { getTemplate, normalizeFields, esc } = require('./templates');
const { colors: COLORS, html: { FONT_STACK, FONT_STACKS, FONT_FILES } } = loadTemplate('default');

// ブランド書体を /fonts/ 配信で読み込む @font-face 定義。
// 混植: ラテン文字・数字は Inter（En）、和文は Aoto Gothic（Ja）。FONT_STACK で
// 'Inter' を先頭に置き、グリフ単位フォールバックで Latin→Inter / 日本語→Aoto になる。
// サーバ経由で閲覧した時点で読み込まれ、ブラウザ印刷の PDF にも焼き込まれる。
// 単体 HTML を file:// で開いた場合やフォント未配置環境では FONT_STACK の
// 後続ゴシックへ自動フォールバックする（埋め込みはしない方針）。
const FONT_FACE_CSS = FONT_FILES.flatMap(({ family, weights }) =>
  Object.entries(weights).map(
    ([w, file]) =>
      `  @font-face { font-family: '${family}'; font-style: normal; font-weight: ${w}; font-display: swap; src: url('/fonts/${file}.woff2') format('woff2'); }`
  )
).join('\n');

function buildCss(width, height, bare, fontStack = FONT_STACK) {
  const c = COLORS;
  // bare: スクリーンショット用。余白・影なしでスライドをぴったり描画する。
  const bodyCss = bare
    ? `body { font-family: ${fontStack}; color: var(--ink); }`
    : `body { background: ${c.canvas}; font-family: ${fontStack}; color: var(--ink);
         display: flex; flex-direction: column; align-items: center; gap: 28px; padding: 28px 0; }`;
  return `
${FONT_FACE_CSS}
  :root {
    --ink: ${c.ink}; --accent: ${c.accent}; --accent-light: ${c.accentLight};
    --secondary: ${c.secondary}; --secondary-light: ${c.secondaryLight};
    --gray: ${c.gray}; --gray-light: ${c.grayLight}; --paper: ${c.paper};
    --ok: ${c.ok}; --ok-light: ${c.okLight}; --warn: ${c.warn}; --warn-light: ${c.warnLight};
    --danger: ${c.danger}; --danger-light: ${c.dangerLight};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  ${bodyCss}
  .slide { width: ${width}px; height: ${height}px; background: var(--paper); position: relative;
           overflow: hidden; padding: 52px 64px 60px; display: flex; flex-direction: column;
           box-shadow: 0 2px 10px rgba(31,41,51,.18); }

  /* ---- 共通ヘッダー / フッター ---- */
  .sl-header h2 { font-size: 33px; font-weight: 700; line-height: 1.3; }
  .sl-header { padding-bottom: 18px; border-bottom: 3px solid var(--gray-light); margin-bottom: 34px; position: relative; }
  .sl-header::after { content: ''; position: absolute; left: 0; bottom: -3px; width: 96px; height: 3px; background: var(--accent); }
  .sl-lead { margin-top: 12px; font-size: 21px; color: var(--gray); line-height: 1.5; }
  .sl-body { flex: 1; min-height: 0; }
  .sl-footer { position: absolute; left: 64px; right: 64px; bottom: 22px; display: flex;
               justify-content: space-between; font-size: 15px; color: var(--gray); }

  /* ---- 表紙 / クロージング / 中扉 ---- */
  .tpl-title, .tpl-closing { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .title-rule { width: 110px; height: 6px; background: var(--accent); margin-bottom: 38px; }
  .tpl-title h1, .tpl-closing h1 { font-size: 52px; font-weight: 700; line-height: 1.35; letter-spacing: .01em; }
  .title-sub { margin-top: 22px; font-size: 25px; color: var(--gray); line-height: 1.5; }
  .title-meta { margin-top: 56px; display: flex; gap: 32px; font-size: 19px; color: var(--gray); }
  .tpl-section { flex: 1; display: flex; align-items: center; gap: 44px; }
  .tpl-section h1 { font-size: 48px; font-weight: 700; line-height: 1.35; }
  .section-no { font-size: 110px; font-weight: 700; color: var(--accent); line-height: 1; }
  .sec-main { flex: 1; min-width: 0; }
  .sec-nav { flex: 0 0 ${width < 1000 ? 250 : 330}px; display: flex; flex-direction: column; gap: 20px;
             border-left: 3px solid var(--gray-light); padding-left: ${width < 1000 ? 26 : 36}px; }
  .sec-nav-item { display: flex; gap: 14px; align-items: baseline; font-size: 20px; color: var(--gray); }
  .sec-nav-no { font-size: 16px; font-weight: 700; }
  .sec-nav-item.cur { color: var(--ink); font-weight: 700; }
  .sec-nav-item.cur .sec-nav-no { color: var(--accent); }

  /* ---- アジェンダ ---- */
  .tpl-agenda ol { list-style: none; display: flex; flex-direction: column; gap: 24px; max-width: 860px; }
  .tpl-agenda li { display: flex; align-items: center; gap: 26px; font-size: 26px; padding-bottom: 22px;
                   border-bottom: 1px solid var(--gray-light); }
  .agenda-no { font-size: 24px; font-weight: 700; color: var(--accent); }

  /* ---- 箇条書き ---- */
  .tpl-bullets ul { list-style: none; display: flex; flex-direction: column; gap: 30px; }
  .tpl-bullets li { padding-left: 26px; border-left: 5px solid var(--accent); }
  .b-head { font-size: 26px; font-weight: 700; }
  .b-body { margin-top: 8px; font-size: 20px; color: var(--gray); line-height: 1.55; }
  /* 横並びブロック（images 指定時） */
  .tpl-bullets.b-cards { display: flex; gap: 26px; align-items: stretch; }
  .b-card { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .b-card .b-head { margin-top: 18px; font-size: 23px; padding-left: 14px; border-left: 5px solid var(--accent); line-height: 1.35; }
  .b-card .b-body { margin-top: 10px; padding-left: 14px; font-size: 19px; line-height: 1.6; }
  .bc-visual { height: 150px; border-radius: 10px; overflow: hidden; display: flex; }
  .bc-visual img { width: 100%; height: 100%; object-fit: cover; }
  .bc-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
           text-align: center; border: 2px dashed var(--gray); border-radius: 10px; background: var(--paper);
           color: var(--gray); font-size: 16px; line-height: 1.7; }

  /* ---- As-Is / To-Be （As-Is は控えめ・To-Be は強く見せる） ---- */
  .tpl-asistobe { display: flex; align-items: stretch; gap: 20px; }
  .ab-panel { flex: 1; border-radius: 10px; padding: 24px 26px; display: flex; flex-direction: column; }
  .ab-asis { background: var(--gray-light); opacity: .82; }
  .ab-tobe { flex: 1.12; background: var(--accent-light); border: 2.5px solid var(--accent);
             box-shadow: 0 6px 20px rgba(37,99,235,.16); }
  .ab-label { font-size: 21px; font-weight: 700; margin-bottom: 16px; color: var(--gray); }
  .ab-tobe .ab-label { color: var(--accent); font-size: 23px; }
  .ab-visual { height: 175px; border-radius: 8px; overflow: hidden; margin-bottom: 18px; display: flex; }
  .ab-visual img { width: 100%; height: 100%; object-fit: cover; }
  .ab-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
           text-align: center; border: 2px dashed var(--gray); border-radius: 8px; font-size: 15px;
           line-height: 1.7; color: var(--gray); background: var(--paper); }
  .ab-ph-tobe { border-color: var(--accent); color: var(--accent); }
  .ab-panel ul { list-style: none; display: flex; flex-direction: column; gap: 14px; }
  .ab-panel li { font-size: 19px; line-height: 1.5; padding-left: 20px; position: relative; color: var(--gray); }
  .ab-tobe li { font-size: 20px; color: var(--ink); font-weight: 500; }
  .ab-panel li::before { content: ''; position: absolute; left: 0; top: 11px; width: 8px; height: 8px;
                         border-radius: 50%; background: var(--gray); }
  .ab-tobe li::before { background: var(--accent); top: 12px; }
  .ab-arrow { display: flex; flex-direction: column; align-items: center; justify-content: center;
              gap: 10px; color: var(--accent); flex: 0 0 80px; }
  .ab-transition { font-size: 17px; font-weight: 700; color: var(--accent); text-align: center; }

  /* ---- ビッグナンバー ---- */
  .tpl-bignumber { display: flex; align-items: center; gap: 56px; }
  .bn-left { flex: 1.1; }
  .bn-desc { font-size: 23px; line-height: 1.75; }
  .bn-points { list-style: none; margin-top: 30px; display: flex; flex-direction: column; gap: 14px; }
  .bn-points li { font-size: 20px; color: var(--gray); padding-left: 20px; position: relative; }
  .bn-points li::before { content: ''; position: absolute; left: 0; top: 11px; width: 9px; height: 9px; background: var(--accent); }
  .bn-right { flex: 1; text-align: center; background: var(--accent-light); border-radius: 12px; padding: 48px 24px; }
  .bn-value { font-size: 150px; font-weight: 700; color: var(--accent); line-height: 1; letter-spacing: -.02em; }
  .bn-unit { font-size: 60px; margin-left: 6px; }
  .bn-caption { margin-top: 18px; font-size: 21px; color: var(--gray); }

  /* ---- チャート ---- */
  .tpl-chart { display: flex; gap: 40px; }
  .ch-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .ch-split .ch-main { flex: 1.55; }
  .ch-points { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
  .ch-points ul { list-style: none; display: flex; flex-direction: column; gap: 26px; }
  .ch-points li { font-size: 20px; line-height: 1.55; padding-left: 22px; border-left: 4px solid var(--accent); }
  .chart-wrap { position: relative; flex: 1; min-height: 0; }
  .callout { position: absolute; transform: translate(-50%, -100%); background: var(--ink); color: var(--paper);
             font-size: 18px; font-weight: 600; line-height: 1.4; padding: 10px 18px; border-radius: 8px;
             white-space: nowrap; }
  .callout::after { content: ''; position: absolute; left: 50%; top: 100%; transform: translateX(-50%);
                    border: 9px solid transparent; border-top-color: var(--ink); }
  .chart-note { margin-top: 14px; font-size: 19px; color: var(--gray); border-left: 4px solid var(--accent); padding-left: 16px; }

  /* ---- ガントチャート ---- */
  .tpl-gantt { display: flex; flex-direction: column; }
  .gt { flex: 1; display: flex; flex-direction: column; }
  .gt-row { flex: 1; max-height: 78px; display: flex; border-bottom: 1px solid var(--gray-light); }
  .gt-row.gt-head { max-height: 46px; min-height: 42px; }
  .gt-label { flex: 0 0 ${width < 1000 ? 210 : 290}px; display: flex; align-items: center;
              font-size: 18px; font-weight: 600; padding-right: 18px; line-height: 1.35; }
  .gt-track { flex: 1; position: relative; display: flex; }
  .gt-cell { flex: 1; border-left: 1px solid var(--gray-light); }
  .gt-head .gt-cell { display: flex; align-items: center; justify-content: center;
                      font-size: 17px; font-weight: 600; color: var(--gray); }
  .gt-bar { position: absolute; top: 50%; transform: translateY(-50%); height: 26px;
            border-radius: 7px; background: var(--accent); }
  .gt-note { margin-top: 14px; font-size: 19px; color: var(--gray); border-left: 4px solid var(--accent); padding-left: 16px; }

  /* ---- 画像 + 解説 ---- */
  .tpl-imagetext { display: flex; gap: 40px; align-items: flex-start; }
  .it-left, .it-right { flex: 1; min-width: 0; }
  .it-lead { font-size: 21px; line-height: 1.75; }
  .it-left .bn-points { margin-top: 24px; }
  .it-img { width: 100%; height: 460px; border-radius: 10px; background: var(--gray-light);
            display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .it-img img { width: 100%; height: 100%; object-fit: cover; }
  .it-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
                    border: 2px dashed var(--gray); border-radius: 10px; background: var(--paper);
                    color: var(--gray); font-size: 18px; text-align: center; line-height: 1.8; }
  .it-caption { margin-top: 12px; font-size: 17px; color: var(--gray); text-align: center; }

  /* ---- 比較 ---- */
  .tpl-comparison { display: flex; gap: 24px; align-items: stretch; }
  .cmp-col { flex: 1; border: 2px solid var(--gray-light); border-radius: 10px; overflow: hidden;
             display: flex; flex-direction: column; }
  .cmp-head { background: var(--gray-light); font-size: 23px; font-weight: 700; text-align: center; padding: 18px 12px; }
  .cmp-col ul { list-style: none; padding: 22px 26px; display: flex; flex-direction: column; gap: 16px; }
  .cmp-col li { font-size: 19px; line-height: 1.5; padding-bottom: 14px; border-bottom: 1px solid var(--gray-light); }
  .cmp-col li:last-child { border-bottom: none; }
  .cmp-highlight { border-color: var(--accent); }
  .cmp-highlight .cmp-head { background: var(--accent); color: var(--paper); }

  /* ---- キーポイント ---- */
  .tpl-keypoints { display: flex; gap: 26px; align-items: stretch; }
  .kp-card { flex: 1; min-width: 0; background: var(--gray-light); border-radius: 10px; padding: 30px 28px;
             display: flex; flex-direction: column; }
  .kp-no { font-size: 40px; font-weight: 700; color: var(--accent); }
  .kp-head { margin-top: 14px; font-size: 24px; font-weight: 700; line-height: 1.4; }
  .kp-body { margin-top: 12px; font-size: 19px; color: var(--gray); line-height: 1.6; }
  .kp-visual { position: relative; flex: 1; min-height: 180px; border-radius: 8px; overflow: hidden; margin: -8px -6px 10px; }
  .kp-visual img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .kp-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
           text-align: center; border: 2px dashed var(--gray); border-radius: 8px; background: var(--paper);
           color: var(--gray); font-size: 16px; line-height: 1.7; }
  .kp-no-badge { position: absolute; z-index: 1; top: 10px; left: 10px; background: var(--accent);
                 color: var(--paper); font-size: 17px; font-weight: 700; border-radius: 8px; padding: 4px 11px; }

  /* ---- タイムライン ---- */
  .tpl-timeline { display: flex; align-items: center; }
  .tl-track { display: flex; width: 100%; position: relative; }
  .tl-track::before { content: ''; position: absolute; left: 4%; right: 4%; top: 51px; height: 4px; background: var(--gray-light); }
  .tl-item { flex: 1; position: relative; padding: 0 14px; text-align: center; }
  .tl-label { font-size: 18px; font-weight: 700; color: var(--accent); height: 30px; }
  .tl-dot { width: 18px; height: 18px; border-radius: 50%; background: var(--paper); border: 5px solid var(--accent);
            margin: 8px auto 18px; position: relative; z-index: 1; }
  .tl-head { font-size: 21px; font-weight: 700; }
  .tl-body { margin-top: 10px; font-size: 17px; color: var(--gray); line-height: 1.55; }
  /* 責任分解レーン（lanes/bands 指定時） */
  .tpl-timeline.tl-with-lanes { flex-direction: column; align-items: stretch; justify-content: flex-start; }
  .tl-with-lanes .tl-top { padding-top: 6px; }
  .tl-with-lanes .tl-body { font-size: 16px; }
  .rl-wrap { margin-top: 26px; padding-top: 24px; border-top: 2px dashed var(--gray-light); }
  .rl-caption { font-size: 16px; font-weight: 700; color: var(--gray); margin-bottom: 12px; }
  .rl-row { display: flex; align-items: stretch; height: 52px; margin-bottom: 12px; }
  .rl-row:last-child { margin-bottom: 0; }
  .rl-name { flex: 0 0 ${width < 1000 ? 96 : 120}px; display: flex; align-items: center; font-size: 18px; font-weight: 700; padding-right: 16px; }
  .rl-name-a { color: var(--accent); }
  .rl-name-b { color: var(--ink); }
  .rl-track { flex: 1; position: relative; display: flex; background: var(--gray-light); border-radius: 8px; }
  .rl-cell { flex: 1; border-right: 1px solid var(--paper); }
  .rl-cell:last-child { border-right: none; }
  .rl-bar { position: absolute; top: 6px; bottom: 6px; border-radius: 6px; display: flex; align-items: center;
            justify-content: center; padding: 0 12px; font-size: 15px; font-weight: 600; line-height: 1.2;
            text-align: center; white-space: nowrap; overflow: hidden; }
  .rl-bar-a { background: var(--accent); color: var(--paper); }
  .rl-bar-b { background: var(--ink); color: var(--paper); }

  /* ---- 収束（根拠→結論） ---- */
  .tpl-converge { display: flex; flex-direction: column; gap: 14px; }
  .cv-supports { display: flex; gap: 22px; flex: 1; min-height: 0; }
  .cv-card { flex: 1; min-width: 0; background: var(--gray-light); border-radius: 10px; padding: 24px 26px;
             display: flex; flex-direction: column; }
  .cv-no { font-size: 32px; font-weight: 700; color: var(--accent); line-height: 1; }
  .cv-head { margin-top: 12px; font-size: 22px; font-weight: 700; line-height: 1.4; }
  .cv-body { margin-top: 10px; font-size: 18px; color: var(--gray); line-height: 1.6; }
  .cv-funnel { display: flex; justify-content: center; align-items: center; color: var(--accent); height: 32px; }
  .cv-conclusion { background: var(--accent); color: var(--paper); border-radius: 12px; padding: 22px 30px;
                   display: flex; align-items: center; gap: 18px; box-shadow: 0 6px 20px rgba(37,99,235,.18); }
  .cv-tag { flex: 0 0 auto; font-size: 18px; font-weight: 700; background: rgba(255,255,255,.22);
            border-radius: 999px; padding: 6px 16px; }
  .cv-text { font-size: 26px; font-weight: 700; line-height: 1.4; }

  /* ---- 要因→帰結 ---- */
  .tpl-drivers { display: flex; align-items: stretch; gap: 20px; }
  .dv-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; justify-content: center; }
  .dv-item { display: flex; gap: 16px; align-items: flex-start; background: var(--gray-light);
             border-radius: 10px; padding: 18px 22px; }
  .dv-no { flex: 0 0 auto; font-size: 26px; font-weight: 700; color: var(--accent); line-height: 1.25; }
  .dv-head { font-size: 20px; font-weight: 700; line-height: 1.4; }
  .dv-body { margin-top: 4px; font-size: 16px; color: var(--gray); line-height: 1.55; }
  .dv-arrow { flex: 0 0 80px; display: flex; flex-direction: column; align-items: center; justify-content: center;
              gap: 10px; color: var(--accent); }
  .dv-arrowlabel { font-size: 17px; font-weight: 700; color: var(--accent); text-align: center; }
  .dv-right { flex: 1.12; min-width: 0; background: var(--accent-light); border: 2.5px solid var(--accent);
              border-radius: 10px; padding: 28px 30px; display: flex; flex-direction: column; justify-content: center;
              box-shadow: 0 6px 20px rgba(37,99,235,.16); }
  .dv-rlabel { font-size: 20px; font-weight: 700; color: var(--accent); margin-bottom: 14px; }
  .dv-conclusion { font-size: 26px; font-weight: 700; line-height: 1.5; color: var(--ink); }
  .dv-points { list-style: none; margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
  .dv-points li { font-size: 18px; color: var(--ink); padding-left: 20px; position: relative; line-height: 1.5; }
  .dv-points li::before { content: ''; position: absolute; left: 0; top: 10px; width: 8px; height: 8px;
                          border-radius: 50%; background: var(--accent); }

  /* ---- ピラミッド（結論先出し） ---- */
  .tpl-pyramid { display: flex; flex-direction: column; gap: 14px; }
  .py-top { background: var(--accent); color: var(--paper); border-radius: 12px; padding: 24px 32px;
            display: flex; align-items: center; gap: 18px; box-shadow: 0 6px 20px rgba(37,99,235,.18); }
  .py-tag { flex: 0 0 auto; font-size: 18px; font-weight: 700; background: rgba(255,255,255,.22);
            border-radius: 999px; padding: 6px 16px; }
  .py-text { font-size: 27px; font-weight: 700; line-height: 1.4; }
  .py-connect { display: flex; justify-content: center; align-items: center; color: var(--accent); height: 24px; }
  .py-connect svg { width: 160px; height: 24px; }
  .py-supports { display: flex; gap: 22px; flex: 1; min-height: 0; }
  .py-card { flex: 1; min-width: 0; background: var(--paper); border: 2px solid var(--gray-light);
             border-top: 4px solid var(--accent); border-radius: 10px; padding: 24px 26px;
             display: flex; flex-direction: column; }
  .py-head { font-size: 22px; font-weight: 700; line-height: 1.4; }
  .py-body { margin-top: 10px; font-size: 18px; color: var(--gray); line-height: 1.6; }

  /* ---- 引用（顧客の声） ---- */
  .tpl-quote { display: flex; flex-direction: column; justify-content: center; position: relative; padding: 0 70px; }
  .q-body { position: relative; }
  .q-mark { position: absolute; top: -14px; left: -6px; font-size: 180px; line-height: 1; font-weight: 700;
            font-family: Georgia, 'Times New Roman', serif; color: var(--accent-light); z-index: 0; }
  .q-text { position: relative; font-size: 34px; font-weight: 600; line-height: 1.7; z-index: 1; }
  .q-attr { margin-top: 42px; display: flex; align-items: center; justify-content: flex-end; gap: 20px; }
  .q-name { font-size: 23px; font-weight: 700; }
  .q-role { margin-top: 4px; font-size: 18px; color: var(--gray); }
  /* お客様ロゴ/写真を大きく配置（imageSrc 指定時） */
  .tpl-quote.q-split { flex-direction: row; align-items: center; gap: 56px; padding: 0 24px; }
  .q-split .q-figure { flex: 0 0 ${width < 1000 ? 280 : 360}px; align-self: stretch; border-radius: 14px;
                       display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .q-figure-logo { background: var(--gray-light); padding: 36px; }
  .q-figure-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .q-figure-photo img { width: 100%; height: 100%; object-fit: cover; }
  .q-fig-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
              text-align: center; border: 2px dashed var(--gray); border-radius: 12px; background: var(--paper);
              color: var(--gray); font-size: 18px; line-height: 1.8; }
  .q-split .q-body { flex: 1; min-width: 0; }
  .q-split .q-text { font-size: 30px; }
  .q-split .q-attr { justify-content: flex-start; }

  /* ---- プロフィール表 ---- */
  .tpl-factprofile { display: flex; gap: 40px; align-items: stretch; }
  .tpl-factprofile.fp-full { align-items: flex-start; }
  .fp-table { flex: 1; min-width: 0; border-top: 2px solid var(--ink); align-self: flex-start; }
  .fp-row { display: flex; border-bottom: 1px solid var(--gray-light); }
  .fp-label { flex: 0 0 170px; background: var(--gray-light); font-size: 20px; font-weight: 700;
              padding: 19px 20px; line-height: 1.45; }
  .fp-value { flex: 1; min-width: 0; font-size: 20px; padding: 19px 22px; line-height: 1.45; }
  .fp-side { flex: 0 0 ${width < 1000 ? 340 : 440}px; display: flex; flex-direction: column; gap: 16px; }
  .fp-logo { flex: 0 0 auto; min-height: 150px; background: var(--gray-light); border-radius: 12px;
             display: flex; align-items: center; justify-content: center; padding: 28px; }
  .fp-side .fp-logo:only-child { flex: 1; }
  .fp-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .fp-logo-ph { width: 100%; height: 100%; min-height: 110px; display: flex; align-items: center; justify-content: center;
                border: 2px dashed var(--gray); border-radius: 10px; background: var(--paper);
                color: var(--gray); font-size: 18px; }
  .fp-side .it-img { flex: 1; height: auto; }

  /* ---- 事例1枚サマリー ---- */
  .cs-meta { display: inline-block; margin-left: 16px; vertical-align: 4px; font-size: 17px; font-weight: 600;
             color: var(--accent); background: var(--accent-light); border-radius: 999px; padding: 4px 16px; }
  .tpl-casesummary { display: flex; align-items: stretch; gap: 12px; }
  .cs-col { flex: 1; min-width: 0; border-radius: 10px; padding: 26px 24px; }
  .cs-challenge { background: var(--gray-light); }
  .cs-solution { background: var(--paper); border: 2px solid var(--gray-light); }
  .cs-outcome { background: var(--accent-light); border: 2px solid var(--accent); }
  .cs-head { font-size: 22px; font-weight: 700; margin-bottom: 18px; }
  .cs-outcome .cs-head { color: var(--accent); }
  .cs-col ul { list-style: none; display: flex; flex-direction: column; gap: 14px; }
  .cs-col li { font-size: 18px; line-height: 1.5; padding-left: 18px; position: relative; }
  .cs-col li::before { content: ''; position: absolute; left: 0; top: 10px; width: 8px; height: 8px;
                       border-radius: 50%; background: var(--gray); }
  .cs-outcome li::before { background: var(--accent); }
  .cs-arrow { align-self: center; color: var(--accent); flex: 0 0 30px; display: flex; justify-content: center; }
  /* 立体版（logo/profile/features/metric 指定時） */
  .tpl-casesummary.cs-rich { display: flex; align-items: stretch; gap: 30px; }
  .cs-aside { flex: 0 0 ${width < 1000 ? 250 : 310}px; display: flex; flex-direction: column; gap: 18px; }
  .cs-logo { flex: 0 0 auto; min-height: 110px; background: var(--gray-light); border-radius: 10px;
             display: flex; align-items: center; justify-content: center; padding: 20px; }
  .cs-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .cs-logo-ph { width: 100%; height: 100%; min-height: 80px; display: flex; align-items: center; justify-content: center;
                border: 2px dashed var(--gray); border-radius: 8px; background: var(--paper); color: var(--gray); font-size: 16px; }
  .cs-profile { display: flex; flex-direction: column; gap: 0; }
  .cs-pf-row { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--gray-light); }
  .cs-pf-label { flex: 0 0 64px; font-size: 14px; font-weight: 700; color: var(--gray); }
  .cs-pf-value { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; line-height: 1.4; }
  .cs-feats-cap { font-size: 14px; font-weight: 700; color: var(--gray); margin-bottom: 10px; }
  .cs-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .cs-chip { font-size: 15px; font-weight: 600; color: var(--accent); background: var(--accent-light);
             border-radius: 999px; padding: 5px 14px; }
  .cs-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px; }
  .cs-flow { flex: 1; display: flex; align-items: stretch; gap: 10px; }
  .cs-flow .cs-col { padding: 20px 20px; }
  .cs-flow .cs-head { font-size: 20px; margin-bottom: 14px; }
  .cs-flow .cs-col li { font-size: 17px; }
  .cs-arrow-sm { flex: 0 0 26px; }
  .cs-metric { flex: 0 0 auto; display: flex; align-items: baseline; gap: 20px; background: var(--accent-light);
               border-radius: 12px; padding: 18px 28px; }
  .cs-metric-val { font-size: 52px; font-weight: 700; color: var(--accent); line-height: 1; letter-spacing: -.02em; }
  .cs-metric-label { font-size: 18px; color: var(--ink); font-weight: 600; }
  .cs-voice { flex: 0 0 auto; position: relative; background: var(--accent-light); border-left: 5px solid var(--accent);
              border-radius: 10px; padding: 16px 26px 14px 58px; }
  .cs-voice-mark { position: absolute; left: 18px; top: 10px; font-size: 56px; line-height: 1; font-weight: 700;
                   font-family: Georgia, 'Times New Roman', serif; color: var(--accent); opacity: .45; }
  .cs-voice-text { font-size: 19px; line-height: 1.6; font-weight: 600; color: var(--ink); }
  .cs-voice-by { margin-top: 8px; font-size: 15px; color: var(--gray); font-weight: 600; text-align: right; }

  /* ---- 料金プラン ---- */
  .tpl-pricing { display: flex; gap: 26px; align-items: stretch; padding-top: 14px; }
  .pr-card { flex: 1; min-width: 0; border: 2px solid var(--gray-light); border-radius: 10px;
             padding: 28px 28px 24px; position: relative; }
  .pr-highlight { border-color: var(--accent); background: var(--accent-light); }
  .pr-badge { position: absolute; top: -17px; left: 50%; transform: translateX(-50%); background: var(--accent);
              color: var(--paper); font-size: 16px; font-weight: 700; border-radius: 999px; padding: 5px 22px;
              white-space: nowrap; }
  .pr-name { font-size: 24px; font-weight: 700; text-align: center; }
  .pr-price { margin-top: 14px; font-size: 44px; font-weight: 700; color: var(--accent); text-align: center;
              letter-spacing: -.01em; }
  .pr-note { margin-top: 6px; font-size: 16px; color: var(--gray); text-align: center; min-height: 24px; }
  .pr-card ul { list-style: none; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--gray-light);
                display: flex; flex-direction: column; gap: 13px; }
  .pr-highlight ul { border-top-color: var(--accent); }
  .pr-card li { font-size: 18px; line-height: 1.45; padding-left: 26px; position: relative; }
  .pr-card li::before { content: '✓'; position: absolute; left: 0; color: var(--accent); font-weight: 700; }

  /* ---- 実績数字 ---- */
  .tpl-stats { display: flex; flex-direction: column; }
  .st-grid { flex: 1; display: flex; gap: 26px; align-items: stretch; }
  .st-card { flex: 1; min-width: 0; background: var(--accent-light); border-radius: 12px; display: flex;
             flex-direction: column; align-items: center; justify-content: center; padding: 30px 14px;
             text-align: center; }
  .st-value { font-size: 56px; font-weight: 700; color: var(--accent); line-height: 1.1; letter-spacing: -.02em; }
  .st-grid.n-2 .st-value { font-size: 84px; }
  .st-grid.n-3 .st-value { font-size: 72px; }
  ${width < 1000 ? `.st-value { font-size: 40px; }
  .st-grid.n-2 .st-value { font-size: 64px; }
  .st-grid.n-3 .st-value { font-size: 52px; }` : ''}
  .st-caption { margin-top: 16px; font-size: 19px; color: var(--gray); line-height: 1.4; }
  .st-note { margin-top: 18px; font-size: 19px; color: var(--gray); border-left: 4px solid var(--accent); padding-left: 16px; }
  /* 成長グラフ + 数字（chartValues 指定時） */
  .tpl-stats.st-has-chart { flex-direction: column; }
  .st-row { flex: 1; min-height: 0; display: flex; gap: 36px; align-items: stretch; }
  .st-chart { flex: 1.7; min-width: 0; display: flex; }
  .st-chart .chart-wrap { position: relative; flex: 1; min-height: 0; }
  .st-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
  .st-side .st-card { flex: 1; padding: 20px 18px; }
  .st-side .st-value { font-size: 48px; }
  ${width < 1000 ? '.st-side .st-value { font-size: 40px; }' : ''}
  .st-side .st-caption { margin-top: 8px; font-size: 17px; }

  /* ---- 汎用テーブル ---- */
  .tpl-table { display: flex; flex-direction: column; }
  .tbl { width: 100%; border-collapse: collapse; }
  .tbl th, .tbl td { border: 1px solid var(--gray-light); padding: 15px 18px; font-size: 18px;
                     line-height: 1.45; text-align: center; }
  .tbl th { background: var(--gray-light); font-weight: 700; font-size: 19px; }
  .tbl th:first-child, .tbl td:first-child { text-align: left; }
  .tbl td.td-sym { font-size: 26px; font-weight: 700; }
  .tbl td.td-best { color: var(--accent); }
  .tbl td.col-hl { background: var(--accent-light); }
  .tbl th.col-hl { background: var(--accent); color: var(--paper); }
  .tbl-note { margin-top: 16px; font-size: 19px; color: var(--gray); border-left: 4px solid var(--accent); padding-left: 16px; }

  /* ---- FAQ ---- */
  .tpl-faq ul { list-style: none; display: flex; flex-direction: column; gap: 32px; }
  .faq-no { flex: 0 0 36px; height: 36px; border-radius: 50%; background: var(--accent); color: var(--paper);
            display: inline-flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; }
  .faq-no-a { background: var(--gray-light); color: var(--ink); }
  .faq-q { display: flex; gap: 16px; align-items: center; font-size: 23px; font-weight: 700; }
  .faq-a { margin-top: 12px; display: flex; gap: 16px; align-items: flex-start; font-size: 19px;
           color: var(--gray); line-height: 1.55; }
  .faq-a > span:last-child { padding-top: 5px; }

  /* ---- 種別バッジ（changelog-list / change-detail 共用） ---- */
  .cl-badge { font-size: 16px; font-weight: 700; border-radius: 6px; line-height: 1.3; text-align: center; }
  .cl-new { background: var(--accent); color: var(--paper); }
  .cl-imp { background: var(--secondary); color: var(--paper); }
  .cl-chg { background: var(--accent-light); color: var(--accent); box-shadow: inset 0 0 0 1.5px var(--accent); }
  .cl-dep { background: var(--ink); color: var(--paper); }

  /* ---- 変更一覧（チェンジログ） ---- */
  .tpl-changelog ul { list-style: none; display: flex; flex-direction: column; gap: 16px; }
  .cl-row { display: flex; align-items: flex-start; gap: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--gray-light); }
  .cl-row:last-child { border-bottom: none; }
  .cl-row .cl-badge { flex: 0 0 90px; padding: 7px 6px; align-self: center; }
  .cl-main { flex: 1; min-width: 0; }
  .cl-head { font-size: 21px; font-weight: 700; line-height: 1.4; }
  .cl-impact { margin-top: 7px; font-size: 17px; color: var(--gray); line-height: 1.5; display: flex; gap: 10px; align-items: baseline; }
  .cl-impact-tag { flex: 0 0 auto; font-size: 13px; font-weight: 700; color: var(--accent); border: 1px solid var(--accent);
                   border-radius: 4px; padding: 1px 7px; }
  .cl-when { flex: 0 0 auto; align-self: center; font-size: 15px; color: var(--gray); background: var(--gray-light);
             border-radius: 999px; padding: 5px 14px; white-space: nowrap; }

  /* ---- 変更カード（影響と対応） ---- */
  .tpl-changedetail { display: flex; flex-direction: column; gap: 20px; }
  .cd-badge { display: inline-block; font-size: 16px; padding: 5px 14px; margin-right: 14px; vertical-align: 3px; }
  .cd-cols { flex: 1; min-height: 0; display: flex; gap: 26px; align-items: stretch; }
  .cd-context { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 22px; }
  .cd-label { font-size: 17px; font-weight: 700; color: var(--gray); margin-bottom: 10px; padding-left: 12px;
              border-left: 4px solid var(--gray); }
  .cd-block p { font-size: 19px; line-height: 1.75; padding-left: 12px; }
  .cd-key { flex: 1.05; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
  .cd-card { flex: 1; border-radius: 10px; padding: 20px 24px; display: flex; flex-direction: column; }
  .cd-card-label { font-size: 20px; font-weight: 700; margin-bottom: 14px; }
  .cd-card.cd-impact { background: var(--accent-light); border: 2px solid var(--accent); }
  .cd-card.cd-impact .cd-card-label { color: var(--accent); }
  .cd-card.cd-action { background: var(--gray-light); }
  .cd-card ul { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .cd-card li { font-size: 19px; line-height: 1.5; padding-left: 24px; position: relative; }
  .cd-card li::before { content: ''; position: absolute; left: 0; top: 9px; width: 9px; height: 9px; border-radius: 50%; }
  .cd-impact li::before { background: var(--accent); }
  .cd-action li::before { background: var(--gray); }
  .cd-meta { display: flex; flex-wrap: wrap; gap: 14px 32px; padding: 14px 22px; background: var(--gray-light);
             border-radius: 8px; font-size: 17px; }
  .cd-meta-item b { color: var(--accent); margin-right: 10px; }

  /* ---- トークスクリプト ---- */
  .tpl-talktrack ul { list-style: none; display: flex; flex-direction: column; gap: 20px; }
  .tt-row { display: flex; gap: 22px; align-items: stretch; padding-bottom: 20px; border-bottom: 1px solid var(--gray-light); }
  .tt-row:last-child { border-bottom: none; padding-bottom: 0; }
  .tt-sit { flex: 0 0 290px; display: flex; flex-direction: column; gap: 8px; background: var(--gray-light);
            border-radius: 10px; padding: 18px 20px; justify-content: center; }
  .tt-sit-tag { font-size: 14px; font-weight: 700; color: var(--gray); }
  .tt-sit-text { font-size: 19px; font-weight: 700; line-height: 1.45; }
  .tt-say { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 14px; }
  .tt-good, .tt-bad { display: flex; gap: 14px; align-items: flex-start; }
  .tt-mark { flex: 0 0 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center;
             justify-content: center; font-size: 16px; font-weight: 700; color: var(--paper); }
  .tt-mark-good { background: var(--accent); }
  .tt-mark-bad { background: var(--gray); }
  .tt-good-text { font-size: 20px; line-height: 1.5; font-weight: 500; padding-top: 2px; }
  .tt-bad-text { font-size: 17px; line-height: 1.45; color: var(--gray); padding-top: 4px; }

  /* ---- 議論収束マップ（discussion-map） ---- */
  .tpl-dmap { display: flex; flex-direction: column; }
  .dm-head { position: relative; height: 22px; margin-bottom: 8px; }
  .dm-head span { position: absolute; font-size: 15px; font-weight: 700; color: var(--gray);
                  text-align: center; letter-spacing: .04em; }
  .dm-head .dh-t { left: 0; width: 26%; }
  .dm-head .dh-d { left: 38%; width: 24%; }
  .dm-head .dh-c { left: 72%; width: 28%; }
  .dm-wrap { position: relative; flex: 1; min-height: 0; }
  .dm-links { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
  .dm-band { position: absolute; top: 0; bottom: 0; }
  .dm-threads { left: 0; width: 26%; }
  .dm-delibs { left: 38%; width: 24%; }
  .dm-conc { left: 72%; width: 28%; }
  .dm-node { position: absolute; left: 0; right: 0; transform: translateY(-50%); z-index: 1;
             background: var(--gray-light); border-radius: 10px; padding: 11px 14px; }
  .dm-threads .dm-node { border-left: 5px solid var(--accent); }
  .dm-delibs .dm-node { background: var(--paper); border: 2px solid var(--gray-light); }
  .dm-node-text { font-size: 16px; line-height: 1.32; font-weight: 600;
                  display: block; max-height: 2.64em; overflow: hidden; }
  /* 判定バッジはカード右上角にフロートさせ、縦の高さを食わない（ノード数が多くても重ならない） */
  .dm-verdict { position: absolute; top: -9px; right: 10px; z-index: 2; font-size: 11px; font-weight: 700;
                border-radius: 999px; padding: 2px 10px; }
  .dm-v-adopt { background: var(--accent); color: var(--paper); }
  .dm-v-hold { background: var(--secondary); color: var(--paper); }
  .dm-v-reject { background: var(--paper); color: var(--gray); box-shadow: inset 0 0 0 1.5px var(--gray); }
  .dm-reject .dm-node-text { color: var(--gray); text-decoration: line-through; }
  .dm-conc .dm-node { top: 50%; background: var(--accent); color: var(--paper); border: none;
                      padding: 22px 26px; box-shadow: 0 6px 20px rgba(37,99,235,.22); }
  .dm-conc-label { display: inline-block; font-size: 14px; font-weight: 700; background: rgba(255,255,255,.22);
                   border-radius: 999px; padding: 4px 14px; margin-bottom: 12px; }
  .dm-conc-text { font-size: 23px; font-weight: 700; line-height: 1.45; }
  .dm-open { margin-top: 14px; padding-top: 12px; border-top: 2px dashed var(--gray-light);
             font-size: 16px; color: var(--gray); line-height: 1.5; display: flex; gap: 12px; align-items: baseline; }
  .dm-open b { flex: 0 0 auto; color: var(--ink); }

  /* ---- 議題タイル（agenda-grid） ---- */
  .tpl-agrid { display: flex; flex-direction: column; }
  .ag-grid { flex: 1; min-height: 0; display: grid; gap: 12px; }
  .ag-card { background: var(--gray-light); border-radius: 12px; padding: 13px 18px; min-height: 0;
             display: flex; flex-direction: column; overflow: hidden; }
  .ag-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 9px; flex-shrink: 0; }
  .ag-no { font-size: 21px; font-weight: 700; color: var(--accent); line-height: 1; }
  .ag-topic { flex: 1; min-width: 0; font-size: 20px; font-weight: 700; line-height: 1.25; }
  .ag-status { flex: 0 0 auto; font-size: 13px; font-weight: 700; border-radius: 999px; padding: 3px 12px; }
  .ag-s-done { background: var(--accent); color: var(--paper); }
  .ag-s-cont { background: var(--secondary); color: var(--paper); }
  .ag-s-hold { background: var(--paper); color: var(--gray); box-shadow: inset 0 0 0 1.5px var(--gray); }
  .ag-s-info { background: var(--accent-light); color: var(--accent); }
  .ag-concl { font-size: 17px; font-weight: 600; line-height: 1.4; margin-bottom: 9px; flex-shrink: 0;
              display: block; max-height: 2.8em; overflow: hidden; }
  .ag-points { list-style: none; min-height: 0; display: flex; flex-direction: column; gap: 5px; }
  .ag-points li { font-size: 14.5px; color: var(--gray); line-height: 1.35; padding-left: 16px; position: relative;
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ag-points li::before { content: ''; position: absolute; left: 0; top: 7px; width: 7px; height: 7px;
                          border-radius: 50%; background: var(--accent); }
  .ag-todo { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 10px; flex-shrink: 0;
             border-top: 1px solid rgba(26,26,26,.08); }
  .ag-owner { font-size: 14px; font-weight: 700; color: var(--ink); background: var(--paper); border-radius: 6px; padding: 3px 10px; }
  .ag-due { font-size: 14px; font-weight: 600; color: var(--accent); background: var(--accent-light); border-radius: 6px; padding: 3px 10px; }
  .ag-summary { margin-top: 14px; padding-top: 12px; border-top: 2px dashed var(--gray-light);
                font-size: 16px; color: var(--gray); display: flex; gap: 12px; align-items: baseline; }
  .ag-summary b { flex: 0 0 auto; color: var(--ink); }

  /* ---- 中心論点・放射（hub） ---- */
  .tpl-hub { display: flex; }
  .hub-wrap { position: relative; flex: 1; min-height: 0; }
  .hub-links { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
  .hub-sat { position: absolute; transform: translate(-50%, -50%); z-index: 1; width: 23%;
             background: var(--gray-light); border-radius: 10px; border-top: 4px solid var(--accent);
             padding: 12px 14px; text-align: center; }
  .hub-sat-head { font-size: 18px; font-weight: 700; line-height: 1.3; }
  .hub-sat-body { margin-top: 6px; font-size: 14px; color: var(--gray); line-height: 1.4;
                  display: block; max-height: 2.8em; overflow: hidden; }
  .hub-center { position: absolute; transform: translate(-50%, -50%); z-index: 2; width: 30%;
                background: var(--accent); color: var(--paper); border-radius: 16px; padding: 24px 26px;
                text-align: center; box-shadow: 0 8px 28px rgba(37,99,235,.28); }
  .hub-c-label { display: inline-block; font-size: 14px; font-weight: 700; background: rgba(255,255,255,.22);
                 border-radius: 999px; padding: 4px 14px; margin-bottom: 10px; }
  .hub-c-text { font-size: 23px; font-weight: 700; line-height: 1.45; }

  /* ---- エグゼクティブ・ダッシュボード（dashboard） ---- */
  .tpl-dashboard { display: flex; flex-direction: column; gap: 11px; }
  .db-card-title { font-size: 15px; font-weight: 700; color: var(--ink); margin-bottom: 5px; }
  /* サマリー帯 */
  .db-summary { flex-shrink: 0; display: flex; gap: 16px; align-items: stretch;
                background: var(--accent-light); border-radius: 12px; padding: 9px 18px; }
  .db-sum-main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .db-sum-label { font-size: 13px; font-weight: 700; color: var(--accent); letter-spacing: .06em; }
  .db-sum-text { font-size: 18px; font-weight: 600; line-height: 1.35; color: var(--ink);
                 display: block; max-height: 2.7em; overflow: hidden; }
  .db-status { flex: 0 0 auto; min-width: 124px; display: flex; flex-direction: column; align-items: center;
               justify-content: center; border-radius: 10px; padding: 6px 16px; color: var(--paper); }
  .db-status-cap { font-size: 12px; font-weight: 700; opacity: .9; }
  .db-status-val { font-size: 25px; font-weight: 700; line-height: 1.15; }
  .db-status.db-ok { background: var(--ok); } .db-status.db-warn { background: var(--warn); }
  .db-status.db-danger { background: var(--danger); } .db-status.db-neutral { background: var(--gray); }
  /* KPI スコアカード */
  .db-kpis { flex-shrink: 0; display: grid; gap: 11px; }
  .db-kpi { background: var(--paper); border: 2px solid var(--gray-light); border-radius: 12px;
            padding: 7px 15px; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .db-kpi-label { font-size: 13px; font-weight: 700; color: var(--gray);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .db-kpi-val { font-size: 27px; font-weight: 700; line-height: 1.05; color: var(--ink); }
  .db-kpi-unit { font-size: 16px; font-weight: 600; color: var(--gray); margin-left: 3px; }
  .db-kpi-delta { font-size: 15px; font-weight: 700; }
  .db-kpi-delta.db-ok { color: var(--ok); } .db-kpi-delta.db-warn { color: var(--warn); }
  .db-kpi-delta.db-danger { color: var(--danger); } .db-kpi-delta.db-neutral { color: var(--gray); }
  /* メイン2分割 */
  .db-split { flex: 1; min-height: 0; display: grid; gap: 13px; }
  .db-chart, .db-projects { background: var(--paper); border: 2px solid var(--gray-light); border-radius: 12px;
                            padding: 10px 16px; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  .db-chart-wrap { flex: 1; min-height: 0; display: flex; align-items: center; }
  .db-chart-wrap svg { width: 100%; height: auto; max-height: 100%; }
  .db-projects { gap: 3px; overflow: hidden; }
  .db-proj { display: flex; flex-direction: column; gap: 2px; }
  .db-proj-top { display: flex; align-items: center; gap: 8px; }
  .db-dot { flex: 0 0 auto; width: 11px; height: 11px; border-radius: 50%; }
  .db-proj-name { flex: 1; min-width: 0; font-size: 16px; font-weight: 700;
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .db-proj-pct { flex: 0 0 auto; font-size: 15px; font-weight: 700; color: var(--ink); }
  .db-bar { height: 7px; background: var(--gray-light); border-radius: 999px; overflow: hidden; }
  .db-bar-fill { height: 100%; border-radius: 999px; }
  .db-dot.db-ok, .db-bar-fill.db-ok { background: var(--ok); }
  .db-dot.db-warn, .db-bar-fill.db-warn { background: var(--warn); }
  .db-dot.db-danger, .db-bar-fill.db-danger { background: var(--danger); }
  .db-dot.db-neutral, .db-bar-fill.db-neutral { background: var(--accent); }
  .db-proj-note { font-size: 12.5px; color: var(--gray); line-height: 1.25;
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* フッター帯（注目・次アクション） */
  .db-foot { flex-shrink: 0; display: flex; align-items: center; gap: 14px;
             background: var(--gray-light); border-radius: 10px; padding: 9px 16px; }
  .db-foot-label { flex: 0 0 auto; font-size: 14px; font-weight: 700; color: var(--ink); }
  .db-foot-items { flex: 1; min-width: 0; display: flex; gap: 10px; flex-wrap: wrap; }
  .db-foot-item { font-size: 14.5px; color: var(--ink); background: var(--paper); border-radius: 8px;
                  padding: 5px 12px; border-left: 4px solid var(--accent); }

  /* ---- 印刷: A4横1枚に1スライド（ブラウザの印刷から PDF 化できる） ---- */
  @media print {
    ${buildPrintCss(width, height)}
  }
  `;
}

// A4 ランドスケープ（297×210mm）に1スライドを収めるための計算。
// px→mm は 96dpi 換算。zoom でレイアウトごと縮小し、@page の余白で上下センタリングする。
function buildPrintCss(width, height) {
  const MM = 25.4 / 96;
  const slideW = width * MM;
  const slideH = height * MM;
  const scale = Math.min(287 / slideW, 200 / slideH); // 左右・上下に最低5mmの余白
  const scaledH = slideH * scale;
  const vMargin = Math.max(Math.floor((210 - scaledH) / 2) - 1, 0);
  return `
    @page { size: A4 landscape; margin: ${vMargin}mm 0; }
    body { background: none; padding: 0; gap: 0; margin: 0; display: block;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .slide { box-shadow: none; zoom: ${scale.toFixed(4)}; margin: 0 auto;
             page-break-after: always; break-inside: avoid; }
    .slide:last-child { page-break-after: auto; }
  `;
}

// opts.only: 指定インデックスのスライドだけ出力（ページ番号は全体基準のまま）
// opts.bare: 余白・影なし（スクリーンショット用）
function renderDeck(deck, opts = {}) {
  // HTML is a free-flowing preview: capacity limits apply to PPTX output only.
  const errors = validateDeck(deck, { limits: false });
  if (errors.length) {
    const err = new Error('deck の検証に失敗しました:\n  - ' + errors.join('\n  - '));
    err.validation = errors;
    throw err;
  }
  const aspect = deck.aspect || '16:9';
  const { width, height } = ASPECTS[aspect];
  const total = deck.slides.length;
  const deckTitle = deck.title || '';
  // deck.lang で言語別フォントスタックを選ぶ（既定 ja）。
  const lang = deck.lang || 'ja';
  const fontStack = FONT_STACKS[lang] || FONT_STACKS.ja;
  const htmlLang = lang === 'zh' ? 'zh-Hans' : lang;

  const slides = deck.slides
    .map((slide, i) => {
      if (opts.only !== undefined && i !== opts.only) return '';
      const t = getTemplate(slide.template);
      const fields = normalizeFields(t, slide.fields);
      const body = t.render(fields, { aspect, colors: COLORS });
      const showFooter = !['title', 'section', 'closing'].includes(t.name);
      const footer = showFooter
        ? `<footer class="sl-footer"><span>${esc(deckTitle)}</span><span>${i + 1} / ${total}</span></footer>`
        : '';
      return `<section class="slide" id="slide-${i + 1}" data-template="${t.name}">${body}${footer}</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${width + 56}">
<meta name="generator" content="slidemaker">
<title>${esc(deckTitle || 'Slides')}</title>
<style>${buildCss(width, height, opts.bare, fontStack)}</style>
</head>
<body>
${slides}
</body>
</html>`;
}

module.exports = { renderDeck, validateDeck, deckSchema };
