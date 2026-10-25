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
            <div class="card-head"><span class="h-section">快速操作</span></div>
            <div class="card-body col">
              <button class="btn btn-ghost btn-block" onclick="Admin.act('重建向量索引')">${I('refresh',15)} 重建 RAG 索引</button>
              <button class="btn btn-ghost btn-block" onclick="Admin.act('导出平台报表')">${I('download',15)} 导出平台报表</button>
              <button class="btn btn-ghost btn-block" onclick="Admin.act('配置 LLM 供应商')">${I('settings',15)} 配置 LLM 供应商</button>
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
      { id: 't01', name: 'Dr. Chan',   sid: 'staff', cls: '—', role: 'Instructor', eng: 100, active: true },
      { id: 't02', name: 'Prof. Lee',  sid: 'staff', cls: '—', role: 'Instructor', eng: 100, active: true },
      { id: 'a01', name: 'System Admin', sid: 'admin', cls: '—', role: 'Admin', eng: 100, active: true },
    ];

    const rows = all.map(u => `
      <tr>
        <td>
          <div class="cell-user">
            <span class="avatar">${u.name[0]}</span>
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
    const rows = DATA.courses.map(c => `
      <tr>
        <td><div class="u-name">${c.title}</div><div class="u-sub">${c.author}</div></td>
        <td class="num">${c.topics}</td>
        <td class="num">${c.students}</td>
        <td><span class="badge ${c.status === '已发布' ? 'badge-success' : 'badge-muted'}">${c.status}</span></td>
        <td>${c.updated}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="Admin.act('编辑课程')">${I('edit',13)}</button>
        </td>
      </tr>`).join('');

    return `
      <div class="section-head">
        <div>
          <div class="h-section" style="font-size:18px">课程与内容管理</div>
          <div class="text-sm" style="color:var(--text-3)">平台级课程审批、归档与内容治理</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><span class="h-section">全部课程</span><span class="spacer"></span>
          <span class="text-sm" style="color:var(--text-3)">共 ${DATA.courses.length} 门</span>
        </div>
        <table class="tbl">
          <thead><tr><th>课程</th><th>知识点</th><th>学生</th><th>状态</th><th>更新</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="card mt-16">
        <div class="card-head"><span class="h-section">AI 内容审核队列（Diligence）</span></div>
        <div class="card-body">
          ${[
            ['AI 生成', '需求工程工作坊 · 单元 3「用户故事拆分」', '待审核', 'badge-warning'],
            ['AI 生成', '软件测试实战 · 单元 2「边界值分析」', '待审核', 'badge-warning'],
            ['人工创建', 'Git 与团队协作 · 单元 4「冲突处理」', '已通过', 'badge-success'],
          ].map(([src, t, st, cls]) => `
            <div class="topic-row">
              <span class="badge ${src === 'AI 生成' ? 'badge-primary' : 'badge-muted'}">${src}</span>
              <div class="topic-main"><div class="topic-name">${t}</div></div>
              <span class="badge ${cls}">${st}</span>
              <button class="btn btn-ghost btn-sm" onclick="Admin.act('审核')">审核</button>
            </div>`).join('')}
          <div class="text-xs mt-16" style="color:var(--text-3)">
            ${I('shield',12)} 所有 AI 生成内容在发布前必须经过人工审核并留痕，符合 Diligence 要求。
          </div>
        </div>
      </div>`;
  }

  return { overview, users, courses, act, toggleUser };
})();
