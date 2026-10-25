/* ============================================================
   views-instructor.js — 教师端视图
   核心流程：上传课件 → AI 生成课程（知识点数量由 AI 决定）
             → 逐知识点「查看」并可自主修改
             → 教师审核通过并发布（同步到学生端 / 管理员端）
             → 发布后仍可继续修改
   ============================================================ */

const Instructor = (() => {

  const I = UI.icon;

  /* ================= 通用小组件 ================= */
  function kpi(label, val, ic, tone, delta) {
    return `
      <div class="card stat">
        <div class="row"><div class="stat-icon ${tone}">${I(ic, 17)}</div></div>
        <div class="stat-label" style="margin-top:10px">${label}</div>
        <div class="stat-value" style="font-size:${String(val).length > 6 ? '19px' : '24px'}">${val}</div>
        <div class="stat-delta">${delta}</div>
      </div>`;
  }

  function statusBadge(s) {
    if (s === '已发布') return `<span class="badge badge-success">${s}</span>`;
    if (s === '待审核') return `<span class="badge badge-warning">${s}</span>`;
    if (s === '已驳回') return `<span class="badge badge-danger">${s}</span>`;
    if (s === '已归档') return `<span class="badge badge-muted">${s}</span>`;
    return `<span class="badge badge-muted">${s}</span>`;
  }

  /* ================= 班级总览 ================= */
  function dashboard() {
    const avg = Engine.topicAverages();
    if (!avg.length) return UI.empty('尚未有已发布课程', '📭');

    const weakest = avg.slice().sort((a, b) => a.avg - b.avg)[0];
    const activeCount = DATA.students.filter(s => s.active).length;
    const classAvg = Math.round(avg.reduce((s, x) => s + x.avg, 0) / avg.length);
    const pubs = Engine.publishedCourses();
    const drafts = Engine.courses().filter(c => c.status === '待审核').length;

    const pubRows = pubs.map((c, i) => `
      <div class="topic-row">
        <span class="path-idx">${i + 1}</span>
        <div class="topic-emoji">📘</div>
        <div class="topic-main">
          <div class="topic-name">${escapeHtml(c.title)}</div>
          <div class="topic-meta">${escapeHtml(c.instructor)} · 发布后追加 ${c.topics.length} 个知识点 · ${escapeHtml(c.source)}</div>
        </div>
        <span class="badge ${i === pubs.length - 1 && pubs.length > 1 ? 'badge-primary' : 'badge-success'}">
          ${i === pubs.length - 1 && pubs.length > 1 ? '最近发布' : '学习中'}
        </span>
        <button class="btn btn-ghost btn-sm" onclick="Instructor.openCourse('${c.id}')">${I('edit',13)} 管理</button>
      </div>`).join('');

    const topicRows = avg.map(x => `
      <div class="topic-row">
        <div class="topic-emoji">${x.topic.icon}</div>
        <div class="topic-main">
          <div class="topic-name">${x.topic.name}</div>
          <div class="topic-meta">最低分学生 ${x.low}% · ${x.avg < 50 ? '建议增加讲解与练习' : '维持现有节奏'}</div>
        </div>
        <div class="topic-bar-wrap">${UI.bar(x.avg)}</div>
        <div class="topic-pct">${x.avg}%</div>
      </div>`).join('');

    const attention = DATA.students.slice().sort((a, b) => a.eng - b.eng).slice(0, 5).map(s => `
      <div class="topic-row">
        <span class="avatar">${s.name[0].toUpperCase()}</span>
        <div class="topic-main">
          <div class="topic-name">${s.name}</div>
          <div class="topic-meta">${s.cls} · 连续学习 ${s.streak} 天</div>
        </div>
        <span class="badge ${s.eng < 40 ? 'badge-danger' : s.eng < 70 ? 'badge-warning' : 'badge-success'}">${s.eng}%</span>
      </div>`).join('');

    return `
      <div class="section-head">
        <span class="h-section">班级总览 · SE-3A / SE-3B</span>
        <span class="spacer"></span>
        <button class="btn btn-primary" onclick="App.go('#/instructor/generate')">${I('sparkles',15)} AI 生成新课程</button>
      </div>

      <div class="card pub-card mb-16">
        <div class="row">
          <span class="badge badge-primary">${I('book',13)} 已发布给学生（${pubs.length} 门 · 共 ${avg.length} 个知识点）</span>
          <span class="spacer"></span>
          ${drafts ? `<span class="badge badge-warning">${drafts} 个草稿待审核</span>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="App.go('#/instructor/courses')">课程管理</button>
        </div>
        ${pubRows}
        <div class="pub-note">发布一门新课程＝把它的知识点<b>追加</b>到学生已有学习路径的末尾，原有知识点与进度不会被覆盖；同一知识点在多门课程中重复时只计入一次。</div>
      </div>

      <div class="grid g-3 mb-16">
        ${kpi('班级平均掌握度', classAvg + '%', 'target', '', `共 ${DATA.students.length} 名学生`)}
        ${kpi('本周活跃学生', `${activeCount} / ${DATA.students.length}`, 'users', 'green', '登录并完成活动')}
        ${kpi('最薄弱知识点', weakest.topic.name, 'bug', 'amber', `班级均分 ${weakest.avg}%`)}
      </div>

      <div class="grid g-main">
        <div class="card">
          <div class="card-head">
            <span class="h-section">各知识点掌握情况（${avg.length} 个）</span>
            <span class="spacer"></span>
            <button class="btn btn-ghost btn-sm" onclick="App.go('#/instructor/heatmap')">查看热力图</button>
          </div>
          ${topicRows}
        </div>

        <div class="card">
          <div class="card-head"><span class="h-section">需要关注的学生</span></div>
          ${attention}
        </div>
      </div>`;
  }

  /* ================= 班级知识热力图 ================= */
  function heatmap() {
    const m = Engine.classMatrix();
    const cols = Engine.pathTopics();
    if (!cols.length) return UI.empty('尚未有已发布课程', '📭');

    const head = `<tr><th class="rowhead">学生</th>${cols.map(t =>
      `<th style="text-align:center">${t.icon}<br>${t.name}</th>`).join('')}<th style="text-align:center">均值</th></tr>`;

    const rows = m.map(r => {
      const a = Math.round(r.scores.reduce((x, y) => x + y, 0) / r.scores.length);
      return `<tr>
        <th class="rowhead">
          <div class="heat-name">
            <span class="avatar">${r.student.name[0]}</span>
            <span>${r.student.name}</span>
          </div>
        </th>
        ${r.scores.map(v => `<td><div class="heat-cell" style="background:${UI.heatColor(v)}" title="${r.student.name} · ${v}%">${v}</div></td>`).join('')}
        <td><div class="heat-cell" style="background:#334155">${a}</div></td>
      </tr>`;
    }).join('');

    const avg = Engine.topicAverages().slice().sort((x, y) => x.avg - y.avg);

    return `
      <div class="section-head">
        <span class="h-section">班级知识状态热力图</span>
        <span class="spacer"></span>
        <span class="badge badge-primary">${cols.length} 个知识点</span>
      </div>

      <div class="card mb-16">
        <div class="card-body"><div class="heat-wrap">
          <table class="heat"><thead>${head}</thead><tbody>${rows}</tbody></table>
        </div></div>
      </div>

      <div class="card">
        <div class="card-head"><span class="h-section">教学建议（AI 生成）</span></div>
        <div class="card-body">
          ${avg.slice(0, 3).map((x, i) => `
            <div class="row mb-16" style="align-items:flex-start;gap:12px">
              <span style="font-size:15px">${i === 0 ? '🔴' : i === 1 ? '🟠' : '🟢'}</span>
              <div>
                <div style="font-weight:650;font-size:13.5px">${x.topic.icon} ${x.topic.name}</div>
                <div class="text-sm" style="color:var(--text-2)">
                  ${x.avg < 50 ? `班级均分 ${x.avg}%，建议增加讲解与练习；最低分学生仅 ${x.low}%。`
                            : `班级均分 ${x.avg}%，掌握良好，可推进进阶内容。`}
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ================= AI 生成新课程 ================= */
  let G = null;   // 生成草稿的 UI 状态

  function generate() {
    if (!G) G = { step: 'upload', busy: false, cid: null };
    App.go('#/instructor/generate');
  }

  function generateView() {
    if (!G) G = { step: 'upload', busy: false, cid: null };
    const files = Engine.instFiles();

    /* Step 1 —— 上传课件 */
    const fileRows = files.length ? files.map(f => `
      <div class="topic-row">
        <div class="topic-emoji">${f.kind === 'PDF' ? '📕' : f.kind === 'PPT' ? '📊' : '📄'}</div>
        <div class="topic-main">
          <div class="topic-name">${f.name}</div>
          <div class="topic-meta">${f.kind} · ${f.size}</div>
        </div>
        ${f.status === 'indexing'
          ? `<span class="badge badge-warning">${I('refresh',12)} 解析中…</span>`
          : `<span class="badge badge-success">${I('check',12)} 已解析</span>`}
        <button class="btn btn-ghost btn-sm" onclick="Instructor.rmFile('${f.id}')">移除</button>
      </div>`).join('')
      : `<div class="empty" style="padding:22px">还没有上传课件 · AI 将依据课件内容抽取知识点</div>`;

    /* Step 1 —— 上传课件卡片 */
    const step1 = `
      <div class="card mb-16">
        <div class="card-head">
          <span class="step-n">1</span>
          <span class="h-section">上传课件 / 课程材料</span>
          <span class="spacer"></span>
          <span class="badge ${files.length ? 'badge-success' : 'badge-muted'}">${files.length} 份已就绪</span>
        </div>
        <div class="card-body">
          <div class="dropzone"
               onclick="document.getElementById('inst-file').click()"
               ondragover="event.preventDefault();this.classList.add('over')"
               ondragleave="this.classList.remove('over')"
               ondrop="Instructor.dropFile(event)">
            ${I('upload', 22)}
            <div style="font-weight:700;font-size:13.5px;margin-top:6px">上传课件</div>
            <div class="text-xs" style="color:var(--text-3)">点击选择，或把文件拖到这里 · 支持 PDF / PPT / MD / TXT / DOCX</div>
          </div>
          <input type="file" id="inst-file" multiple hidden onchange="Instructor.onFiles(this)">
        </div>
        ${fileRows}
        <div class="card-body" style="border-top:1px solid var(--border)">
          <div class="text-xs" style="color:var(--text-3)">
            ${I('sparkles',12)} AI 会读取全部课件后自行判断应拆出多少个知识点 ——
            <b>知识点数量不是固定值</b>，取决于课件数量与内容密度。
          </div>
        </div>
      </div>`;

    /* Step 2 —— 填写标题（生成草稿后折叠为只读摘要） */
    const step2 = `
      <div class="card mb-16">
        <div class="card-head"><span class="step-n">2</span><span class="h-section">填写课程标题</span></div>
        <div class="card-body">
          <div class="gen-input" style="margin-bottom:10px">
            <input id="gen-title" placeholder="例如：面向初学者的软件测试实战"
                   value="${escapeAttr(G.title || '')}"
                   onkeydown="if(event.key==='Enter')Instructor.doGenerate()">
            <button class="btn btn-primary" onclick="Instructor.doGenerate()" ${G.busy ? 'disabled' : ''}>
              ${I('sparkles',15)} ${G.busy ? '生成中…' : 'AI 生成课程'}
            </button>
          </div>
          <div class="row row-wrap">
            ${['软件测试实战', 'Git 协作与代码评审'].map(t =>
              `<button class="chip" onclick="Instructor.setGenTitle('${t}')">${t}</button>`).join('')}
          </div>
        </div>
      </div>`;

    /* Step 3 —— 生成结果（待审核草稿） */
    const c = G.cid ? Engine.course(G.cid) : null;
    const step3 = c ? `
      <div class="card mb-16">
        <div class="card-head">
          <span class="step-n done">✓</span>
          <span class="h-section">AI 生成结果</span>
          <span class="spacer"></span>
          <span class="chip">${escapeHtml(c.title)}</span>
          <button class="btn btn-ghost btn-sm" onclick="Instructor.regen()">${I('refresh',13)} 重新生成</button>
        </div>
      </div>` + renderDraftCard(c) : '';

    return `
      <div class="section-head">
        <div>
          <div class="h-section" style="font-size:18px">AI 生成新课程</div>
          <div class="text-sm" style="color:var(--text-3)">上传课件 → AI 抽取知识点 → 逐条查看并可修改 → 审核通过后发布</div>
        </div>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" onclick="App.go('#/instructor/courses')">${I('arrowLeft',14)} 返回课程管理</button>
      </div>

      ${G.busy ? `
        <div class="card card-pad mb-16 gen-anim" style="border-color:var(--primary);background:var(--primary-soft)">
          <div class="row" style="gap:10px">
            ${I('refresh', 17)}
            <div style="font-weight:700">AI 正在阅读课件…</div>
            <span class="spacer"></span>
            <span class="text-xs" style="color:var(--text-3)">切片 → 向量化 → 抽取知识点 → 生成讲解与练习</span>
          </div>
        </div>` : ''}

      ${step1}
      ${step2}
      ${step3}`;
  }

  /* 草稿卡片：知识点列表 + 审核操作 */
  function renderDraftCard(c) {
    const topicRows = c.topics.map((t, i) => `
      <div class="topic-row">
        <span class="path-idx">${i + 1}</span>
        <div class="topic-emoji">${t.icon}</div>
        <div class="topic-main">
          <div class="topic-name">${escapeHtml(t.name)}</div>
          <div class="topic-meta">${escapeHtml(t.desc)}</div>
          <div class="text-xs mt-8" style="color:var(--text-3)">
            ${I('book',11)} ${escapeHtml(t.src)} · 讲解 ${t.content.explain.length} 页 · 练习 ${t.content.quiz.length} 题 · 约 ${t.mins} 分钟
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="Instructor.viewTopic('${c.id}',${i})">${I('edit',13)} 查看</button>
        <button class="btn btn-ghost btn-sm" onclick="Instructor.delTopic('${c.id}',${i})">删除</button>
      </div>`).join('');

    const published = c.status === '已发布';

    return `
      <div class="card card-pad mt-16 gen-anim" style="border-color:var(--primary);background:var(--primary-soft)">
        <div class="row" style="gap:10px">
          ${I('sparkles', 17)}
          <div style="font-weight:700;font-size:15px">${escapeHtml(c.title)}</div>
          <span class="badge badge-primary">AI 生成${published ? ' · 已发布' : ' · 待审核'}</span>
          <span class="spacer"></span>
          <span class="chip">${I('clock',13)} 约 ${c.genMeta ? c.genMeta.estMins : 0} 分钟</span>
        </div>
        <div class="text-sm mt-8" style="color:var(--text-2)">
          AI 依据 <b>${c.genMeta ? c.genMeta.fileCount : 0}</b> 份课件
          （${(c.genMeta ? c.genMeta.fileNames : []).map(escapeHtml).join('、') || '—'}）
          共抽取 <b>${c.topics.length} 个知识点</b>。
          <b>该数量由 AI 依据课件内容自动确定</b>，不是固定值；你可逐一查看并修改后决定是否发布。
          ${c.genMeta && c.genMeta.editedCount ? `<br>本次已人工修订 <b>${c.genMeta.editedCount}</b> 处。` : ''}
        </div>
        <div class="divider"></div>
        ${topicRows}
        <div class="row mt-16 row-wrap">
          ${published
            ? `<span class="badge badge-success">${I('check',13)} 已发布 · 知识点已追加到学生路径末尾</span>
               <button class="btn btn-ghost" onclick="Instructor.syncCourse('${c.id}')">${I('refresh',14)} 同步到学生端</button>`
            : `<button class="btn btn-primary" onclick="Instructor.publish('${c.id}')">${I('check',15)} 审核通过并发布</button>
               <button class="btn btn-ghost" onclick="Instructor.reject('${c.id}')">${I('bug',15)} 驳回</button>`}
          <button class="btn btn-ghost" onclick="Instructor.regen()">${I('refresh',15)} 重新生成</button>
          <span class="spacer"></span>
          <span class="text-xs" style="color:var(--text-3)">
            ${I('shield',12)} AI 生成内容必须由教师人工审核后才能发布；发布为追加，不会删除学生已有知识点
          </span>
        </div>
      </div>`;
  }

  /* ---------- 生成动作 ---------- */
  function setGenTitle(t) {
    const el = document.getElementById('gen-title');
    if (el) { el.value = t; el.focus(); }
  }

  function doGenerate() {
    if (G.busy) return;
    const el = document.getElementById('gen-title');
    const v = el ? el.value.trim() : '';
    if (!v) { UI.toast('请先填写课程标题', 'warn'); return; }
    if (!Engine.instFiles().length) { UI.toast('请先上传至少一份课件', 'warn'); return; }

    G.title = v;
    G.busy = true;
    App.render();
    setTimeout(() => {
      const c = Engine.generateCourse({ title: v });
      G.busy = false;
      G.cid = c.id;
      App.render();
      UI.toast(`AI 依据 ${c.genMeta.fileCount} 份课件抽取了 ${c.topics.length} 个知识点`, 'ok');
    }, 1200);
  }

  function regen() {
    G.cid = null;
    UI.toast('已清空草稿，可调整课件或标题后重新生成', 'warn');
    App.render();
  }

  function onFiles(input) {
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    files.slice(0, 6).forEach(f => Engine.addInstFile(f));
    UI.toast(`已接收 ${Math.min(files.length, 6)} 份课件，正在解析入库…`, 'ok');
    App.render();
  }

  function dropFile(e) {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt || !dt.files) return;
    Array.from(dt.files).slice(0, 6).forEach(f => Engine.addInstFile(f));
    UI.toast('已接收拖放的课件，正在解析入库…', 'ok');
    App.render();
  }

  function rmFile(id) {
    Engine.removeInstFile(id);
    UI.toast('已移除该课件', 'warn');
    App.render();
  }

  function publish(cid) {
    const c = Engine.course(cid);
    if (!c) return;
    const r = Engine.publishCourse(cid, '内容与来源课件一致');
    UI.toast(`已发布《${c.title}》：${r.before} 个知识点保持不变，追加 ${r.added} 个，学生路径共 ${r.total} 个`, 'ok');
    App.go('#/instructor/courses');
  }

  function reject(cid) {
    const reason = prompt('请填写驳回原因（将记入审核记录）：', '知识点与课件章节不匹配');
    if (reason === null) return;
    Engine.rejectCourse(cid, reason.trim() || '未填写原因');
    G.cid = null;
    UI.toast('已驳回该草稿，记录已同步到管理员审计日志', 'warn');
    App.go('#/instructor/courses');
  }

  function syncCourse(cid) {
    Engine.syncStudentTopics(cid);
    UI.toast('已把最新修改同步到学生端', 'ok');
    App.render();
  }

  function delTopic(cid, idx) {
    const t = Engine.courseTopic(cid, idx);
    if (!t) return;
    if (!confirm(`确认删除知识点「${t.name}」？`)) return;
    Engine.removeCourseTopic(cid, idx);
    UI.toast('已删除该知识点', 'warn');
    App.render();
  }

  function viewTopic(cid, idx) {
    T = { cid, idx, form: null };
    App.go(`#/instructor/topic/${cid}/${idx}`);
  }

  /* ================= 知识点查看与自主修改 ================= */
  let T = null;

  function topicEdit(cid, idx) {
    const c = Engine.course(cid);
    if (!c) return UI.empty('课程不存在', '🚧');
    const t = c.topics[idx];
    if (!t) return UI.empty('知识点不存在', '🚧');

    // 表单状态（首次进入时从数据初始化）
    if (!T || T.cid !== cid || T.idx !== idx) T = { cid, idx, form: null, addingQ: false };
    if (!T.form) {
      T.form = {
        name: t.name,
        desc: t.desc,
        explain: JSON.parse(JSON.stringify(t.content.explain || [])),
        quiz: JSON.parse(JSON.stringify(t.content.quiz || [])),
      };
    }
    const f = T.form;
    const published = c.status === '已发布';

    const explainBlocks = f.explain.map((s, si) => `
      <div class="edit-block">
        <div class="row mb-8">
          <span class="badge badge-primary">讲解第 ${si + 1} 页</span>
          <span class="spacer"></span>
          <button class="btn btn-ghost btn-sm" onclick="Instructor.rmSlide(${si})">删除本页</button>
        </div>
        <input class="inp mb-8" value="${escapeAttr(s.t)}" placeholder="页面标题"
               oninput="Instructor.setSlide(${si},'t',this.value)">
        ${s.items.map((it, ii) => `
          <div class="row mb-8">
            <span class="slide-bullet"></span>
            <input class="inp" value="${escapeAttr(it)}" placeholder="要点内容"
                   oninput="Instructor.setItem(${si},${ii},this.value)">
            <button class="btn btn-ghost btn-sm" onclick="Instructor.rmItem(${si},${ii})">×</button>
          </div>`).join('')}
        <button class="btn btn-ghost btn-sm mb-8" onclick="Instructor.addItem(${si})">${I('plus',13)} 增加要点</button>
        <textarea class="inp" rows="2" placeholder="要点提示 / 总结"
                  oninput="Instructor.setSlide(${si},'tip',this.value)">${escapeHtml(s.tip || '')}</textarea>
      </div>`).join('');

    const quizBlocks = f.quiz.map((q, qi) => `
      <div class="edit-block">
        <div class="row mb-8">
          <span class="badge badge-info">练习第 ${qi + 1} 题</span>
          <span class="text-xs" style="color:var(--text-3)">${qi === 0 ? '（同时用作 Pre-test 起点评估题）' : ''}</span>
          <span class="spacer"></span>
          <button class="btn btn-ghost btn-sm" onclick="Instructor.rmQuiz(${qi})">删除本题</button>
        </div>
        <textarea class="inp mb-8" rows="2" placeholder="题干"
                  oninput="Instructor.setQuiz(${qi},'q',this.value)">${escapeHtml(q.q)}</textarea>
        ${q.opts.map((o, oi) => `
          <div class="row mb-8">
            <span class="opt-key" style="background:${oi === q.a ? 'var(--success)' : 'var(--surface-3)'};color:${oi === q.a ? '#fff' : 'var(--text-2)'}">${'ABCD'[oi]}</span>
            <input class="inp" value="${escapeAttr(o)}" placeholder="选项内容"
                   oninput="Instructor.setOpt(${qi},${oi},this.value)">
            <button class="btn btn-ghost btn-sm" onclick="Instructor.setAnswer(${qi},${oi})">${oi === q.a ? '当前答案' : '设为答案'}</button>
          </div>`).join('')}
        <textarea class="inp" rows="2" placeholder="解析（为什么）"
                  oninput="Instructor.setQuiz(${qi},'why',this.value)">${escapeHtml(q.why || '')}</textarea>
      </div>`).join('');

    return `
      <div class="runner-head">
        <button class="btn btn-ghost btn-sm" onclick="Instructor.backToCourse('${cid}')">${I('arrowLeft',15)} 返回课程</button>
        <div>
          <div class="runner-title">${t.icon} 查看与修改知识点</div>
          <div class="runner-topic">${escapeHtml(c.title)} · 第 ${idx + 1} / ${c.topics.length} 个知识点${published ? ' · 已发布（修改后立即同步）' : ''}</div>
        </div>
        <span class="spacer"></span>
        ${statusBadge(c.status)}
      </div>

      <div class="notice">
        <span class="notice-ico">${I('edit',17)}</span>
        <div style="flex:1">
          <div class="notice-t">AI 已生成内容，由你决定是否采纳</div>
          <div class="notice-d">下方所有字段均可直接修改。保存后立即生效${published ? '，并同步到学生端（只更新这一个知识点，其他知识点进度不变）' : ''}；审核由你负责，管理员不参与。</div>
        </div>
      </div>

      <div class="grid g-edit">
        <div class="card">
          <div class="card-head"><span class="h-section">知识点基本信息</span></div>
          <div class="card-body">
            <div class="text-xs mb-8" style="color:var(--text-3)">名称</div>
            <input class="inp mb-16" value="${escapeAttr(f.name)}" oninput="Instructor.setName(this.value)">
            <div class="text-xs mb-8" style="color:var(--text-3)">简介</div>
            <textarea class="inp" rows="2" oninput="Instructor.setDesc(this.value)">${escapeHtml(f.desc)}</textarea>
            <div class="divider"></div>
            <div class="text-xs" style="color:var(--text-3)">
              ${I('book',11)} 来源：${escapeHtml(t.src)} · 建议时长 ${t.mins} 分钟
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <span class="h-section">AI 生成的讲解内容（${f.explain.length} 页）</span>
            <span class="spacer"></span>
            <button class="btn btn-ghost btn-sm" onclick="Instructor.addSlide()">${I('plus',13)} 增加一页</button>
          </div>
          <div class="card-body">${explainBlocks || UI.empty('暂无讲解内容', '📄')}</div>
        </div>

        <div class="card">
          <div class="card-head">
            <span class="h-section">AI 生成的练习题目（${f.quiz.length} 题）</span>
            <span class="spacer"></span>
            <button class="btn btn-ghost btn-sm" onclick="Instructor.addQuiz()">${I('plus',13)} 增加一题</button>
          </div>
          <div class="card-body">${quizBlocks || UI.empty('暂无练习题目', '📝')}</div>
        </div>
      </div>

      <div class="row mt-16">
        <button class="btn btn-primary" onclick="Instructor.saveTopic()">${I('check',15)} 保存修改</button>
        <button class="btn btn-ghost" onclick="Instructor.cancelEdit()">放弃修改</button>
        <span class="spacer"></span>
        <span class="text-xs" style="color:var(--text-3)">${I('shield',12)} 所有修改留痕，可在「审核记录」查看</span>
      </div>`;
  }

  /* ---------- 表单改名 ---------- */
  function setName(v) { if (T) T.form.name = v; }
  function setDesc(v) { if (T) T.form.desc = v; }
  function setSlide(si, k, v) { if (T) T.form.explain[si][k] = v; }
  function setItem(si, ii, v) { if (T) T.form.explain[si].items[ii] = v; }
  function setQuiz(qi, k, v) { if (T) T.form.quiz[qi][k] = v; }
  function setOpt(qi, oi, v) { if (T) T.form.quiz[qi].opts[oi] = v; }
  function setAnswer(qi, oi) { if (T) { T.form.quiz[qi].a = oi; App.render(); } }

  function addSlide() {
    if (!T) return;
    T.form.explain.push({ t: '新的一页', items: ['要点一', '要点二'], tip: '' });
    App.render();
  }
  function rmSlide(si) { if (T) { T.form.explain.splice(si, 1); App.render(); } }
  function addItem(si) { if (T) { T.form.explain[si].items.push('新增要点'); App.render(); } }
  function rmItem(si, ii) { if (T) { T.form.explain[si].items.splice(ii, 1); App.render(); } }

  function addQuiz() {
    if (!T) return;
    T.form.quiz.push({ q: '新的练习题题干？', opts: ['选项 A', '选项 B', '选项 C', '选项 D'], a: 0, why: '请填写解析。' });
    App.render();
  }
  function rmQuiz(qi) { if (T) { T.form.quiz.splice(qi, 1); App.render(); } }

  function saveTopic() {
    if (!T) return;
    const f = T.form;
    if (!f.name.trim()) { UI.toast('知识点名称不能为空', 'warn'); return; }
    Engine.updateTopic(T.cid, T.idx, {
      name: f.name, desc: f.desc, explain: f.explain, quiz: f.quiz,
    });
    UI.toast('已保存修改', 'ok');
    backToCourse(T.cid);
  }

  function cancelEdit() {
    T = null;
    UI.toast('已放弃本次修改', 'warn');
    history.back();
  }

  function backToCourse(cid) {
    T = null;
    G = { step: 'upload', busy: false, cid };
    App.go('#/instructor/generate');
  }

  /* ================= 课程管理 ================= */
  function courses() {
    const pubs = Engine.publishedCourses();
    const lastPubId = pubs.length ? pubs[pubs.length - 1].id : null;
    const list = Engine.courses().map(c => {
      const isLast = c.id === lastPubId;
      return `
      <div class="topic-row">
        <div class="topic-emoji">${c.status === '已归档' ? '🗄️' : '📘'}</div>
        <div class="topic-main">
          <div class="topic-name">${escapeHtml(c.title)}
            ${c.status === '已发布' ? `<span class="badge badge-primary">已追加到学生路径</span>` : ''}
            ${isLast && pubs.length > 1 ? '<span class="badge badge-info">最近发布</span>' : ''}
          </div>
          <div class="topic-meta">
            <b>${c.topics.length}</b> 个知识点 · ${c.students} 名学生 · ${escapeHtml(c.source)} · 更新于 ${c.updated}
            ${c.status === '已发布' ? '' : ' · 未计入学生学习路径'}
          </div>
        </div>
        ${statusBadge(c.status)}
        ${c.status === '待审核'
          ? `<button class="btn btn-primary btn-sm" onclick="Instructor.openCourse('${c.id}')">${I('shield',13)} 去审核</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="Instructor.openCourse('${c.id}')">${I('edit',13)} 查看 / 修改</button>`}
      </div>`;
    }).join('');

    return `
      <div class="section-head">
        <span class="h-section">课程管理 · 共 ${Engine.courses().length} 门（${pubs.length} 门已发布，共 ${Engine.pathTopics().length} 个知识点）</span>
        <span class="spacer"></span>
        <button class="btn btn-primary" onclick="App.go('#/instructor/generate')">${I('sparkles',15)} AI 生成新课程</button>
      </div>

      <div class="card mb-16">
        <div class="card-body">
          <div class="text-sm" style="color:var(--text-2)">
            每门课程的知识点<b>数量不同</b>：人工编排或 AI 依据课件抽取后确定。
            <b>发布即追加</b>——新课程的知识点会接到学生已有路径末尾，原有知识点与进度不会被覆盖；
            已归档 / 草稿 / 待审核 / 已驳回的课程不计入学生学习路径。
          </div>
        </div>
      </div>

      <div class="card">${list}</div>`;
  }

  function openCourse(id) {
    G = { step: 'upload', busy: false, cid: id };
    App.go('#/instructor/generate');
  }

  /* ================= 我的审核记录 ================= */
  function audit() {
    const log = Engine.auditLog();
    const rows = log.map(a => `
      <div class="topic-row">
        <span class="avatar">${a.actor ? a.actor[0] : '?'}</span>
        <div class="topic-main">
          <div class="topic-name">${escapeHtml(a.action)} · ${escapeHtml(a.courseTitle)}</div>
          <div class="topic-meta">${timeAgo(a.ts)} · ${escapeHtml(a.actor)} · ${a.topicCount} 个知识点${a.note ? ' · ' + escapeHtml(a.note) : ''}</div>
        </div>
        ${actionBadge(a.action)}
      </div>`).join('') || UI.empty('暂无审核记录', '📋');

    const n = Engine.courses();
    return `
      <div class="section-head">
        <div>
          <div class="h-section" style="font-size:18px">我的审核记录</div>
          <div class="text-sm" style="color:var(--text-3)">内容审核由授课教师负责，全部操作自动留痕并同步给管理员</div>
        </div>
      </div>

      <div class="grid g-3 mb-16">
        ${kpi('待我审核', n.filter(c => c.status === '待审核').length, 'shield', 'amber', 'AI 生成草稿')}
        ${kpi('已发布', n.filter(c => c.status === '已发布').length, 'check', 'green', '已推送学生端')}
        ${kpi('已驳回', n.filter(c => c.status === '已驳回').length, 'bug', '', '需重新生成或修改')}
      </div>

      <div class="card">
        <div class="card-head"><span class="h-section">操作日志</span><span class="spacer"></span>
          <span class="text-xs" style="color:var(--text-3)">共 ${log.length} 条</span></div>
        ${rows}
      </div>`;
  }

  function actionBadge(a) {
    if (a.indexOf('发布') >= 0) return '<span class="badge badge-success">发布</span>';
    if (a.indexOf('驳回') >= 0) return '<span class="badge badge-danger">驳回</span>';
    if (a.indexOf('修改') >= 0) return '<span class="badge badge-primary">修改</span>';
    return '<span class="badge badge-muted">生成</span>';
  }

  function timeAgo(ts) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    return Math.floor(d / 86400) + ' 天前';
  }

  /* ================= 学生管理 ================= */
  function students() {
    const rows = DATA.students.map(s => `
      <tr>
        <td>
          <div class="cell-user">
            <span class="avatar">${s.name[0].toUpperCase()}</span>
            <div><div class="u-name">${s.name}</div><div class="u-sub">${s.sid} · ${s.cls}</div></div>
          </div>
        </td>
        <td class="num">${s.eng}%</td>
        <td class="num">${s.streak} 天</td>
        <td><span class="badge ${s.active ? 'badge-success' : 'badge-danger'}">${s.active ? '活跃' : '沉默'}</span></td>
        <td>${UI.bar(s.eng)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="Instructor.viewStudent('${s.id}')">详情</button></td>
      </tr>`).join('');

    return `
      <div class="section-head">
        <span class="h-section">学生管理 · 追踪参与度与知识状态</span>
        <span class="spacer"></span>
        <button class="btn btn-ghost" onclick="Instructor.importStudents()">${I('upload',15)} 批量导入</button>
      </div>

      <div class="grid g-3 mb-16">
        ${kpi('学生总数', DATA.students.length, 'users', '', 'SE-3A + SE-3B')}
        ${kpi('本周活跃', DATA.students.filter(s => s.active).length, 'flame', 'green', '登录并完成活动')}
        ${kpi('沉默学生', DATA.students.filter(s => !s.active).length, 'bug', 'amber', '建议发送提醒')}
      </div>

      <div class="card">
        <div class="card-head"><span class="h-section">学生列表</span></div>
        <table class="tbl">
          <thead><tr><th>学生</th><th>参与度</th><th>连续学习</th><th>状态</th><th>参与度趋势</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function importStudents() { UI.toast('演示环境：已模拟导入 12 名学生（CSV）', 'ok'); }
  function viewStudent(id) {
    const s = DATA.students.find(x => x.id === id);
    UI.toast(`查看 ${s ? s.name : id} 的学习详情`, 'ok');
  }

  /* ================= 工具 ================= */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  return {
    dashboard, heatmap, generate, generateView, courses, students, audit,
    setGenTitle, doGenerate, regen, onFiles, dropFile, rmFile,
    publish, reject, syncCourse, delTopic, viewTopic, openCourse,
    topicEdit, setName, setDesc, setSlide, setItem, setQuiz, setOpt, setAnswer,
    addSlide, rmSlide, addItem, rmItem, addQuiz, rmQuiz, saveTopic, cancelEdit, backToCourse,
    importStudents, viewStudent,
  };
})();
