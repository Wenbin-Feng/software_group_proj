/* ============================================================
   engine.js — 学生知识模型 + 自适应规划 Agent（前端模拟）
   对应 README 中的 Adaptive Planning Agent 与 Student Knowledge Model
   ============================================================ */

const Engine = (() => {

  /* ---------------- 持久化 ---------------- */
  const KEY = 'asap_state_v1';

  let state = {
    role: 'student',              // student | instructor | admin
    studentName: '陈家明',
    hasPreTest: false,
    topics: [],                   // 学生知识模型
    trace: [],                    // 规划轨迹日志
    loopStage: 'plan',            // plan|act|observe|update|replan
    lastActivity: null,
    completed: 0,                 // 已完成活动数
    streak: 5,
  };

  function init() {
    // file:// 打开时部分浏览器会禁用 localStorage，需容错降级为内存态
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
    if (saved) {
      try { state = JSON.parse(saved); return; } catch (e) { /* 忽略损坏数据 */ }
    }
    reset();
  }

  function reset() {
    state.topics = DATA.topics.map(t => ({ ...t }));
    state.hasPreTest = false;
    state.trace = [];
    state.loopStage = 'plan';
    state.lastActivity = null;
    state.completed = 0;
    save();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------------- 知识模型读写 ---------------- */
  function topics() { return state.topics; }
  function topic(id) { return state.topics.find(t => t.id === id); }

  function overallMastery() {
    if (!state.topics.length) return 0;
    return Math.round(state.topics.reduce((s, t) => s + t.mastery, 0) / state.topics.length);
  }

  /* ---------------- 自适应规划规则 ---------------- */
  /* 决策优先级：
     1) 反复出错 → 复习
     2) 掌握不足 (<40) → 概念讲解
     3) 中等 (40-70) → 针对性练习
     4) 较好 (70-85) → 难度提升挑战
     5) 已掌握 (>=85) → 应用类活动（仿真 / 角色扮演 / 编程）
  */
  function plan(topicId) {
    const t = topic(topicId);
    if (!t) return null;

    let actId, reason, rule;

    if (t.errors >= 2 && t.mastery < 75) {
      actId = 'review';
      rule = `errors >= 2 且 mastery < 75`;
      reason = `该知识点已累计 <b>${t.errors} 次错误</b>，且掌握度仅 ${t.mastery}%，需要先纠正错误概念再继续。`;
    } else if (t.mastery < 40) {
      actId = 'explain';
      rule = `mastery < 40`;
      reason = `掌握度 ${t.mastery}%（&lt; 40%）属于薄弱区，需要先建立概念理解。`;
    } else if (t.mastery < 70) {
      actId = 'practice';
      rule = `40 <= mastery < 70`;
      reason = `掌握度 ${t.mastery}% 已有基础但仍不稳定，通过针对性练习巩固应用。`;
    } else if (t.mastery < 85) {
      actId = 'challenge';
      rule = `70 <= mastery < 85`;
      reason = `掌握度 ${t.mastery}% 接近熟练，提升难度以突破瓶颈。`;
    } else {
      // 已掌握 → 应用类活动轮转
      const applied = ['simulation', 'roleplay', 'coding', 'game'];
      const idx = (t.attempts || 0) % applied.length;
      actId = applied[idx];
      rule = `mastery >= 85 → 应用类轮转`;
      reason = `掌握度 ${t.mastery}% 已达熟练，转向知识应用与迁移（${DATA.activities[actId].name}）。`;
    }

    return { topic: t, activity: DATA.activities[actId], reason, rule };
  }

  /* 选择「当前最该学」的知识点：
     优先照顾掌握度最低且未完成的知识点的薄弱项 */
  function nextTopic() {
    const sorted = [...state.topics].sort((a, b) => {
      // 错误多的优先，其次掌握度低的优先
      if (b.errors !== a.errors) return b.errors - a.errors;
      return a.mastery - b.mastery;
    });
    return sorted[0];
  }

  function nextPlan() {
    const t = nextTopic();
    return plan(t.id);
  }

  /* ---------------- 活动完成 → 状态更新 ---------------- */
  /* 对应 Observe → Update 阶段 */
  function applyResult(topicId, actId, outcome) {
    const t = topic(topicId);
    if (!t) return null;

    const before = t.mastery;
    let delta = 0;

    switch (actId) {
      case 'explain':
        delta = 9;
        break;
      case 'practice':
        delta = outcome.correct ? 13 : 4;
        if (!outcome.correct) t.errors += 1;
        break;
      case 'challenge':
        delta = outcome.correct ? 16 : 3;
        if (!outcome.correct) t.errors += 1;
        break;
      case 'review':
        delta = 7;
        t.errors = 0;                     // 复习后清空错误计数
        break;
      case 'game':
        delta = Math.round(6 + (outcome.score || 0) * 0.45);
        break;
      case 'simulation':
        delta = outcome.correct ? 12 : 5;
        break;
      case 'roleplay':
        delta = 8;
        break;
      case 'coding':
        delta = outcome.correct ? 12 : 5;
        break;
      default:
        delta = 5;
    }

    t.mastery = Math.max(0, Math.min(100, t.mastery + delta));
    t.attempts += 1;
    t.lastActivity = DATA.activities[actId].name;

    state.completed += 1;
    state.lastActivity = { topicId, actId, delta, ts: Date.now() };

    // 记录轨迹
    state.trace.unshift({
      ts: Date.now(),
      topicId, topicName: t.name,
      actId, actName: DATA.activities[actId].name,
      delta, before, after: t.mastery,
      ok: outcome.correct !== false,
    });
    if (state.trace.length > 30) state.trace.pop();

    const after = t.mastery;
    const re = plan(topicId);         // Re-plan

    save();
    return { topic: t, before, after, delta, re };
  }

  /* ---------------- Pre-test：初始化知识状态 ---------------- */
  function applyPreTest(answers) {
    // answers: [{topicId, correct}]
    state.topics.forEach(t => {
      const a = answers.find(x => x.topicId === t.id);
      t.mastery = a && a.correct ? 45 : 20;
      t.attempts += 1;
      t.errors = a && a.correct ? 0 : 1;
    });
    state.hasPreTest = true;
    state.loopStage = 'plan';
    save();
  }

  /* ---------------- 循环阶段控制 ---------------- */
  function setStage(s) { state.loopStage = s; save(); }
  function stage() { return state.loopStage; }

  /* ---------------- 角色 ---------------- */
  function setRole(r) { state.role = r; save(); }
  function role() { return state.role; }

  /* ---------------- 生成式课程（模拟 AI） ---------------- */
  function generateCourse(topicText) {
    const t = topicText.trim() || '软件工程';
    const tmpl = [
      { title: `${t} · 核心概念与术语`, acts: ['交互式讲解', '针对性练习'], mins: 15 },
      { title: `${t} · 原理拆解与案例`,  acts: ['交互式讲解', '交互仿真'],   mins: 20 },
      { title: `${t} · 动手实践`,        acts: ['在线编程', 'Bug Hunter'],  mins: 25 },
      { title: `${t} · 常见误区辨析`,    acts: ['针对性练习', '知识复习'],   mins: 15 },
      { title: `${t} · 综合应用与评估`,  acts: ['角色扮演', '难度提升挑战'], mins: 20 },
    ];
    return {
      title: `${t} 迷你课程`,
      desc: `基于课程资料与教学目标自动生成，共 5 个学习单元，覆盖概念 → 原理 → 实践 → 辨析 → 应用。`,
      outline: tmpl,
      estMins: tmpl.reduce((s, x) => s + x.mins, 0),
    };
  }

  /* ---------------- 学生掌握度矩阵（Instructor 热力图） ---------------- */
  function classMatrix() {
    // 用学生 id 做确定性伪随机，保证每次渲染一致
    const seedOf = (s) => s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return DATA.students.map(st => {
      const seed = seedOf(st.id);
      const base = Math.round(st.eng * 0.75) + 10;   // 参与度越高，掌握度基线越高
      const row = DATA.topics.map((tp, i) => {
        const v = (seed * (i + 3) * 7) % 40;
        return Math.max(8, Math.min(98, base - 18 + v));
      });
      return { student: st, scores: row };
    });
  }

  /* ---------------- 某知识点班级平均掌握度 ---------------- */
  function topicAverages() {
    const m = classMatrix();
    return DATA.topics.map((tp, i) => {
      const vals = m.map(r => r.scores[i]);
      return { topic: tp, avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), low: Math.min(...vals) };
    });
  }

  init();

  return {
    state, init, reset, save,
    topics, topic, overallMastery,
    plan, nextTopic, nextPlan, applyResult, applyPreTest,
    setStage, stage, setRole, role,
    generateCourse, classMatrix, topicAverages,
  };
})();
