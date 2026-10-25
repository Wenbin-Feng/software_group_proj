/* ============================================================
   views-admin.js — 管理员端视图
   ============================================================ */

const Admin = (() => {

  const I = UI.icon;

  /* ================= 平台总览 ================= */
  function overview() {
    const p = DATA.platform;

    return `
      <div class="section-head">
        <div>
          <div class="h-section" style="font-size:18px">平台运行状况</div>
          <div class="text-sm" style="color:var(--text-3)">系统健康、资源使用与成本概览</div>
        </div>
        <span class="spacer"></span>
        <span class="chip">${I('clock',13)} 数据更新于 2 分钟前</span>
      </div>

      <div class="grid g-4 mb-16">
        ${kpi('可用率', p.uptime, 'shield', 'green', '近 30 天')}
        ${kpi('活跃用户', p.activeUsers, 'users', '', '当前在线')}
        ${kpi('API 平均延迟', p.apiLatency, 'dashboard', '', 'p50')}
        ${kpi('今日 LLM 成本', '¥' + p.llmCostToday, 'sparkles', 'amber', `${p.llmCallsToday} 次调用`)}
      </div>

      <div class="grid g-main">
        <div class="card">
          <div class="card-head"><span class="h-section">服务状态</span></div>
          ${p.services.map(s => `
            <div class="topic-row">
              <div class="topic-emoji" style="background:${s.status === 'ok' ? 'var(--success-soft)' : 'var(--warning-soft)'};font-size:15px">
                ${s.status === 'ok' ? '✅' : '⚠️'}
              </div>
              <div class="topic-main">
                <div class="topic-name">${s.name}</div>
                <div class="topic-meta">${s.note}</div>
              </div>
              <span class="badge ${s.status === 'ok' ? 'badge-success' : 'badge-warning'}">
                ${s.status === 'ok' ? '正常' : '注意'}
              </span>
            </div>`).join('')}
        </div>

        <div class="col">
          <div class="card">
            <div class="card-head"><span class="h-section">资源使用</span></div>
            <div class="card-body">
              ${resRow('对象存储', p.storageMB + ' MB', (p.storageMB / 5120) * 100)}
              ${resRow('向量库条目', '12.4k', 62)}
              ${resRow('学生状态记录', '3.1k', 41)}
              ${resRow('LLM 配额（今日）', p.llmCallsToday + ' / 10000', (p.llmCallsToday / 10000) * 100)}
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <span class="h-section">最近课程动态</span>
              <span class="spacer"></span>
              <button class="btn btn-ghost btn-sm" onclick="App.go('#/admin/courses')">全部</button>
            </div>
            ${Engine.courses().slice(0, 4).map(c => `
              <div class="topic-row">
                <div class="topic-emoji">📘</div>
                <div class="topic-main">
                  <div class="topic-name">${escapeHtml(c.title)}</div>
                  <div class="topic-meta">${c.topics.length} 个知识点 · ${escapeHtml(c.source)} · ${c.updated}</div>
                </div>
                <span class="badge ${c.status === '已发布' ? 'badge-success' : c.status === '待审核' ? 'badge-warning' : c.status === '已驳回' ? 'badge-danger' : 'badge-muted'}">${c.status}</span>
              </div>`).join('')}
          </div>

          <div class="card">
            <div class="card-head"><span class="h-section">快速操作</span></div>
            <div class="card-body col">
              <button class="btn btn-ghost btn-block" onclick="Admin.act('重建向量索引')">${I('refresh',15)} 重建 RAG 索引</button>
              <button class="btn btn-ghost btn-block" onclick="Admin.act('导出平台报表')">${I('download',15)} 导出平台报表</button>
              <button class="btn btn-ghost btn-block" onclick="Admin.act('配置 LLM 供应商')">${I('settings',15)} 配置 LLM 供应商</button>
              <div class="text-xs" style="color:var(--text-3)">
                ${I('shield',12)} 内容「审核 / 驳回」属于教师职责，此处不提供审核入口，管理员仅查看记录。
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function kpi(label, val, ic, tone, delta) {
    return `
      <div class="card stat">
        <div class="row"><div class="stat-icon ${tone}">${I(ic, 18)}</div><span class="spacer"></span></div>
        <div class="stat-label" style="margin-top:12px">${label}</div>
        <div class="stat-value">${val}</div>
        <div class="stat-delta up">${delta}</div>
      </div>`;
  }

  function resRow(name, val, pct) {
    return `
      <div class="mb-16">
        <div class="row mb-8">
          <span style="font-size:13px;font-weight:600">${name}</span>
          <span class="spacer"></span>
          <span style="font-size:12.5px;color:var(--text-2)">${val}</span>
        </div>
        ${UI.bar(Math.min(100, pct))}
      </div>`;
  }

  function act(name) { UI.toast(`演示环境：${name} 已触发`, 'ok'); }

  /* ================= 用户管理 ================= */
  function users() {
    const all = [
      ...DATA.students.map(s => ({ ...s, role: 'Student' })),
      { id: 't01', name: 'Teacher',    sid: 'staff', cls: '—', role: 'Instructor', eng: 100, active: true },
      { id: 't02', name: 'Prof. Lee',  sid: 'staff', cls: '—', role: 'Instructor', eng: 100, active: true },
      { id: 'a01', name: 'System Admin', sid: 'admin', cls: '—', role: 'Admin', eng: 100, active: true },
    ];

    const rows = all.map(u => `
      <tr>
        <td>
          <div class="cell-user">
            <span class="avatar">${u.name[0].toUpperCase()}</span>
            <div><div class="u-name">${u.name}</div><div class="u-sub">${u.sid}${u.cls !== '—' ? ' · ' + u.cls : ''}</div></div>
          </div>
        </td>
        <td><span class="badge ${u.role === 'Admin' ? 'badge-danger' : u.role === 'Instructor' ? 'badge-primary' : 'badge-muted'}">${u.role}</span></td>
        <td><span class="badge ${u.active ? 'badge-success' : 'badge-danger'}">${u.active ? '启用' : '停用'}</span></td>
        <td class="num">${u.role === 'Student' ? u.eng : '—'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="Admin.toggleUser('${u.id}')">${u.active ? '停用' : '启用'}</button>
        </td>
      </tr>`).join('');

    return `
      <div class="section-head">
        <div>
          <div class="h-section" style="font-size:18px">用户管理</div>
          <div class="text-sm" style="color:var(--text-3)">管理 Student / Instructor / Admin 三类角色</div>
        </div>
        <span class="spacer"></span>
        <button class="btn btn-grad" onclick="Admin.act('新增用户')">${I('plus',15)} 新增用户</button>
      </div>

      <div class="grid g-3 mb-16">
        ${kpi('学生', DATA.students.length, 'users', '', '在读')}
        ${kpi('教师', 2, 'book', '', '授课中')}
        ${kpi('管理员', 1, 'shield', 'green', '系统管理员')}
      </div>

      <div class="card">
        <div class="card-head"><span class="h-section">全部用户</span><span class="spacer"></span>
          <span class="text-sm" style="color:var(--text-3)">共 ${all.length} 个账号</span>
        </div>
        <table class="tbl">
          <thead><tr><th>用户</th><th>角色</th><th>状态</th><th>参与度</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function toggleUser(id) { UI.toast('演示环境：账号状态已切换', 'ok'); }

  /* ================= 课程管理 ================= */
  function courses() {
    const cs = Engine.courses();          // 与教师端共用同一份课程仓库，新增课程自动同步
    const aiCount = cs.filter(c => c.source.indexOf('AI') >= 0).length;
    const pub = Engine.publishedCourses();

    const statusBadge = (s) => s === '已发布' ? 'badge-success'
                            : s === '待审核' ? 'badge-warning'
                            : s === '已驳回' ? 'badge-danger' : 'badge-muted';

    const rows = cs.map((c, i) => `
      <tr>
        <td>
          <div class="u-name">${escapeHtml(c.title)}</div>
          <div class="u-sub">${escapeHtml(c.source)} · ${escapeHtml(c.instructor)}</div>
        </td>
        <td class="num">${c.topics.length}</td>
        <td class="num">${c.students}</td>
        <td><span class="badge ${statusBadge(c.status)}">${c.status}</span></td>
        <td>${c.updated}</td>
        <td><span class="badge ${c.source.indexOf('AI') >= 0 ? 'badge-primary' : 'badge-muted'}">
              ${c.source.indexOf('AI') >= 0 ? '含 AI 内容' : '人工创建'}</span></td>
      </tr>`).join('');

    return `
      <div class="section-head">
        <div>
          <div class="h-section" style="font-size:18px">课程与内容管理</div>
          <div class="text-sm" style="color:var(--text-3)">查看全部课程与教师审核留痕 · 管理员不参与内容审核</div>
        </div>
      </div>

      <div class="grid g-4 mb-16">
        ${kpi('课程总数', cs.length, 'book', '', `${aiCount} 门含 AI 生成内容`)}
        ${kpi('已发布', pub.length, 'check', 'green', '按发布时间依次追加')}
        ${kpi('学生学习路径', Engine.pathTopics().length + ' 个', 'target', '', `来自 ${pub.length} 门已发布课程`)}
        ${kpi('审核记录', Engine.auditLog().length, 'shield', '', '全部操作留痕')}
      </div>

      <div class="card">
        <div class="card-head"><span class="h-section">全部课程</span><span class="spacer"></span>
          <span class="text-sm" style="color:var(--text-3)">共 ${cs.length} 门 · 知识点数量各不相同 · 只有「已发布」计入学生路径</span>
        </div>
        <table class="tbl">
          <thead><tr><th>课程</th><th>知识点</th><th>学生</th><th>状态</th><th>更新</th><th>内容来源</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      ${auditPanel()}`;
  }

  /* 教师审核操作记录（只读，管理员不做审核决策） */
  function auditPanel() {
    const log = Engine.auditLog();
    const rows = log.map(a => `
      <div class="topic-row">
        <span class="avatar">${escapeHtml((a.actor || '?')[0])}</span>
        <div class="topic-main">
          <div class="topic-name">${escapeHtml(a.action)} · ${escapeHtml(a.courseTitle)}</div>
          <div class="topic-meta">
            ${timeAgo(a.ts)} · ${escapeHtml(a.actor)} · ${a.topicCount} 个知识点
            ${a.note ? ' · ' + escapeHtml(a.note) : ''}
          </div>
        </div>
        <span class="badge ${a.action.indexOf('驳回') >= 0 ? 'badge-danger'
                              : a.action.indexOf('发布') >= 0 ? 'badge-success'
                              : a.action.indexOf('修改') >= 0 ? 'badge-primary' : 'badge-muted'}">
          ${a.action.indexOf('驳回') >= 0 ? '驳回'
            : a.action.indexOf('审核') >= 0 ? '审核通过'
            : a.action.indexOf('修改') >= 0 ? '发布后修改' : '生成'}
        </span>
      </div>`).join('') || UI.empty('暂无审核记录', '📋');

    return `
      <div class="card mt-16">
        <div class="card-head">
          <span class="h-section">教师审核记录（只读）</span>
          <span class="spacer"></span>
          <span class="badge badge-muted">${log.length} 条</span>
        </div>
        ${rows}
        <div class="card-body" style="border-top:1px solid var(--border)">
          <div class="text-xs" style="color:var(--text-3)">
            ${I('shield',12)} 内容审核由<b>授课教师</b>执行，管理员不参与审核决策，仅留存上述记录用于审计：
            谁在什么时间审核了哪门课、当时包含多少个知识点、追加到学生路径后共有多少个知识点，以及驳回或发布后的修改原因。
          </div>
        </div>
      </div>`;
  }

  function timeAgo(ts) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    return Math.floor(d / 86400) + ' 天前';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { overview, users, courses, act, toggleUser };
})();
