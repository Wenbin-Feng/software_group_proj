/* ============================================================
   views-student.js — 学生端视图
   规则：学习路径与知识点由教师发布（学生只读）
        学生可做的活动只有三种：知识点讲解 / 实践练习 / 知识复习
        学生自主上传课程资料，并通过 AI 问答助手提问
   ============================================================ */

const Student = (() => {

  const I = UI.icon;

  /* ================= 活动运行状态 ================= */
  let A = null;   // 当前活动状态

  function startAct(type, topicId) {
    A = { type, topicId, result: null };

    if (type === 'explain') {
      A.slides = Engine.topicContent(topicId).explain || [];
      A.i = 0; A.asked = null;
    } else if (type === 'practice') {
      A.qs = Engine.topicContent(topicId).quiz || [];
      A.i = 0; A.sel = null; A.correct = 0;
      A.phase = 'quiz';                 // quiz → code
      A.code = DATA.coding.starter;
      A.ran = false; A.testOut = null;
    } else if (type === 'review') {
      A.cards = (Engine.topicContent(topicId).explain || []).map(s => ({ q: s.t, a: s.tip }));
      A.i = 0; A.flip = false;
    }

    Engine.setStage('act');
    App.go(`#/student/activity/${type}/${topicId}`);
  }

  function finish(outcome) {
    if (!A) return;
    const r = Engine.applyResult(A.topicId, A.type, outcome || {});
    A.result = r;
    Engine.setStage('replan');
    App.render();
  }

  /* ================= 仪表盘 ================= */
  function dashboard() {
    if (!Engine.pathTopics().length) {
      return UI.empty('教师尚未发布学习路径，请稍后再来', '📭');
    }
    const overall = Engine.overallMastery();
    const plan = Engine.nextPlan();
    const tp = plan.topic, act = plan.activity;
    const pub = Engine.published();
    const pubs = Engine.publishedCourses();

    /* ① 使用流程：让用户一眼知道平台怎么用 */
    const hasPre = Engine.state.hasPreTest;
    const cur = !hasPre ? 0 : (Engine.state.completed === 0 ? 1 : 2);
    const STEPS = [
      ['完成 Pre-test', '建立初始掌握度'],
      ['完成推荐活动', '讲解 / 实践 / 复习'],
      ['查看学习进度', '掌握度持续更新'],
    ];
    const steps = STEPS.map((s, i) => `
      <div class="step ${i < cur ? 'done' : (i === cur ? 'active' : '')}">
        <span class="step-n">${i + 1}</span>
        <div>
          <div class="step-t">${s[0]}</div>
          <div class="step-d">${s[1]}</div>
        </div>
      </div>`).join('<span class="step-arrow">›</span>');

    /* ② 教师发布的学习路径（学生只读，多门课程依次追加） */
    const pubList = pubs.map((c, i) => `
      <div class="topic-row">
        <span class="path-idx">${i + 1}</span>
        <div class="topic-emoji">📘</div>
        <div class="topic-main">
          <div class="topic-name">${escapeHtml(c.title)}</div>
          <div class="topic-meta">
            ${escapeHtml(c.instructor)} · ${escapeHtml(c.term)} · 更新于 ${escapeHtml(c.updated)}
            · ${c.topics.length} 个知识点 · 来源：${escapeHtml(c.source)}
          </div>
        </div>
        ${i === pubs.length - 1 && pubs.length > 1
          ? `<span class="badge badge-primary">最近发布 · 已追加</span>`
          : `<span class="badge badge-success">${I('check',12)} 学习中</span>`}
        <button class="btn btn-ghost btn-sm" onclick="App.go('#/student/materials')">${I('upload',14)} 资料</button>
      </div>`).join('');

    const published = `
      <div class="card pub-card">
        <div class="row">
          <span class="badge badge-primary">${I('book', 13)} 教师发布</span>
          <div style="min-width:0">
            <div style="font-weight:700;font-size:14px">已发布 ${pubs.length} 门课程 · 共 ${Engine.pathTopics().length} 个知识点</div>
            <div class="text-xs" style="color:var(--text-3)">每发布一门课，其知识点会追加到你的学习路径末尾，已有知识点与进度不会被覆盖</div>
          </div>
          <span class="spacer"></span>
          <button class="btn btn-ghost btn-sm" onclick="App.go('#/student/materials')">${I('upload',14)} 课程资料 · AI 问答</button>
        </div>
        ${pubList}
        <div class="pub-note">${pub.note}如需补充资料，可在「课程资料 · AI 问答」中自行上传，AI 问答将一并检索。</div>
      </div>`;

    /* ②-b 新追加的知识点提示 */
    const ap = Engine.state.lastAppend;
    const appendBanner = ap && ap.count ? `
      <div class="notice">
        <span class="notice-ico">🆕</span>
        <div style="flex:1">
          <div class="notice-t">教师新发布了《${escapeHtml(ap.courseTitle)}》，已为你追加 ${ap.count} 个知识点</div>
          <div class="notice-d">
            追加内容：${ap.names.map(escapeHtml).join(' · ')}${ap.count > 5 ? ' 等' : ''}
            —— 排在原有知识点之后，原有进度保持不变。可随时学习。
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="Student.dismissAppend()">知道了</button>
      </div>` : '';

    /* ③ 未做 Pre-test 时的提示（新增知识点需要补一次起点评估） */
    const pending = Engine.pendingTopics();
    const notice = pending.length ? `
      <div class="notice">
        <span class="notice-ico">📝</span>
        <div style="flex:1">
          <div class="notice-t">${hasPre
            ? `有 ${pending.length} 个新追加的知识点还没做 Pre-test`
            : '先完成 Pre-test，让 Agent 了解你的起点'}</div>
          <div class="notice-d">共 ${pending.length} 道题（对应尚未评估的知识点），约 1–2 分钟。</div>
        </div>
        <button class="btn btn-primary" onclick="Student.pretest()">开始 Pre-test ${I('arrowRight',15)}</button>
      </div>` : '';

    /* ④ 主行动卡：一次只推一件事 */
    const focus = `
      <div class="focus-card">
        <div class="focus-top">
          <div class="focus-ico">${act.icon}</div>
          <div class="focus-main">
            <div class="focus-label">ADAPTIVE PLANNING AGENT · 推荐下一步</div>
            <div class="focus-title">${act.name}</div>
            <div class="focus-meta">${tp.icon} ${tp.name} · 当前掌握度 ${tp.mastery}%</div>
          </div>
          ${UI.ring(tp.mastery, 68)}
        </div>
        <div class="focus-body">
          <div class="reason-line">${plan.reason}　规则 <span class="reason-rule">${plan.rule}</span></div>
          <div class="row mt-16">
            <button class="btn btn-primary" onclick="Student.start('${act.id}','${tp.id}')">${I('play',15)} 开始学习</button>
            <button class="btn btn-ghost" onclick="Student.openTopic('${tp.id}')">选择其他活动</button>
            <span class="spacer"></span>
            <span class="text-xs" style="color:var(--text-3)">完成后自动更新掌握度并重新规划</span>
          </div>
        </div>
      </div>`;

    /* ⑤ 知识状态：按课程分组，后发布的课程排在后面（追加而非覆盖） */
    let seq = 0;
    const topicCards = Engine.pathGroups().map((g, gi) => {
      const rows = g.topics.map(t => {
        seq++;
        const lv = UI.level(t.mastery);
        const col = lv.key === 'ok' ? 'var(--success)' : lv.key === 'mid' ? 'var(--warning)' : 'var(--danger)';
        return `
          <div class="topic-row">
            <span class="path-idx">${seq}</span>
            <div class="topic-emoji">${t.icon}</div>
            <div class="topic-main">
              <div class="topic-name">${escapeHtml(t.name)}
                ${t.pretested ? '' : `<span class="badge badge-warning" style="margin-left:6px">待 Pre-test</span>`}
              </div>
              <div class="topic-meta">练习 ${t.attempts} 次${t.errors ? ` · <span style="color:var(--danger)">${t.errors} 次错误</span>` : ''}</div>
            </div>
            <div class="topic-bar-wrap">${UI.bar(t.mastery)}</div>
            <div class="topic-pct" style="color:${col}">${t.mastery}%</div>
            <button class="btn btn-ghost btn-sm" onclick="Student.openTopic('${t.id}')">学习</button>
          </div>`;
      }).join('');

      const isLatest = gi === Engine.pathGroups().length - 1 && Engine.pathGroups().length > 1;
      return `
        <div class="card mb-16">
          <div class="card-head">
            <span class="h-section">${escapeHtml(g.course.title)} · ${g.topics.length} 个知识点</span>
            ${isLatest ? '<span class="badge badge-primary">最近发布 · 已追加</span>' : ''}
            <span class="spacer"></span>
            <div class="mastery-legend">
              <span><i style="background:#16a34a"></i>已掌握</span>
              <span><i style="background:#d97706"></i>学习中</span>
              <span><i style="background:#dc2626"></i>薄弱</span>
            </div>
          </div>
          ${rows}
        </div>`;
    }).join('');

    /* ⑥ 最近记录 */
    const recent = Engine.state.trace.slice(0, 4).map(x => `
      <div class="topic-row">
        <div class="topic-emoji">${(Engine.topic(x.topicId) || {}).icon || '📘'}</div>
        <div class="topic-main">
          <div class="topic-name">${x.topicName} · ${x.actName}</div>
          <div class="topic-meta">掌握度 ${x.before}% → ${x.after}%</div>
        </div>
        <span class="badge badge-success">+${x.delta}%</span>
      </div>`).join('') || UI.empty('还没有学习记录，完成一个活动试试', '🌱');

    return `
      <div class="steps">${steps}</div>
      ${published}
      ${appendBanner}
      ${notice}

      <div class="dash-top">
        ${focus}
        <div class="card dash-side">
          ${UI.ring(overall, 84)}
          <div class="text-xs mt-8" style="color:var(--text-3)">整体掌握度</div>
          <div class="divider"></div>
          <div class="text-sm">已完成 <b>${Engine.state.completed}</b> 个活动</div>
          <div class="text-sm">连续学习 <b>${Engine.state.streak}</b> 天</div>
          <div class="text-sm">薄弱知识点 <b>${Engine.topics().filter(t => t.mastery < 45).length}</b> 个</div>
        </div>
      </div>

      ${topicCards}

      <div class="card">
        <div class="card-head">
          <span class="h-section">最近学习记录</span>
          <span class="spacer"></span>
          <button class="btn btn-ghost btn-sm" onclick="App.go('#/student/progress')">查看全部</button>
        </div>
        ${recent}
      </div>`;
  }

  function greet() {
    const h = new Date().getHours();
    return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  }

  /* ================= 知识点详情（三种活动可选） ================= */
  function openTopic(topicId) {
    A = null;
    App.go('#/student/topic/' + topicId);
  }

  function topicDetail(topicId) {
    const t = Engine.topic(topicId);
    const p = Engine.plan(topicId);
    const acts = Object.values(DATA.activities).map(a => `
      <button class="act-card ${a.id === p.activity.id ? 'recommended' : ''}" onclick="Student.start('${a.id}','${t.id}')">
        <div class="row" style="gap:8px">
          <span class="act-ico">${a.icon}</span>
          <span class="act-name">${a.name}</span>
          ${a.id === p.activity.id ? '<span class="badge badge-primary" style="margin-left:auto">推荐</span>' : ''}
        </div>
        <div class="act-desc">${a.desc}</div>
        <div class="act-ability">训练：${a.ability}</div>
      </button>`).join('');

    return `
      <div class="runner-head">
        <button class="btn btn-ghost btn-sm" onclick="App.go('#/student/dashboard')">${I('arrowLeft',15)} 返回</button>
        <div>
          <div class="runner-title">${t.icon} ${t.name}</div>
          <div class="runner-topic">${t.desc}</div>
        </div>
        <span class="spacer"></span>
        ${UI.ring(t.mastery, 56)}
      </div>

      <div class="notice">
        <span class="notice-ico">${I('brain',17)}</span>
        <div style="flex:1">
          <div class="notice-t">Agent 推荐：${p.activity.icon} ${p.activity.name}</div>
          <div class="notice-d">${p.reason}</div>
        </div>
      </div>

      <div class="section-head">
        <span class="h-section">选择学习活动（${Object.keys(DATA.activities).length} 种）</span>
        <span class="spacer"></span>
        <span class="text-xs" style="color:var(--text-3)">知识点来自教师发布的学习路径</span>
      </div>
      <div class="act-grid">${acts}</div>`;
  }

  /* ================= Pre-test ================= */
  let P = null;

  function pretest() {
    P = { i: 0, answers: [], sel: null, fb: null };
    App.go('#/student/pretest');
  }

  function pretestView() {
    if (!P) pretest();

    const TS = Engine.pendingTopics();      // 只测尚未评估的知识点（新追加的知识点会在这里）
    if (!TS.length) {
      return UI.empty('所有知识点都已完成起点评估', '✅') +
        `<div class="row mt-16"><span class="spacer"></span>
           <button class="btn btn-primary" onclick="App.go('#/student/dashboard')">回到学习主页</button></div>`;
    }

    if (P.i >= TS.length) {
      const correct = P.answers.filter(a => a.correct).length;
      return `
        <div class="runner">
          <div class="card card-pad" style="text-align:center">
            <div style="font-size:40px">🎉</div>
            <div class="h-section mt-8" style="font-size:18px">Pre-test 完成</div>
            <div class="text-sm mt-8" style="color:var(--text-2)">
              答对 ${correct} / ${TS.length} 题。Agent 已为这 ${TS.length} 个知识点建立初始掌握度；
              此前已学过的知识点进度保持不变。
            </div>
            <div class="row mt-16" style="justify-content:center">
              <button class="btn btn-primary" onclick="Student.commitPretest()">查看我的学习路径</button>
            </div>
          </div>
        </div>`;
    }

    const t = TS[P.i];
    const q = Engine.topicContent(t.id).pretest || Engine.topicContent(t.id).quiz[0];
    if (!q) return UI.empty('该知识点暂无评估题目', '🚧');
    const opts = q.opts.map((o, i) => `
      <button class="opt ${P.sel === i ? 'selected' : ''} ${P.sel !== null ? (i === q.a ? 'correct' : (P.sel === i ? 'wrong' : '')) : ''}"
              ${P.sel !== null ? 'disabled' : `onclick="Student.pickPretest(${i})"`}>
        <span class="opt-key">${'ABCD'[i]}</span><span class="opt-label">${o}</span>
      </button>`).join('');

    const fb = P.sel !== null ? `
      <div class="feedback ${P.sel === q.a ? 'ok' : 'bad'}">
        <div class="feedback-title">${P.sel === q.a ? I('check',15) + ' 回答正确' : I('bug',15) + ' 回答错误'}</div>
        ${q.why}
      </div>
      <div class="row mt-16">
        <button class="btn btn-primary" onclick="Student.nextPretest()">${P.i === TS.length - 1 ? '查看结果' : '下一题'} ${I('arrowRight',15)}</button>
      </div>` : '';

    return `
      <div class="runner">
        <div class="runner-head">
          <div>
            <div class="runner-title">Pre-test · 起点评估</div>
            <div class="runner-topic">第 ${P.i + 1} / ${TS.length} 题 · ${t.icon} ${escapeHtml(t.name)}（教师发布）</div>
          </div>
          <span class="spacer"></span>
          <span class="badge badge-muted">共 ${Engine.pathTopics().length} 个知识点，本次只需评估 ${TS.length} 个新知识点</span>
        </div>
        <div class="card card-pad">
          <div class="bar mb-16"><div class="bar-fill" style="width:${(P.i / TS.length) * 100}%"></div></div>
          <div class="q-text">${q.q}</div>
          ${opts}
          ${fb}
        </div>
      </div>`;
  }

  function pickPretest(i) { P.sel = i; App.render(); }

  function nextPretest() {
    const TS = Engine.pendingTopics();
    const t = TS[P.i];
    if (!t) return;
    const q = Engine.topicContent(t.id).pretest || Engine.topicContent(t.id).quiz[0];
    if (!q) { P.i++; P.sel = null; App.render(); return; }
    P.answers.push({ topicId: t.id, correct: P.sel === q.a });
    P.i++; P.sel = null;
    App.render();
  }

  function commitPretest() {
    Engine.applyPreTest(P.answers);
    P = null;
    UI.toast('已建立初始掌握度，开始学习', 'ok');
    App.go('#/student/dashboard');
  }

  /* ================= 活动运行器 ================= */
  function activity(type, topicId) {
    if (!A || A.type !== type || A.topicId !== topicId) {
      // 直接进入 URL 时初始化
      A = { type, topicId, result: null };
      if (type === 'explain') {
        A.slides = Engine.topicContent(topicId).explain || []; A.i = 0; A.asked = null;
      } else if (type === 'practice') {
        A.qs = Engine.topicContent(topicId).quiz || [];
        A.i = 0; A.sel = null; A.correct = 0;
        A.phase = 'quiz'; A.code = DATA.coding.starter; A.ran = false; A.testOut = null;
      } else if (type === 'review') {
        A.cards = (Engine.topicContent(topicId).explain || []).map(s => ({ q: s.t, a: s.tip }));
        A.i = 0; A.flip = false;
      }
    }

    const t = Engine.topic(topicId);
    const act = DATA.activities[type];
    if (!act) { A = null; return UI.empty('该活动已下线', '🚧'); }

    // ---- 已完成 → 结果面板（含 Re-plan） ----
    if (A.result) {
      const r = A.result;
      return `
        <div class="runner">
          <div class="card card-pad" style="text-align:center">
            <div style="font-size:38px">${r.delta > 0 ? '📈' : '📉'}</div>
            <div class="h-section mt-8" style="font-size:18px">活动完成 · 掌握度已更新</div>
            <div class="row mt-16" style="justify-content:center;gap:24px">
              <div><div class="text-xs" style="color:var(--text-3)">之前</div><div style="font-size:24px;font-weight:800">${r.before}%</div></div>
              <div style="font-size:20px;color:var(--text-3)">→</div>
              <div><div class="text-xs" style="color:var(--text-3)">现在</div><div style="font-size:24px;font-weight:800;color:var(--success)">${r.after}%</div></div>
              <div><div class="text-xs" style="color:var(--text-3)">提升</div><div style="font-size:24px;font-weight:800;color:var(--primary)">+${r.delta}%</div></div>
            </div>
            ${UI.bar(r.after)}
            <div class="mt-16"></div>
          </div>

          <div class="card card-pad mt-16" style="background:var(--primary-soft);border-color:#c7d2fe">
            <div class="row" style="gap:10px">
              ${I('refresh', 18)}
              <div style="font-weight:700">Re-plan · Agent 的下一步决策</div>
            </div>
            <div class="text-sm mt-8" style="color:var(--text-2)">
              该知识点现为 <b>${r.after}%</b>，规则命中
              <span class="reason-rule">${r.re.rule}</span>，下一步推荐：
              <b>${r.re.activity.icon} ${r.re.activity.name}</b>
            </div>
            <div class="row mt-16">
              <button class="btn btn-primary" onclick="Student.start('${r.re.activity.id}','${r.topic.id}')">
                继续：${r.re.activity.name} ${I('arrowRight',15)}
              </button>
              <button class="btn btn-ghost" onclick="App.go('#/student/dashboard')">回到主页</button>
            </div>
          </div>
        </div>`;
    }

    // ---- 活动主体 ----
    let body = '';
    if (type === 'explain')       body = vExplain();
    else if (type === 'practice') body = A.phase === 'code' ? vPracticeCode() : vPracticeQuiz();
    else if (type === 'review')   body = vReview();

    const stage = type === 'practice'
      ? `<span class="badge ${A.phase === 'code' ? 'badge-primary' : 'badge-muted'}">${A.phase === 'code' ? '阶段 2 · 编程实践' : '阶段 1 · 针对性练习'}</span>`
      : '';

    return `
      <div class="runner">
        <div class="runner-head">
          <button class="btn btn-ghost btn-sm" onclick="Student.quit()">${I('arrowLeft',15)} 退出</button>
          <div>
            <div class="runner-title">${act.icon} ${act.name}</div>
            <div class="runner-topic">${t.icon} ${t.name} · 训练：${act.ability}</div>
          </div>
          <span class="spacer"></span>
          ${stage}
        </div>
        ${body}
      </div>`;
  }

  function quit() {
    A = null;
    App.go('#/student/dashboard');
  }

  /* ---- 知识点讲解 ---- */
  function vExplain() {
    const s = A.slides[A.i];
    if (!s) {
      return `
        <div class="card card-pad">
          ${UI.empty('该知识点的讲解内容尚未生成', '📄')}
          <div class="row mt-16">
            <span class="spacer"></span>
            <button class="btn btn-primary" onclick="Student.finish({})">完成讲解 ${I('check',15)}</button>
          </div>
        </div>`;
    }
    const items = (s.items || []).map(x => `<div class="slide-item"><span class="slide-bullet"></span><div>${x}</div></div>`).join('');
    const last = A.i === A.slides.length - 1;

    const askAns = A.asked ? `
      <div class="ask-answer gen-anim">
        <b>AI 助教：</b>关于「${A.asked}」——${s.tip} 该内容来自教师发布的课程资料；如需沿其他方向展开，可到「课程资料 · AI 问答」继续追问。
      </div>` : '';

    return `
      <div class="slides">
        <div class="slide">
          <div class="slide-num">SLIDE ${A.i + 1} / ${A.slides.length}</div>
          <div class="slide-title">${s.t}</div>
          <div class="slide-list">${items}</div>
          <div class="slide-tip"><b>要点：</b>${s.tip}</div>
        </div>

        <div class="ask-box mt-16">
          <input id="ask-input" placeholder="随时暂停并提问，例如：这和敏捷有什么关系？"
                 onkeydown="if(event.key==='Enter')Student.ask()">
          <button class="btn btn-soft" onclick="Student.ask()">${I('sparkles',15)} 提问</button>
        </div>
        ${askAns}

        <div class="row mt-16">
          <button class="btn btn-ghost" ${A.i === 0 ? 'disabled' : ''} onclick="Student.slide(-1)">上一页</button>
          <span class="spacer"></span>
          ${last
            ? `<button class="btn btn-primary" onclick="Student.finish({})">完成讲解 ${I('check',15)}</button>`
            : `<button class="btn btn-primary" onclick="Student.slide(1)">下一页 ${I('arrowRight',15)}</button>`}
        </div>
      </div>`;
  }
  function slide(d) {
    A.i = Math.max(0, Math.min(A.slides.length - 1, A.i + d));
    A.asked = null;
    App.render();
  }
  function ask() {
    const el = document.getElementById('ask-input');
    if (!el || !el.value.trim()) return;
    A.asked = el.value.trim();
    App.render();
  }

  /* ---- 实践练习：阶段 1 针对性练习 ---- */
  function vPracticeQuiz() {
    const q = A.qs[A.i];
    if (!q) {
      return `
        <div class="card card-pad">
          ${UI.empty('该知识点暂无练习题', '📝')}
          <div class="row mt-16">
            <span class="spacer"></span>
            <button class="btn btn-primary" onclick="Student.toCode()">跳到编程实践 ${I('arrowRight',15)}</button>
          </div>
        </div>`;
    }
    const opts = q.opts.map((o, i) => {
      let cls = '';
      if (A.sel !== null) {
        if (i === q.a) cls = 'correct';
        else if (A.sel === i) cls = 'wrong';
      }
      return `<button class="opt ${cls}" ${A.sel !== null ? 'disabled' : `onclick="Student.pick(${i})"`}>
                <span class="opt-key">${'ABCD'[i]}</span><span class="opt-label">${o}</span>
              </button>`;
    }).join('');

    const fb = A.sel !== null ? `
      <div class="feedback ${A.sel === q.a ? 'ok' : 'bad'}">
        <div class="feedback-title">${A.sel === q.a ? I('check',15) + ' 正确' : I('bug',15) + ' 不正确'}</div>
        ${q.why}
      </div>
      <div class="row mt-16">
        ${A.i === A.qs.length - 1
          ? `<button class="btn btn-primary" onclick="Student.toCode()">进入编程实践 ${I('arrowRight',15)}</button>`
          : `<button class="btn btn-primary" onclick="Student.nextQ()">下一题 ${I('arrowRight',15)}</button>`}
      </div>` : '';

    return `
      <div class="card card-pad">
        <div class="bar mb-16"><div class="bar-fill" style="width:${(A.i / A.qs.length) * 100}%"></div></div>
        <div class="row mb-8"><span class="badge badge-primary">第 ${A.i + 1} / ${A.qs.length} 题</span>
          <span class="text-xs" style="color:var(--text-3)">题目依据你的掌握度动态抽取</span></div>
        <div class="q-text">${q.q}</div>
        ${opts}
        ${fb}
      </div>`;
  }
  function pick(i) {
    if (A.sel !== null) return;
    A.sel = i;
    if (i === A.qs[A.i].a) A.correct++;
    App.render();
  }
  function nextQ() {
    if (A.i < A.qs.length - 1) { A.i++; A.sel = null; App.render(); }
  }
  function toCode() { A.phase = 'code'; App.render(); }

  /* ---- 实践练习：阶段 2 编程实践 ---- */
  function vPracticeCode() {
    const c = DATA.coding;
    const out = A.testOut;

    const tests = out && !out.error ? c.tests.map(t => {
      const r = out.results[t.input];
      return `<div><span class="${r.ok ? 'ok' : 'fail'}">${r.ok ? '✓ PASS' : '✗ FAIL'}</span>
        <span class="dim"> isBalanced(${t.input}) → 期望 ${t.expect}${r.ok ? '' : '，实际 ' + r.actual}</span></div>`;
    }).join('') : '';

    const afterRun = out ? `
      ${out.error
        ? `<div class="feedback bad mt-16"><div class="feedback-title">${I('bug',15)} 运行出错</div>${out.error}</div>`
        : `<div class="terminal"><span class="dim">$ node test.js</span>\n${tests}\n<span class="dim">${c.tests.length} tests · ${out.passed} passed · ${c.tests.length - out.passed} failed</span></div>
           <div class="feedback ${out.passed === c.tests.length ? 'ok' : 'bad'} mt-16">
             <div class="feedback-title">${I('sparkles',15)} AI 实时反馈</div>
             ${out.passed === c.tests.length
               ? '全部测试用例通过。' + c.aiFeedback[0]
               : c.aiFeedback.slice(1).join('<br>')}
           </div>`}
      <div class="row mt-16">
        <button class="btn btn-ghost" onclick="Student.runCode()">${I('refresh',14)} 重新运行</button>
        <span class="spacer"></span>
        <button class="btn btn-primary" onclick="Student.finishPractice()">完成实践练习 ${I('check',15)}</button>
      </div>` : `
      <div class="row mt-16">
        <span class="text-xs" style="color:var(--text-3)">代码在浏览器内真实执行（沙盒），运行后即可看到测试结果</span>
        <span class="spacer"></span>
        <button class="btn btn-primary" onclick="Student.runCode()">${I('play',15)} 运行测试</button>
      </div>`;

    return `
      <div class="card card-pad">
        <div class="row mb-8">
          <span class="badge badge-primary">${I('code',12)} ${c.title}</span>
          <span class="text-xs" style="color:var(--text-3)">练习已答对 ${A.correct} / ${A.qs.length} 题，接着动手实现</span>
        </div>
        <div class="q-text">${c.prompt}</div>
        <textarea class="code-editor" id="code-area" spellcheck="false">${A.code}</textarea>
        ${afterRun}
      </div>`;
  }

  function runCode() {
    const el = document.getElementById('code-area');
    if (el) A.code = el.value;
    A.testOut = evalCode(A.code);
    A.ran = true;
    App.render();
  }

  /* 在浏览器中真实执行学生代码并跑测试 */
  function evalCode(code) {
    let fn;
    try {
      fn = new Function(code + '\n;return typeof isBalanced === "function" ? isBalanced : null;')();
    } catch (e) {
      return { error: '代码无法编译：' + e.message };
    }
    if (!fn) return { error: '未找到 isBalanced(s) 函数，请检查函数签名。' };

    const results = {};
    let passed = 0;
    DATA.coding.tests.forEach(t => {
      let actual, ok = false;
      try {
        actual = String(fn(JSON.parse(t.input)));
        ok = actual === t.expect;
      } catch (e) {
        actual = '运行异常：' + e.message;
      }
      if (ok) passed++;
      results[t.input] = { ok, actual };
    });
    return { results, passed };
  }

  function finishPractice() {
    const quizOk = A.correct >= Math.ceil(A.qs.length / 2);
    const codeOk = !!(A.testOut && !A.testOut.error && A.testOut.passed === DATA.coding.tests.length);
    finish({ quizCorrect: quizOk, codePass: codeOk });
  }

  /* ---- 知识复习（闪卡） ---- */
  function vReview() {
    const c = A.cards[A.i];
    if (!c) {
      return `
        <div class="card card-pad">
          ${UI.empty('暂无可复习的内容', '🔁')}
          <div class="row mt-16">
            <span class="spacer"></span>
            <button class="btn btn-primary" onclick="Student.finish({})">完成复习 ${I('check',15)}</button>
          </div>
        </div>`;
    }
    const last = A.i === A.cards.length - 1;
    return `
      <div class="flash" onclick="Student.flip()">
        <div class="flash-q">${c.q}</div>
        ${A.flip ? `<div class="flash-a gen-anim">${c.a}</div>`
                 : `<div class="text-sm mt-16" style="color:var(--text-3)">点击卡片查看答案</div>`}
      </div>
      <div class="row mt-16">
        <button class="btn btn-ghost" ${A.i === 0 ? 'disabled' : ''} onclick="Student.card(-1)">上一张</button>
        <div class="spacer"></div>
        <span class="text-sm" style="color:var(--text-3)">${A.i + 1} / ${A.cards.length}</span>
        ${last ? `<button class="btn btn-primary" onclick="Student.finish({})">完成复习 ${I('check',15)}</button>`
               : `<button class="btn btn-primary" onclick="Student.card(1)">下一张 ${I('arrowRight',15)}</button>`}
      </div>`;
  }
  function flip() { A.flip = !A.flip; App.render(); }
  function card(d) { A.i = Math.max(0, Math.min(A.cards.length - 1, A.i + d)); A.flip = false; App.render(); }

  /* ================= 课程资料上传 + AI 问答助手 ================= */
  let M = null;

  function materials() {
    if (!M) M = { msgs: [] };
    App.go('#/student/materials');
  }

  function materialsView() {
    if (!M) M = { msgs: [] };

    const mine = Engine.uploads();
    const teacher = DATA.materials;
    const indexed = teacher.length + mine.filter(m => m.status === 'indexed').length;

    /* 资料列表 */
    const rowOf = (m, removable) => `
      <div class="topic-row">
        <div class="topic-emoji">${m.kind === 'PDF' ? '📕' : m.kind === 'PPT' ? '📊' : m.kind === 'MD' ? '📝' : '📄'}</div>
        <div class="topic-main">
          <div class="topic-name">${m.name}</div>
          <div class="topic-meta">${m.kind} · ${m.size}${m.pages ? ' · ' + m.pages + ' 页' : ''} · ${m.from}</div>
        </div>
        ${m.status === 'indexing'
          ? `<span class="badge badge-warning">${I('refresh',12)} 解析中…</span>`
          : `<span class="badge badge-success">${I('check',12)} 已索引</span>`}
        ${removable ? `<button class="btn btn-ghost btn-sm" onclick="Student.rmUpload('${m.id}')">移除</button>` : ''}
      </div>`;

    const fileRows = teacher.map(m => rowOf(m, false)).join('')
      + (mine.length ? mine.map(m => rowOf(m, true)).join('')
        : `<div class="empty" style="padding:22px">还没有上传资料 · 上传后 AI 问答会一并检索</div>`);

    /* 问答消息 */
    const msgs = M.msgs.map(m => `
      <div class="msg ${m.who === 'ai' ? 'ai' : 'me'}">
        ${m.who === 'ai' ? `<div class="msg-who">${I('sparkles',12)} AI 问答助手</div>` : ''}
        ${m.text.replace(/\n/g, '<br>')}
        ${m.sources && m.sources.length ? `
          <div class="qa-src">
            <span class="text-xs" style="color:var(--text-3)">引用出处：</span>
            ${m.sources.map(s => `<span class="chip">${s}</span>`).join('')}
          </div>` : ''}
      </div>`).join('')
      || `<div class="msg ai">
            <div class="msg-who">${I('sparkles',12)} AI 问答助手</div>
            ${DATA.assistant.welcome}
            <div class="qa-src"><span class="chip">${I('database',12)} 已索引 ${indexed} 份资料</span></div>
          </div>`;

    return `
      <div class="grid g-main" style="align-items:start">
        <div class="card">
          <div class="card-head">
            <span class="h-section">AI 问答助手</span>
            <span class="badge badge-info">${indexed} 份资料可检索</span>
            <span class="spacer"></span>
            <span class="text-xs" style="color:var(--text-3)">只依据资料作答，并给出引用</span>
          </div>
          <div class="chat-wrap" style="height:460px">
            <div class="chat-scroll" id="qa-scroll">${msgs}</div>
            <div class="chat-input">
              <input id="qa-in" placeholder="就课程资料提问，例如：非功能性需求包含哪些内容？"
                     onkeydown="if(event.key==='Enter')Student.askAI()">
              <button class="btn btn-primary" onclick="Student.askAI()">${I('arrowRight',15)}</button>
            </div>
          </div>
          <div class="card-body" style="border-top:1px solid var(--border)">
            <div class="text-xs mb-8" style="color:var(--text-3)">试试这些问题：</div>
            <div class="row row-wrap">
              ${DATA.assistant.examples.map(q =>
                `<button class="chip" onclick="Student.askExample('${q}')">${q}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <span class="h-section">我的课程资料</span>
            <span class="spacer"></span>
            <span class="badge badge-muted">${teacher.length} 份教师发布 + ${mine.length} 份我的上传</span>
          </div>

          <div class="card-body">
            <div class="dropzone"
                 onclick="document.getElementById('file-input').click()"
                 ondragover="event.preventDefault();this.classList.add('over')"
                 ondragleave="this.classList.remove('over')"
                 ondrop="Student.drop(event)">
              ${I('upload', 22)}
              <div style="font-weight:700;font-size:13.5px;margin-top:6px">上传课程资料</div>
              <div class="text-xs" style="color:var(--text-3)">点击选择，或把文件拖到这里 · 支持 PDF / PPT / MD / TXT</div>
            </div>
            <input type="file" id="file-input" multiple hidden onchange="Student.onFiles(this)">
          </div>

          ${fileRows}

          <div class="card-body" style="border-top:1px solid var(--border)">
            <div class="text-xs" style="color:var(--text-3)">
              ${I('shield',12)} 上传资料仅用于你个人的 AI 问答检索；AI 回答均为生成内容，请对照引用出处自行判断（Diligence）。
            </div>
          </div>
        </div>
      </div>`;
  }

  function onFiles(input) {
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    files.slice(0, 5).forEach(f => Engine.addUpload(f));
    UI.toast(`已接收 ${Math.min(files.length, 5)} 个文件，正在解析入库…`, 'ok');
    App.render();
  }

  function drop(e) {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt || !dt.files) return;
    Array.from(dt.files).slice(0, 5).forEach(f => Engine.addUpload(f));
    UI.toast('已接收拖放的文件，正在解析入库…', 'ok');
    App.render();
  }

  function rmUpload(id) {
    Engine.removeUpload(id);
    UI.toast('已移除该资料', 'warn');
    App.render();
  }

  function askAI() {
    const el = document.getElementById('qa-in');
    if (!el || !el.value.trim()) return;
    const q = el.value.trim();
    el.value = '';
    M.msgs.push({ who: 'me', text: q });
    App.render();

    setTimeout(() => {
      const r = Engine.ask(q);
      M.msgs.push({ who: 'ai', text: r.answer, sources: r.sources });
      App.render();
      const sc = document.getElementById('qa-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    }, 700);
  }

  function askExample(q) {
    if (!M) M = { msgs: [] };
    M.msgs.push({ who: 'me', text: q });
    App.render();
    setTimeout(() => {
      const r = Engine.ask(q);
      M.msgs.push({ who: 'ai', text: r.answer, sources: r.sources });
      App.render();
      const sc = document.getElementById('qa-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    }, 700);
  }

  /* ================= 学习进度 ================= */
  function progress() {
    const ts = Engine.pathTopics();
    const pubs = Engine.publishedCourses();
    const trace = Engine.state.trace.length ? Engine.state.trace.map(x => `
      <div class="topic-row">
        <div class="topic-emoji">${(Engine.topic(x.topicId) || {}).icon || '📘'}</div>
        <div class="topic-main">
          <div class="topic-name">${x.actName}</div>
          <div class="topic-meta">${x.topicName} · ${x.before}% → ${x.after}%</div>
        </div>
        <span class="badge badge-success">+${x.delta}%</span>
      </div>`).join('') : UI.empty('暂无学习记录', '📊');

    return `
      <div class="section-head">
        <span class="h-section">学习进度与掌握度</span>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" onclick="Student.reset()">${I('refresh',14)} 重置演示数据</button>
      </div>

      <div class="grid g-4 mb-16">
        ${kpi('整体掌握度', Engine.overallMastery() + '%', 'target', '', '教师发布路径平均')}
        ${kpi('已完成活动', Engine.state.completed, 'flame', '', '累计完成数')}
        ${kpi('薄弱知识点', Engine.topics().filter(t => t.mastery < 45).length, 'bug', 'amber', '需优先关注')}
        ${kpi('已掌握', Engine.topics().filter(t => t.mastery >= 75).length, 'check', 'green', `共 ${Engine.topics().length} 个知识点`)}
      </div>

      <div class="grid g-main">
        <div class="card">
          <div class="card-head">
            <span class="h-section">各知识点掌握度</span>
            <span class="spacer"></span>
            <span class="badge badge-primary">${pubs.length} 门课程 · ${ts.length} 个知识点</span>
          </div>
          <div class="card-body">
            ${Engine.pathGroups().map(g => `
              <div class="text-xs mb-8" style="color:var(--text-3);font-weight:600">${escapeHtml(g.course.title)}</div>
              ${g.topics.map(t => `
              <div class="mb-16">
                <div class="row mb-8">
                  <span style="font-weight:600;font-size:13.5px">${t.icon} ${escapeHtml(t.name)}</span>
                  <span class="spacer"></span>
                  <span style="font-weight:800">${t.mastery}%</span>
                  <span class="badge ${UI.level(t.mastery).badge}">${UI.level(t.mastery).label}</span>
                </div>
                ${UI.bar(t.mastery)}
                <div class="text-xs mt-8" style="color:var(--text-3)">练习 ${t.attempts} 次 · 错误 ${t.errors} 次${t.lastActivity ? ' · 最近：' + t.lastActivity : ''}</div>
              </div>`).join('')}
              <div class="divider"></div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><span class="h-section">全部学习轨迹</span></div>
          ${trace}
        </div>
      </div>`;
  }

  function kpi(label, val, ic, tone, delta) {
    return `
      <div class="card stat">
        <div class="row">
          <div class="stat-icon ${tone}">${I(ic, 18)}</div>
          <span class="spacer"></span>
        </div>
        <div class="stat-label" style="margin-top:12px">${label}</div>
        <div class="stat-value">${val}</div>
        <div class="stat-delta up">${delta}</div>
      </div>`;
  }
  function reset() {
    Engine.reset();
    M = null; A = null; P = null;
    UI.toast('演示数据已重置', 'ok');
    App.go('#/student/dashboard');
  }

  function dismissAppend() {
    Engine.dismissAppend();
    App.render();
  }

  /* ================= 工具 ================= */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* 供外部调用 */
  function start(type, topicId) {
    if (!Engine.state.hasPreTest) {
      UI.toast('建议先完成 Pre-test 以获得准确起点', 'warn');
    }
    startAct(type, topicId);
  }

  return {
    dashboard, topicDetail, openTopic, activity, start, quit,
    pretest, pretestView, pickPretest, nextPretest, commitPretest,
    slide, ask, pick, nextQ, toCode, runCode, finishPractice, flip, card, finish,
    materials, materialsView, onFiles, drop, rmUpload, askAI, askExample,
    progress, reset, dismissAppend,
  };
})();
