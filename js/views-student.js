/* ============================================================
   views-student.js — 学生端视图
   ============================================================ */

const Student = (() => {

  const I = UI.icon;

  /* ================= 活动运行状态 ================= */
  let A = null;   // 当前活动状态

  function startAct(type, topicId) {
    A = { type, topicId, result: null };

    if (type === 'explain') {
      A.slides = (DATA.explain[topicId] || DATA.explain.req);
      A.i = 0; A.asked = null;
    } else if (type === 'practice') {
      A.qs = (DATA.practice[topicId] || DATA.practice.req);
      A.i = 0; A.sel = null; A.fb = null; A.correct = 0;
    } else if (type === 'challenge') {
      A.q = DATA.challenge[topicId] || DATA.challenge.req;
      A.sel = null; A.fb = null;
    } else if (type === 'review') {
      const src = (DATA.explain[topicId] || DATA.explain.req);
      A.cards = src.map(s => ({ q: s.t, a: s.tip }));
      A.i = 0; A.flip = false;
    } else if (type === 'simulation') {
      A.steps = [...DATA.simulation.steps];
      A.order = [];
    } else if (type === 'roleplay') {
      A.msgs = [{ who: 'ai', text: DATA.roleplay.opening }];
      A.turn = 0;
    } else if (type === 'game') {
      const lv = DATA.bugs[0];
      A.lv = lv; A.found = []; A.time = lv.time; A.submitted = false; A.timerId = null;
      startTimer();
    } else if (type === 'coding') {
      A.code = DATA.coding.starter; A.ran = false;
    }

    Engine.setStage('act');
    App.go(`#/student/activity/${type}/${topicId}`);
  }

  /* Bug Hunter 倒计时 */
  function startTimer() {
    if (A && A.timerId) clearInterval(A.timerId);
    A.timerId = setInterval(() => {
      if (!A || A.type !== 'game' || A.submitted) { clearInterval(A.timerId); return; }
      A.time--;
      const el = document.getElementById('hud-time');
      if (el) el.textContent = A.time + 's';
      if (A.time <= 0) { clearInterval(A.timerId); submitGame(); }
    }, 1000);
  }

  function finish(outcome) {
    if (!A) return;
    if (A.timerId) clearInterval(A.timerId);
    const r = Engine.applyResult(A.topicId, A.type, outcome || {});
    A.result = r;
    Engine.setStage('replan');
    App.render();
  }

  /* ================= 语法高亮（简易） ================= */
  function hl(line) {
    let s = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let ci = s.indexOf('#');
    let cj = s.indexOf('//');
    let cs = [ci, cj].filter(x => x >= 0);
    let cut = cs.length ? Math.min(...cs) : -1;
    let code = s, com = '';
    if (cut >= 0) {
      code = s.slice(0, cut);
      com = `<span class="code-com">${s.slice(cut)}</span>`;
    }
    code = code.replace(/\b(def|function|return|if|else|while|for|break|const|let|var|True|False|None|MAX_STEPS)\b/g,
                        '<span class="code-kw">$1</span>');
    code = code.replace(/'([^']*)'/g, '<span class="code-str">\'$1\'</span>');
    return code + com;
  }

  /* ================= 仪表盘 ================= */
  function dashboard() {
    const overall = Engine.overallMastery();
    const plan = Engine.nextPlan();
    const tp = plan.topic, act = plan.activity;

    // 未做 Pre-test → 提示横幅
    const preBanner = !Engine.state.hasPreTest ? `
      <div class="card card-pad" style="border-color:#c7d2fe;background:var(--grad-soft);margin-bottom:18px">
        <div class="row row-wrap">
          <div style="font-size:20px">📝</div>
          <div style="flex:1;min-width:220px">
            <div style="font-weight:700">先完成一次 Pre-test，让 Agent 了解你的起点</div>
            <div class="text-sm" style="color:var(--text-2)">系统会根据答题结果为 8 个知识点建立初始掌握度，再据此规划学习路径。</div>
          </div>
          <button class="btn btn-grad" onclick="Student.pretest()">开始 Pre-test ${I('arrowRight',15)}</button>
        </div>
      </div>` : '';

    // 规划闭环轨迹
    const stage = Engine.stage();
    const steps = [
      ['plan', 'Plan'],
      ['act', 'Act'],
      ['observe', 'Observe'],
      ['update', 'Update'],
      ['replan', 'Re-plan'],
    ];
    const activeIdx = steps.findIndex(s => s[0] === stage);
    const trace = steps.map((s, i) => {
      const cls = i < activeIdx ? 'done' : (i === activeIdx ? 'active' : '');
      return `<span class="trace-step ${cls}">${s[1]}</span>`;
    }).join('<span class="trace-arrow">›</span>');

    // 知识点列表
    const topicRows = Engine.topics().map(t => {
      const lv = UI.level(t.mastery);
      return `
        <div class="topic-row">
          <div class="topic-emoji">${t.icon}</div>
          <div class="topic-main">
            <div class="topic-name">${t.name}</div>
            <div class="topic-meta">${t.desc} · 练习 ${t.attempts} 次${t.errors ? ` · <span style="color:var(--danger)">${t.errors} 次错误</span>` : ''}</div>
          </div>
          <div class="topic-bar-wrap">${UI.bar(t.mastery)}</div>
          <div class="topic-pct" style="color:var(--${lv.key === 'ok' ? 'success' : lv.key === 'mid' ? 'warning' : 'danger'})">${t.mastery}%</div>
          <button class="btn btn-ghost btn-sm" onclick="Student.openTopic('${t.id}')">学习</button>
        </div>`;
    }).join('');

    // 最近轨迹
    const traceRows = Engine.state.trace.slice(0, 5).map(x => `
      <div class="topic-row">
        <div class="topic-emoji" style="background:var(--surface-3)">${DATA.topics.find(t => t.id === x.topicId)?.icon || '📘'}</div>
        <div class="topic-main">
          <div class="topic-name">${x.topicName} · ${x.actName}</div>
          <div class="topic-meta">掌握度 ${x.before}% → ${x.after}%</div>
        </div>
        <span class="badge ${x.delta > 0 ? 'badge-success' : 'badge-muted'}">+${x.delta}%</span>
      </div>`).join('') || UI.empty('还没有学习记录，先完成一个活动试试', '🌱');

    return `
      ${preBanner}

      <div class="hero mb-16">
        <div class="hero-inner">
          <div class="row" style="gap:9px;opacity:.9;font-size:12.5px;font-weight:600">
            ${I('sparkles', 14)} Adaptive Study Assistant
          </div>
          <div class="hero-title" style="margin-top:8px">${greet()}，${Engine.state.studentName}</div>
          <div class="hero-sub">
            你的整体掌握度 <b>${overall}%</b>。Agent 已分析 ${Engine.topics().length} 个知识点，
            为你规划了下一步学习活动 —— 它会随着你的每次作答持续调整。
          </div>
          <div class="hero-actions">
            <button class="btn-on-hero" onclick="Student.start('${act.id}','${tp.id}')">
              ${I('play', 15)} 开始「${act.name}」
            </button>
            <button class="btn-on-hero outline" onclick="App.go('#/student/explore')">
              ${I('sparkles', 15)} 自定义学习主题
            </button>
          </div>
        </div>
      </div>

      <div class="grid g-main mb-16">
        <!-- 下一步活动 -->
        <div class="next-card">
          <div class="next-top">
            <div class="next-ico">${act.icon}</div>
            <div style="flex:1">
              <div class="text-xs" style="color:var(--primary-600);font-weight:700;letter-spacing:.04em">ADAPTIVE PLANNING AGENT · 推荐下一步</div>
              <div style="font-size:17px;font-weight:800;margin-top:2px">${act.name}</div>
              <div class="text-sm" style="color:var(--text-2)">${tp.icon} ${tp.name} · ${act.desc}</div>
            </div>
            <div style="text-align:center">${UI.ring(tp.mastery, 76)}</div>
          </div>
          <div class="next-body">
            <div class="h-section mb-8" style="font-size:13.5px">决策依据</div>
            <div class="reason-box">
              ${plan.reason}
              <div class="mt-8">命中规则：<span class="reason-rule">${plan.rule}</span></div>
            </div>
            <div class="row mt-16">
              <button class="btn btn-grad" onclick="Student.start('${act.id}','${tp.id}')">${I('play',15)} 开始这个活动</button>
              <button class="btn btn-ghost" onclick="Student.openTopic('${tp.id}')">查看全部活动</button>
            </div>
          </div>
        </div>

        <!-- 闭环 + 总览 -->
        <div class="col">
          <div class="card">
            <div class="card-head"><span class="h-section">自适应闭环</span></div>
            <div class="card-body">
              <div class="trace">${trace}</div>
              <div class="text-sm mt-16" style="color:var(--text-3)">
                完成活动后 Agent 会 <b>Observe</b> 你的作答、<b>Update</b> 掌握度，并 <b>Re-plan</b> 下一步。
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <div class="row">
                <div style="text-align:center">${UI.ring(overall, 92, '整体掌握度')}</div>
                <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:12px">
                  ${stat('已完成活动', Engine.state.completed, 'flame', '')}
                  ${stat('连续学习', Engine.state.streak + ' 天', 'clock', '')}
                  ${stat('薄弱知识点', Engine.topics().filter(t => t.mastery < 45).length, 'bug', 'amber')}
                  ${stat('已掌握', Engine.topics().filter(t => t.mastery >= 75).length, 'check', 'green')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid g-main">
        <div class="card">
          <div class="card-head">
            <span class="h-section">知识状态模型</span>
            <span class="spacer"></span>
            <div class="mastery-legend">
              <span><i style="background:#22c55e"></i>已掌握</span>
              <span><i style="background:#f59e0b"></i>学习中</span>
              <span><i style="background:#f87171"></i>薄弱</span>
            </div>
          </div>
          ${topicRows}
        </div>

        <div class="card">
          <div class="card-head"><span class="h-section">最近学习轨迹</span><span class="spacer"></span>
            <button class="btn btn-ghost btn-sm" onclick="App.go('#/student/progress')">全部</button>
          </div>
          ${traceRows}
        </div>
      </div>
    `;
  }

  function stat(label, val, ic, tone) {
    return `
      <div>
        <div class="stat-icon ${tone}" style="width:30px;height:30px;border-radius:9px">${I(ic, 15)}</div>
        <div class="stat-value" style="font-size:20px;margin-top:6px">${val}</div>
        <div class="text-xs" style="color:var(--text-3)">${label}</div>
      </div>`;
  }

  function greet() {
    const h = new Date().getHours();
    return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  }

  /* ================= 知识点详情（可选活动） ================= */
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
        <div class="spacer"></div>
        <div style="text-align:center">${UI.ring(t.mastery, 72)}</div>
      </div>

      <div class="card card-pad mb-16">
        <div class="row" style="gap:12px">
          ${I('brain', 20)}
          <div style="flex:1">
            <div style="font-weight:700">Agent 推荐：${p.activity.icon} ${p.activity.name}</div>
            <div class="text-sm" style="color:var(--text-2)">${p.reason} · 规则 <span class="reason-rule">${p.rule}</span></div>
          </div>
        </div>
      </div>

      <div class="section-head"><span class="h-section">选择学习活动</span>
        <span class="spacer"></span><span class="text-sm" style="color:var(--text-3)">共 ${Object.keys(DATA.activities).length} 种形式</span>
      </div>
      <div class="act-grid">${acts}</div>
    `;
  }

  /* ================= Pre-test ================= */
  let P = null;

  function pretest() {
    P = { i: 0, answers: [], sel: null, fb: null };
    App.go('#/student/pretest');
  }

  function pretestView() {
    if (!P) pretest();

    if (P.i >= DATA.topics.length) {
      const correct = P.answers.filter(a => a.correct).length;
      return `
        <div class="runner">
          <div class="card card-pad" style="text-align:center">
            <div style="font-size:40px">🎉</div>
            <div class="h-section mt-8" style="font-size:18px">Pre-test 完成</div>
            <div class="text-sm mt-8" style="color:var(--text-2)">
              答对 ${correct} / ${DATA.topics.length} 题。Agent 已据此为各知识点建立初始掌握度，并生成第一条学习路径。
            </div>
            <div class="row mt-16" style="justify-content:center">
              <button class="btn btn-grad" onclick="Student.commitPretest()">生成我的学习路径</button>
            </div>
          </div>
        </div>`;
    }

    const t = DATA.topics[P.i];
    const q = DATA.challenge[t.id];
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
        <button class="btn btn-primary" onclick="Student.nextPretest()">${P.i === DATA.topics.length - 1 ? '查看结果' : '下一题'} ${I('arrowRight',15)}</button>
      </div>` : '';

    return `
      <div class="runner">
        <div class="runner-head">
          <div>
            <div class="runner-title">Pre-test · 起点评估</div>
            <div class="runner-topic">第 ${P.i + 1} / ${DATA.topics.length} 题 · ${t.icon} ${t.name}</div>
          </div>
        </div>
        <div class="card card-pad">
          <div class="bar mb-16"><div class="bar-fill" style="width:${(P.i / DATA.topics.length) * 100}%"></div></div>
          <div class="q-text">${q.q}</div>
          ${opts}
          ${fb}
        </div>
      </div>`;
  }

  function pickPretest(i) { P.sel = i; App.render(); }

  function nextPretest() {
    const t = DATA.topics[P.i];
    const q = DATA.challenge[t.id];
    P.answers.push({ topicId: t.id, correct: P.sel === q.a });
    P.i++; P.sel = null;
    App.render();
  }

  function commitPretest() {
    Engine.applyPreTest(P.answers);
    P = null;
    UI.toast('已生成个性化学习路径', 'ok');
    App.go('#/student/dashboard');
  }

  /* ================= 活动运行器 ================= */
  function activity(type, topicId) {
    if (!A || A.type !== type || A.topicId !== topicId) {
      // 直接进入 URL 时初始化
      A = { type, topicId, result: null };
      if (type === 'explain') { A.slides = DATA.explain[topicId] || DATA.explain.req; A.i = 0; A.asked = null; }
      else if (type === 'practice') { A.qs = DATA.practice[topicId] || DATA.practice.req; A.i = 0; A.sel = null; A.fb = null; A.correct = 0; }
      else if (type === 'challenge') { A.q = DATA.challenge[topicId] || DATA.challenge.req; A.sel = null; A.fb = null; }
      else if (type === 'review') { A.cards = (DATA.explain[topicId] || DATA.explain.req).map(s => ({ q: s.t, a: s.tip })); A.i = 0; A.flip = false; }
      else if (type === 'simulation') { A.steps = [...DATA.simulation.steps]; A.order = []; }
      else if (type === 'roleplay') { A.msgs = [{ who: 'ai', text: DATA.roleplay.opening }]; A.turn = 0; }
      else if (type === 'game') {
        A.lv = DATA.bugs[0]; A.found = []; A.time = A.lv.time; A.submitted = false; A.timerId = null;
        startTimer();
      }
      else if (type === 'coding') { A.code = DATA.coding.starter; A.ran = false; }
    }

    const t = Engine.topic(topicId);
    const act = DATA.activities[type];

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

          <div class="card card-pad mt-16" style="background:var(--grad-soft);border-color:#c7d2fe">
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
              <button class="btn btn-grad" onclick="Student.start('${r.re.activity.id}','${r.topic.id}')">
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
    else if (type === 'practice') body = vPractice();
    else if (type === 'challenge')body = vChallenge();
    else if (type === 'review')   body = vReview();
    else if (type === 'simulation') body = vSim();
    else if (type === 'roleplay') body = vRoleplay();
    else if (type === 'game')     body = vGame();
    else if (type === 'coding')   body = vCoding();

    return `
      <div class="runner">
        <div class="runner-head">
          <button class="btn btn-ghost btn-sm" onclick="Student.quit()">${I('arrowLeft',15)} 退出</button>
          <div>
            <div class="runner-title">${act.icon} ${act.name}</div>
            <div class="runner-topic">${t.icon} ${t.name} · 训练：${act.ability}</div>
          </div>
        </div>
        ${body}
      </div>`;
  }

  function quit() {
    if (A && A.timerId) clearInterval(A.timerId);
    A = null;
    App.go('#/student/dashboard');
  }

  /* ---- 交互式讲解 ---- */
  function vExplain() {
    const s = A.slides[A.i];
    const items = s.items.map(x => `<div class="slide-item"><span class="slide-bullet"></span><div>${x}</div></div>`).join('');
    const last = A.i === A.slides.length - 1;

    const askAns = A.asked ? `
      <div class="ask-answer gen-anim">
        <b>AI 助教：</b>关于「${A.asked}」——${s.tip} 如需更深入，我可以从课程资料中检索 ${Engine.topic(A.topicId).name} 的相关章节为你展开。
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
            ? `<button class="btn btn-grad" onclick="Student.finish({})">完成讲解 ${I('check',15)}</button>`
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

  /* ---- 针对性练习 ---- */
  function vPractice() {
    const q = A.qs[A.i];
    const opts = q.opts.map((o, i) => {
      let cls = '';
      if (A.sel !== null) {
        if (i === q.a) cls = 'correct';
        else if (A.sel === i) cls = 'wrong';
      } else if (A.sel === i) cls = 'selected';
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
          ? `<button class="btn btn-grad" onclick="Student.finishPractice()">完成练习 ${I('check',15)}</button>`
          : `<button class="btn btn-primary" onclick="Student.nextQ()">下一题 ${I('arrowRight',15)}</button>`}
      </div>` : '';

    return `
      <div class="card card-pad">
        <div class="bar mb-16"><div class="bar-fill" style="width:${(A.i / A.qs.length) * 100}%"></div></div>
        <div class="row mb-8"><span class="badge badge-primary">第 ${A.i + 1} / ${A.qs.length} 题</span>
          <span class="text-xs" style="color:var(--text-3)">题目由 Agent 依据你的掌握度动态生成</span></div>
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
  function nextQ() { A.i++; A.sel = null; App.render(); }
  function finishPractice() {
    finish({ correct: A.correct >= Math.ceil(A.qs.length / 2) });
  }

  /* ---- 挑战 ---- */
  function vChallenge() {
    const q = A.q;
    const opts = q.opts.map((o, i) => {
      let cls = '';
      if (A.sel !== null) {
        if (i === q.a) cls = 'correct';
        else if (A.sel === i) cls = 'wrong';
      }
      return `<button class="opt ${cls}" ${A.sel !== null ? 'disabled' : `onclick="Student.pickC(${i})"`}>
                <span class="opt-key">${'ABCD'[i]}</span><span class="opt-label">${o}</span>
              </button>`;
    }).join('');
    const fb = A.sel !== null ? `
      <div class="feedback ${A.sel === q.a ? 'ok' : 'bad'}">
        <div class="feedback-title">${A.sel === q.a ? I('check',15) + ' 挑战成功' : I('bug',15) + ' 挑战失败'}</div>
        ${q.why}
      </div>
      <div class="row mt-16"><button class="btn btn-grad" onclick="Student.finish({correct:${A.sel === q.a}})">完成挑战 ${I('check',15)}</button></div>` : '';

    return `
      <div class="card card-pad">
        <div class="row mb-8">
          <span class="badge badge-danger">难度提升</span>
          <span class="text-xs" style="color:var(--text-3)">综合场景题 · 检验知识迁移</span>
        </div>
        <div class="q-text">${q.q}</div>
        ${opts}${fb}
      </div>`;
  }
  function pickC(i) {
    if (A.sel !== null) return;
    A.sel = i;
    App.render();
  }

  /* ---- 复习闪卡 ---- */
  function vReview() {
    const c = A.cards[A.i];
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
        ${last ? `<button class="btn btn-grad" onclick="Student.finish({})">完成复习 ${I('check',15)}</button>`
               : `<button class="btn btn-primary" onclick="Student.card(1)">下一张 ${I('arrowRight',15)}</button>`}
      </div>`;
  }
  function flip() { A.flip = !A.flip; App.render(); }
  function card(d) { A.i = Math.max(0, Math.min(A.cards.length - 1, A.i + d)); A.flip = false; App.render(); }

  /* ---- 交互仿真 ---- */
  function vSim() {
    const locked = A.order;
    const items = A.steps.map(s => {
      const pos = locked.indexOf(s.id);
      const isLocked = pos >= 0;
      return `<button class="sim-item ${isLocked ? 'locked' : ''}" ${isLocked ? 'disabled' : `onclick="Student.order('${s.id}')"`}>
                <span class="sim-order">${isLocked ? pos + 1 : I('plus', 12)}</span>
                <span class="sim-text">${s.text}</span>
              </button>`;
    }).join('');

    const done = locked.length === A.steps.length;
    const ok = done && A.order.join() === DATA.simulation.correct.join();

    const result = done ? `
      <div class="feedback ${ok ? 'ok' : 'bad'} mt-16">
        <div class="feedback-title">${ok ? I('check',15) + ' 编排正确！' : I('bug',15) + ' 顺序有误'}</div>
        ${ok ? '你已经完整搭建出「接收 → 检索 → 决策 → 生成 → 评估 → 更新 → 重规划」的 Agent 闭环。'
             : `正确顺序应为：${DATA.simulation.correct.map(id => A.steps.find(s => s.id === id).text).join(' → ')}`}
      </div>
      <div class="row mt-16">
        ${ok ? `<button class="btn btn-grad" onclick="Student.finish({correct:true})">完成仿真 ${I('check',15)}</button>`
             : `<button class="btn btn-ghost" onclick="Student.resetSim()">重新编排</button>
                <button class="btn btn-primary" onclick="Student.finish({correct:false})">仍要提交</button>`}
      </div>` : '';

    return `
      <div class="card card-pad">
        <div class="row mb-8"><span class="badge badge-info">可视化沙盒</span>
          <span class="text-sm" style="color:var(--text-3)">${DATA.simulation.desc}</span></div>
        <div class="q-text">${DATA.simulation.title}</div>
        <div class="sim-list">${items}</div>
        <div class="mt-16 text-sm" style="color:var(--text-3)">已编排 ${locked.length} / ${A.steps.length} 步</div>
        ${result}
      </div>`;
  }
  function order(id) {
    if (A.order.includes(id)) return;
    A.order.push(id);
    App.render();
  }
  function resetSim() { A.order = []; App.render(); }

  /* ---- 角色扮演 ---- */
  function vRoleplay() {
    const rp = DATA.roleplay;
    const msgs = A.msgs.map(m => `
      <div class="msg ${m.who === 'ai' ? 'ai' : 'me'}">
        <div class="msg-who">${m.who === 'ai' ? rp.persona.name : '我'}</div>
        ${m.text}
      </div>`).join('');

    const tip = A.turn > 0 && A.turn <= rp.coach.length
      ? `<div class="reason-box mt-8"><b>AI 教练提示：</b>${rp.coach[A.turn - 1]}</div>` : '';

    return `
      <div class="card" style="overflow:hidden">
        <div class="card-head">
          <span class="avatar" style="width:28px;height:28px;font-size:11px">${rp.persona.avatar}</span>
          <div>
            <div style="font-weight:700;font-size:13.5px">${rp.persona.name}</div>
            <div class="text-xs" style="color:var(--text-3)">模拟面试 / 需求沟通</div>
          </div>
          <span class="spacer"></span>
          <span class="badge badge-primary">第 ${A.turn} 轮</span>
        </div>
        <div class="reason-box" style="margin:14px 16px 0"><b>场景：</b>${rp.scenario}</div>
        <div class="chat-wrap">
          <div class="chat-scroll" id="chat-scroll">${msgs}</div>
          <div class="chat-input">
            <input id="chat-in" placeholder="向客户提问，例如：活动有名额上限吗？"
                   onkeydown="if(event.key==='Enter')Student.send()">
            <button class="btn btn-grad" onclick="Student.send()">${I('arrowRight',15)}</button>
          </div>
        </div>
      </div>
      ${tip}
      <div class="row mt-16">
        <span class="text-sm" style="color:var(--text-3)">沟通 ${A.turn} 轮 · 建议至少 3 轮以充分澄清需求</span>
        <span class="spacer"></span>
        <button class="btn btn-grad" ${A.turn < 1 ? 'disabled' : ''} onclick="Student.finish({})">结束对话并复盘 ${I('check',15)}</button>
      </div>`;
  }
  function send() {
    const el = document.getElementById('chat-in');
    if (!el || !el.value.trim()) return;
    const text = el.value.trim();
    A.msgs.push({ who: 'me', text });
    A.turn++;

    // 关键词匹配生成回复
    const rp = DATA.roleplay;
    const hit = rp.replies.find(r => r.kw.some(k => text.includes(k)));
    const reply = hit ? hit.text : rp.fallback;

    setTimeout(() => {
      A.msgs.push({ who: 'ai', text: reply });
      App.render();
      const sc = document.getElementById('chat-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    }, 650);

    App.render();
  }

  /* ---- Bug Hunter ---- */
  function vGame() {
    const lv = A.lv;
    const lines = lv.lines.map((l, i) => {
      let cls = '';
      if (A.submitted) {
        if (lv.bugLines.includes(i) && A.found.includes(i)) cls = 'found';
        else if (lv.bugLines.includes(i)) cls = 'missed';
        else if (A.found.includes(i)) cls = 'missed';
      } else if (A.found.includes(i)) cls = 'found';
      return `<div class="code-line ${cls}" ${A.submitted ? '' : `onclick="Student.toggleLine(${i})"`}>
                <span class="code-num">${i + 1}</span><span class="code-src">${hl(l) || '&nbsp;'}</span>
              </div>`;
    }).join('');

    const score = A.submitted
      ? `已找到 ${A.found.filter(f => lv.bugLines.includes(f)).length} / ${lv.bugLines.length} 处问题`
      : `已标记 ${A.found.length} 处`;

    const after = A.submitted ? `
      <div class="feedback ${A.found.filter(f => lv.bugLines.includes(f)).length === lv.bugLines.length ? 'ok' : 'bad'} mt-16">
        <div class="feedback-title">${I('bug',15)} 结果</div>
        ${lv.hints.join('<br>')}
      </div>
      <div class="row mt-16">
        <button class="btn btn-grad" onclick="Student.finish({score:${A.found.filter(f => lv.bugLines.includes(f)).length * 20}})">
          结束游戏 ${I('check',15)}
        </button>
      </div>` : `
      <div class="row mt-16">
        <span class="text-sm" style="color:var(--text-3)">${lv.hints.length > 0 ? '提示：先找语法与边界问题' : ''}</span>
        <span class="spacer"></span>
        <button class="btn btn-grad" onclick="Student.submitGame()">提交答案 ${I('check',15)}</button>
      </div>`;

    return `
      <div class="game-hud">
        <div class="hud-item">${I('clock',15)} <span class="hud-timer ${A.time <= 10 ? 'urgent' : ''}" id="hud-time">${A.time}s</span></div>
        <div class="hud-item">${I('bug',15)} ${score}</div>
        <div class="spacer"></div>
        <span class="badge badge-warning">${I('sparkles',12)} 训练 Discernment</span>
      </div>
      <div class="card card-pad">
        <div class="row mb-8">
          <span class="badge badge-danger">AI 生成的代码</span>
          <span class="text-sm" style="color:var(--text-3)">点击你认为有问题的行 · ${lv.title}</span>
        </div>
        <div class="code-box">${lines}</div>
        ${after}
      </div>`;
  }
  function toggleLine(i) {
    if (A.submitted) return;
    const k = A.found.indexOf(i);
    if (k >= 0) A.found.splice(k, 1); else A.found.push(i);
    App.render();
  }
  function submitGame() {
    if (A.submitted) return;
    A.submitted = true;
    if (A.timerId) clearInterval(A.timerId);
    App.render();
  }

  /* ---- 在线编程 ---- */
  function vCoding() {
    const c = DATA.coding;
    const tests = A.ran ? c.tests.map(t => `
      <div><span class="${t.pass ? 'ok' : 'fail'}">${t.pass ? '✓ PASS' : '✗ FAIL'}</span>
        <span class="dim"> isBalanced(${t.input}) → 期望 ${t.expect}</span></div>`).join('') : '';

    const ai = A.ran ? `
      <div class="feedback ok mt-16">
        <div class="feedback-title">${I('sparkles',15)} AI 实时反馈</div>
        ${c.aiFeedback.map(f => '· ' + f).join('<br>')}
      </div>
      <div class="row mt-16">
        <button class="btn btn-grad" onclick="Student.finish({correct:true})">完成练习 ${I('check',15)}</button>
      </div>` : `
      <div class="row mt-16">
        <span class="spacer"></span>
        <button class="btn btn-grad" onclick="Student.runCode()">${I('play',15)} 运行测试</button>
      </div>`;

    return `
      <div class="card card-pad">
        <div class="row mb-8"><span class="badge badge-primary">${I('code',12)} 在线编程</span>
          <span class="text-sm" style="color:var(--text-3)">浏览器内运行 · AI 实时反馈</span></div>
        <div class="q-text">${c.prompt}</div>
        <textarea class="code-editor" id="code-area" spellcheck="false">${A.code}</textarea>
        ${A.ran ? `<div class="terminal"><span class="dim">$ node test.js</span>\n${tests}\n<span class="dim">5 tests · ${c.tests.filter(t=>t.pass).length} passed · ${c.tests.filter(t=>!t.pass).length} failed</span></div>` : ''}
        ${ai}
      </div>`;
  }
  function runCode() {
    const el = document.getElementById('code-area');
    if (el) A.code = el.value;
    A.ran = true;
    App.render();
  }

  /* ================= 自生成学习路径 ================= */
  let G = null;
  function explore() { G = null; App.go('#/student/explore'); }

  function exploreView() {
    const gen = G ? `
      <div class="card card-pad mt-16 gen-anim">
        <div class="row" style="gap:10px">
          ${I('sparkles', 18)}
          <div style="font-weight:700;font-size:16px">${G.title}</div>
          <span class="badge badge-primary">AI 生成</span>
          <span class="spacer"></span>
          <span class="chip">${I('clock',13)} 约 ${G.estMins} 分钟</span>
        </div>
        <div class="text-sm mt-8" style="color:var(--text-2)">${G.desc}</div>
        <div class="divider"></div>
        ${G.outline.map((o, i) => `
          <div class="outline-item">
            <span class="outline-idx">${i + 1}</span>
            <div style="flex:1">
              <div class="outline-title">${o.title}</div>
              <div class="outline-meta">${o.acts.join(' · ')} · 约 ${o.mins} 分钟</div>
            </div>
            <button class="btn btn-soft btn-sm" onclick="Student.enroll('${o.title}')">加入路径</button>
          </div>`).join('')}
        <div class="row mt-16">
          <button class="btn btn-grad" onclick="Student.enrollAll()">${I('play',15)} 全部加入我的学习路径</button>
          <button class="btn btn-ghost" onclick="Student.explore()">重新生成</button>
        </div>
      </div>` : '';

    return `
      <div class="section-head">
        <div>
          <div class="h-section" style="font-size:18px">自定义学习主题</div>
          <div class="text-sm" style="color:var(--text-3)">输入任何你想学的主题，AI 会基于课程资料生成 mini-course 与学习路径</div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="gen-input">
          <input id="gen-topic" placeholder="例如：Docker 容器化部署 / 领域驱动设计 / 前端性能优化"
                 onkeydown="if(event.key==='Enter')Student.gen()">
          <button class="btn btn-grad" onclick="Student.gen()">${I('sparkles',15)} 生成课程</button>
        </div>
        <div class="row row-wrap">
          ${['代码重构实战', 'RESTful API 设计', '单元测试入门', 'Scrum 实战'].map(t =>
            `<button class="chip" onclick="Student.setTopic('${t}')">${t}</button>`).join('')}
        </div>
      </div>

      ${gen || `
        <div class="card mt-16">
          <div class="card-head"><span class="h-section">我当前的自适应学习路径</span></div>
          <div class="card-body">
            ${Engine.topics().slice().sort((a,b)=>a.mastery-b.mastery).slice(0,4).map(t => {
              const p = Engine.plan(t.id);
              return `<div class="outline-item">
                <span class="outline-idx">${t.icon}</span>
                <div style="flex:1">
                  <div class="outline-title">${t.name}</div>
                  <div class="outline-meta">下一步：${p.activity.icon} ${p.activity.name} · 掌握度 ${t.mastery}%</div>
                </div>
                <button class="btn btn-soft btn-sm" onclick="Student.start('${p.activity.id}','${t.id}')">开始</button>
              </div>`;
            }).join('')}
          </div>
        </div>`}
    `;
  }
  function setTopic(t) {
    const el = document.getElementById('gen-topic');
    if (el) { el.value = t; el.focus(); }
  }
  function gen() {
    const el = document.getElementById('gen-topic');
    const v = el ? el.value : '';
    if (!v.trim()) { UI.toast('请先输入一个学习主题', 'warn'); return; }
    UI.toast('正在基于课程资料生成 mini-course…');
    setTimeout(() => {
      G = Engine.generateCourse(v);
      App.render();
      UI.toast('已生成 5 个学习单元', 'ok');
    }, 900);
  }
  function enroll(title) { UI.toast(`已加入：${title}`, 'ok'); }
  function enrollAll() {
    UI.toast('已加入学习路径，Agent 将据此调整规划', 'ok');
    setTimeout(() => App.go('#/student/dashboard'), 600);
  }

  /* ================= 进度 ================= */
  function progress() {
    const ts = Engine.topics().slice().sort((a, b) => b.mastery - a.mastery);
    return `
      <div class="section-head">
        <div>
          <div class="h-section" style="font-size:18px">学习进度与掌握度</div>
          <div class="text-sm" style="color:var(--text-3)">Pre-test → Learning Session → Post-test 的过程数据</div>
        </div>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" onclick="Student.reset()">${I('refresh',14)} 重置演示数据</button>
      </div>

      <div class="grid g-4 mb-16">
        ${kpi('整体掌握度', Engine.overallMastery() + '%', 'target', '', '较初始 +18%')}
        ${kpi('已完成活动', Engine.state.completed, 'flame', '', '本周 +7')}
        ${kpi('薄弱知识点', Engine.topics().filter(t => t.mastery < 45).length, 'bug', 'amber', '需优先关注')}
        ${kpi('已掌握', Engine.topics().filter(t => t.mastery >= 75).length, 'check', 'green', '共 8 个知识点')}
      </div>

      <div class="grid g-main">
        <div class="card">
          <div class="card-head"><span class="h-section">各知识点掌握度</span></div>
          <div class="card-body">
            ${ts.map(t => `
              <div class="mb-16">
                <div class="row mb-8">
                  <span style="font-weight:600;font-size:13.5px">${t.icon} ${t.name}</span>
                  <span class="spacer"></span>
                  <span style="font-weight:800">${t.mastery}%</span>
                  <span class="badge ${UI.level(t.mastery).badge}">${UI.level(t.mastery).label}</span>
                </div>
                ${UI.bar(t.mastery)}
                <div class="text-xs mt-8" style="color:var(--text-3)">练习 ${t.attempts} 次 · 错误 ${t.errors} 次${t.lastActivity ? ` · 最近：${t.lastActivity}` : ''}</div>
              </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><span class="h-section">全部学习轨迹</span></div>
          ${Engine.state.trace.length ? Engine.state.trace.map(x => `
            <div class="topic-row">
              <div class="topic-emoji">${DATA.topics.find(t => t.id === x.topicId)?.icon || '📘'}</div>
              <div class="topic-main">
                <div class="topic-name">${x.actName}</div>
                <div class="topic-meta">${x.topicName} · ${x.before}% → ${x.after}%</div>
              </div>
              <span class="badge badge-success">+${x.delta}%</span>
            </div>`).join('') : UI.empty('暂无记录', '📊')}
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
    UI.toast('演示数据已重置', 'ok');
    App.go('#/student/dashboard');
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
    slide, ask, pick, nextQ, finishPractice, pickC, flip, card,
    order, resetSim, send, toggleLine, submitGame, runCode, finish,
    explore, exploreView, setTopic, gen, enroll, enrollAll,
    progress, reset,
  };
})();
