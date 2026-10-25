/* ============================================================
   engine.js — 知识模型 + 自适应规划 Agent + 课程仓库（前端模拟）
   对应 README 中的 Adaptive Planning Agent、Student Knowledge Model
   与「教师 AI 生成课程 → 人工审核 → 发布」治理链路
   ============================================================ */

const Engine = (() => {

  /* ---------------- 持久化 ---------------- */
  /* v8：演示账号改名（student1..N / Teacher），与旧数据不兼容 */
  const KEY = 'asap_state_v8';

  /* 注意：state 的引用必须保持稳定，reset 只允许就地改写、不允许整体替换 */
  let state = blankState();

  function blankState() {
    return {
      role: 'student',
      studentName: 'student1',
      hasPreTest: false,
      topics: [],                   // 当前生效课程的知识点（学生知识模型）
      activeCourseId: DATA.activeCourseId,
      trace: [],
      loopStage: 'plan',
      lastActivity: null,
      completed: 0,
      streak: 5,
      uploads: [],                  // 学生自主上传的资料
      instFiles: [],                // 教师上传的课件（用于 AI 生成课程）
      courses: [],                  // 课程仓库（含草稿 / 已发布 / 已驳回）
      audit: [],                    // 教师审核操作记录（管理员只读）
    };
  }

  function init() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.keys(state).forEach(k => { delete state[k]; });
        Object.keys(parsed).forEach(k => { state[k] = parsed[k]; });
        if (!Array.isArray(state.uploads)) state.uploads = [];
        if (!Array.isArray(state.instFiles)) state.instFiles = [];
        if (!Array.isArray(state.courses) || !state.courses.length) state.courses = seedCourses();
        if (!Array.isArray(state.audit)) state.audit = [];
        if (!Array.isArray(state.topics)) state.topics = [];
        // 旧版本状态没有 pretested 字段，用旧的全局标记推断，避免进度丢失
        if (state.topics.length) {
          state.topics.forEach(t => { if (t.pretested === undefined) t.pretested = !!state.hasPreTest; });
        }
        rebuildStudentPath();   // 保证与当前「已发布课程」集合完全一致
        return;
      } catch (e) { /* 忽略损坏数据 */ }
    }
    reset();
  }

  function reset() {
    // 就地改写，保持 Engine.state 的引用不变
    const s = blankState();
    Object.keys(s).forEach(k => { state[k] = s[k]; });
    state.courses = seedCourses();
    state.audit = seedAudit();
    rebuildStudentPath();
    save();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* =========================================================
     知识点：统一形态
     { id, name, icon, desc, mastery, attempts, errors, src,
       content: { explain:[{t,items,tip}], quiz:[{q,opts,a,why}], pretest:{...} } }
     ========================================================= */

  /* 由内置素材库构建一个知识点实例 */
  function libTopic(id) {
    const base = DATA.topicLib.find(t => t.id === id);
    if (!base) return null;
    return {
      id: base.id,
      name: base.name,
      icon: base.icon,
      desc: base.desc,
      mastery: base.mastery,
      attempts: base.attempts,
      errors: base.errors,
      // 内置知识点统一以教师发布的那份课程讲义为出处，保证 AI 问答的引用可核对
      src: DATA.materials.length ? DATA.materials[0].name : '内置知识点库',
      content: {
        explain: DATA.explain[id] || [],
        quiz: DATA.practice[id] || [],
        pretest: DATA.challenge[id] || (DATA.practice[id] || [])[0],
      },
    };
  }

  /* =========================================================
     课程仓库
     ========================================================= */

  function seedCourses() {
    return DATA.seedCourses.map((c, i) => {
      const files = (c.files || []).slice();
      const topics = c.topicIds.map(libTopic).filter(Boolean);
      const isAI = c.source.indexOf('AI') >= 0;
      return {
        id: c.id,
        title: c.title,
        source: c.source,
        status: c.status,               // 草稿 / 待审核 / 已发布 / 已驳回 / 已归档
        instructor: c.instructor,
        term: c.term,
        updated: c.updated,
        students: c.students,
        files,
        builtin: true,
        topics,
        // 只有「已发布」的课程会进入学生学习路径，按此时间戳依次追加
        publishedAt: c.status === '已发布' ? Date.now() - 86400000 * (i + 1) * 2 : null,
        // AI 生成的内置草稿同样带上课件来源，便于教师在草稿卡上核对依据
        genMeta: isAI ? {
          fileCount: files.length,
          fileNames: files,
          decidedBy: 'AI 依据课件内容抽取',
          estMins: topics.reduce((s, t) => s + (t.mins || 15), 0),
          editedCount: 0,
        } : null,
      };
    });
  }

  function courses() { return state.courses; }
  function course(id) { return state.courses.find(c => c.id === id); }
  function activeCourse() { return course(state.activeCourseId); }

  /* 已发布课程（按发布时间排序）—— 学生学习路径的唯一来源 */
  function publishedCourses() {
    return state.courses
      .filter(c => c.status === '已发布')
      .slice()
      .sort((a, b) => (a.publishedAt || 0) - (b.publishedAt || 0));
  }

  /* ---------- 教师上传课件 ---------- */
  function instFiles() { return state.instFiles; }

  function addInstFile(file) {
    const rec = {
      id: 'if_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: file.name,
      kind: (file.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 5),
      size: fmtSize(file.size),
      status: 'indexing',   // indexing → indexed
      ts: Date.now(),
    };
    state.instFiles.unshift(rec);
    save();
    setTimeout(() => {
      const r = state.instFiles.find(x => x.id === rec.id);
      if (r) { r.status = 'indexed'; save(); }
      if (window.App && location.hash.indexOf('generate') >= 0) App.render();
    }, 1500);
    return rec;
  }

  function removeInstFile(id) {
    state.instFiles = state.instFiles.filter(x => x.id !== id);
    save();
  }

  /* =========================================================
     AI 生成课程
     知识点数量由「上传课件的数量与内容」动态决定，不固定为某个数字
     ========================================================= */

  function pickDomain(text) {
    const s = (text || '').toLowerCase();
    for (const d of DATA.genDomain) {
      if (d.kw.some(k => s.includes(k.toLowerCase()))) return d.key;
    }
    return null;
  }

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  /* AI 依据课件决定知识点个数：课件越多、内容越丰富，抽取出的知识点越多 */
  function decideTopicCount(fileCount) {
    const base = 2 + Math.min(fileCount, 4);        // 每个课件至少贡献 1 个知识点
    const jitter = randInt(0, 2);                   // 课件内部结构的差异
    return Math.max(3, Math.min(8, base + jitter));
  }

  function generateCourse(opts) {
    const files = state.instFiles.filter(f => f.status === 'indexed');
    const title = ((opts && opts.title) || '').trim();
    const theme = (title + ' ' + files.map(f => f.name).join(' ')).trim();

    const n = decideTopicCount(files.length);
    const primary = pickDomain(theme);
    const order = [];
    if (primary) order.push(primary);
    Object.keys(DATA.genbank).forEach(k => { if (k !== primary) order.push(k); });

    // 依次从各领域候选库中抽取，保证不重复
    const pool = [];
    const used = {};
    for (const dom of order) {
      const bank = DATA.genbank[dom] || [];
      for (let i = 0; i < bank.length && pool.length < n; i++) {
        const idx = randInt(0, bank.length - 1);
        const key = dom + '#' + idx;
        if (used[key]) continue;
        used[key] = true;
        pool.push({ ...bank[idx], domain: dom });
      }
    }

    const topics = pool.slice(0, n).map((p, i) => {
      const srcFile = files.length ? files[i % files.length] : null;
      return {
        id: 'g' + Date.now().toString(36) + '_' + i,
        name: p.name,
        icon: p.icon,
        desc: p.desc,
        mastery: 30,       // 新知识点默认起点掌握度（Pre-test 后会被覆盖）
        attempts: 0,
        errors: 0,
        src: srcFile ? srcFile.name : 'AI 依据课件抽取',
        mins: randInt(12, 22),
        content: {
          explain: JSON.parse(JSON.stringify(p.explain || [])),
          quiz: JSON.parse(JSON.stringify(p.quiz || [])),
          pretest: JSON.parse(JSON.stringify((p.quiz || [])[0] || {})),
        },
      };
    });

    // 若个别知识点缺少 pretest（极端兜底），用 quiz[0]
    topics.forEach(t => {
      if (!t.content.pretest || !t.content.pretest.q) t.content.pretest = t.content.quiz[0] || null;
    });

    const estMins = topics.reduce((s, t) => s + (t.mins || 15), 0);

    const c = {
      id: 'c_' + Date.now().toString(36),
      title: title || '未命名新课程',
      source: 'AI 生成',
      status: '待审核',
      instructor: 'Teacher',
      term: '2026 Fall',
      updated: new Date().toISOString().slice(0, 10),
      students: 0,
      files: files.map(f => f.name),
      builtin: false,
      topics,
      genMeta: {
        fileCount: files.length,
        fileNames: files.map(f => f.name),
        decidedBy: 'AI 依据课件内容抽取',
        estMins,
        editedCount: 0,
      },
    };

    state.courses.unshift(c);
    addAudit({
      actor: c.instructor, action: 'AI 生成课程草稿', courseId: c.id, courseTitle: c.title,
      topicCount: topics.length, note: `依据 ${files.length} 份课件抽取 ${topics.length} 个知识点`,
    });
    save();
    return c;
  }

  /* ---------- 知识点编辑（发布前预审 / 发布后修订，同一套能力） ---------- */
  function courseTopic(cid, idx) {
    const c = course(cid);
    if (!c) return null;
    return c.topics[idx] || null;
  }

  function updateTopic(cid, idx, patch) {
    const c = course(cid);
    if (!c) return null;
    const t = c.topics[idx];
    if (!t) return null;

    if (typeof patch.name === 'string') t.name = patch.name.trim() || t.name;
    if (typeof patch.desc === 'string') t.desc = patch.desc.trim();
    if (Array.isArray(patch.explain)) t.content.explain = patch.explain;
    if (Array.isArray(patch.quiz))    t.content.quiz = patch.quiz;
    if (t.content.quiz[0])            t.content.pretest = t.content.quiz[0];

    c.updated = new Date().toISOString().slice(0, 10);
    if (c.genMeta) c.genMeta.editedCount = (c.genMeta.editedCount || 0) + 1;

    // 已发布的课程：修改立即同步给学生（追加式重建路径，不影响已有知识点进度）
    if (c.status === '已发布') syncStudentTopics(c.id);

    if (c.status === '已发布') {
      addAudit({
        actor: c.instructor, action: '发布后修改知识点', courseId: c.id, courseTitle: c.title,
        topicCount: c.topics.length, note: `修改知识点「${t.name}」并同步至学生端`,
      });
    }
    save();
    return t;
  }

  function removeCourseTopic(cid, idx) {
    const c = course(cid);
    if (!c) return;
    const t = c.topics[idx];
    c.topics.splice(idx, 1);
    c.updated = new Date().toISOString().slice(0, 10);
    if (c.genMeta) c.genMeta.editedCount = (c.genMeta.editedCount || 0) + 1;
    if (c.status === '已发布') {
      syncStudentTopics(c.id);
      addAudit({
        actor: c.instructor, action: '发布后修改知识点', courseId: c.id, courseTitle: c.title,
        topicCount: c.topics.length, note: `删除知识点「${t ? t.name : ''}」并同步至学生端`,
      });
    }
    save();
    return t;
  }

  /* ---------- 审核：发布 / 驳回 ----------
     发布 = 追加：新课程的知识点接到学生已有知识点之后，已有进度原样保留 */
  function publishCourse(cid, note) {
    const c = course(cid);
    if (!c) return null;

    const before = state.topics.length;
    c.status = '已发布';
    c.updated = new Date().toISOString().slice(0, 10);
    if (!c.publishedAt) c.publishedAt = Date.now();
    state.activeCourseId = cid;

    const added = rebuildStudentPath();     // 追加式重建

    addAudit({
      actor: c.instructor, action: '审核通过并发布', courseId: c.id, courseTitle: c.title,
      topicCount: c.topics.length,
      note: (note || '') + ` · 追加 ${added.length} 个知识点（原有 ${before} 个 → 现有 ${state.topics.length} 个）`
            + `，人工修订 ${c.genMeta ? c.genMeta.editedCount : 0} 处`,
    });
    save();
    return { course: c, added: added.length, total: state.topics.length, before };
  }

  function rejectCourse(cid, reason) {
    const c = course(cid);
    if (!c) return null;
    c.status = '已驳回';
    c.updated = new Date().toISOString().slice(0, 10);
    addAudit({
      actor: c.instructor, action: '驳回 AI 生成内容', courseId: c.id, courseTitle: c.title,
      topicCount: c.topics.length, note: reason || '内容不符合教学要求',
    });
    rebuildStudentPath();
    save();
    return c;
  }

  /* ============ 学生学习路径 = 全部已发布课程知识点的追加并集 ============
     规则：
       1. 按课程发布时间升序，后发布的知识点排在后面
       2. 已存在的知识点保留其掌握度 / 练习次数 / 错误数，不被重置
       3. 同一知识点在多门课程中重复时，只保留最早出现的一份
       4. 新出现的知识点标记为未 Pre-test，需要补一次起点评估     */
  function rebuildStudentPath() {
    const prev = {};
    state.topics.forEach(t => { prev[t.id] = t; });
    const isFirst = Object.keys(prev).length === 0;

    const list = [];
    publishedCourses().forEach(c => {
      c.topics.forEach(t => {
        if (list.some(x => x.id === t.id)) return;     // 去重：保留最早的一份
        const old = prev[t.id];
        list.push({
          ...t,
          courseId: c.id,
          courseTitle: c.title,
          mastery: old ? old.mastery : (typeof t.mastery === 'number' ? t.mastery : 30),
          attempts: old ? old.attempts : (t.attempts || 0),
          errors: old ? old.errors : (t.errors || 0),
          pretested: old ? !!old.pretested : false,
          lastActivity: old ? old.lastActivity : undefined,
        });
      });
    });

    const added = isFirst ? [] : list.filter(t => !prev[t.id]);
    state.topics = list;
    state.hasPreTest = list.length > 0 && list.every(t => t.pretested);

    if (added.length) {
      state.lastAppend = {
        ts: Date.now(),
        count: added.length,
        courseTitle: added[added.length - 1].courseTitle,
        names: added.slice(0, 5).map(t => t.icon + ' ' + t.name),
      };
    }
    save();
    return added;
  }

  /* 兼容旧调用：把最新修改同步到学生端 */
  function syncStudentTopics(cid) {
    const added = rebuildStudentPath();
    return added;
  }

  /* 学生路径按课程分组，便于「按课程」查看追加进来的知识点 */
  function pathGroups() {
    return publishedCourses().map(c => {
      const topics = c.topics
        .map(t => topic(t.id))
        .filter(t => t && t.courseId === c.id);
      return { course: c, topics };
    }).filter(g => g.topics.length);
  }

  /* 尚未做 Pre-test 的知识点（新发布追加进来的知识点会落在这里） */
  function pendingTopics() { return state.topics.filter(t => !t.pretested); }

  function dismissAppend() { state.lastAppend = null; save(); }

  /* =========================================================
     审核操作记录（管理员端只读）
     ========================================================= */

  /* 演示初始的审核记录：固定 2 条，均指向当前唯一的一门课程 */
  function seedAudit() {
    return [
      // 顺序与 addAudit 一致：最新的排在最前面
      { ts: Date.now() - 86400000 * 4, actor: 'Teacher', action: '修改知识点', courseTitle: '软件工程导论 · SE-3A', topicCount: 1, note: '需求工程一节补充了 2 页讲解' },
      { ts: Date.now() - 86400000 * 6, actor: 'Teacher', action: '发布课程', courseTitle: '软件工程导论 · SE-3A', topicCount: 5, note: '学期初始课程，共 5 个知识点' },
    ];
  }

  function addAudit(e) {
    state.audit.unshift({ ts: Date.now(), ...e });
    if (state.audit.length > 40) state.audit.pop();
  }

  function auditLog() { return state.audit; }

  /* =========================================================
     学生知识模型
     ========================================================= */

  function topics() { return state.topics; }
  function topic(id) { return state.topics.find(t => t.id === id); }

  function overallMastery() {
    if (!state.topics.length) return 0;
    return Math.round(state.topics.reduce((s, t) => s + t.mastery, 0) / state.topics.length);
  }

  /* 当前生效的课程信息：学生学习路径 = 全部已发布课程按发布时间追加 */
  function published() {
    const cs = publishedCourses();
    if (!cs.length) {
      return { count: 0, courses: [], latest: null, note: '教师尚未发布课程。' };
    }
    const latest = cs[cs.length - 1];
    return {
      count: state.topics.length,
      courses: cs.map((c, i) => ({
        id: c.id, title: c.title, instructor: c.instructor, term: c.term,
        updated: c.updated, source: c.source, count: c.topics.length,
        newTopicCount: c.topics.filter(t => topic(t.id) && topic(t.id).courseId === c.id).length,
        order: i + 1,
      })),
      latest,
      note: '每发布一门课程，其知识点会追加到你的学习路径末尾；已有知识点与进度不会被覆盖。',
    };
  }

  function pathTopics() { return state.topics; }

  /* 活动运行所需内容（内置知识点与 AI 生成知识点统一入口） */
  function topicContent(topicId) {
    const t = topic(topicId);
    if (!t) return { explain: [], quiz: [], pretest: null };
    return t.content || { explain: [], quiz: [], pretest: null };
  }

  /* =========================================================
     自适应规划（学生端 3 种活动）
     ========================================================= */

  function plan(topicId) {
    const t = topic(topicId);
    if (!t) return null;

    let actId, reason, rule;

    if (t.errors >= 2 && t.mastery < 75) {
      actId = 'review';
      rule = `errors >= 2 且 mastery < 75`;
      reason = `该知识点已累计 <b>${t.errors} 次错误</b>，且掌握度仅 ${t.mastery}%，先通过复习纠正错误概念再继续。`;
    } else if (t.mastery < 45) {
      actId = 'explain';
      rule = `mastery < 45`;
      reason = `掌握度 ${t.mastery}% 属于薄弱区，先学习教师发布资料生成的知识点讲解。`;
    } else if (t.mastery < 80) {
      actId = 'practice';
      rule = `45 <= mastery < 80`;
      reason = `掌握度 ${t.mastery}% 已有基础但仍不稳定，通过实践练习（练习 + 编程任务）巩固应用。`;
    } else {
      actId = 'review';
      rule = `mastery >= 80`;
      reason = `掌握度 ${t.mastery}% 已达熟练，安排间隔复习以维持长期记忆。`;
    }

    return { topic: t, activity: DATA.activities[actId], reason, rule };
  }

  function nextTopic() {
    const sorted = [...state.topics].sort((a, b) => {
      if (b.errors !== a.errors) return b.errors - a.errors;
      return a.mastery - b.mastery;
    });
    return sorted[0];
  }

  function nextPlan() {
    const t = nextTopic();
    return t ? plan(t.id) : null;
  }

  /* ---------------- 活动完成 → 状态更新 ---------------- */
  function applyResult(topicId, actId, outcome) {
    const t = topic(topicId);
    if (!t) return null;

    const before = t.mastery;
    let delta = 0;

    switch (actId) {
      case 'explain':
        delta = 9;
        break;
      case 'practice': {
        const quizOk = outcome.quizCorrect !== false;
        const codeOk = outcome.codePass === true;
        delta = (quizOk ? 8 : 3) + (codeOk ? 6 : 2);
        if (!quizOk) t.errors += 1;
        break;
      }
      case 'review':
        delta = 7;
        t.errors = 0;
        break;
      default:
        delta = 5;
    }

    t.mastery = Math.max(0, Math.min(100, t.mastery + delta));
    t.attempts += 1;
    t.lastActivity = DATA.activities[actId].name;

    state.completed += 1;
    state.lastActivity = { topicId, actId, delta, ts: Date.now() };

    state.trace.unshift({
      ts: Date.now(),
      topicId, topicName: t.name,
      actId, actName: DATA.activities[actId].name,
      delta, before, after: t.mastery,
      ok: outcome.correct !== false,
    });
    if (state.trace.length > 30) state.trace.pop();

    const after = t.mastery;
    const re = plan(topicId);
    save();
    return { topic: t, before, after, delta, re };
  }

  /* ---------------- Pre-test ----------------
     只对本轮提交的知识点设定初始掌握度，并标记已完成评估；
     新追加进来的知识点从未做过评估，需要单独补一次 Pre-test。 */
  function applyPreTest(answers) {
    (answers || []).forEach(a => {
      const t = topic(a.topicId);
      if (!t) return;
      t.mastery = a.correct ? 45 : 20;
      t.attempts += 1;
      t.errors = a.correct ? 0 : 1;
      t.pretested = true;
    });
    state.hasPreTest = state.topics.length > 0 && state.topics.every(t => t.pretested);
    state.loopStage = 'plan';
    save();
  }

  /* ---------------- 循环阶段 / 角色 ---------------- */
  function setStage(s) { state.loopStage = s; save(); }
  function stage() { return state.loopStage; }
  function setRole(r) { state.role = r; save(); }
  function role() { return state.role; }

  /* ---------------- 学生自主上传的资料 ---------------- */
  function uploads() { return state.uploads; }

  function addUpload(file) {
    const rec = {
      id: 'up_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: file.name,
      kind: (file.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 5),
      size: fmtSize(file.size),
      from: '我的上传',
      status: 'indexing',
      ts: Date.now(),
    };
    state.uploads.unshift(rec);
    save();
    setTimeout(() => {
      const r = state.uploads.find(x => x.id === rec.id);
      if (r) { r.status = 'indexed'; save(); }
      if (window.App && location.hash.indexOf('materials') >= 0) App.render();
    }, 1600);
    return rec;
  }

  function removeUpload(id) {
    state.uploads = state.uploads.filter(x => x.id !== id);
    save();
  }

  function fmtSize(b) {
    if (!b && b !== 0) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }

  /* ---------------- AI 问答助手（模拟 RAG） ---------------- */
  function ask(q) {
    const text = (q || '').trim();
    const mine = state.uploads.filter(x => x.status === 'indexed');
    const cs = publishedCourses();
    const corpus = DATA.materials.length + mine.length + state.topics.length;

    if (!text) return { answer: '请输入你的问题。', sources: [], hit: false, corpus };

    const hit = DATA.assistant.kb.find(e => e.kw.some(k => text.toLowerCase().includes(k.toLowerCase())));
    if (!hit) return { answer: DATA.assistant.noHit, sources: [], hit: false, corpus };

    // 引用出处优先取「课程知识点来源的课件」，找不到再回退到内置出处
    let rel = null, owner = null;
    for (const c of cs) {
      const t = c.topics.find(t => t.id === hit.topicId);
      if (t) { rel = t; owner = c; break; }
    }
    const sources = rel && rel.src ? [rel.src] : hit.src.slice();
    const answer = hit.a + (rel ? `\n\n相关知识点：${rel.icon} ${rel.name}（来自${owner.title}）。` : '');

    return { answer, sources, hit: true, topicId: hit.topicId, corpus };
  }

  /* ---------------- 班级矩阵（Instructor 热力图，跟随已发布知识点） ---------------- */
  function classMatrix() {
    const cols = state.topics.length ? state.topics : DATA.topicLib;
    const seedOf = (s) => s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return DATA.students.map(st => {
      const seed = seedOf(st.id);
      const base = Math.round(st.eng * 0.75) + 10;
      const row = cols.map((tp, i) => {
        const v = (seed * (i + 3) * 7) % 40;
        return Math.max(8, Math.min(98, base - 18 + v));
      });
      return { student: st, scores: row };
    });
  }

  function topicAverages() {
    const m = classMatrix();
    const cols = state.topics.length ? state.topics : DATA.topicLib;
    return cols.map((tp, i) => {
      const vals = m.map(r => r.scores[i]);
      return { topic: tp, avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), low: Math.min(...vals) };
    });
  }

  init();

  return {
    state, init, reset, save,
    topics, topic, overallMastery, topicContent,
    plan, nextTopic, nextPlan, applyResult, applyPreTest,
    setStage, stage, setRole, role,
    published, publishedCourses, pathTopics, pathGroups,
    rebuildStudentPath, syncStudentTopics, dismissAppend, pendingTopics,
    courses, course, activeCourse,
    instFiles, addInstFile, removeInstFile, generateCourse,
    courseTopic, updateTopic, removeCourseTopic,
    publishCourse, rejectCourse,
    auditLog, addAudit,
    uploads, addUpload, removeUpload,
    ask, classMatrix, topicAverages,
  };
})();
