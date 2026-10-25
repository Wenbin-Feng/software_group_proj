/* ============================================================
   views-instructor.js — 教师端视图（简化版）
   ============================================================ */

const Instructor = (() => {

  const I = UI.icon;

  /* ================= 班级总览 ================= */
  function dashboard() {
    const avg = Engine.topicAverages();
    const weakest = avg.slice().sort((a, b) => a.avg - b.avg)[0];
    const activeCount = DATA.students.filter(s => s.active).length;
    const classAvg = Math.round(avg.reduce((s, x) => s + x.avg, 0) / avg.length);

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
        <span class="avatar">${s.name[0]}</span>
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
        <button class="btn btn-primary" onclick="App.go('#/instructor/courses')">${I('sparkles',15)} AI 生成课程</button>
      </div>

      <div class="grid g-3 mb-16">
        ${kpi('班级平均掌握度', classAvg + '%', 'target', '', `共 ${DATA.students.length} 名学生`)}
        ${kpi('本周活跃学生', `${activeCount} / ${DATA.students.length}`, 'users', 'green', '登录并完成活动')}
        ${kpi('最薄弱知识点', weakest.topic.name, 'bug', 'amber', `班级均分 ${weakest.avg}%`)}
      </div>

      <div class="grid g-main">
        <div class="card">
          <div class="card-head">
            <span class="h-section">各知识点掌握情况</span>
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

  function kpi(label, val, ic, tone, delta) {
    return `
      <div class="card stat">
        <div class="row"><div class="stat-icon ${tone}">${I(ic, 17)}</div></div>
        <div class="stat-label" style="margin-top:10px">${label}</div>
        <div class="stat-value" style="font-size:${String(val).length > 6 ? '19px' : '24px'}">${val}</div>
        <div class="stat-delta">${delta}</div>
      </div>`;
  }

  /* ================= 班级知识热力图 ================= */
  function heatmap() {
    const m = Engine.classMatrix();
    const topics = DATA.topics;

    const head = `<tr><th class="rowhead">学生</th>${topics.map(t =>
      `<th style="text-align:center">${t.icon}<br>${t.name}</th>`).join('')}<th style="text-align:center">均值</th></tr>`;

    const rows = m.map(r => {
      const avg = Math.round(r.scores.reduce((a, b) => a + b, 0) / r.scores.length);
      return `<tr>
        <th class="rowhead">
          <div class="heat-name">
            <span class="avatar">${r.student.name[0]}</span>
            <span>${r.student.name}</span>
          </div>
        </th>
        ${r.scores.map(v => `<td><div class="heat-cell" style="background:${UI.heatColor(v)}" title="${r.student.name} · ${v}%">${v}</div></td>`).join('')}
        <td><div class="heat-cell" style="background:#334155">${avg}</div></td>
      </tr>`;
    }).join('');

    const legend = [['≥85', '#15803d'], ['70-84', '#22a55a'], ['55-69', '#84cc16'],
                    ['40-54', '#f59e0b'], ['25-39', '#f97316'], ['<25', '#dc2626']];

    return `
      <div class="section-head">
        <span class="h-section">班级知识状态热力图</span>
        <span class="spacer"></span>
        <div class="row">
          ${legend.map(([l, c]) => `<span class="chip"><i style="width:9px;height:9px;border-radius:3px;background:${c};display:inline-block"></i>${l}</span>`).join('')}
        </div>
      </div>

      <div class="card mb-16">
        <div class="card-body"><div class="heat-wrap">
          <table class="heat"><thead>${head}</thead><tbody>${rows}</tbody></table>
        </div></div>
      </div>

      <div class="card">
        <div class="card-head"><span class="h-section">教学建议（AI 生成）</span></div>
        <div class="card-body">
          ${[
            ['🔴', '代码质量与重构', '班级均分偏低，建议在下次课增加重构实操环节。'],
            ['🟠', '需求工程', '错误率集中，学生普遍混淆功能性与非功能性需求。'],
            ['🟢', '版本控制 Git', '掌握良好，可推进到「冲突处理与 rebase」进阶内容。'],
          ].map(([ic, t, d]) => `
            <div class="row mb-16" style="align-items:flex-start;gap:12px">
              <span style="font-size:15px">${ic}</span>
              <div>
                <div style="font-weight:650;font-size:13.5px">${t}</div>
                <div class="text-sm" style="color:var(--text-2)">${d}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ================= 课程管理 ================= */
  let C = null;   // 生成的课程草稿

  function courses() {
    const list = DATA.courses.map(c => `
      <div class="topic-row">
        <div class="topic-emoji">📘</div>
        <div class="topic-main">
          <div class="topic-name">${c.title}</div>
          <div class="topic-meta">${c.topics} 个知识点 · ${c.students} 名学生 · ${c.author}</div>
        </div>
        <span class="badge ${c.status === '已发布' ? 'badge-success' : 'badge-muted'}">${c.status}</span>
        <button class="btn btn-ghost btn-sm" onclick="Instructor.customize('${c.id}')">${I('edit',13)} 定制</button>
      </div>`).join('');

    const draft = C ? `
      <div class="card card-pad mt-16 gen-anim" style="border-color:var(--primary);background:var(--primary-soft)">
        <div class="row" style="gap:10px">
          ${I('sparkles', 17)}
          <div style="font-weight:700;font-size:15px">${C.title}</div>
          <span class="badge badge-primary">AI 生成草稿</span>
          <span class="spacer"></span>
          <span class="chip">${I('clock',13)} 约 ${C.estMins} 分钟</span>
        </div>
        <div class="text-sm mt-8" style="color:var(--text-2)">${C.desc}</div>
        <div class="divider"></div>
        ${C.outline.map((o, i) => `
          <div class="outline-item">
            <span class="outline-idx">${i + 1}</span>
            <div style="flex:1">
              <div class="outline-title">${o.title}</div>
              <div class="outline-meta">${o.acts.join(' · ')} · 约 ${o.mins} 分钟</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="Instructor.refine(${i})">${I('sparkles',12)} AI 优化</button>
            <button class="btn btn-ghost btn-sm" onclick="Instructor.removeUnit(${i})">删除</button>
          </div>`).join('')}
        <div class="row mt-16 row-wrap">
          <button class="btn btn-primary" onclick="Instructor.publish()">${I('check',15)} 审核通过并发布</button>
          <button class="btn btn-ghost" onclick="Instructor.regen()">${I('refresh',15)} 重新生成</button>
          <button class="btn btn-ghost" onclick="Instructor.discard()">丢弃草稿</button>
          <span class="spacer"></span>
          <span class="text-xs" style="color:var(--text-3)">${I('shield',12)} AI 生成内容需教师人工审核后发布</span>
        </div>
      </div>` : '';

    return `
      <div class="section-head">
        <span class="h-section">课程管理 · 定制现有课程或 AI 生成新课程</span>
      </div>

      <div class="card card-pad mb-16">
        <div class="gen-input">
          <input id="course-topic" placeholder="输入课程主题，例如：面向初学者的软件测试实战"
                 onkeydown="if(event.key==='Enter')Instructor.genCourse()">
          <button class="btn btn-ghost" onclick="Instructor.upload()">${I('upload',15)} 上传材料</button>
          <button class="btn btn-primary" onclick="Instructor.genCourse()">${I('sparkles',15)} 生成</button>
        </div>
        <div class="row row-wrap">
          ${['软件测试实战', 'Git 协作流程', '需求工程工作坊', 'CI/CD 入门'].map(t =>
            `<button class="chip" onclick="Instructor.setCourseTopic('${t}')">${t}</button>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="h-section">已有课程（${DATA.courses.length} 门）</span>
        </div>
        ${list}
      </div>

      ${draft}`;
  }

  function setCourseTopic(t) {
    const el = document.getElementById('course-topic');
    if (el) { el.value = t; el.focus(); }
  }
  function genCourse() {
    const el = document.getElementById('course-topic');
    const v = el ? el.value : '';
    if (!v.trim()) { UI.toast('请输入课程主题', 'warn'); return; }
    UI.toast('正在检索课程资料并生成大纲…');
    setTimeout(() => {
      C = Engine.generateCourse(v);
      App.render();
      UI.toast('已生成 5 个学习单元，请审核', 'ok');
    }, 1000);
  }
  function regen() { genCourse(); }
  function refine(i) {
    UI.toast('AI 正在优化该单元的活动配置…');
    setTimeout(() => { UI.toast('已优化单元 ' + (i + 1), 'ok'); App.render(); }, 800);
  }
  function removeUnit(i) {
    if (!C) return;
    C.outline.splice(i, 1);
    App.render();
    UI.toast('已删除该单元', 'warn');
  }
  function publish() {
    if (!C) return;
    UI.toast('课程已发布给学生', 'ok');
    C = null;
    setTimeout(() => App.render(), 500);
  }
  function discard() { C = null; App.render(); UI.toast('草稿已丢弃', 'warn'); }
  function customize(id) {
    const c = DATA.courses.find(x => x.id === id);
    UI.toast(`打开定制面板：${c ? c.title : id}`, 'ok');
  }
  function upload() { UI.toast('演示环境：材料上传已模拟（PDF/PPT 解析）', 'ok'); }

  /* ================= 学生管理 ================= */
  function students() {
    const rows = DATA.students.map(s => `
      <tr>
        <td>
          <div class="cell-user">
            <span class="avatar">${s.name[0]}</span>
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

  return {
    dashboard, heatmap, courses, students,
    setCourseTopic, genCourse, regen, refine, removeUnit, publish, discard, customize, upload,
    importStudents, viewStudent,
  };
})();
