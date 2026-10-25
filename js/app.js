/* ============================================================
   app.js — 应用外壳与路由（简化版）
   结构：侧边栏（品牌 + 导航） / 顶栏（标题 + 角色切换 + 用户）
   ============================================================ */

const App = (() => {

  const I = UI.icon;

  /* ---------------- 导航配置 ---------------- */
  const NAV = {
    student: [
      { hash: '#/student/dashboard', label: '学习主页',        icon: 'dashboard' },
      { hash: '#/student/materials', label: '课程资料 · 问答', icon: 'book' },
      { hash: '#/student/progress',  label: '学习进度',        icon: 'target' },
    ],
    instructor: [
      { hash: '#/instructor/dashboard', label: '班级总览',   icon: 'dashboard' },
      { hash: '#/instructor/generate',  label: 'AI 生成课程', icon: 'sparkles' },
      { hash: '#/instructor/courses',   label: '课程管理',   icon: 'book' },
      { hash: '#/instructor/heatmap',   label: '知识热力图', icon: 'chart' },
      { hash: '#/instructor/audit',     label: '审核记录',   icon: 'shield' },
      { hash: '#/instructor/students',  label: '学生管理',   icon: 'users' },
    ],
    admin: [
      { hash: '#/admin/overview', label: '平台总览', icon: 'dashboard' },
      { hash: '#/admin/users',    label: '用户管理', icon: 'users' },
      { hash: '#/admin/courses',  label: '课程管理', icon: 'layers' },
    ],
  };

  const TITLES = {
    '#/student/dashboard': ['学习主页', '教师发布的学习路径 · Agent 推荐下一步'],
    '#/student/progress':  ['学习进度', '各知识点掌握度与学习轨迹'],
    '#/student/materials': ['课程资料 · AI 问答', '上传资料，向 AI 助手提问'],
    '#/student/pretest':   ['Pre-test', '建立你的初始知识状态'],
    '#/instructor/dashboard': ['班级总览', '参与度与知识状态概览'],
    '#/instructor/generate':  ['AI 生成课程', '上传课件 → AI 抽取知识点 → 查看修改 → 审核发布'],
    '#/instructor/courses':   ['课程管理', '查看 / 修改已发布与待审核课程'],
    '#/instructor/audit':     ['审核记录', '我的审核与驳回操作留痕'],
    '#/instructor/heatmap':   ['知识热力图', '学生 × 知识点掌握度'],
    '#/instructor/students':  ['学生管理', '导入学生并追踪参与度'],
    '#/admin/overview': ['平台总览', '系统健康、资源与成本'],
    '#/admin/users':    ['用户管理', 'Student / Instructor / Admin'],
    '#/admin/courses':  ['课程管理', '课程审批与 AI 内容审核'],
  };

  const ROLES = [
    { key: 'student',    label: '学生' },
    { key: 'instructor', label: '教师' },
    { key: 'admin',      label: '管理员' },
  ];

  const USER = {
    student:    { name: 'student1',      initial: 'S' },
    instructor: { name: 'Teacher',      initial: 'T' },
    admin:      { name: 'System Admin', initial: 'A'  },
  };

  /* ---------------- 路由 ---------------- */
  function currentRole() {
    const h = location.hash || '';
    if (h.startsWith('#/instructor')) return 'instructor';
    if (h.startsWith('#/admin')) return 'admin';
    return 'student';
  }

  function view() {
    const seg = (location.hash || '#/student/dashboard').replace('#/', '').split('/');

    if (seg[0] === 'student') {
      if (seg[1] === 'activity') return Student.activity(seg[2], seg[3]);
      if (seg[1] === 'topic')    return Student.topicDetail(seg[2]);
      if (seg[1] === 'pretest')   return Student.pretestView();
      if (seg[1] === 'materials') return Student.materialsView();
      if (seg[1] === 'progress')  return Student.progress();
      return Student.dashboard();
    }
    if (seg[0] === 'instructor') {
      if (seg[1] === 'heatmap')  return Instructor.heatmap();
      if (seg[1] === 'generate') return Instructor.generateView();
      if (seg[1] === 'courses')  return Instructor.courses();
      if (seg[1] === 'audit')    return Instructor.audit();
      if (seg[1] === 'students') return Instructor.students();
      if (seg[1] === 'topic')    return Instructor.topicEdit(seg[2], Number(seg[3]));
      return Instructor.dashboard();
    }
    if (seg[0] === 'admin') {
      if (seg[1] === 'users')   return Admin.users();
      if (seg[1] === 'courses') return Admin.courses();
      return Admin.overview();
    }
    return Student.dashboard();
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    const role = currentRole();
    Engine.setRole(role);

    const h = location.hash || '#/student/dashboard';
    const title = TITLES[h] || ['', ''];
    const u = USER[role];

    const sidebar = `
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-logo">${I('brain', 17)}</div>
          <div class="brand-name">Adaptive Study</div>
        </div>
        <div class="sidebar-scroll">
          <div class="nav-label">${ROLES.find(r => r.key === role).label}菜单</div>
          ${NAV[role].map(n => `
            <button class="nav-item ${h === n.hash ? 'active' : ''}" onclick="App.go('${n.hash}')">
              <span class="ico">${I(n.icon, 17)}</span>${n.label}
            </button>`).join('')}
        </div>
        <div class="sidebar-foot">COMP5241 · 原型演示</div>
      </aside>`;

    const topbar = `
      <header class="topbar">
        <div>
          <div class="topbar-title">${title[0]}</div>
          <div class="topbar-sub">${title[1]}</div>
        </div>
        <div class="topbar-right">
          <div class="role-switch">
            ${ROLES.map(r => `
              <button class="role-btn ${r.key === role ? 'active' : ''}"
                      onclick="App.switchRole('${r.key}')">${r.label}</button>`).join('')}
          </div>
          <div class="row" style="gap:8px">
            <span class="avatar">${u.initial}</span>
            <div>
              <div class="u-name">${u.name}</div>
              <div class="text-xs" style="color:var(--text-3)">${ROLES.find(r => r.key === role).label}</div>
            </div>
          </div>
        </div>
      </header>`;

    document.getElementById('app').innerHTML = `
      ${sidebar}
      <main class="main">
        ${topbar}
        <div class="content">
          <div class="content-inner page-in">${view()}</div>
        </div>
      </main>`;
  }

  /* ---------------- 导航 ---------------- */
  function go(hash) {
    if (location.hash === hash) { render(); return; }
    location.hash = hash;
  }

  function switchRole(role) {
    const def = { student: '#/student/dashboard', instructor: '#/instructor/dashboard', admin: '#/admin/overview' };
    go(def[role]);
  }

  function tip(name) { UI.toast(`演示环境：${name} 功能未接入`, 'warn'); }

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (!location.hash) location.hash = '#/student/dashboard';
    window.addEventListener('hashchange', render);
    render();
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { render, go, switchRole, tip, view };
})();
