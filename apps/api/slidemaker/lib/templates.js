'use strict';

const { renderChart } = require('./chart');
const { loadTemplate } = require('./template-loader');
const { limitOf, describe, isMedia, generationEnabled } = require('./limits');
const { catalogEntry } = require('./catalog');

// =============================================================
// テンプレート定義
//
// 各テンプレートは { name, label, description, fields, render } を持つ。
// fields のメタデータは CLI のヘルプ・JSON Schema・Web UI のフォーム生成の
// 3箇所すべてで使われる（ここを直せば全部に反映される）。
//
// フィールド型:
//   text     : 1行テキスト
//   textarea : 複数行テキスト
//   select   : 選択（options 必須）
//   lines    : 文字列の配列（UI では1行=1項目）
//   csv      : 文字列の配列（UI ではカンマ区切り）
//   numbers  : 数値の配列（UI ではカンマ区切り）
//   pairs    : {heading, body} の配列（UI では「見出し :: 本文」を1行ずつ）
//   steps    : {label, heading, body} の配列（UI では「ラベル :: 見出し :: 本文」）
//   callouts : {index, text} の配列（UI では「データ番号 :: 吹き出し文」。番号は0始まり）
//   raw      : ネストした配列/オブジェクトをそのまま受ける（discussion-map のノード・リンク等）
// JSON で渡す場合、配列型はネイティブの配列を推奨（"a :: b" 形式の文字列配列も受理する）。
// =============================================================

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- フィールド値の正規化（文字列でも配列でも受け付ける） ----

function toArray(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v;
  return String(v)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitParts(s, n) {
  const parts = String(s).split('::').map((p) => p.trim());
  while (parts.length < n) parts.push('');
  return parts;
}

function normalizeField(type, v) {
  switch (type) {
    case 'lines':
      return toArray(v).map((x) => (typeof x === 'object' ? String(x.text ?? '') : String(x)));
    case 'csv':
      if (Array.isArray(v)) return v.map(String);
      return String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    case 'numbers':
      if (Array.isArray(v)) return v.map(Number).filter((n) => !Number.isNaN(n));
      return String(v ?? '').split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    case 'pairs':
      return toArray(v).map((x) => {
        if (typeof x === 'object') return { heading: String(x.heading ?? ''), body: String(x.body ?? '') };
        const [heading, body] = splitParts(x, 2);
        return { heading, body };
      });
    case 'steps':
      return toArray(v).map((x) => {
        if (typeof x === 'object')
          return { label: String(x.label ?? ''), heading: String(x.heading ?? ''), body: String(x.body ?? '') };
        const [label, heading, body] = splitParts(x, 3);
        return { label, heading, body };
      });
    case 'callouts':
      return toArray(v).map((x) => {
        if (typeof x === 'object') return { index: Number(x.index ?? 0), text: String(x.text ?? '') };
        const [index, text] = splitParts(x, 2);
        return { index: Number(index) || 0, text };
      });
    case 'raw':
      // ネストした配列/オブジェクトをそのまま通す（discussion-map のノード・リンク等）。
      return v == null ? null : v;
    case 'rows':
      // Table rows: arrays of cells (preferred) or legacy "a | b | c" strings.
      return toArray(v).map((row) =>
        Array.isArray(row) ? row.map((c) => String(c ?? '').trim()) : String(row).split('|').map((c) => c.trim()));
    default:
      return v == null ? '' : String(v);
  }
}

// objects: arrays of small records whose properties are declared on the field spec.
// Legacy "a | b | c" strings are accepted through the spec's parse().
function normalizeObjects(spec, v) {
  return toArray(v).map((item) => {
    const raw = typeof item === 'object' && item !== null ? item : spec.parse ? spec.parse(String(item)) : {};
    const out = {};
    for (const [key, prop] of Object.entries(spec.props)) {
      const value = raw[key];
      if (prop.type === 'number') out[key] = value === '' || value == null || Number.isNaN(Number(value)) ? null : Number(value);
      else if (prop.type === 'numbers') out[key] = Array.isArray(value) ? value.map(Number).filter((n) => !Number.isNaN(n)) : [];
      else out[key] = value == null ? '' : String(value);
    }
    return out;
  });
}

function normalizeFields(template, fields) {
  const out = {};
  for (const spec of template.fields) {
    const value = fields ? fields[spec.key] : undefined;
    out[spec.key] = spec.type === 'objects' ? normalizeObjects(spec, value) : normalizeField(spec.type, value);
  }
  return out;
}

const splitBar = (s) => String(s).split('|').map((x) => x.trim());

// ---- 共通パーツ ----

const slideHeader = (title, lead) =>
  `<header class="sl-header"><h2>${esc(title)}</h2>${lead ? `<p class="sl-lead">${esc(lead)}</p>` : ''}</header>`;

const listItems = (items) => items.map((it) => `<li>${esc(it)}</li>`).join('');

// チェンジログの種別ラベル → バッジの色クラス（changelog-list / change-detail で共用）。
// 新機能=accent / 改善=secondary / 廃止=ink / それ以外（仕様変更など）=accent枠 にマップする。
const changeClass = (label) => {
  const s = String(label || '');
  if (/廃止|終了|削除|停止|deprecat|remov|sunset/i.test(s)) return 'cl-dep';
  if (/新機能|新規|追加|new|リリース/i.test(s)) return 'cl-new';
  if (/改善|改良|向上|強化|更新|improve|enhance/i.test(s)) return 'cl-imp';
  return 'cl-chg'; // 仕様変更・変更・その他
};

// ---- テンプレート本体 ----

const TEMPLATES = [
  {
    name: 'title',
    label: '表紙',
    description: '資料の表紙。タイトル・サブタイトル・発表者・日付。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '52px・全角22字/行・2行まで'},
      { key: 'subtitle', type: 'text', label: 'サブタイトル', fit: '25px・全角46字/行・2行まで'},
      { key: 'presenter', type: 'text', label: '発表者 / 部署', fit: '19px・1行'},
      { key: 'date', type: 'text', label: '日付', fit: '19px・1行'},
    ],
    render: (f) => `
      <div class="tpl-title">
        <div class="title-rule"></div>
        <h1>${esc(f.title)}</h1>
        ${f.subtitle ? `<p class="title-sub">${esc(f.subtitle)}</p>` : ''}
        <div class="title-meta">
          ${f.presenter ? `<span>${esc(f.presenter)}</span>` : ''}
          ${f.date ? `<span>${esc(f.date)}</span>` : ''}
        </div>
      </div>`,
  },

  {
    name: 'section',
    label: '中扉（セクション区切り）',
    description: '章の区切りページ。章番号と章タイトル。全章リストを渡すと現在地ナビを表示。',
    fields: [
      { key: 'number', type: 'text', label: '章番号', fit: '110px・4字まで。chapters 併用時は現在の章の番号（1始まり）'},
      { key: 'title', type: 'text', label: '章タイトル', required: true, fit: '48px・全角20字/行・2行まで'},
      { key: 'subtitle', type: 'text', label: '補足', fit: '25px・全角40字・1行'},
      { key: 'chapters', type: 'lines', label: '全章リスト（任意。右側に現在地ナビを表示し number の章を強調）', fit: '20px・各全角14字・1行 / 3〜6章'},
    ],
    render: (f) => {
      const current = parseInt(f.number, 10) || 0;
      const nav = f.chapters.length
        ? `<div class="sec-nav">${f.chapters
            .map(
              (c, i) =>
                `<div class="sec-nav-item ${i + 1 === current ? 'cur' : ''}"><span class="sec-nav-no">${String(i + 1).padStart(2, '0')}</span><span>${esc(c)}</span></div>`
            )
            .join('')}</div>`
        : '';
      return `
      <div class="tpl-section">
        ${f.number ? `<div class="section-no">${esc(f.number)}</div>` : ''}
        <div class="sec-main">
          <h1>${esc(f.title)}</h1>
          ${f.subtitle ? `<p class="title-sub">${esc(f.subtitle)}</p>` : ''}
        </div>
        ${nav}
      </div>`;
    },
  },

  {
    name: 'agenda',
    label: 'アジェンダ',
    description: '目次。番号付きの項目リスト。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字・1行'},
      { key: 'items', type: 'lines', label: '項目（1行1項目）', required: true, fit: '26px・各全角30字・1行 / 3〜7項目'},
    ],
    render: (f) => `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-agenda">
        <ol>${f.items.map((it, i) => `<li><span class="agenda-no">${String(i + 1).padStart(2, '0')}</span><span>${esc(it)}</span></li>`).join('')}</ol>
      </div>`,
  },

  {
    name: 'bullets',
    label: '箇条書き',
    description: '汎用の説明ページ。リード文と「見出し+本文」。images を渡すと挿絵付きの横並びブロックになり、課題提起などにインパクトを持たせられる（key-points は画像が主役・本文最小、bullets は挿絵を添えつつ文章で説明する用途）。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      { key: 'lead', type: 'textarea', label: 'リード文（要点の一文）', fit: '21px・全角54字・1行推奨'},
      {
        key: 'items', type: 'pairs', label: '箇条書き（見出し :: 本文）', required: true,
        fit: '縦リスト時: 見出し26px・全角40字/1行、本文20px・全角57字/行・2行まで / 3〜4項目。横ブロック時(images指定): 見出し全角14字、本文全角20字/行・3行まで / 3個推奨',
      },
      {
        key: 'images', type: 'lines', label: '各項目の挿絵（1行1項目。パス/URL、または "-" でプレースホルダー矩形）。指定すると横並びブロックレイアウトになる',
        fit: '表示領域 ブロック幅×150px。空なら従来の縦リスト',
      },
    ],
    render: (f) => {
      if (f.images.length) {
        const visual = (i) => {
          const src = (f.images[i] || '').trim();
          return src && src !== '-'
            ? `<img src="${esc(src)}" alt="">`
            : `<div class="bc-ph">挿絵 / アイコン<br>（あとで差し替え）</div>`;
        };
        return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-bullets b-cards">
        ${f.items
          .map(
            (p, i) => `
        <div class="b-card">
          <div class="bc-visual">${visual(i)}</div>
          <div class="b-head">${esc(p.heading)}</div>
          ${p.body ? `<div class="b-body">${esc(p.body)}</div>` : ''}
        </div>`
          )
          .join('')}
      </div>`;
      }
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-bullets">
        <ul>${f.items.map((p) => `<li><div class="b-head">${esc(p.heading)}</div>${p.body ? `<div class="b-body">${esc(p.body)}</div>` : ''}</li>`).join('')}</ul>
      </div>`;
    },
  },

  {
    name: 'as-is-to-be',
    label: 'As-Is / To-Be',
    description: '現状とあるべき姿を左右に並べ、矢印で変化を示す。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      { key: 'asIsLabel', type: 'text', label: '左側ラベル', fit: '22px・全角12字'},
      { key: 'asIsImage', type: 'text', label: 'As-Is の挿絵（パス/URL、または "-" でプレースホルダー。空なら画像なし）', fit: '表示領域 パネル幅×175px'},
      { key: 'asIsItems', type: 'lines', label: '現状の項目（1行1項目）', required: true, fit: '20px・各全角23字/行・2行まで / 3〜4項目'},
      { key: 'toBeLabel', type: 'text', label: '右側ラベル', fit: '22px・全角12字'},
      { key: 'toBeImage', type: 'text', label: 'To-Be の挿絵（パス/URL、または "-" でプレースホルダー。空なら画像なし）', fit: '表示領域 パネル幅×175px'},
      { key: 'toBeItems', type: 'lines', label: 'あるべき姿の項目（1行1項目）', required: true, fit: '20px・各全角23字/行・2行まで / 3〜4項目'},
      { key: 'transition', type: 'text', label: '矢印に添える一言', fit: '17px・全角8字まで（幅90pxで折返し）'},
    ],
    render: (f) => {
      const visual = (src, cls) => {
        const s = (src || '').trim();
        if (!s) return '';
        const inner = s !== '-' ? `<img src="${esc(s)}" alt="">` : `<div class="ab-ph ${cls}">挿絵<br>（あとで差し替え）</div>`;
        return `<div class="ab-visual">${inner}</div>`;
      };
      return `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-asistobe">
        <div class="ab-panel ab-asis">
          <div class="ab-label">${esc(f.asIsLabel || 'As-Is（現状）')}</div>
          ${visual(f.asIsImage, 'ab-ph-asis')}
          <ul>${listItems(f.asIsItems)}</ul>
        </div>
        <div class="ab-arrow">
          <svg viewBox="0 0 60 60" width="60" height="60"><path d="M8 18 L36 18 L36 6 L56 30 L36 54 L36 42 L8 42 Z" fill="currentColor"/></svg>
          ${f.transition ? `<div class="ab-transition">${esc(f.transition)}</div>` : ''}
        </div>
        <div class="ab-panel ab-tobe">
          <div class="ab-label">${esc(f.toBeLabel || 'To-Be（あるべき姿）')}</div>
          ${visual(f.toBeImage, 'ab-ph-tobe')}
          <ul>${listItems(f.toBeItems)}</ul>
        </div>
      </div>`;
    },
  },

  {
    name: 'big-number',
    label: 'ビッグナンバー',
    description: '大きな数字を右に見せ、左でその意味を解説する。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      { key: 'value', type: 'text', label: '数字', required: true, fit: '150px・半角4字/全角3字まで'},
      { key: 'unit', type: 'text', label: '単位', fit: '60px・2字まで'},
      { key: 'caption', type: 'text', label: '数字の説明（数字の下）', fit: '21px・全角24字・1行'},
      { key: 'description', type: 'textarea', label: '左側の解説文', required: true, fit: '23px・全角26字/行・4行まで'},
      { key: 'points', type: 'lines', label: '補足ポイント（1行1項目）', fit: '20px・各全角28字・1行 / 3項目まで'},
    ],
    render: (f) => `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-bignumber">
        <div class="bn-left">
          <p class="bn-desc">${esc(f.description)}</p>
          ${f.points.length ? `<ul class="bn-points">${listItems(f.points)}</ul>` : ''}
        </div>
        <div class="bn-right">
          <div class="bn-value">${esc(f.value)}<span class="bn-unit">${esc(f.unit)}</span></div>
          ${f.caption ? `<div class="bn-caption">${esc(f.caption)}</div>` : ''}
        </div>
      </div>`,
  },

  {
    name: 'chart',
    label: 'チャート + 注釈',
    description: '棒/折れ線/横棒ランキング/ウォーターフォール。1点強調・差分矢印・右カラムの示唆で「データに主張を語らせる」。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。チャートの結論をタイトルで言い切る'},
      { key: 'chartType', type: 'select', label: 'グラフ種別（bar=縦棒 / line=折れ線 / hbar=横棒ランキング / waterfall=増減の内訳）', options: ['bar', 'line', 'hbar', 'waterfall']},
      { key: 'labels', type: 'csv', label: '項目ラベル（カンマ区切り）', required: true, fit: 'bar/line/waterfall: 各全角6字 / hbar: 各全角14字 / 3〜8個'},
      { key: 'values', type: 'numbers', label: '値（カンマ区切り）', required: true, fit: 'labels と同数。waterfall は最初=開始値・以降=増減（負数で減少）・合計列は自動追加'},
      { key: 'unit', type: 'text', label: '単位', fit: '全角4字まで'},
      { key: 'highlight', type: 'text', label: '強調するデータ番号（0始まり・任意）。指定すると他の棒はグレーになる', fit: 'bar / hbar のみ有効'},
      { key: 'delta', type: 'text', label: '差分矢印（開始番号 :: 終了番号 :: ラベル。ラベル省略時は%を自動計算）', fit: 'bar のみ有効。番号は0始まり'},
      { key: 'callouts', type: 'callouts', label: '吹き出し（データ番号 :: 文言、番号は0始まり）', fit: '各全角14字まで・折返し不可 / 2個まで（隣接データ点は重なる）'},
      { key: 'points', type: 'lines', label: '右カラムの示唆（So What。指定するとチャートが左60%になる）', fit: '20px・各全角15字/行・2行まで / 2〜4項目'},
      { key: 'note', type: 'textarea', label: '下部の補足', fit: '19px・全角58字/行・2行まで'},
    ],
    render: (f, ctx) => {
      const cw = ctx && ctx.aspect === '4:3' ? 832 : 1152;
      const split = f.points.length > 0;
      const chartW = split ? Math.round((cw - 40) * 0.6) : cw;
      const hl = f.highlight === '' ? null : Number(f.highlight);
      const dp = f.delta ? String(f.delta).split('::').map((s) => s.trim()) : [];
      const delta = dp.length >= 2 ? { from: Number(dp[0]), to: Number(dp[1]), label: dp[2] || '' } : null;
      const { svg, anchors } = renderChart({
        type: f.chartType || 'bar', labels: f.labels, values: f.values, unit: f.unit,
        width: chartW, height: 460, highlight: Number.isNaN(hl) ? null : hl, delta,
      }, ctx && ctx.colors);
      const bubbles = f.callouts
        .filter((c) => anchors[c.index])
        .map((c) => {
          const a = anchors[c.index];
          const top = Math.max(a.yPct - 11, 4); // 値ラベルの上に吹き出しが乗るよう持ち上げる
          return `<div class="callout" style="left:${a.xPct}%;top:${top}%">${esc(c.text)}</div>`;
        })
        .join('');
      const pointsHtml = split
        ? `<div class="ch-points"><ul>${f.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`
        : '';
      return `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-chart ${split ? 'ch-split' : ''}">
        <div class="ch-main">
          <div class="chart-wrap">${svg}${bubbles}</div>
          ${f.note ? `<p class="chart-note">${esc(f.note)}</p>` : ''}
        </div>
        ${pointsHtml}
      </div>`;
    },
  },

  {
    name: 'gantt',
    label: 'ガントチャート',
    description: '期間×タスクの工程表。導入スケジュールをタスク単位で見せる（timeline の詳細版）。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      { key: 'columns', type: 'csv', label: '期間ヘッダー（カンマ区切り）', required: true, fit: '17px・各全角5字 / 3〜8列'},
      {
        key: 'tasks', type: 'objects', label: 'タスク（{name, start, end}。start/end は期間列の番号・1始まり）', required: true,
        props: { name: { type: 'string', required: true }, start: { type: 'number', required: true }, end: { type: 'number', required: true } },
        parse: (s) => { const [name, start, end] = splitBar(s); return { name, start, end }; },
      },
      { key: 'note', type: 'textarea', label: '下部の補足', fit: '19px・全角58字/行・2行まで'},
    ],
    render: (f) => {
      const nCols = f.columns.length || 1;
      const cells = f.columns.map(() => '<div class="gt-cell"></div>').join('');
      const head = `<div class="gt-row gt-head"><div class="gt-label"></div><div class="gt-track">${f.columns
        .map((c) => `<div class="gt-cell">${esc(c)}</div>`)
        .join('')}</div></div>`;
      const rows = f.tasks
        .map((t) => {
          const { name, start: s, end: e } = t;
          const start = Math.min(Math.max(Number(s) || 1, 1), nCols);
          const end = Math.min(Math.max(Number(e) || start, start), nCols);
          const left = ((start - 1) / nCols) * 100;
          const w = ((end - start + 1) / nCols) * 100;
          return `<div class="gt-row"><div class="gt-label">${esc(name)}</div><div class="gt-track">${cells}<div class="gt-bar" style="left:calc(${left}% + 5px);width:calc(${w}% - 10px)"></div></div></div>`;
        })
        .join('');
      return `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-gantt">
        <div class="gt">${head}${rows}</div>
        ${f.note ? `<p class="gt-note">${esc(f.note)}</p>` : ''}
      </div>`;
    },
  },

  {
    name: 'image-text',
    label: '画像 + 解説',
    description: '右に画像、左に解説。スクリーンショットや図版を見せながら説明する。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字・1行'},
      { key: 'lead', type: 'textarea', label: '左側の解説文', fit: '21px・全角25字/行・4行まで'},
      { key: 'points', type: 'lines', label: '補足ポイント（1行1項目）', fit: '20px・各全角26字/行・2行まで / 4項目まで'},
      { key: 'imageSrc', type: 'text', label: '画像（パス/URL/data URI。空または "-" でプレースホルダを表示）', fit: '表示領域 556×460px（16:9）/ 396×460px（4:3）・object-fit:cover'},
      { key: 'imageAlt', type: 'text', label: '画像の代替テキスト'},
      { key: 'imageNote', type: 'text', label: 'プレースホルダに表示する指示（何の画像を入れるか）', fit: '18px・全角20字'},
      { key: 'caption', type: 'text', label: '画像キャプション', fit: '17px・全角30字・1行'},
    ],
    render: (f, ctx) => {
      const slotW = ctx && ctx.aspect === '4:3' ? 396 : 556;
      const img = f.imageSrc && f.imageSrc !== '-'
        ? `<img src="${esc(f.imageSrc)}" alt="${esc(f.imageAlt)}">`
        : `<div class="it-placeholder">${f.imageNote ? `ここに：${esc(f.imageNote)}<br>` : '画像プレースホルダ<br>'}推奨 ${slotW}×460px（またはこの比率の倍数）</div>`;
      return `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-imagetext">
        <div class="it-left">
          ${f.lead ? `<p class="it-lead">${esc(f.lead)}</p>` : ''}
          ${f.points.length ? `<ul class="bn-points">${listItems(f.points)}</ul>` : ''}
        </div>
        <div class="it-right">
          <div class="it-img">${img}</div>
          ${f.caption ? `<div class="it-caption">${esc(f.caption)}</div>` : ''}
        </div>
      </div>`;
    },
  },

  {
    name: 'comparison',
    label: '比較（2〜3カラム)',
    description: '選択肢やプランを横並びで比較する。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      { key: 'col1Heading', type: 'text', label: 'カラム1見出し', required: true, fit: '23px・全角14字（3列時）'},
      { key: 'col1Items', type: 'lines', label: 'カラム1項目（1行1項目）', required: true, fit: '19px・各全角19字/行（3列時。2列なら29字）・2行まで / 3〜6項目・全カラム同数推奨'},
      { key: 'col2Heading', type: 'text', label: 'カラム2見出し', required: true, fit: '23px・全角14字（3列時）'},
      { key: 'col2Items', type: 'lines', label: 'カラム2項目（1行1項目）', required: true, fit: 'col1Items と同じ'},
      { key: 'col3Heading', type: 'text', label: 'カラム3見出し（任意）', fit: '23px・全角14字'},
      { key: 'col3Items', type: 'lines', label: 'カラム3項目（1行1項目）', fit: 'col1Items と同じ'},
      { key: 'highlight', type: 'select', label: '強調するカラム（任意）', options: ['', '1', '2', '3']},
    ],
    render: (f) => {
      const cols = [
        { heading: f.col1Heading, items: f.col1Items },
        { heading: f.col2Heading, items: f.col2Items },
        { heading: f.col3Heading, items: f.col3Items },
      ].filter((c) => c.heading);
      return `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-comparison cols-${cols.length}">
        ${cols
          .map(
            (c, i) => `
          <div class="cmp-col ${String(i + 1) === f.highlight ? 'cmp-highlight' : ''}">
            <div class="cmp-head">${esc(c.heading)}</div>
            <ul>${listItems(c.items)}</ul>
          </div>`
          )
          .join('')}
      </div>`;
    },
  },

  {
    name: 'key-points',
    label: 'キーポイント（カード）',
    description: '要点を2〜4枚のカードで横に並べる。カード上部に画像/アイコンのスロットを置ける（文字を詰め込まず絵に語らせる）。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      {
        key: 'points', type: 'pairs', label: 'ポイント（見出し :: 本文）', required: true,
        fit: '見出し24px・全角14字（3枚時）、本文19px・全角19字/行・画像あり時2行（約35字）/なし時4行 / 2〜4枚',
      },
      {
        key: 'images', type: 'lines', label: '各カードの画像（1行1カード。パス/URL、または "-" でプレースホルダー矩形）',
        fit: '表示領域 カード幅×180px・object-fit:cover。空なら文字のみの従来レイアウト',
      },
    ],
    render: (f) => {
      const visual = (i) => {
        const src = (f.images[i] || '').trim();
        if (!f.images.length) return '';
        const inner =
          src && src !== '-'
            ? `<img src="${esc(src)}" alt="">`
            : `<div class="kp-ph">画像 / アイコン<br>（あとで差し替え）</div>`;
        return `<div class="kp-visual"><span class="kp-no-badge">${String(i + 1).padStart(2, '0')}</span>${inner}</div>`;
      };
      return `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-keypoints">
        ${f.points
          .map(
            (p, i) => `
        <div class="kp-card">
          ${visual(i) || `<div class="kp-no">${String(i + 1).padStart(2, '0')}</div>`}
          <div class="kp-head">${esc(p.heading)}</div>
          <div class="kp-body">${esc(p.body)}</div>
        </div>`
          )
          .join('')}
      </div>`;
    },
  },

  {
    name: 'timeline',
    label: 'タイムライン / ロードマップ',
    description: '導入ステップやスケジュールを時系列で示す。lanes / bands を渡すと、タイムラインの下に「誰がどの時期に担当するか」の責任分解レーンを表示できる。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      {
        key: 'milestones', type: 'steps', label: 'マイルストーン（時期 :: 見出し :: 説明）', required: true,
        fit: '時期は全角10字、見出し21px・全角13字（4個時）、説明17px・全角16字/行・3行まで / 3〜5個',
      },
      { key: 'lanes', type: 'csv', label: '責任分解レーン名（カンマ区切り。誰が担当するかの主体。任意・1〜3レーン）', fit: '16px・各全角8字。指定すると下段に役割分担グリッドを表示'},
      {
        key: 'bands', type: 'objects',
        label: '担当区間（{lane, start, end, label}。lane=レーン番号、start/end=マイルストーン番号、いずれも1始まり）',
        props: { lane: { type: 'number', required: true }, start: { type: 'number', required: true }, end: { type: 'number', required: true }, label: { type: 'string' } },
        parse: (s) => { const [lane, start, end, ...rest] = splitBar(s); return { lane, start, end, label: rest.join('|').trim() }; },
      },
    ],
    render: (f) => {
      const ms = f.milestones;
      const n = ms.length || 1;
      const track = `
        <div class="tl-track">
        ${ms
          .map(
            (m) => `
          <div class="tl-item">
            <div class="tl-label">${esc(m.label)}</div>
            <div class="tl-dot"></div>
            <div class="tl-head">${esc(m.heading)}</div>
            <div class="tl-body">${esc(m.body)}</div>
          </div>`
          )
          .join('')}
        </div>`;
      const hasLanes = f.lanes.length && f.bands.length;
      if (!hasLanes) {
        return `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-timeline">${track}</div>`;
      }
      const parsed = f.bands
        .map((b) => {
          const li = (Number(b.lane) || 1) - 1;
          const start = Math.min(Math.max(Number(b.start) || 1, 1), n);
          const end = Math.min(Math.max(Number(b.end) || start, start), n);
          return { li, start, end, label: b.label };
        })
        .filter((b) => b.li >= 0 && b.li < f.lanes.length);
      const laneRows = f.lanes
        .map((name, li) => {
          const bars = parsed
            .filter((b) => b.li === li)
            .map((b) => {
              const left = ((b.start - 1) / n) * 100;
              const w = ((b.end - b.start + 1) / n) * 100;
              return `<div class="rl-bar rl-bar-${li === 0 ? 'a' : 'b'}" style="left:calc(${left}% + 4px);width:calc(${w}% - 8px)">${esc(b.label)}</div>`;
            })
            .join('');
          const cells = ms.map(() => '<div class="rl-cell"></div>').join('');
          return `<div class="rl-row"><div class="rl-name rl-name-${li === 0 ? 'a' : 'b'}">${esc(name)}</div><div class="rl-track">${cells}${bars}</div></div>`;
        })
        .join('');
      return `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-timeline tl-with-lanes">
        <div class="tl-top">${track}</div>
        <div class="rl-wrap">
          <div class="rl-caption">役割分担</div>
          ${laneRows}
        </div>
      </div>`;
    },
  },

  {
    name: 'quote',
    label: '顧客の声（引用）',
    description: '大きな引用文と発言者で語らせる。導入事例の説得力の核に。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル（空なら引用文を全面表示）', fit: '33px・全角33字・1行'},
      { key: 'quote', type: 'textarea', label: '引用文（カギ括弧は不要）', required: true, fit: '34px・全角28字/行・4行まで'},
      { key: 'name', type: 'text', label: '発言者名', required: true, fit: '23px・全角15字・1行'},
      { key: 'role', type: 'text', label: '所属・役職', fit: '18px・全角30字・1行'},
      { key: 'imageSrc', type: 'text', label: 'お客様のロゴ / 写真（パス/URL。"-" でプレースホルダ表示。指定すると左に大きく配置）', fit: '左カラム 約360px幅×全高・ロゴは contain / 写真は cover'},
      { key: 'imageMode', type: 'select', label: '左カラム画像の表示方法（logo=余白付きで全体表示 / photo=切り抜き）', options: ['logo', 'photo']},
    ],
    render: (f) => {
      const hasImg = f.imageSrc && f.imageSrc !== '';
      const mode = f.imageMode === 'photo' ? 'photo' : 'logo';
      const panel = !hasImg
        ? ''
        : `<div class="q-figure q-figure-${mode}">${
            f.imageSrc === '-'
              ? `<div class="q-fig-ph">お客様のロゴ<br>／ 写真</div>`
              : `<img src="${esc(f.imageSrc)}" alt="${esc(f.name)}">`
          }</div>`;
      const body = `
        <div class="q-body">
          <div class="q-mark">“</div>
          <p class="q-text">${esc(f.quote)}</p>
          <div class="q-attr">
            <div class="q-who">
              <div class="q-name">${esc(f.name)}</div>
              ${f.role ? `<div class="q-role">${esc(f.role)}</div>` : ''}
            </div>
          </div>
        </div>`;
      return `
      ${f.title ? slideHeader(f.title) : ''}
      <div class="sl-body tpl-quote ${hasImg ? 'q-split' : ''}">
        ${panel}
        ${body}
      </div>`;
    },
  },

  {
    name: 'fact-profile',
    label: 'プロフィール表',
    description: '会社概要や導入企業プロフィールをラベル+値の表で示す。右に画像も置ける。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字・1行'},
      { key: 'lead', type: 'textarea', label: 'リード文', fit: '21px・全角54字・1行推奨'},
      {
        key: 'facts', type: 'pairs', label: '項目（ラベル :: 値）', required: true,
        fit: 'ラベル20px・全角7字、値20px・全角24字/行（画像あり時。なしなら全角44字）/ 3〜6行',
      },
      { key: 'logo', type: 'text', label: 'お客様ロゴ（パス/URL。"-" でプレースホルダ表示。空なら非表示）', fit: '右カラム上部・余白付きで全体表示（contain）'},
      { key: 'imageSrc', type: 'text', label: '写真（社屋・利用風景など。パス/URL。"-" でプレースホルダ表示。空なら非表示）', fit: '表示領域 約440×残り高さ・object-fit:cover'},
      { key: 'imageAlt', type: 'text', label: '画像の代替テキスト'},
      { key: 'caption', type: 'text', label: '画像キャプション', fit: '17px・全角30字・1行'},
    ],
    render: (f) => {
      const rows = f.facts
        .map((p) => `<div class="fp-row"><div class="fp-label">${esc(p.heading)}</div><div class="fp-value">${esc(p.body)}</div></div>`)
        .join('');
      const hasLogo = !!f.logo;
      const hasImg = !!f.imageSrc;
      const logoBox = hasLogo
        ? `<div class="fp-logo">${f.logo === '-' ? '<div class="fp-logo-ph">お客様のロゴ</div>' : `<img src="${esc(f.logo)}" alt="${esc(f.title)}">`}</div>`
        : '';
      const imgBox = hasImg
        ? `<div class="it-img">${f.imageSrc === '-' ? '<div class="it-placeholder">写真プレースホルダ<br>（社屋・利用風景など）</div>' : `<img src="${esc(f.imageSrc)}" alt="${esc(f.imageAlt)}">`}</div>`
        : '';
      const right = hasLogo || hasImg
        ? `<div class="fp-side">
            ${logoBox}
            ${imgBox}
            ${f.caption && hasImg ? `<div class="it-caption">${esc(f.caption)}</div>` : ''}
          </div>`
        : '';
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-factprofile${right ? '' : ' fp-full'}">
        <div class="fp-table">${rows}</div>
        ${right}
      </div>`;
    },
  },

  {
    name: 'case-summary',
    label: '事例1枚サマリー',
    description: '導入事例を1枚で立体的に語る。左にお客様ロゴ・プロフィール・活用機能、右に課題→施策→効果の流れと費用対効果のヒーロー数字。voice を渡すと右下に「お客様の声」の引用ブロック（感情に訴える一言）を表示する。logo/profile/features/metric/voice を省くと従来の課題→施策→効果の3カラムにフォールバックする。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角26字・1行（メタタグ併用時）'},
      { key: 'meta', type: 'text', label: 'タイトル横のタグ（業種・規模など）', fit: '17px・全角12字'},
      { key: 'logo', type: 'text', label: 'お客様ロゴ（パス/URL。"-" でプレースホルダ。空なら非表示）', fit: '左カラム上部・余白付きで全体表示（contain）'},
      {
        key: 'profile', type: 'pairs', label: 'プロフィール（ラベル :: 値。左カラムに表示。任意）',
        fit: 'ラベル14px・全角5字、値15px・全角13字 / 2〜4行',
      },
      { key: 'features', type: 'csv', label: '活用した機能（カンマ区切り・チップ表示。任意）', fit: '15px・各全角8字 / 2〜4個'},
      { key: 'challenge', type: 'lines', label: '課題（1行1項目）', required: true, fit: '17px・各全角19字/行・2行まで / 2〜3項目'},
      { key: 'solution', type: 'lines', label: '施策（1行1項目）', required: true, fit: '17px・各全角19字/行・2行まで / 2〜3項目'},
      { key: 'outcome', type: 'lines', label: '効果（1行1項目）', required: true, fit: '17px・各全角19字/行・2行まで / 2〜3項目'},
      { key: 'metric', type: 'text', label: '費用対効果などのヒーロー数字（任意）', fit: '52px・半角8字/全角5字'},
      { key: 'metricLabel', type: 'text', label: 'ヒーロー数字の説明', fit: '18px・全角24字・1行'},
      { key: 'voice', type: 'textarea', label: 'お客様の声（引用。任意・感情に訴えるブロック）', fit: '19px・全角28字/行・2〜3行'},
      { key: 'voiceBy', type: 'text', label: 'お客様の声の発言者（匿名可。役職・部門レベル）', fit: '15px・全角30字・1行'},
    ],
    render: (f) => {
      const arrow = (cls) => `<div class="cs-arrow ${cls || ''}"><svg viewBox="0 0 36 36" width="26" height="26"><path d="M6 11 L20 11 L20 4 L32 18 L20 32 L20 25 L6 25 Z" fill="currentColor"/></svg></div>`;
      const col = (cls, head, items) =>
        `<div class="cs-col ${cls}"><div class="cs-head">${head}</div><ul>${listItems(items)}</ul></div>`;
      const header = `<header class="sl-header"><h2>${esc(f.title)}${f.meta ? `<span class="cs-meta">${esc(f.meta)}</span>` : ''}</h2></header>`;
      const rich = f.logo || f.profile.length || f.features.length || f.metric || f.voice;
      if (!rich) {
        return `
      ${header}
      <div class="sl-body tpl-casesummary">
        ${col('cs-challenge', '課題', f.challenge)}
        ${arrow()}
        ${col('cs-solution', '施策', f.solution)}
        ${arrow()}
        ${col('cs-outcome', '効果', f.outcome)}
      </div>`;
      }
      const logoBox = f.logo
        ? `<div class="cs-logo">${f.logo === '-' ? '<div class="cs-logo-ph">お客様のロゴ</div>' : `<img src="${esc(f.logo)}" alt="${esc(f.title)}">`}</div>`
        : '';
      const profileBox = f.profile.length
        ? `<div class="cs-profile">${f.profile.map((p) => `<div class="cs-pf-row"><span class="cs-pf-label">${esc(p.heading)}</span><span class="cs-pf-value">${esc(p.body)}</span></div>`).join('')}</div>`
        : '';
      const featBox = f.features.length
        ? `<div class="cs-feats"><div class="cs-feats-cap">活用した機能</div><div class="cs-chips">${f.features.map((x) => `<span class="cs-chip">${esc(x)}</span>`).join('')}</div></div>`
        : '';
      const metricBox = f.metric
        ? `<div class="cs-metric"><div class="cs-metric-val">${esc(f.metric)}</div>${f.metricLabel ? `<div class="cs-metric-label">${esc(f.metricLabel)}</div>` : ''}</div>`
        : '';
      const voiceBox = f.voice
        ? `<div class="cs-voice"><span class="cs-voice-mark">&ldquo;</span><p class="cs-voice-text">${esc(f.voice)}</p>${f.voiceBy ? `<div class="cs-voice-by">— ${esc(f.voiceBy)}</div>` : ''}</div>`
        : '';
      return `
      ${header}
      <div class="sl-body tpl-casesummary cs-rich">
        <aside class="cs-aside">
          ${logoBox}
          ${profileBox}
          ${featBox}
        </aside>
        <div class="cs-main">
          <div class="cs-flow">
            ${col('cs-challenge', '課題', f.challenge)}
            ${arrow('cs-arrow-sm')}
            ${col('cs-solution', '施策', f.solution)}
            ${arrow('cs-arrow-sm')}
            ${col('cs-outcome', '効果', f.outcome)}
          </div>
          ${metricBox}
          ${voiceBox}
        </div>
      </div>`;
    },
  },

  {
    name: 'pricing',
    label: '料金プラン',
    description: 'プランカードを2〜3枚横に並べ、価格を大きく見せる。おすすめプランを強調できる。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字・1行'},
      { key: 'plan1Name', type: 'text', label: 'プラン1名', required: true, fit: '24px・全角10字'},
      { key: 'plan1Price', type: 'text', label: 'プラン1価格', required: true, fit: '44px・半角12字/全角6字'},
      { key: 'plan1Note', type: 'text', label: 'プラン1注記（価格の下）', fit: '16px・全角16字・1行'},
      { key: 'plan1Items', type: 'lines', label: 'プラン1機能（1行1項目）', required: true, fit: '18px・各全角16字/行・2行まで / 3〜5項目・全プラン同数推奨'},
      { key: 'plan2Name', type: 'text', label: 'プラン2名（任意）', fit: '24px・全角10字'},
      { key: 'plan2Price', type: 'text', label: 'プラン2価格', fit: '44px・半角12字/全角6字'},
      { key: 'plan2Note', type: 'text', label: 'プラン2注記', fit: '16px・全角16字・1行'},
      { key: 'plan2Items', type: 'lines', label: 'プラン2機能（1行1項目）', fit: 'plan1Items と同じ'},
      { key: 'plan3Name', type: 'text', label: 'プラン3名（任意）', fit: '24px・全角10字'},
      { key: 'plan3Price', type: 'text', label: 'プラン3価格', fit: '44px・半角12字/全角6字'},
      { key: 'plan3Note', type: 'text', label: 'プラン3注記', fit: '16px・全角16字・1行'},
      { key: 'plan3Items', type: 'lines', label: 'プラン3機能（1行1項目）', fit: 'plan1Items と同じ'},
      { key: 'highlight', type: 'select', label: '強調するプラン（任意）', options: ['', '1', '2', '3']},
      { key: 'badge', type: 'text', label: '強調プランのバッジ文言', fit: '16px・全角6字'},
    ],
    render: (f) => {
      const plans = [
        { name: f.plan1Name, price: f.plan1Price, note: f.plan1Note, items: f.plan1Items, no: '1' },
        { name: f.plan2Name, price: f.plan2Price, note: f.plan2Note, items: f.plan2Items, no: '2' },
        { name: f.plan3Name, price: f.plan3Price, note: f.plan3Note, items: f.plan3Items, no: '3' },
      ].filter((p) => p.name);
      return `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-pricing">
        ${plans
          .map((p) => {
            const hl = p.no === f.highlight;
            return `
          <div class="pr-card ${hl ? 'pr-highlight' : ''}">
            ${hl && f.badge ? `<div class="pr-badge">${esc(f.badge)}</div>` : ''}
            <div class="pr-name">${esc(p.name)}</div>
            <div class="pr-price">${esc(p.price)}</div>
            <div class="pr-note">${esc(p.note)}</div>
            <ul>${listItems(p.items)}</ul>
          </div>`;
          })
          .join('')}
      </div>`;
    },
  },

  {
    name: 'stats',
    label: '実績数字（横並び）',
    description: '実績の数字を見せる。chartValues を渡すと成長グラフが主役になり、横に数字カードが並ぶ（実績の伸びを視覚的に訴求）。グラフを省くと数字カードのみの横並び。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字・1行'},
      { key: 'lead', type: 'textarea', label: 'リード文', fit: '21px・全角54字・1行推奨'},
      {
        key: 'stats', type: 'pairs', label: '数字（数値 :: 説明）', required: true,
        fit: 'グラフなし時: 2個84px/3個72px/4個56px。グラフあり時: 右に縦並び（48px）/ 2〜3個推奨',
      },
      { key: 'chartType', type: 'select', label: '成長グラフの種別（空ならグラフなし / bar=縦棒 / line=折れ線）', options: ['', 'bar', 'line']},
      { key: 'chartLabels', type: 'csv', label: 'グラフの項目ラベル（カンマ区切り）', fit: '各全角6字 / 3〜6個'},
      { key: 'chartValues', type: 'numbers', label: 'グラフの値（カンマ区切り。chartLabels と同数）'},
      { key: 'chartUnit', type: 'text', label: 'グラフの単位', fit: '全角4字まで'},
      { key: 'note', type: 'textarea', label: '下部の補足', fit: '19px・全角58字/行・2行まで'},
    ],
    render: (f, ctx) => {
      const card = (s) => `
          <div class="st-card">
            <div class="st-value">${esc(s.heading)}</div>
            <div class="st-caption">${esc(s.body)}</div>
          </div>`;
      const hasChart = f.chartType && f.chartValues.length && f.chartLabels.length;
      if (hasChart) {
        const cw = ctx && ctx.aspect === '4:3' ? 470 : 660;
        const { svg } = renderChart({
          type: f.chartType, labels: f.chartLabels, values: f.chartValues, unit: f.chartUnit,
          width: cw, height: 430, highlight: f.chartValues.length - 1,
        }, ctx && ctx.colors);
        return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-stats st-has-chart">
        <div class="st-row">
          <div class="st-chart"><div class="chart-wrap">${svg}</div></div>
          <div class="st-side">
            ${f.stats.map(card).join('')}
          </div>
        </div>
        ${f.note ? `<p class="st-note">${esc(f.note)}</p>` : ''}
      </div>`;
      }
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-stats">
        <div class="st-grid n-${Math.min(f.stats.length, 4)}">
          ${f.stats.map(card).join('')}
        </div>
        ${f.note ? `<p class="st-note">${esc(f.note)}</p>` : ''}
      </div>`;
    },
  },

  {
    name: 'table',
    label: '汎用テーブル',
    description: 'ヘッダー行+データ行の表。◎○△×の機能比較やスケジュール表・体制表に。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      { key: 'lead', type: 'textarea', label: 'リード文', fit: '21px・全角54字・1行推奨'},
      { key: 'columns', type: 'csv', label: 'ヘッダー行（カンマ区切り）', required: true, fit: '19px・2〜5列（幅は均等割り。1列目のみ左寄せ）'},
      { key: 'rows', type: 'rows', label: 'データ行（セル文字列の配列を1行とする。セル数は columns と同数。◎○△×は自動で大きく表示）', required: true},
      { key: 'highlight', type: 'select', label: '強調する列（任意）', options: ['', '1', '2', '3', '4', '5']},
      { key: 'note', type: 'textarea', label: '下部の補足', fit: '19px・全角58字/行・2行まで'},
    ],
    render: (f) => {
      const hl = Number(f.highlight) || 0;
      const sym = (s) => /^[◎○◯〇●△▲×✕ー−-]$/.test(s);
      const head = f.columns
        .map((c, i) => `<th class="${i + 1 === hl ? 'col-hl' : ''}">${esc(c)}</th>`)
        .join('');
      const body = f.rows
        .map((row) => {
          const cells = [...row];
          while (cells.length < f.columns.length) cells.push('');
          return `<tr>${cells
            .slice(0, f.columns.length)
            .map((c, i) => {
              const cls = [i + 1 === hl ? 'col-hl' : '', sym(c) ? (c === '◎' ? 'td-sym td-best' : 'td-sym') : ''].filter(Boolean).join(' ');
              return `<td class="${cls}">${esc(c)}</td>`;
            })
            .join('')}</tr>`;
        })
        .join('');
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-table">
        <table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
        ${f.note ? `<p class="tbl-note">${esc(f.note)}</p>` : ''}
      </div>`;
    },
  },

  {
    name: 'faq',
    label: 'よくある質問',
    description: 'Q&A形式のスライド。セキュリティ・契約まわりの想定問答に。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字・1行'},
      {
        key: 'items', type: 'pairs', label: 'Q&A（質問 :: 回答）', required: true,
        fit: '質問23px・全角38字・1行、回答19px・全角50字/行・2行まで / 3〜4組',
      },
    ],
    render: (f) => `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-faq">
        <ul>${f.items
          .map(
            (p) => `
        <li>
          <div class="faq-q"><span class="faq-no">Q</span><span>${esc(p.heading)}</span></div>
          <div class="faq-a"><span class="faq-no faq-no-a">A</span><span>${esc(p.body)}</span></div>
        </li>`
          )
          .join('')}</ul>
      </div>`,
  },

  {
    name: 'changelog-list',
    label: '変更一覧（チェンジログ）',
    description: '今回の変更を1枚で一覧化する。種別バッジ（新機能/改善/仕様変更/廃止）と「お客様への影響」を各行に並べ、CSがお客様に告知する入口にする。timings を渡すと各行の右に提供時期チップを表示する。【選ぶ合図】複数の変更点を俯瞰させたいとき。1つの変更を深掘りするなら change-detail。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      { key: 'lead', type: 'textarea', label: 'リード文（要点の一文）', fit: '21px・全角54字・1行推奨'},
      {
        key: 'items', type: 'steps', label: '変更（種別 :: 変更の見出し :: お客様への影響）', required: true,
        fit: '種別は 新機能/改善/仕様変更/廃止 のいずれか（バッジ色が変わる）、見出し21px・全角22字、影響17px・全角30字/行・2行まで / 3〜5件',
      },
      { key: 'timings', type: 'lines', label: '各行の提供時期チップ（1行1件・items と同順・任意）', fit: '15px・全角10字。空の行は表示なし'},
    ],
    render: (f) => {
      const rows = f.items
        .map((it, i) => {
          const when = (f.timings[i] || '').trim();
          return `
        <li class="cl-row">
          <span class="cl-badge ${changeClass(it.label)}">${esc(it.label || '変更')}</span>
          <div class="cl-main">
            <div class="cl-head">${esc(it.heading)}</div>
            ${it.body ? `<div class="cl-impact"><span class="cl-impact-tag">影響</span><span>${esc(it.body)}</span></div>` : ''}
          </div>
          ${when ? `<span class="cl-when">${esc(when)}</span>` : ''}
        </li>`;
        })
        .join('');
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-changelog">
        <ul>${rows}</ul>
      </div>`;
    },
  },

  {
    name: 'change-detail',
    label: '変更カード（影響と対応）',
    description: '1つの変更を「変更点／背景／お客様への影響／必要なご対応／提供時期」の固定枠で説明する。影響と対応を必ず書かせ、CSの説明から抜けを無くす型。【選ぶ合図】1つの変更を深掘りして伝えたいとき。複数を俯瞰するなら changelog-list。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角30字/行・2行まで（バッジ併用時）。結論を言い切るメッセージ文を推奨'},
      { key: 'badge', type: 'text', label: '種別（新機能/改善/仕様変更/廃止。バッジ色が変わる）', fit: '16px・全角6字'},
      { key: 'timing', type: 'text', label: '提供時期', fit: '17px・全角16字'},
      { key: 'scope', type: 'text', label: '対象（プラン・地域など。任意）', fit: '17px・全角22字'},
      { key: 'what', type: 'textarea', label: '変更点（何が変わるか）', required: true, fit: '19px・全角26字/行・3行まで'},
      { key: 'background', type: 'textarea', label: '背景・理由（任意）', fit: '18px・全角26字/行・3行まで'},
      { key: 'impact', type: 'lines', label: 'お客様への影響（1行1項目）', required: true, fit: '19px・各全角24字/行・2行まで / 2〜3項目'},
      { key: 'action', type: 'lines', label: '必要なご対応（1行1項目。不要なら「特別な操作は不要です」）', required: true, fit: '19px・各全角24字/行・2行まで / 1〜3項目'},
    ],
    render: (f) => {
      const chip = f.badge ? `<span class="cd-badge ${changeClass(f.badge)}">${esc(f.badge)}</span>` : '';
      const block = (label, text) =>
        text ? `<div class="cd-block"><div class="cd-label">${label}</div><p>${esc(text)}</p></div>` : '';
      const card = (cls, label, items) =>
        `<div class="cd-card ${cls}"><div class="cd-card-label">${label}</div><ul>${listItems(items)}</ul></div>`;
      const meta = [
        f.timing ? `<span class="cd-meta-item"><b>提供時期</b>${esc(f.timing)}</span>` : '',
        f.scope ? `<span class="cd-meta-item"><b>対象</b>${esc(f.scope)}</span>` : '',
      ].filter(Boolean).join('');
      return `
      <header class="sl-header"><h2>${chip}${esc(f.title)}</h2></header>
      <div class="sl-body tpl-changedetail">
        <div class="cd-cols">
          <div class="cd-context">
            ${block('変更点', f.what)}
            ${block('背景', f.background)}
          </div>
          <div class="cd-key">
            ${card('cd-impact', 'お客様への影響', f.impact)}
            ${card('cd-action', '必要なご対応', f.action)}
          </div>
        </div>
        ${meta ? `<div class="cd-meta">${meta}</div>` : ''}
      </div>`;
    },
  },

  {
    name: 'talk-track',
    label: 'トークスクリプト（お客様対応）',
    description: '「お客様にこう言われたら → こう伝える」を場面ごとに用意する。推奨フレーズと避ける言い方をセットで示し、CSが変更をそのまま自分の言葉で説明できるようにする。FAQ（質問→回答）と違い、状況→言い回しの実演にフォーカスする。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで'},
      { key: 'lead', type: 'textarea', label: 'リード文（要点の一文）', fit: '21px・全角54字・1行推奨'},
      {
        key: 'items', type: 'steps', label: 'スクリプト（場面 :: こう伝える（推奨） :: 避ける言い方）', required: true,
        fit: '場面19px・全角16字/行・2行、推奨フレーズ20px・全角40字/行・2行、避ける言い方17px・全角40字・1行 / 2〜3件',
      },
    ],
    render: (f) => {
      const rows = f.items
        .map(
          (it) => `
        <li class="tt-row">
          <div class="tt-sit"><span class="tt-sit-tag">こんなとき</span><div class="tt-sit-text">${esc(it.label)}</div></div>
          <div class="tt-say">
            <div class="tt-good"><span class="tt-mark tt-mark-good">✓</span><div class="tt-good-text">${esc(it.heading)}</div></div>
            ${it.body ? `<div class="tt-bad"><span class="tt-mark tt-mark-bad">✕</span><div class="tt-bad-text">${esc(it.body)}</div></div>` : ''}
          </div>
        </li>`
        )
        .join('');
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-talktrack">
        <ul>${rows}</ul>
      </div>`;
    },
  },

  {
    name: 'converge',
    label: '収束（根拠→結論）',
    description: '複数の異質な根拠が1つの結論に「集約」される帰納の型。3つが足し合わさって新しい結論に至る（1+1+1＝別物）。【選ぶ合図】右下の箱に入るのが「気づき・洞察」で、積み上げて納得させたいとき。結論先出しなら pyramid、左→右の因果なら drivers を使う。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      { key: 'lead', type: 'textarea', label: 'リード文（要点の一文）', fit: '21px・全角54字・1行推奨'},
      {
        key: 'points', type: 'pairs', label: '根拠（見出し :: 本文）', required: true,
        fit: '見出し22px・全角14字、本文18px・全角20字/行・3行まで / 2〜4個（3個推奨）',
      },
      { key: 'conclusionLabel', type: 'text', label: '結論の接続ラベル', fit: '18px・全角6字'},
      { key: 'conclusion', type: 'textarea', label: '結論（収束する主張）', required: true, fit: '26px・全角40字/行・2行まで'},
    ],
    render: (f) => {
      const n = f.points.length;
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-converge">
        <div class="cv-supports" data-n="${n}">
          ${f.points
            .map(
              (p, i) => `
          <div class="cv-card">
            <span class="cv-no">${String(i + 1).padStart(2, '0')}</span>
            <div class="cv-head">${esc(p.heading)}</div>
            <div class="cv-body">${esc(p.body)}</div>
          </div>`
            )
            .join('')}
        </div>
        <div class="cv-funnel">
          <svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><path d="M22 31 L6 8 M22 31 L38 8 M22 31 L22 5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>
        </div>
        <div class="cv-conclusion">
          ${f.conclusionLabel ? `<span class="cv-tag">${esc(f.conclusionLabel)}</span>` : ''}
          <span class="cv-text">${esc(f.conclusion)}</span>
        </div>
      </div>`;
    },
  },

  {
    name: 'drivers',
    label: '要因→帰結',
    description: '左の要因（ドライバー）が右の結果・打ち手を「生む」因果／手段–目的の型。矢印は「〜に至る／だからこうする」を意味し、前へ押し出す勢いが出る。【選ぶ合図】右の箱に入るのが「だからこうすべき／こうなる」という帰結・アクションのとき。発見の集約なら converge、結論先出しなら pyramid。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字/行・2行まで。体言止めでなく結論を言い切るメッセージ文を推奨'},
      {
        key: 'points', type: 'pairs', label: '要因（見出し :: 本文）', required: true,
        fit: '見出し20px・全角16字、本文16px・全角22字/行・2行まで / 2〜4個（3個推奨）',
      },
      { key: 'arrowLabel', type: 'text', label: '矢印に添える一言', fit: '17px・全角8字まで（幅80pxで折返し）'},
      { key: 'conclusionLabel', type: 'text', label: '右パネルのラベル', fit: '20px・全角8字'},
      { key: 'conclusion', type: 'textarea', label: '帰結（結果・打ち手）', required: true, fit: '26px・全角20字/行・3行まで'},
      { key: 'conclusionPoints', type: 'lines', label: '帰結の補足（1行1項目・任意）', fit: '18px・各全角22字・1行 / 3項目まで'},
    ],
    render: (f) => `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-drivers">
        <div class="dv-left">
          ${f.points
            .map(
              (p, i) => `
          <div class="dv-item">
            <span class="dv-no">${String(i + 1).padStart(2, '0')}</span>
            <div class="dv-text">
              <div class="dv-head">${esc(p.heading)}</div>
              <div class="dv-body">${esc(p.body)}</div>
            </div>
          </div>`
            )
            .join('')}
        </div>
        <div class="dv-arrow">
          <svg viewBox="0 0 60 60" width="58" height="58" aria-hidden="true"><path d="M8 18 L36 18 L36 6 L56 30 L36 54 L36 42 L8 42 Z" fill="currentColor"/></svg>
          ${f.arrowLabel ? `<div class="dv-arrowlabel">${esc(f.arrowLabel)}</div>` : ''}
        </div>
        <div class="dv-right">
          ${f.conclusionLabel ? `<div class="dv-rlabel">${esc(f.conclusionLabel)}</div>` : ''}
          <div class="dv-conclusion">${esc(f.conclusion)}</div>
          ${f.conclusionPoints.length ? `<ul class="dv-points">${listItems(f.conclusionPoints)}</ul>` : ''}
        </div>
      </div>`,
  },

  {
    name: 'pyramid',
    label: 'ピラミッド（結論先出し）',
    description: '主張を先に大きく置き、対等な根拠3本で「支える」演繹／答え先出しの型。矢印は「なぜなら」を意味し、根拠は独立した柱（1本欠けても他で立つ）。【選ぶ合図】一番上に置きたい一文がもう決まっていて、経営層にまず結論を渡したいとき。積み上げて気づかせるなら converge、左→右の因果なら drivers。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル', required: true, fit: '33px・全角33字・1行'},
      { key: 'conclusionLabel', type: 'text', label: '主張のラベル', fit: '18px・全角6字'},
      { key: 'conclusion', type: 'textarea', label: '主張（一番言いたいこと）', required: true, fit: '27px・全角38字/行・2行まで'},
      {
        key: 'points', type: 'pairs', label: '根拠（見出し :: 本文）', required: true,
        fit: '見出し22px・全角14字、本文18px・全角20字/行・3行まで / 2〜4本（3本推奨）',
      },
    ],
    render: (f) => `
      ${slideHeader(f.title)}
      <div class="sl-body tpl-pyramid">
        <div class="py-top">
          ${f.conclusionLabel ? `<span class="py-tag">${esc(f.conclusionLabel)}</span>` : ''}
          <span class="py-text">${esc(f.conclusion)}</span>
        </div>
        <div class="py-connect">
          <svg width="160" height="26" viewBox="0 0 160 26" preserveAspectRatio="none" aria-hidden="true"><path d="M80 2 L26 24 M80 2 L80 24 M80 2 L134 24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>
        </div>
        <div class="py-supports">
          ${f.points
            .map(
              (p) => `
          <div class="py-card">
            <div class="py-head">${esc(p.heading)}</div>
            <div class="py-body">${esc(p.body)}</div>
          </div>`
            )
            .join('')}
        </div>
      </div>`,
  },

  {
    name: 'discussion-map',
    label: '議論収束マップ',
    description: '探索的議論を1枚で「論点→検討→結論」の有向フローとして見せる型。左の論点（探索した案）と中間の検討/対立ノードを線でつなぎ、どれとどれが結びついて結論に至ったかを2次元で示す。各論点に採用/保留/棄却の判定を付けられる。【選ぶ合図】ブレストや方針決めなど、結論そのものより「どう議論が収束したか」を会議録として残したいとき。結論が先に1つ決まっているなら pyramid、独立議題の並列なら（将来の）agenda-grid を使う。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル/会議名', required: true, fit: '33px・全角33字・1行'},
      { key: 'lead', type: 'text', label: 'テーマ補足（任意）', fit: '21px・全角40字・1行'},
      {
        key: 'threads', type: 'raw', label: '探索した論点（{text, verdict} の配列。verdict は 採用/保留/棄却 のいずれか・任意）', required: true,
        fit: 'text 各 全角20字・3行まで / 3〜5個推奨',
      },
      {
        key: 'deliberations', type: 'raw', label: '検討・対立の中間ノード（{text} の配列・任意。0個なら論点が直接結論につながる）',
        fit: 'text 各 全角18字・3行まで / 0〜4個',
      },
      {
        key: 'links', type: 'raw', label: '接続（{from, to} の配列。id は 論点=t0,t1.. / 中間=d0,d1.. / 結論=c。左→右方向のみ: t→d, d→c, t→c）',
        fit: '無指定かつ中間ノード0個なら全論点→結論を自動接続',
      },
      { key: 'conclusionLabel', type: 'text', label: '結論ラベル', fit: '14px・全角6字'},
      { key: 'conclusion', type: 'textarea', label: '結論（右の箱・言い切る）', required: true, fit: '23px・全角22字/行・3行まで'},
      { key: 'open', type: 'lines', label: '未決事項/次回持ち越し（1行1項目・任意）', fit: '全角28字・1行 / 2〜3個'},
    ],
    render: (f) => {
      const threads = Array.isArray(f.threads) ? f.threads : [];
      const delibs = Array.isArray(f.deliberations) ? f.deliberations : [];
      const open = Array.isArray(f.open) ? f.open : [];
      const n = threads.length || 1;
      const m = delibs.length;
      const yT = (i) => (((i + 0.5) / n) * 100).toFixed(2);
      const yD = (j) => (((j + 0.5) / (m || 1)) * 100).toFixed(2);
      const X = { tR: 26, dL: 38, dR: 62, cL: 72 };
      const anchor = (id, side) => {
        if (id === 'c') return [X.cL, 50];
        if (id[0] === 'd') return [side === 'src' ? X.dR : X.dL, yD(+id.slice(1))];
        return [X.tR, yT(+id.slice(1))]; // 論点は始点としてのみ使う
      };
      let links = Array.isArray(f.links) ? f.links : [];
      if (!links.length && m === 0) links = threads.map((_, i) => ({ from: `t${i}`, to: 'c' }));
      const vClass = (v) => (v === '採用' ? 'dm-v-adopt' : v === '保留' ? 'dm-v-hold' : v === '棄却' ? 'dm-v-reject' : '');
      const paths = links
        .map((lk) => {
          const [x1, y1] = anchor(String(lk.from), 'src');
          const [x2, y2] = anchor(String(lk.to), 'dst');
          const cx = ((+x1 + +x2) / 2).toFixed(2);
          const reject = String(lk.from)[0] === 't' && (threads[+String(lk.from).slice(1)] || {}).verdict === '棄却';
          const style = `stroke:${reject ? 'var(--gray)' : 'var(--accent)'};fill:none;stroke-width:2.5px${reject ? ';stroke-dasharray:4 4' : ''}`;
          return `<path d="M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}" style="${style}" vector-effect="non-scaling-stroke"/>`;
        })
        .join('');
      const threadNodes = threads
        .map((t, i) => {
          const reject = t.verdict === '棄却';
          return `<div class="dm-node${reject ? ' dm-reject' : ''}" style="top:${yT(i)}%">${
            t.verdict ? `<span class="dm-verdict ${vClass(t.verdict)}">${esc(t.verdict)}</span>` : ''
          }<div class="dm-node-text">${esc(t.text)}</div></div>`;
        })
        .join('');
      const delibNodes = delibs
        .map((d, j) => `<div class="dm-node" style="top:${yD(j)}%"><div class="dm-node-text">${esc(d.text)}</div></div>`)
        .join('');
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-dmap">
        <div class="dm-head"><span class="dh-t">探索した論点</span><span class="dh-d">検討・対立</span><span class="dh-c">結論</span></div>
        <div class="dm-wrap">
          <svg class="dm-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>
          <div class="dm-band dm-threads">${threadNodes}</div>
          ${m ? `<div class="dm-band dm-delibs">${delibNodes}</div>` : ''}
          <div class="dm-band dm-conc"><div class="dm-node">${
            f.conclusionLabel ? `<span class="dm-conc-label">${esc(f.conclusionLabel)}</span>` : ''
          }<div class="dm-conc-text">${esc(f.conclusion)}</div></div></div>
        </div>
        ${open.length ? `<div class="dm-open"><b>未決事項</b><span>${open.map(esc).join(' ／ ')}</span></div>` : ''}
      </div>`;
    },
  },

  {
    name: 'agenda-grid',
    label: '議題タイル',
    description: '複数の独立した議題を1枚に格子状にタイルする型。各議題が「結論・論点・ToDo（担当/期限）」で自己完結し、読み手は任意の順で走査できる。会議録（定例・多議題）の王道。各議題に 決定/継続/保留/共有 のステータスを付けられる。【選ぶ合図】独立した複数トピックを並列に俯瞰させたいとき。1つの結論への収束を見せるなら discussion-map、結論先出しの放射なら hub。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル/会議名', required: true, fit: '33px・全角33字・1行'},
      { key: 'lead', type: 'text', label: '日付・参加者・目的（任意）', fit: '21px・全角40字・1行'},
      {
        key: 'items', type: 'raw', label: '議題（{topic, status, conclusion, points[], owner, due} の配列。status は 決定/継続/保留/共有）', required: true,
        fit: 'topic 全角16字 / conclusion 全角28字・2行 / points 各全角20字・2項目 / 4〜6個',
      },
      { key: 'summary', type: 'lines', label: '全体決定/横断ToDo（1行1項目・任意）', fit: '全角40字・1行 / 2〜3個'},
    ],
    render: (f) => {
      const items = Array.isArray(f.items) ? f.items : [];
      const summary = Array.isArray(f.summary) ? f.summary : [];
      const n = items.length;
      const cols = n <= 2 ? Math.max(n, 1) : n === 4 ? 2 : 3;
      const sClass = (s) =>
        s === '決定' ? 'ag-s-done' : s === '継続' ? 'ag-s-cont' : s === '保留' ? 'ag-s-hold' : s === '共有' ? 'ag-s-info' : '';
      const cards = items
        .map((it, i) => {
          const pts = Array.isArray(it.points) ? it.points : [];
          return `<div class="ag-card">
            <div class="ag-card-head">
              <span class="ag-no">${String(i + 1).padStart(2, '0')}</span>
              <span class="ag-topic">${esc(it.topic)}</span>
              ${it.status ? `<span class="ag-status ${sClass(it.status)}">${esc(it.status)}</span>` : ''}
            </div>
            ${it.conclusion ? `<div class="ag-concl">${esc(it.conclusion)}</div>` : ''}
            ${pts.length ? `<ul class="ag-points">${pts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
            ${
              it.owner || it.due
                ? `<div class="ag-todo">${it.owner ? `<span class="ag-owner">${esc(it.owner)}</span>` : ''}${
                    it.due ? `<span class="ag-due">${esc(it.due)}</span>` : ''
                  }</div>`
                : ''
            }
          </div>`;
        })
        .join('');
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-agrid">
        <div class="ag-grid" style="grid-template-columns:repeat(${cols},1fr)">${cards}</div>
        ${summary.length ? `<div class="ag-summary"><b>全体</b><span>${summary.map(esc).join(' ／ ')}</span></div>` : ''}
      </div>`;
    },
  },

  {
    name: 'hub',
    label: '中心論点（放射）',
    description: '結論を中央に置き、それを支える独立した論点・観点を放射状に周囲へ配置して線でつなぐ型。論点は順序を持たない対等な衛星で、2次元の中心性により「1つの核を多角的に支える」関係を示す。【選ぶ合図】結論が1つ明確で、独立した複数の根拠・観点が対等に支える意思決定会議。発散→収束の物語なら discussion-map、独立議題の並列なら agenda-grid。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル/会議名', required: true, fit: '33px・全角33字・1行'},
      { key: 'lead', type: 'text', label: 'テーマ補足（任意）', fit: '21px・全角40字・1行'},
      { key: 'conclusionLabel', type: 'text', label: '結論ラベル', fit: '14px・全角6字'},
      { key: 'conclusion', type: 'textarea', label: '中央の結論（言い切る）', required: true, fit: '23px・全角18字/行・3行まで'},
      {
        key: 'points', type: 'raw', label: '周囲の論点（{heading, body} の配列。body 任意）', required: true,
        fit: 'heading 全角12字 / body 全角16字・2行 / 4〜6個推奨',
      },
    ],
    render: (f) => {
      const pts = Array.isArray(f.points) ? f.points : [];
      const N = pts.length || 1;
      const cx = 50, cy = 53, Rx = 36, Ry = 35;
      const at = (i) => {
        const th = -Math.PI / 2 + (i * 2 * Math.PI) / N;
        return [(cx + Rx * Math.cos(th)).toFixed(2), (cy + Ry * Math.sin(th)).toFixed(2)];
      };
      const lines = pts
        .map((_, i) => {
          const [x, y] = at(i);
          return `<line x1="${x}" y1="${y}" x2="${cx}" y2="${cy}" style="stroke:var(--accent);fill:none;stroke-width:2px" vector-effect="non-scaling-stroke"/>`;
        })
        .join('');
      const sats = pts
        .map((p, i) => {
          const [x, y] = at(i);
          return `<div class="hub-sat" style="left:${x}%;top:${y}%"><div class="hub-sat-head">${esc(p.heading)}</div>${
            p.body ? `<div class="hub-sat-body">${esc(p.body)}</div>` : ''
          }</div>`;
        })
        .join('');
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-hub">
        <div class="hub-wrap">
          <svg class="hub-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
          ${sats}
          <div class="hub-center" style="left:${cx}%;top:${cy}%">${
            f.conclusionLabel ? `<span class="hub-c-label">${esc(f.conclusionLabel)}</span>` : ''
          }<div class="hub-c-text">${esc(f.conclusion)}</div></div>
        </div>
      </div>`;
    },
  },

  {
    name: 'dashboard',
    label: 'エグゼクティブ・ダッシュボード',
    description: '報告会後のまとめ用。結論（Executive Summary）と KPI・トレンド・進捗ステータス（Executive Dashboard）を1枚に統合する高密度フォーマット。10秒で要点 → その下を数字カード・推移グラフ・RAG進捗で支える。【選ぶ合図】定例報告・事業レビューの結果を1枚で配布したいとき。議論の収束は discussion-map、独立議題の並列は agenda-grid。',
    fields: [
      { key: 'title', type: 'text', label: 'タイトル/報告会名', required: true, fit: '33px・全角33字・1行'},
      { key: 'lead', type: 'text', label: '対象期間・部門（任意）', fit: '21px・全角40字・1行'},
      { key: 'summary', type: 'textarea', label: '結論サマリー（10秒で要点・言い切る）', required: true, fit: '19px・全角42字/行・2行まで'},
      { key: 'status', type: 'text', label: '全体ステータス（順調/注意/危険 など短語）', fit: '25px・全角4字'},
      { key: 'statusTone', type: 'select', label: '全体ステータスの色', options: ['ok', 'warn', 'danger'], fit: 'ok=緑 / warn=橙 / danger=赤'},
      {
        key: 'kpis', type: 'raw', label: 'KPIスコアカード（{label, value, unit, delta, dir, tone} の配列。dir=up/down/flat、tone=ok/warn/danger）', required: true,
        fit: '3〜4個 / label 全角8字 / value 半角5字',
      },
      { key: 'chartTitle', type: 'text', label: 'グラフの見出し（任意）', fit: '15px・全角26字'},
      { key: 'projectsTitle', type: 'text', label: '右パネルの見出し（任意・既定「進捗ステータス」）', fit: '15px・全角20字'},
      {
        key: 'chart', type: 'raw', label: 'トレンドグラフ（{type, labels[], values[], unit, highlight, delta}。type=bar/line/hbar/waterfall）',
        fit: '4〜6点・line か bar 推奨',
      },
      {
        key: 'projects', type: 'raw', label: '進捗ステータス（{name, progress(0-100), tone, note} の配列。tone=ok/warn/danger）',
        fit: '3〜4個 / name 全角12字 / note 全角22字',
      },
      { key: 'foot', type: 'lines', label: '注目・次アクション（1行1項目・任意）', fit: '全角30字・1行 / 2〜3個'},
    ],
    render: (f, ctx) => {
      const toneCls = (t) => {
        const s = String(t || '').toLowerCase();
        if (['ok', 'good', '順調', 'green'].includes(s)) return 'db-ok';
        if (['warn', 'caution', '注意', 'amber', 'yellow'].includes(s)) return 'db-warn';
        if (['danger', 'bad', '危険', 'red'].includes(s)) return 'db-danger';
        return 'db-neutral';
      };
      const arrow = (d) => (d === 'up' ? '▲' : d === 'down' ? '▼' : '—');
      const kpis = Array.isArray(f.kpis) ? f.kpis : [];
      const projects = Array.isArray(f.projects) ? f.projects : [];
      const foot = Array.isArray(f.foot) ? f.foot : [];
      const chart = f.chart && typeof f.chart === 'object' ? f.chart : null;
      const hasChart = chart && Array.isArray(chart.values) && chart.values.length;
      const hasProj = projects.length > 0;
      const kpiCards = kpis
        .map(
          (k) => `<div class="db-kpi">
            <div class="db-kpi-label">${esc(k.label)}</div>
            <div class="db-kpi-val">${esc(k.value)}${k.unit ? `<span class="db-kpi-unit">${esc(k.unit)}</span>` : ''}</div>
            ${k.delta ? `<div class="db-kpi-delta ${toneCls(k.tone)}">${arrow(k.dir)} ${esc(k.delta)}</div>` : ''}
          </div>`
        )
        .join('');
      let chartHtml = '';
      if (hasChart) {
        const { svg } = renderChart({
          type: chart.type || 'line', labels: chart.labels || [], values: chart.values || [],
          unit: chart.unit || '', highlight: chart.highlight, delta: chart.delta, width: 640, height: 230,
        }, ctx && ctx.colors);
        chartHtml = `<div class="db-chart">${f.chartTitle ? `<div class="db-card-title">${esc(f.chartTitle)}</div>` : ''}<div class="db-chart-wrap">${svg}</div></div>`;
      }
      let projHtml = '';
      if (hasProj) {
        projHtml = `<div class="db-projects"><div class="db-card-title">${esc(f.projectsTitle || '進捗ステータス')}</div>${projects
          .map((p) => {
            const pct = Math.max(0, Math.min(100, Number(p.progress) || 0));
            return `<div class="db-proj">
              <div class="db-proj-top"><span class="db-dot ${toneCls(p.tone)}"></span><span class="db-proj-name">${esc(p.name)}</span><span class="db-proj-pct">${pct}%</span></div>
              <div class="db-bar"><div class="db-bar-fill ${toneCls(p.tone)}" style="width:${pct}%"></div></div>
              ${p.note ? `<div class="db-proj-note">${esc(p.note)}</div>` : ''}
            </div>`;
          })
          .join('')}</div>`;
      }
      const splitCols = hasChart && hasProj ? '1.25fr 1fr' : '1fr';
      return `
      ${slideHeader(f.title, f.lead)}
      <div class="sl-body tpl-dashboard">
        <div class="db-summary">
          <div class="db-sum-main"><span class="db-sum-label">サマリー</span><p class="db-sum-text">${esc(f.summary)}</p></div>
          ${f.status ? `<div class="db-status ${toneCls(f.statusTone || f.status)}"><span class="db-status-cap">全体</span><span class="db-status-val">${esc(f.status)}</span></div>` : ''}
        </div>
        ${kpiCards ? `<div class="db-kpis" style="grid-template-columns:repeat(${kpis.length},1fr)">${kpiCards}</div>` : ''}
        ${hasChart || hasProj ? `<div class="db-split" style="grid-template-columns:${splitCols}">${chartHtml}${projHtml}</div>` : ''}
        ${foot.length ? `<div class="db-foot"><span class="db-foot-label">注目・次アクション</span><div class="db-foot-items">${foot.map((x) => `<span class="db-foot-item">${esc(x)}</span>`).join('')}</div></div>` : ''}
      </div>`;
    },
  },

  // ---- Data-driven layouts (PPTX-first; charts are drawn from deck values) ----
  {
    name: 'kpi-cards',
    label: 'KPI 指标卡',
    description: '2–4 个核心指标卡：数值、单位、同比/环比变化与趋势；可选 series 绘制迷你趋势线。适合经营概览、阶段成果。',
    fields: [
      { key: 'title', type: 'text', label: '标题（结论句）', required: true },
      { key: 'lead', type: 'text', label: '导语（可选）' },
      {
        key: 'kpis', type: 'objects', label: '指标（{label, value, unit, delta, trend, note, series}）', required: true,
        props: {
          label: { type: 'string', required: true, description: 'KPI name' },
          value: { type: 'string', required: true, description: 'Number to display without unit, e.g. "128", "98.5"' },
          unit: { type: 'string', description: 'Unit, e.g. "%", "M", "x"' },
          delta: { type: 'string', description: 'Change vs prior period, e.g. "+12%", "-3.1pt"' },
          trend: { type: 'string', enum: ['up', 'down', 'flat'], description: 'Direction of change' },
          tone: { type: 'string', enum: ['good', 'bad', 'neutral'], description: 'Whether the change is good or bad (sets the colour); default up=good, down=bad' },
          note: { type: 'string', description: 'Short definition or context' },
          series: { type: 'numbers', description: 'Optional sparkline values (3-12 numbers)' },
        },
      },
      { key: 'note', type: 'text', label: '底部注释（数据口径等，可选）' },
    ],
    render: (f) => `${slideHeader(f.title, f.lead)}<div class="sl-body"><ul>${f.kpis.map((k) => `<li><b>${esc(k.label)}</b> ${esc(k.value)}${esc(k.unit)} ${esc(k.delta)}</li>`).join('')}</ul></div>`,
  },

  {
    name: 'donut',
    label: '环形占比图',
    description: '环形图展示构成/占比（2–6 项），右侧图例自动计算百分比，可附 1–3 条洞察。数值按 deck 数据动态绘制。',
    fields: [
      { key: 'title', type: 'text', label: '标题（结论句）', required: true },
      { key: 'lead', type: 'text', label: '导语（可选）' },
      {
        key: 'segments', type: 'objects', label: '构成项（{label, value}，value 为非负数）', required: true,
        props: { label: { type: 'string', required: true }, value: { type: 'number', required: true } },
      },
      { key: 'unit', type: 'text', label: '数值单位（可选）' },
      { key: 'centerValue', type: 'text', label: '环心数值（可选，缺省为合计）' },
      { key: 'centerLabel', type: 'text', label: '环心说明（可选，缺省“合计”）' },
      { key: 'points', type: 'lines', label: '洞察（可选）' },
    ],
    render: (f) => `${slideHeader(f.title, f.lead)}<div class="sl-body"><ul>${f.segments.map((s) => `<li>${esc(s.label)}: ${esc(s.value)}${esc(f.unit)}</li>`).join('')}</ul></div>`,
  },

  {
    name: 'chart-series',
    label: '多系列图表',
    description: '原生可编辑图表：bar=分组柱状 / stacked=堆积柱状 / line=折线 / area=面积 / hbar=横向条形。1–4 个系列，每个系列 values 与 categories 等长。可在右侧给出 1–3 条结论。',
    fields: [
      { key: 'title', type: 'text', label: '标题（结论句）', required: true },
      { key: 'lead', type: 'text', label: '导语（可选）' },
      { key: 'chartType', type: 'select', label: '图表类型', options: ['bar', 'stacked', 'line', 'area', 'hbar'], required: true },
      { key: 'categories', type: 'csv', label: '类别（X 轴标签）', required: true },
      {
        key: 'series', type: 'objects', label: '系列（{name, values}）', required: true,
        props: { name: { type: 'string', required: true }, values: { type: 'numbers', required: true } },
      },
      { key: 'unit', type: 'text', label: '数值单位（可选）' },
      { key: 'points', type: 'lines', label: '右侧结论（可选）' },
      { key: 'note', type: 'text', label: '底部注释（可选）' },
    ],
    render: (f) => `${slideHeader(f.title, f.lead)}<div class="sl-body"><p>${esc(f.categories.join(' / '))}</p><ul>${f.series.map((s) => `<li>${esc(s.name)}: ${esc(s.values.join(', '))}</li>`).join('')}</ul></div>`,
  },

  {
    name: 'progress',
    label: '目标进度',
    description: '2–6 个目标的完成进度条（value / target，target 缺省 100）。超额完成自动标记。适合 OKR、预算执行、里程碑完成度。',
    fields: [
      { key: 'title', type: 'text', label: '标题（结论句）', required: true },
      { key: 'lead', type: 'text', label: '导语（可选）' },
      {
        key: 'items', type: 'objects', label: '目标（{label, value, target, display, note}）', required: true,
        props: {
          label: { type: 'string', required: true },
          value: { type: 'number', required: true, description: 'Current value' },
          target: { type: 'number', description: 'Target value (default 100)' },
          display: { type: 'string', description: 'Right-hand label, e.g. "4.2 / 5 M"; defaults to the percentage' },
          note: { type: 'string', description: 'Optional short status' },
        },
      },
      { key: 'note', type: 'text', label: '底部注释（可选）' },
    ],
    render: (f) => `${slideHeader(f.title, f.lead)}<div class="sl-body"><ul>${f.items.map((i) => `<li>${esc(i.label)}: ${esc(i.value)} / ${esc(i.target ?? 100)}</li>`).join('')}</ul></div>`,
  },

  {
    name: 'funnel',
    label: '转化漏斗',
    description: '3–6 个阶段的漏斗，按数值自动计算阶段转化率与总转化率。适合销售管道、用户转化、招聘流程。',
    fields: [
      { key: 'title', type: 'text', label: '标题（结论句）', required: true },
      { key: 'lead', type: 'text', label: '导语（可选）' },
      {
        key: 'stages', type: 'objects', label: '阶段（{label, value, note}，value 自上而下递减）', required: true,
        props: { label: { type: 'string', required: true }, value: { type: 'number', required: true }, note: { type: 'string' } },
      },
      { key: 'unit', type: 'text', label: '数值单位（可选）' },
      { key: 'points', type: 'lines', label: '右侧洞察（可选）' },
    ],
    render: (f) => `${slideHeader(f.title, f.lead)}<div class="sl-body"><ol>${f.stages.map((s) => `<li>${esc(s.label)}: ${esc(s.value)}${esc(f.unit)}</li>`).join('')}</ol></div>`,
  },

  {
    name: 'matrix',
    label: '四象限矩阵',
    description: '2×2 矩阵（优先级矩阵、SWOT、定位图）。quadrants 顺序：左上、右上、左下、右下；可强调其中一个象限。',
    fields: [
      { key: 'title', type: 'text', label: '标题（结论句）', required: true },
      { key: 'xLabel', type: 'text', label: '横轴含义（从左到右递增，可选）' },
      { key: 'yLabel', type: 'text', label: '纵轴含义（从下到上递增，可选）' },
      {
        key: 'quadrants', type: 'objects', label: '象限（{heading, body}，顺序：左上/右上/左下/右下）', required: true,
        props: { heading: { type: 'string', required: true }, body: { type: 'string' } },
      },
      { key: 'highlight', type: 'select', label: '强调象限（可选）', options: ['', '1', '2', '3', '4'] },
    ],
    render: (f) => `${slideHeader(f.title)}<div class="sl-body"><ol>${f.quadrants.map((q) => `<li><b>${esc(q.heading)}</b> ${esc(q.body)}</li>`).join('')}</ol></div>`,
  },

  {
    name: 'process',
    label: '流程步骤',
    description: '3–6 个顺序步骤（编号 + 标题 + 说明），可在底部给出一句总结。适合实施路径、操作流程、方法论。',
    fields: [
      { key: 'title', type: 'text', label: '标题（结论句）', required: true },
      { key: 'lead', type: 'text', label: '导语（可选）' },
      {
        key: 'steps', type: 'objects', label: '步骤（{heading, body}）', required: true,
        props: { heading: { type: 'string', required: true }, body: { type: 'string' } },
      },
      { key: 'conclusion', type: 'text', label: '底部总结（可选）' },
    ],
    render: (f) => `${slideHeader(f.title, f.lead)}<div class="sl-body"><ol>${f.steps.map((s) => `<li><b>${esc(s.heading)}</b> ${esc(s.body)}</li>`).join('')}</ol></div>`,
  },

  {
    name: 'closing',
    label: 'クロージング',
    description: '締めのページ。メッセージと連絡先。',
    fields: [
      { key: 'message', type: 'text', label: 'メッセージ', required: true, fit: '52px・全角22字/行・2行まで'},
      { key: 'submessage', type: 'textarea', label: '補足', fit: '25px・全角46字/行・2行まで'},
      { key: 'contact', type: 'text', label: '連絡先', fit: '19px・1行'},
    ],
    render: (f) => `
      <div class="tpl-closing">
        <div class="title-rule"></div>
        <h1>${esc(f.message)}</h1>
        ${f.submessage ? `<p class="title-sub">${esc(f.submessage)}</p>` : ''}
        ${f.contact ? `<div class="title-meta"><span>${esc(f.contact)}</span></div>` : ''}
      </div>`,
  },
];

// The common field contract stays here; sample content belongs to the default template.
const { examples } = loadTemplate('default');
for (const template of TEMPLATES) {
  const fields = examples[template.name] || {};
  for (const field of template.fields) {
    if (Object.hasOwn(fields, field.key)) field.example = fields[field.key];
  }
}

// Attach the enforced capacity (lib/limits.js) to every field; `fit` is derived from it.
// The LLM authoring catalog (lib/catalog.js) decides which layouts/fields are generated.
for (const template of TEMPLATES) {
  const entry = catalogEntry(template.name);
  for (const field of template.fields) {
    if (isMedia(template.name, field.key)) field.media = true;
    field.generate = !!(entry && Object.hasOwn(entry.fields, field.key));
    if (entry && entry.fields[field.key]) field.guide = entry.fields[field.key];
    const limit = limitOf(template.name, field.key);
    if (limit == null) continue;
    field.limit = limit;
    field.fit = describe(field, limit);
  }
  template.generate = !!entry && generationEnabled(template.name);
  if (entry) { template.use = entry.use; template.group = entry.group; }
}

const byName = Object.fromEntries(TEMPLATES.map((t) => [t.name, t]));

function getTemplate(name) {
  return byName[name] || null;
}

function templateNames() {
  return TEMPLATES.map((t) => t.name);
}

// 各テンプレートの example フィールドから1枚分のサンプル slide を作る
function exampleSlide(name) {
  const t = byName[name];
  if (!t) return null;
  const fields = {};
  for (const spec of t.fields) {
    if (spec.example !== undefined) fields[spec.key] = spec.example;
  }
  return { template: name, fields };
}

module.exports = { TEMPLATES, getTemplate, templateNames, normalizeFields, exampleSlide, esc };
