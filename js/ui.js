'use strict';
/* 通用界面组件：浮层、菜单、对话框、提示、日期选择器、通知 */

/* ---------- 浮层 ---------- */
const Pop = {
  cur: null,
  /** anchor 可以是元素，也可以是 {x, y} 坐标点 */
  open(anchor, el, opts) {
    opts = opts || {};
    if (Pop.cur && anchor instanceof Element && Pop.cur.anchor === anchor) { Pop.close(); return null; }
    Pop.close();
    el.classList.add('popover');
    document.body.appendChild(el);
    Pop.cur = { el, anchor, onClose: opts.onClose };
    Pop.place(el, anchor, opts);
    setTimeout(() => {
      document.addEventListener('mousedown', Pop._outside, true);
      document.addEventListener('touchstart', Pop._outside, true);
    });
    return el;
  },
  place(el, anchor, opts) {
    const r = anchor instanceof Element
      ? anchor.getBoundingClientRect()
      : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0 };
    const w = el.offsetWidth, hgt = el.offsetHeight, gap = opts.gap != null ? opts.gap : 6;
    let left = opts.align === 'right' ? r.right - w : r.left;
    let top = r.bottom + gap;
    if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - gap);
    left = Math.max(8, Math.min(left, innerWidth - w - 8));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  },
  _outside(e) {
    if (!Pop.cur) return;
    const a = Pop.cur.anchor;
    if (Pop.cur.el.contains(e.target)) return;
    if (a instanceof Element && a.contains(e.target)) return;
    Pop.close();
  },
  close() {
    if (!Pop.cur) return;
    const c = Pop.cur;
    Pop.cur = null;
    document.removeEventListener('mousedown', Pop._outside, true);
    document.removeEventListener('touchstart', Pop._outside, true);
    c.el.remove();
    if (c.onClose) c.onClose();
  },
};

/* ---------- 菜单 ---------- */
const Menu = {
  /** items: [{label, icon, fn, danger, checked, sep, header, dot, disabled}] */
  open(anchor, items, opts) {
    const el = h('<div class="menu"></div>');
    items.forEach((it) => {
      if (it.sep) { el.appendChild(h('<div class="menu-sep"></div>')); return; }
      if (it.header) { el.appendChild(h('<div class="menu-header">' + U.esc(it.header) + '</div>')); return; }
      const lead = it.dot !== undefined
        ? '<span class="dot" style="background:' + (it.dot || 'var(--text-4)') + '"></span>'
        : (it.icon ? ic(it.icon, 16) : '');
      const row = h('<div class="menu-item' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : '') + '">' +
        '<span class="menu-icon' + (it.iconCls ? ' ' + it.iconCls : '') + '">' + lead + '</span>' +
        '<span class="menu-label">' + U.esc(it.label) + '</span>' +
        (it.checked ? '<span class="menu-shortcut">' + ic('check', 15, 2) + '</span>' : '') +
        (it.hint ? '<span class="menu-shortcut">' + U.esc(it.hint) + '</span>' : '') +
        '</div>');
      if (!it.disabled) row.addEventListener('click', () => { Pop.close(); it.fn && it.fn(); });
      el.appendChild(row);
    });
    return Pop.open(anchor, el, opts);
  },
};

/* ---------- 对话框 ---------- */
const Modal = {
  stack: [],
  open(o) {
    const ov = h('<div class="modal-overlay"><div class="modal" style="width:' + (o.width || 420) + 'px">' +
      (o.title != null ? '<div class="modal-header"><span>' + U.esc(o.title) + '</span><button class="modal-x" data-m="x">' + ic('x', 15, 2) + '</button></div>' : '') +
      '<div class="modal-body">' + (o.body || '') + '</div>' +
      (o.footer ? '<div class="modal-footer">' + o.footer + '</div>' : '') +
      '</div></div>');
    const m = { el: ov, box: ov.firstElementChild, close: (v) => Modal.close(m, v), onClose: o.onClose };
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) m.close(); });
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (b && b.dataset.m === 'x') m.close();
    });
    document.body.appendChild(ov);
    Modal.stack.push(m);
    if (o.onMount) o.onMount(m.box, m);
    const f = m.box.querySelector('[autofocus]');
    if (f) setTimeout(() => { f.focus(); if (f.select) f.select(); });
    return m;
  },
  close(m, v) {
    m = m || Modal.stack[Modal.stack.length - 1];
    if (!m) return;
    Modal.stack = Modal.stack.filter((x) => x !== m);
    m.el.remove();
    if (m.onClose) m.onClose(v);
  },
  top() {
    return Modal.stack[Modal.stack.length - 1];
  },
  confirm(o) {
    return new Promise((resolve) => {
      let ok = false;
      Modal.open({
        width: 380,
        body: '<div class="confirm">' +
          '<div class="confirm-ico' + (o.danger ? ' danger' : '') + '">' + ic(o.icon || (o.danger ? 'trash' : 'checkCircle'), 24) + '</div>' +
          '<div class="confirm-title">' + U.esc(o.title || '确认') + '</div>' +
          (o.msg ? '<div class="confirm-msg">' + U.esc(o.msg) + '</div>' : '') +
          '<div class="confirm-btns"><button class="btn" data-c="no">取消</button>' +
          '<button class="btn ' + (o.danger ? 'btn-danger-solid' : 'btn-primary') + '" data-c="ok" autofocus>' + U.esc(o.ok || '确定') + '</button></div></div>',
        onMount(box, m) {
          box.addEventListener('click', (e) => {
            const b = e.target.closest('[data-c]');
            if (!b) return;
            ok = b.dataset.c === 'ok';
            m.close();
          });
          box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { ok = true; m.close(); } });
        },
        onClose: () => resolve(ok),
      });
    });
  },
  prompt(o) {
    return new Promise((resolve) => {
      let val = null;
      Modal.open({
        title: o.title, width: 400,
        body: '<input class="input wide" id="pr-in" maxlength="60" autofocus placeholder="' + U.esc(o.placeholder || '') + '" value="' + U.esc(o.value || '') + '">',
        footer: '<button class="btn" data-m="x">取消</button><button class="btn btn-primary" data-p="ok">确定</button>',
        onMount(box, m) {
          const inp = box.querySelector('#pr-in');
          const done = () => { val = inp.value.trim(); m.close(); };
          box.querySelector('[data-p]').addEventListener('click', done);
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) done(); });
        },
        onClose: () => resolve(val || null),
      });
    });
  },
};

/* ---------- 提示 ---------- */
function toast(msg, type, action) {
  const host = $('#toasts');
  const el = h('<div class="toast' + (type ? ' toast-' + type : '') + '"><span>' + U.esc(msg) + '</span></div>');
  if (action) {
    const b = h('<button class="toast-act">' + U.esc(action.label) + '</button>');
    b.addEventListener('click', () => { action.fn(); hide(); });
    el.appendChild(b);
    el.style.pointerEvents = 'auto';
  }
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  let tm = setTimeout(hide, action ? 5000 : 2400);
  function hide() {
    clearTimeout(tm);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }
  while (host.children.length > 3) host.firstElementChild.remove();
}

/* ---------- 声音与系统通知 ---------- */
const Sound = {
  ctx: null,
  chime() {
    if (!S.settings.sound) return;
    try {
      const ctx = Sound.ctx || (Sound.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const t0 = ctx.currentTime;
      [880, 1175, 1568].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const st = t0 + i * 0.16;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.2, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.7);
        o.connect(g).connect(ctx.destination);
        o.start(st);
        o.stop(st + 0.75);
      });
    } catch (e) { /* 忽略 */ }
  },
};

function askNotify() {
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch (e) { /* 忽略 */ }
  }
}

function sysNotify(title, body, onClick) {
  Sound.chime();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { body, tag: title + body });
      n.onclick = () => { window.focus(); onClick && onClick(); n.close(); };
    } catch (e) { /* 忽略 */ }
  }
}

/* ---------- 日期选择器 ---------- */
const DatePicker = {
  /** val: {dueDate, dueTime, reminder, repeat}；onSave(patch) */
  open(anchor, val, onSave) {
    const v = Object.assign({ dueDate: null, dueTime: null, reminder: null, repeat: null }, val);
    let month = U.monthStart(v.dueDate || U.today());
    const el = h('<div class="dp"></div>');
    const save = (patch) => {
      Pop.close();
      if (patch.reminder != null) askNotify();
      onSave(patch);
    };
    const render = () => {
      const today = U.today();
      const start = U.weekStart(month);
      let cells = '';
      for (let i = 0; i < 7; i++) cells += '<span class="dp-wd">' + U.WD[(S.settings.weekStart + i) % 7] + '</span>';
      for (let i = 0; i < 42; i++) {
        const d = U.addDays(start, i);
        const cls = ['dp-day'];
        if (d.slice(0, 7) !== month.slice(0, 7)) cls.push('other');
        if (d === today) cls.push('today');
        if (d === v.dueDate) cls.push('on');
        cells += '<button class="' + cls.join(' ') + '" data-dp="day" data-d="' + d + '">' + (+d.slice(8)) + '</button>';
      }
      const md = U.toDate(month);
      const remOpts = '<option value="">无</option>' + Object.keys(REMIND_NAMES).map((k) =>
        '<option value="' + k + '"' + (String(v.reminder) === k ? ' selected' : '') + '>' + REMIND_NAMES[k] + '</option>').join('');
      const repOpts = '<option value="">不重复</option>' + Object.keys(REPEAT_NAMES).map((k) =>
        '<option value="' + k + '"' + (v.repeat === k ? ' selected' : '') + '>' + REPEAT_NAMES[k] + '</option>').join('');
      el.innerHTML =
        '<div class="dp-quick">' +
        '<button data-dp="q" data-q="0" title="今天">' + ic('sun', 18) + '<span>今天</span></button>' +
        '<button data-dp="q" data-q="1" title="明天">' + ic('sunrise', 18) + '<span>明天</span></button>' +
        '<button data-dp="q" data-q="nw" title="下周一">' + ic('calNext', 18) + '<span>下周一</span></button>' +
        '<button data-dp="q" data-q="none" title="清除日期">' + ic('calX', 18) + '<span>无日期</span></button>' +
        '</div>' +
        '<div class="dp-head"><b>' + md.getFullYear() + '年' + (md.getMonth() + 1) + '月</b><span>' +
        '<button class="icon-btn sm" data-dp="pm">' + ic('chevL', 16) + '</button>' +
        '<button class="icon-btn sm dp-dot" data-dp="tm" title="回到本月"><i></i></button>' +
        '<button class="icon-btn sm" data-dp="nm">' + ic('chevR', 16) + '</button></span></div>' +
        '<div class="dp-grid">' + cells + '</div>' +
        '<div class="dp-rows">' +
        '<label class="dp-row">' + ic('clock', 16) + '<span>时间</span><input type="time" class="input sm" data-f="time" value="' + (v.dueTime || '') + '">' +
        (v.dueTime ? '<button class="icon-btn sm" data-dp="ct" title="清除时间">' + ic('x', 14) + '</button>' : '') + '</label>' +
        '<label class="dp-row">' + ic('bell', 16) + '<span>提醒</span><select class="input sm" data-f="rem">' + remOpts + '</select></label>' +
        '<label class="dp-row">' + ic('repeat', 16) + '<span>重复</span><select class="input sm" data-f="rep">' + repOpts + '</select></label>' +
        '</div>' +
        '<div class="dp-foot"><button class="btn btn-sm" data-dp="clear">清除</button><button class="btn btn-sm btn-primary" data-dp="ok">确定</button></div>';
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dp]');
      if (!b) return;
      e.preventDefault();
      const a = b.dataset.dp;
      if (a === 'day') { v.dueDate = b.dataset.d; render(); }
      else if (a === 'pm') { month = U.addMonths(month, -1); render(); }
      else if (a === 'nm') { month = U.addMonths(month, 1); render(); }
      else if (a === 'tm') { month = U.monthStart(U.today()); render(); }
      else if (a === 'ct') { v.dueTime = null; render(); }
      else if (a === 'q') {
        const q = b.dataset.q;
        const today = U.today();
        if (q === 'none') return save({ dueDate: null, dueTime: null, reminder: null, repeat: null });
        let d = today;
        if (q === '1') d = U.addDays(today, 1);
        if (q === 'nw') d = U.addDays(U.weekStart(today), 7 + ((1 - S.settings.weekStart + 7) % 7));
        save({ dueDate: d, dueTime: v.dueTime, reminder: v.reminder, repeat: v.repeat });
      } else if (a === 'clear') save({ dueDate: null, dueTime: null, reminder: null, repeat: null });
      else if (a === 'ok') {
        if (!v.dueDate && (v.dueTime || v.repeat)) v.dueDate = U.today();
        save({ dueDate: v.dueDate, dueTime: v.dueDate ? v.dueTime : null, reminder: v.dueDate ? v.reminder : null, repeat: v.dueDate ? v.repeat : null });
      }
    });
    el.addEventListener('change', (e) => {
      const f = e.target.dataset.f;
      if (f === 'time') {
        const had = !!v.dueTime;
        v.dueTime = e.target.value || null;
        if (v.dueTime && !had && v.reminder == null) v.reminder = 0;
        if (!v.dueDate && v.dueTime) {
          v.dueDate = U.today();
          const cell = el.querySelector('.dp-day[data-d="' + v.dueDate + '"]');
          if (cell) cell.classList.add('on');
        }
        el.querySelector('[data-f="rem"]').value = v.reminder == null ? '' : String(v.reminder);
      } else if (f === 'rem') v.reminder = e.target.value === '' ? null : +e.target.value;
      else if (f === 'rep') v.repeat = e.target.value || null;
    });
    render();
    Pop.open(anchor, el);
  },
};

/** 优先级菜单 */
function priorityMenu(anchor, cur, fn) {
  Menu.open(anchor, PRI_LIST.map((p) => ({
    label: PRI[p].name, icon: p ? 'flagFill' : 'flag', iconCls: 'pc-' + p, checked: cur === p, fn: () => fn(p),
  })));
}

/** 清单选择菜单 */
function listMenu(anchor, cur, fn) {
  Menu.open(anchor, S.lists.map((l) => ({
    label: l.name, icon: l.id === 'inbox' ? 'inbox' : null, dot: l.id === 'inbox' ? undefined : l.color,
    checked: l.id === cur, fn: () => fn(l.id),
  })));
}

/** 标签选择浮层（可搜索、可新建） */
function tagPicker(anchor, selected, fn) {
  const sel = new Set(selected);
  const el = h('<div class="tagpick"><input class="input sm wide" placeholder="搜索或新建标签"><div class="tp-list"></div></div>');
  const inp = el.querySelector('input'), box = el.querySelector('.tp-list');
  const render = () => {
    const q = inp.value.trim().replace(/^#/, '');
    const all = Tags.all().map((t) => t.name).filter((n) => !q || n.includes(q));
    let html = all.map((n) => '<div class="menu-item" data-t="' + U.esc(n) + '"><span class="menu-icon">' + ic('hash', 15) + '</span><span class="menu-label">' + U.esc(n) + '</span>' +
      (sel.has(n) ? '<span class="menu-shortcut">' + ic('check', 15, 2) + '</span>' : '') + '</div>').join('');
    if (q && !Tags.all().find((t) => t.name === q)) html += '<div class="menu-item" data-new="' + U.esc(q) + '"><span class="menu-icon">' + ic('plus', 15) + '</span><span class="menu-label">新建标签「' + U.esc(q) + '」</span></div>';
    box.innerHTML = html || '<div class="tp-empty">输入名称以新建标签</div>';
  };
  box.addEventListener('click', (e) => {
    const it = e.target.closest('.menu-item');
    if (!it) return;
    const n = it.dataset.new || it.dataset.t;
    if (it.dataset.new) Tags.ensure(n);
    if (sel.has(n)) sel.delete(n); else sel.add(n);
    inp.value = '';
    fn(Array.from(sel));
    render();
  });
  inp.addEventListener('input', render);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      const q = inp.value.trim().replace(/^#/, '');
      if (!q) return;
      Tags.ensure(q);
      sel.add(q);
      inp.value = '';
      fn(Array.from(sel));
      render();
    }
  });
  render();
  Pop.open(anchor, el);
  setTimeout(() => inp.focus());
}
