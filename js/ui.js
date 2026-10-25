/* ============================================================
   ui.js — 图标与通用 UI 组件
   ============================================================ */

const UI = (() => {

  /* ---------- SVG 图标 ---------- */
  const P = {
    dashboard: '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
    book:      '<path d="M4 4a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2V4z"/><path d="M6 18h12v2H6a2 2 0 0 1 0-4z" opacity=".35"/>',
    target:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    sparkles:  '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/><path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" opacity=".6"/>',
    chart:     '<path d="M4 20V10m5 10V4m5 16v-7m5 7V8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
    users:     '<path d="M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19"/><circle cx="9.5" cy="7" r="3.4"/><path d="M21 19v-1.5a4 4 0 0 0-3-3.87M16.5 3.6a3.4 3.4 0 0 1 0 6.6"/>',
    layers:    '<path d="M12 2.5 3 7.5l9 5 9-5-9-5z"/><path d="M3 12.5l9 5 9-5" opacity=".55"/><path d="M3 17l9 5 9-5" opacity=".3"/>',
    code:      '<path d="m9 18-6-6 6-6M15 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    chat:      '<path d="M20 15a2 2 0 0 1-2 2H8l-4 3V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
    bug:       '<path d="M8 6a4 4 0 0 1 8 0M6 10h12M7 10v3a5 5 0 0 0 10 0v-3M5 12h2M17 12h2M7 17l-1.5 2M17 17l1.5 2M9 10V8M15 10V8" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
    gamepad:   '<path d="M7 12h4m-2-2v4m5.5 1h.01M16 11h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17.5 5h-11A5.5 5.5 0 0 0 1 10.5v3A5.5 5.5 0 0 0 6.5 19c1.6 0 2.7-1 3.5-2h4c.8 1 1.9 2 3.5 2a5.5 5.5 0 0 0 5.5-5.5v-3A5.5 5.5 0 0 0 17.5 5z" stroke="currentColor" stroke-width="1.7" fill="none"/>',
    refresh:   '<path d="M20 11a8 8 0 1 0-.9 4.5M20 5v6h-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    play:      '<path d="M7 4.5v15l12-7.5-12-7.5z"/>',
    check:     '<path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    clock:     '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 7v5l3.2 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    flame:     '<path d="M12 2s4 4.5 4 8a4 4 0 0 1-8 0c0-1.2.5-2.3 1-3 .2 1.5 1 2.3 1.8 2.3C12 9.3 12 6 12 2z"/><path d="M12 22a5.5 5.5 0 0 0 5.5-5.5c0-2-1-3.5-2.2-4.8" opacity=".45"/>',
    settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 2.6 15a1.7 1.7 0 0 0-1.56-1H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.66 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 7 4.54h.08A1.7 1.7 0 0 0 8.1 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 17.4 7v.08a1.7 1.7 0 0 0 1.56 1H19a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" opacity=".55"/>',
    bell:      '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    plus:      '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 9l5-5 5 5M12 4v12" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    search:    '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    arrowRight:'<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    brain:     '<path d="M9.5 3A3.5 3.5 0 0 0 6 6.5c-1.7.6-3 2.2-3 4.2 0 1.3.6 2.5 1.5 3.3-.2.5-.3 1-.3 1.5A3.5 3.5 0 0 0 7.7 19c.9 1.2 2.3 2 3.9 2 .5 0 1-.1 1.4-.3V3.4c-.5-.3-1-.4-1.5-.4z" opacity=".55"/><path d="M14.5 3A3.5 3.5 0 0 1 18 6.5c1.7.6 3 2.2 3 4.2 0 1.3-.6 2.5-1.5 3.3.2.5.3 1 .3 1.5A3.5 3.5 0 0 1 16.3 19c-.9 1.2-2.3 2-3.9 2-.5 0-1-.1-1.4-.3"/>',
    shield:    '<path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.6 7.5 10 4.3-1.4 7.5-5.4 7.5-10v-6L12 2.5z" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    database:  '<ellipse cx="12" cy="6" rx="8" ry="3.2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M4 6v12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V6M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" stroke="currentColor" stroke-width="1.8" fill="none"/>',
    edit:      '<path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  function icon(name, size = 18) {
    const d = P[name] || P.dashboard;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${d}</svg>`;
  }

  /* ---------- toast ---------- */
  function toast(msg, type = '') {
    const box = document.getElementById('toast-container');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    const ico = type === 'ok' ? icon('check', 16)
              : type === 'err' ? icon('bug', 16)
              : icon('sparkles', 16);
    t.innerHTML = `${ico}<span>${msg}</span>`;
    box.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0'; t.style.transform = 'translateX(20px)';
      setTimeout(() => t.remove(), 320);
    }, 2600);
  }

  /* ---------- 掌握度 → 等级 ---------- */
  function level(m) {
    if (m >= 75) return { key: 'ok',  label: '已掌握', badge: 'badge-success' };
    if (m >= 45) return { key: 'mid', label: '学习中', badge: 'badge-warning' };
    return            { key: 'low', label: '薄弱',   badge: 'badge-danger'  };
  }

  /* ---------- 掌握度 → 热力图颜色 ---------- */
  function heatColor(m) {
    if (m >= 85) return '#15803d';
    if (m >= 70) return '#22a55a';
    if (m >= 55) return '#84cc16';
    if (m >= 40) return '#f59e0b';
    if (m >= 25) return '#f97316';
    return '#dc2626';
  }

  /* ---------- 进度条 ---------- */
  function bar(m, width) {
    const lv = level(m);
    const w = width ? ` style="width:${width}"` : '';
    return `<div class="bar"${w}><div class="bar-fill ${lv.key}" style="width:${m}%"></div></div>`;
  }

  /* ---------- 环形进度 ---------- */
  function ring(m, size = 92, label = '') {
    const r = size / 2 - 8;
    const c = 2 * Math.PI * r;
    const off = c - (m / 100) * c;
    const col = m >= 75 ? '#16a34a' : m >= 45 ? '#d97706' : '#dc2626';
    return `
      <div class="ring" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}">
          <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="#e3e7f0" stroke-width="8" fill="none"/>
          <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${col}" stroke-width="8" fill="none"
                  stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
                  style="transition:stroke-dashoffset .7s ease"/>
        </svg>
        <div class="ring-val" style="color:${col}">${m}<span style="font-size:11px">%</span></div>
      </div>
      ${label ? `<div class="text-xs" style="color:var(--text-3);margin-top:4px">${label}</div>` : ''}`;
  }

  /* ---------- 空状态 ---------- */
  function empty(text, emoji = '📭') {
    return `<div class="empty"><div class="empty-ico">${emoji}</div><div>${text}</div></div>`;
  }

  /* ---------- 卡片包装 ---------- */
  function card(inner, opts = {}) {
    const head = opts.title
      ? `<div class="card-head"><span class="h-section">${opts.title}</span>
           ${opts.action || ''}<span class="spacer"></span>${opts.right || ''}</div>`
      : '';
    return `<div class="card">${head}<div class="${opts.pad === false ? '' : 'card-body'}">${inner}</div></div>`;
  }

  return { icon, toast, level, heatColor, bar, ring, empty, card, P };
})();
