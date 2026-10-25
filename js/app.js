/* ============================================================
   app.js — 应用外壳与路由
   ============================================================ */

const App = (() => {

  const I = UI.icon;

  /* ---------------- 导航配置 ---------------- */
  const NAV = {
    student: [
      { hash: '#/student/dashboard', label: '学习主页',   icon: 'dashboard' },
      { hash: '#/student/progress',  label: '学习进度',   icon: 'target' },
      { hash: '#/student/explore',   label: '自定义主题', icon: 'sparkles' },
    ],
    instructor: [
      { hash: '#/instructor/dashboard', label: '班级总览',   icon: 'dashboard' },
      { hash: '#/instructor/heatmap',   label: '知识热力图', icon: 'chart' },
      { hash: '#/instructor/courses',   label: '课程管理',   icon: 'book' },
      { hash: '#/instructor/students',  label: '学生管理',   icon: 'users' },
    ],
    admin: [
      { hash: '#/admin/overview', label: '平台总览', icon: 'dashboard' },
      { hash: '#/admin/users',    label: '用户管理', icon: 'users' },
      { hash: '#/admin/courses',  label: '课程管理', icon: 'layers' },
    ],
  };

  const TITLES = {
    '#/student/dashboard': ['学习主页', 'Adaptive Planning Agent 为你规划的学习路径'],
    '#/student/progress':  ['学习进度', '各知识点掌握度与学习轨迹'],
    '#/student/explore':   ['自定义学习主题', '输入任意主题，AI 生成 mini-course 与学习路径'],
    '#/student/pretest':   ['Pre-test', '起点评估，用于建立初始知识状态'],
    '#/instructor/dashboard': ['班级总览', '参与度与知识状态概览'],
    '#/instructor/heatmap':   ['班级知识热力图', '学生 × 知识点掌握度矩阵'],
    '#/instructor/courses':   ['课程管理', '定制现有课程 / AI 生成 mini-course'],
    '#/instructor/students':  ['学生管理', '导入学生并追踪参与度'],
    '#/admin/overview': ['平台总览', '系统健康、资源与成本'],
    '#/admin/users':    ['用户管理', 'Student / Instructor / Admin'],
    '#/admin/courses':  ['课程与内容管理', '课程审批与 AI 内容审核'],
  };

  const ROLES = [
    { key: 'student',    label: '学生' },
    { key: 'instructor', label: '教师' },
    { key: 'admin',      label: '管理员' },
  ];

  /* ---------------- 路由 ---------------- */
  function currentRole() {
    const h = location.hash || '';
    if (h.startsWith('#/instructor')) return 'instructor';
    if (h.startsWith('#/admin')) return 'admin';
    return 'student';
  }

  function view() {
    const h = location.hash || '#/student/dashboard';
    const seg = h.replace('#/', '').split('/');   // [role, page, ...args]

    if (seg[0] === 'student') {
      if (seg[1] === 'activity') return Student.activity(seg[2], seg[3]);
      if (seg[1] === 'topic')    return Student.topicDetail(seg[2]);
      if (seg[1] === 'pretest')  return Student.pretestView();
      if (seg[1] === 'explore')  return Student.exploreView();
      if (seg[1] === 'progress') return Student.progress();
      return Student.dashboard();
    }
    if (seg[0] === 'instructor') {
      if (seg[1] === 'heatmap')  return Instructor.heatmap();
      if (seg[1] === 'courses')  return Instructor.courses();
      if (seg[1] === 'students') return Instructor.students();
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
    const navItems = NAV[role];
    const title = TITLES[h] || TITLES[h.split('/').slice(0, 3).join('/')] || ['', ''];

    const sidebar = `
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-logo">${I('brain', 19)}</div>
          <div class="brand-text">
            <div class="brand-name">Adaptive Study</div>
            <div class="brand-sub">Assistant Platform</div>
          </div>
        </div>
        <div class="sidebar-scroll">
          <div class="nav-group">
            <div class="nav-label">${ROLES.find(r => r.key === role).label}工作台</div>
            ${navItems.map(n => `
              <button class="nav-item ${h === n.hash ? 'active' : ''}" onclick="App.go('${n.hash}')">
                <span class="ico">${I(n.icon, 18)}</span>${n.label}
              </button>`).join('')}
          </div>
        </div>
        <div class="sidebar-foot">
          <div class="nav-label" style="padding:0 2px 8px">切换角色</div>
          <div class="role-switch">
            ${ROLES.map(r => `
              <button class="role-btn ${r.key === role ? 'active' : ''}"
                      onclick="App.switchRole('${r.key}')">${r.label}</button>`).join('')}
          </div>
        </div>
      </aside>`;

    const topbar = `
      <header class="topbar">
        <div>
          <div class="topbar-title">${title[0]}</div>
          <div class="topbar-sub">${title[1]}</div>
        </div>
        <div class="topbar-right">
          <button class="icon-btn" onclick="App.tip('搜索')">${I('search', 18)}</button>
          <button class="icon-btn" onclick="App.tip('通知')">${I('bell', 18)}<span class="dot-badge"></span></button>
          <div class="row" style="gap:8px">
            <span class="avatar">${role === 'admin' ? 'A' : role === 'instructor' ? 'DC' : Engine.state.studentName[0]}</span>
            <div style="line-height:1.25">
              <div style="font-size:12.5px;font-weight:650">${role === 'admin' ? 'System Admin' : role === 'instructor' ? 'Dr. Chan' : Engine.state.studentName}</div>
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

  return { render, go, switchRole, tip };
})();
