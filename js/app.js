'use strict';
/* 应用外壳：导航、渲染调度、全局事件、拖放、搜索、设置、提醒 */

const VIEWS = {
  tasks: { name: '任务', icon: 'checkSquare', view: () => TasksView },
  calendar: { name: '日历', icon: 'calendar', view: () => CalView },
  matrix: { name: '四象限', icon: 'grid', view: () => MatrixView },
  pomo: { name: '番茄专注', icon: 'timer', view: () => PomoView },
  habits: { name: '习惯打卡', icon: 'target', view: () => HabitsView },
};

const App = {
  _raf: 0,
  dragId: null,

  init() {
    Store.load();
    App.applyTheme();
    App.bind();
    App.render();
    setInterval(() => Pomo.tick(), 500);
    setInterval(App.checkReminders, 15000);
    setTimeout(App.checkReminders, 1500);
    // 跨天时刷新“今天”
    let day = U.today();
    setInterval(() => { if (U.today() !== day) { day = U.today(); App.refresh(); } }, 60000);
    window.addEventListener('beforeunload', Store.flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flush(); });
    window.addEventListener('storage', (e) => {
      if (e.key === DB_KEY && e.newValue) {
        try { S = JSON.parse(e.newValue); Store.normalize(); App.render(); } catch (err) { /* 忽略 */ }
      }
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', App.applyTheme);
  },

  refresh() {
    Store.save();
    if (App._raf) return;
    App._raf = requestAnimationFrame(() => { App._raf = 0; App.render(); });
  },

  render() {
    App.renderRail();
    const v = VIEWS[S.ui.view] ? S.ui.view : 'tasks';
    const root = $('#view');
    if (root.dataset.view !== v) {
      root.innerHTML = '';
      root.dataset.view = v;
      root.className = 'view view-' + v;
      document.body.classList.remove('detail-open', 'side-open');
    }
    VIEWS[v].view().render(root);
  },

  go(view) {
    Pop.close();
    S.ui.view = view;
    App.refresh();
  },

  renderRail() {
    const v = S.ui.view;
    const counting = Pomo.counting();
    $('#rail').innerHTML =
      '<div class="logo-mark" title="我的滴答清单">' + ic('check', 18, 2.6) + '</div>' +
      Object.keys(VIEWS).map((k) =>
        '<button class="rail-btn' + (v === k ? ' active' : '') + (k === 'pomo' && counting ? ' live' : '') + '" data-act="go" data-view="' + k + '" title="' + VIEWS[k].name + '">' +
        ic(VIEWS[k].icon, 21) + (k === 'pomo' ? '<span class="rb-time">' + (counting ? Pomo.timeText() : '') + '</span>' : '') +
        '<span class="rb-label">' + VIEWS[k].name.replace('番茄专注', '番茄').replace('习惯打卡', '习惯') + '</span></button>').join('') +
      '<button class="rail-btn" data-act="search" title="搜索 (Ctrl+K)">' + ic('search', 21) + '<span class="rb-label">搜索</span></button>' +
      '<div class="rail-sp"></div>' +
      '<button class="rail-btn hide-mobile" data-act="theme" title="切换深色 / 浅色">' + ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 20) + '</button>' +
      '<button class="rail-btn" data-act="settings" title="设置">' + ic('settings', 20) + '<span class="rb-label">设置</span></button>';
  },

  applyTheme() {
    let th = S.settings.theme;
    if (th === 'auto') th = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = th;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = th === 'dark' ? '#000000' : '#f5f5f7';
  },

  /* ---------- 全局事件 ---------- */
  bind() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = A[el.dataset.act];
      if (fn) fn(el, e);
    });

    document.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('[data-drag-id], .wk-ev.ghost, .cal-chip.ghost');
      if (row && !e.target.closest('input, textarea')) {
        e.preventDefault();
        taskContextMenu(row.dataset.id || row.dataset.dragId, e.clientX, e.clientY);
        return;
      }
      const nav = e.target.closest('.nav-item[data-menu]');
      if (nav) {
        e.preventDefault();
        const b = nav.querySelector('.ni-more');
        A[nav.dataset.menu](b);
      }
    });

    // 拖放
    document.addEventListener('dragstart', (e) => {
      const r = e.target.closest && e.target.closest('[data-drag-id]');
      if (!r) return;
      App.dragId = r.dataset.dragId;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', App.dragId);
      setTimeout(() => r.classList.add('dragging'));
      Pop.close();
    });
    document.addEventListener('dragover', (e) => {
      if (!App.dragId) return;
      const z = e.target.closest('[data-drop]');
      App.clearDrop();
      if (!z) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (z.dataset.drop.startsWith('row:')) {
        if (z.dataset.drop === 'row:' + App.dragId) return;
        const r = z.getBoundingClientRect();
        z.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
      } else z.classList.add('drop-hover');
    });
    document.addEventListener('drop', (e) => {
      if (!App.dragId) return;
      const z = e.target.closest('[data-drop]');
      if (!z) return;
      e.preventDefault();
      const id = App.dragId;
      const before = z.classList.contains('drop-before');
      App.clearDrop();
      App.handleDrop(id, z, e, before);
    });
    document.addEventListener('dragend', () => {
      App.dragId = null;
      App.clearDrop();
      $$('.dragging').forEach((x) => x.classList.remove('dragging'));
    });

    // 键盘
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (Pop.cur) { Pop.close(); return; }
        if (Modal.top()) { Modal.close(); return; }
        if (isTyping()) { document.activeElement.blur(); return; }
        if (document.body.classList.contains('side-open')) { document.body.classList.remove('side-open'); return; }
        if (S.ui.sel) { S.ui.sel = null; App.refresh(); return; }
        if (S.ui.habitSel) { S.ui.habitSel = null; App.refresh(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); A.search(); return; }
      if (isTyping() || Modal.top() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); A.search(); }
      else if (e.key === 'n' || e.key === 'N') {
        if (S.ui.view !== 'tasks') { S.ui.view = 'tasks'; App.render(); }
        const q = $('.qa-in');
        if (q) { e.preventDefault(); q.focus(); }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.ui.sel) {
        const t = T.get(S.ui.sel);
        if (t && !t.deleted) { e.preventDefault(); deleteTask(t.id); }
      } else if (e.key >= '1' && e.key <= '5' && !e.shiftKey) {
        const k = Object.keys(VIEWS)[+e.key - 1];
        if (k) App.go(k);
      }
    });

    window.addEventListener('resize', () => Pop.close());
  },

  clearDrop() {
    $$('.drop-hover, .drop-before, .drop-after').forEach((x) => x.classList.remove('drop-hover', 'drop-before', 'drop-after'));
  },

  handleDrop(id, z, e, before) {
    const t = T.get(id);
    if (!t) return;
    const d = z.dataset.drop;
    const today = U.today();
    let msg = '';
    if (d.startsWith('list:')) {
      const l = L.get(d.slice(5));
      if (l) { T.update(id, { listId: l.id, deleted: false }); msg = '已移到「' + l.name + '」'; }
    } else if (d.startsWith('tag:')) {
      const g = d.slice(4);
      if (!t.tags.includes(g)) { T.update(id, { tags: t.tags.concat(g) }); msg = '已添加标签 #' + g; }
    } else if (d === 'inbox') { T.update(id, { listId: 'inbox' }); msg = '已移到收集箱'; }
    else if (d === 'today') { T.update(id, { dueDate: today }); msg = '已改到今天'; }
    else if (d === 'tomorrow') { T.update(id, { dueDate: U.addDays(today, 1) }); msg = '已改到明天'; }
    else if (d === 'week') { if (!t.dueDate || t.dueDate > U.addDays(today, 6)) T.update(id, { dueDate: today }); }
    else if (d === 'done') { if (t.status !== 2) return completeTask(id, true); }
    else if (d === 'trash') return deleteTask(id);
    else if (d.startsWith('date:')) T.update(id, { dueDate: d.slice(5), deleted: false });
    else if (d.startsWith('slot:')) {
      const y = e.clientY - z.getBoundingClientRect().top;
      const min = Math.max(0, Math.min(23 * 60 + 30, Math.floor(y / HOUR_H * 2) * 30));
      T.update(id, { dueDate: d.slice(5), dueTime: U.pad(Math.floor(min / 60)) + ':' + U.pad(min % 60), reminder: t.reminder == null ? 0 : t.reminder });
    } else if (d.startsWith('pri:')) T.update(id, { priority: +d.slice(4) });
    else if (d === 'sec' || d.startsWith('row:')) {
      const sec = z.closest('.sec');
      const patch = sec && sec.dataset.patch ? JSON.parse(sec.dataset.patch) : null;
      const differs = patch && Object.keys(patch).some((k) => t[k] !== patch[k]);
      if (differs) {
        if ('dueDate' in patch && patch.dueDate === null) Object.assign(patch, { dueTime: null, reminder: null, repeat: null });
        T.update(id, patch);
      } else if (d.startsWith('row:')) {
        const key = S.ui.list;
        if ((S.ui.sort[key] || 'date') !== 'custom') {
          toast('切换到「自定义」排序后，可以拖动调整顺序', null, { label: '切换', fn: () => { S.ui.sort[key] = 'custom'; App.refresh(); } });
          return;
        }
        const ids = $$('.task-row', sec).map((r) => r.dataset.id).filter((x) => x !== id);
        const target = d.slice(4);
        let idx = ids.indexOf(target);
        if (idx < 0) return;
        if (!before) idx++;
        ids.splice(idx, 0, id);
        ids.forEach((x, i) => { const tt = T.get(x); if (tt) tt.order = i; });
      }
    }
    if (msg) toast(msg);
    App.refresh();
  },

  /* ---------- 提醒 ---------- */
  checkReminders() {
    const now = Date.now();
    let changed = false;
    for (const t of S.tasks) {
      if (t.deleted || t.status === 2 || !t.dueDate || t.reminder == null) continue;
      const [y, m, d] = t.dueDate.split('-').map(Number);
      const [hh, mm] = (t.dueTime || '09:00').split(':').map(Number);
      const fire = new Date(y, m - 1, d, hh, mm).getTime() - t.reminder * 60000;
      const key = t.dueDate + ' ' + (t.dueTime || '') + ' ' + t.reminder;
      if (now >= fire && t.remindedKey !== key) {
        t.remindedKey = key;
        changed = true;
        if (now - fire > 6 * 3600 * 1000) continue; // 太久之前的提醒不再弹出
        const when = (t.dueTime ? t.dueTime : U.friendly(t.dueDate));
        sysNotify('任务提醒：' + (t.title || '无标题'), when + (t.reminder ? '（' + REMIND_NAMES[t.reminder] + '）' : ''), () => { S.ui.view = 'tasks'; S.ui.sel = t.id; App.refresh(); });
        toast('提醒：' + shortTitle(t.title) + ' · ' + when, null, { label: '查看', fn: () => { S.ui.view = 'tasks'; S.ui.sel = t.id; App.refresh(); } });
      }
    }
    if (changed) Store.save();
  },
};

/* ---------- 导航 ---------- */
A.go = (el) => App.go(el.dataset.view);
A.theme = () => {
  const cur = document.documentElement.dataset.theme;
  S.settings.theme = cur === 'dark' ? 'light' : 'dark';
  App.applyTheme();
  App.refresh();
};

/* ---------- 搜索 ---------- */
A.search = () => {
  if (Modal.top()) return;
  let idx = 0;
  let results = [];
  Modal.open({
    width: 600,
    body: '<div class="search"><div class="search-in">' + ic('search', 18) + '<input placeholder="搜索任务、子任务、描述、清单、标签" autofocus><kbd>Esc</kbd></div><div class="search-res"></div></div>',
    onMount(box, m) {
      m.box.classList.add('search-modal');
      const inp = box.querySelector('input'), res = box.querySelector('.search-res');
      const hl = (s, q) => {
        const e = U.esc(s);
        if (!q) return e;
        const i = s.toLowerCase().indexOf(q);
        if (i < 0) return e;
        return U.esc(s.slice(0, i)) + '<mark>' + U.esc(s.slice(i, i + q.length)) + '</mark>' + U.esc(s.slice(i + q.length));
      };
      const render = () => {
        const q = inp.value.trim().toLowerCase();
        results = [];
        if (!q) {
          res.innerHTML = '<div class="search-tip">' +
            '<p><kbd>Ctrl</kbd> <kbd>K</kbd> 或 <kbd>/</kbd> 打开搜索</p><p><kbd>N</kbd> 新建任务　<kbd>1</kbd>–<kbd>5</kbd> 切换模块</p>' +
            '<p><kbd>Delete</kbd> 删除选中任务　<kbd>Esc</kbd> 关闭面板</p></div>';
          return;
        }
        S.lists.forEach((l) => { if (l.name.toLowerCase().includes(q)) results.push({ kind: 'nav', key: l.id === 'inbox' ? 'inbox' : 'list:' + l.id, html: listDot(l) + '<span class="sr-t">' + hl(l.name, q) + '</span><span class="sr-k">清单</span>' }); });
        Tags.all().forEach((g) => { if (g.name.toLowerCase().includes(q)) results.push({ kind: 'nav', key: 'tag:' + g.name, html: ic('hash', 15) + '<span class="sr-t">' + hl(g.name, q) + '</span><span class="sr-k">标签</span>' }); });
        S.tasks.filter((t) => !t.deleted).forEach((t) => {
          const inT = t.title.toLowerCase().includes(q);
          const sub = t.items.find((i) => i.title.toLowerCase().includes(q));
          const inC = t.content.toLowerCase().includes(q);
          if (!inT && !sub && !inC) return;
          let extra = '';
          if (!inT && sub) extra = '子任务：' + hl(sub.title, q);
          else if (!inT && inC) {
            const i = t.content.toLowerCase().indexOf(q);
            const s = t.content.slice(Math.max(0, i - 12), i + 40).replace(/\n/g, ' ');
            extra = hl(s, q);
          }
          results.push({
            kind: 'task', id: t.id, done: t.status === 2,
            html: '<span class="cb sm pri-' + t.priority + (t.status === 2 ? ' on' : '') + '"></span><span class="sr-t' + (t.status === 2 ? ' done' : '') + '">' + hl(t.title || '无标题', q) +
              (extra ? '<small>' + extra + '</small>' : '') + '</span><span class="sr-k">' + U.esc(T.listOf(t).name) + (t.dueDate ? ' · ' + U.friendly(t.dueDate) : '') + '</span>',
          });
        });
        results.sort((a, b) => (a.kind === 'nav' ? 0 : 1) - (b.kind === 'nav' ? 0 : 1) || (a.done ? 1 : 0) - (b.done ? 1 : 0));
        results = results.slice(0, 60);
        idx = Math.min(idx, Math.max(0, results.length - 1));
        res.innerHTML = results.length
          ? results.map((r, i) => '<div class="sr' + (i === idx ? ' on' : '') + '" data-i="' + i + '">' + r.html + '</div>').join('')
          : '<div class="empty sm">' + ic('search', 32, 1.4) + '<div>没有找到相关内容</div></div>';
      };
      const open = (r) => {
        if (!r) return;
        m.close();
        if (r.kind === 'nav') { S.ui.view = 'tasks'; S.ui.list = r.key; S.ui.sel = null; }
        else {
          const t = T.get(r.id);
          S.ui.view = 'tasks';
          if (!listMeta(S.ui.list).filter(t) || t.status === 2) S.ui.list = t.status === 2 ? 'done' : (t.listId === 'inbox' ? 'inbox' : 'list:' + t.listId);
          S.ui.sel = r.id;
        }
        App.refresh();
        requestAnimationFrame(() => {
          const row = $('.task-row[data-id="' + r.id + '"]');
          if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('flash'); }
        });
      };
      inp.addEventListener('input', () => { idx = 0; render(); });
      inp.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!results.length) return;
          idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
          render();
          const on = res.querySelector('.sr.on');
          if (on) on.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') open(results[idx]);
      });
      res.addEventListener('click', (e) => {
        const r = e.target.closest('.sr');
        if (r) open(results[+r.dataset.i]);
      });
      render();
    },
  });
};

/* ---------- 设置 ---------- */
A.settings = () => {
  const st = S.settings;
  const seg = (name, val, opts) => '<div class="seg" data-set="' + name + '">' + opts.map(([v, l]) =>
    '<button data-v="' + v + '" class="' + (String(val) === String(v) ? 'active' : '') + '">' + l + '</button>').join('') + '</div>';
  const num = (name, val, min, max) => '<input class="input num" type="number" data-num="' + name + '" min="' + min + '" max="' + max + '" value="' + val + '">';
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const permText = { granted: '已允许', denied: '已被浏览器阻止', default: '尚未授权', unsupported: '当前浏览器不支持' }[perm];
  Modal.open({
    title: '设置', width: 520,
    body: '<div class="settings">' +
      '<div class="set-sec">外观</div>' +
      '<div class="set-row"><span>主题</span>' + seg('theme', st.theme, [['light', '浅色'], ['dark', '深色'], ['auto', '跟随系统']]) + '</div>' +
      '<div class="set-row"><span>每周开始于</span>' + seg('weekStart', st.weekStart, [[1, '周一'], [0, '周日']]) + '</div>' +
      '<div class="set-row"><span>列表中显示已完成任务</span>' + seg('showCompleted', st.showCompleted, [[true, '显示'], [false, '隐藏']]) + '</div>' +
      '<div class="set-sec">番茄专注</div>' +
      '<div class="set-row"><span>专注时长</span><span>' + num('pomoLen', st.pomoLen, 1, 180) + ' 分钟</span></div>' +
      '<div class="set-row"><span>短休息</span><span>' + num('shortBreak', st.shortBreak, 1, 60) + ' 分钟</span></div>' +
      '<div class="set-row"><span>长休息</span><span>' + num('longBreak', st.longBreak, 1, 90) + ' 分钟</span></div>' +
      '<div class="set-row"><span>长休息间隔</span><span>每 ' + num('longEvery', st.longEvery, 2, 12) + ' 个番茄</span></div>' +
      '<div class="set-row"><span>番茄结束后自动开始休息</span>' + seg('autoBreak', st.autoBreak, [[true, '开'], [false, '关']]) + '</div>' +
      '<div class="set-sec">提醒</div>' +
      '<div class="set-row"><span>提示音</span>' + seg('sound', st.sound, [[true, '开'], [false, '关']]) + '</div>' +
      '<div class="set-row"><span>系统通知 <small class="muted">' + permText + '</small></span>' +
      (perm === 'default' ? '<button class="btn btn-sm" data-s="perm">允许通知</button>' : '<button class="btn btn-sm" data-s="test">测试提醒</button>') + '</div>' +
      '<div class="set-sec">数据</div>' +
      '<div class="set-row"><span>数据只保存在这台电脑的浏览器里，建议定期导出备份</span></div>' +
      '<div class="set-btns"><button class="btn btn-sm" data-s="export">' + ic('download', 15) + '导出备份</button>' +
      '<button class="btn btn-sm" data-s="import">' + ic('upload', 15) + '导入备份</button>' +
      '<button class="btn btn-sm btn-danger" data-s="reset">清空所有数据</button></div>' +
      '<div class="set-about muted">我的滴答清单 · 网页版 · 共 ' + S.tasks.filter((t) => !t.deleted).length + ' 个任务、' + S.lists.length + ' 个清单、' + S.habits.length + ' 个习惯</div>' +
      '</div>',
    onMount(box, m) {
      box.addEventListener('click', async (e) => {
        const sb = e.target.closest('[data-set] button');
        if (sb) {
          const name = sb.parentElement.dataset.set;
          let v = sb.dataset.v;
          if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
          st[name] = v;
          $$('button', sb.parentElement).forEach((x) => x.classList.toggle('active', x === sb));
          if (name === 'theme') App.applyTheme();
          App.refresh();
          return;
        }
        const b = e.target.closest('[data-s]');
        if (!b) return;
        const a = b.dataset.s;
        if (a === 'perm') { if ('Notification' in window) Notification.requestPermission().then(() => { m.close(); A.settings(); }); }
        else if (a === 'test') sysNotify('测试提醒', '提醒功能工作正常');
        else if (a === 'export') {
          Store.flush();
          const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = '我的滴答清单备份-' + U.today() + '.json';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else if (a === 'import') {
          const f = document.createElement('input');
          f.type = 'file';
          f.accept = '.json,application/json';
          f.onchange = async () => {
            const file = f.files[0];
            if (!file) return;
            try {
              const d = JSON.parse(await file.text());
              if (!d || !Array.isArray(d.tasks)) throw new Error('格式不正确');
              const ok = await Modal.confirm({ title: '导入备份？', msg: '导入会覆盖当前全部数据（' + d.tasks.length + ' 个任务）。', ok: '覆盖导入', danger: true, icon: 'upload' });
              if (!ok) return;
              S = d;
              Store.normalize();
              Store.flush();
              m.close();
              App.applyTheme();
              $('#view').dataset.view = '';
              App.render();
              toast('导入成功', 'success');
            } catch (err) {
              toast('导入失败：' + err.message, 'error');
            }
          };
          f.click();
        } else if (a === 'reset') {
          const ok = await Modal.confirm({ title: '清空所有数据？', msg: '所有任务、清单、习惯和专注记录都会被删除，并恢复示例数据。建议先导出备份。', ok: '全部清空', danger: true });
          if (!ok) return;
          S = seedData();
          Store.normalize();
          Store.flush();
          m.close();
          $('#view').dataset.view = '';
          App.applyTheme();
          App.render();
        }
      });
      box.addEventListener('change', (e) => {
        const n = e.target.dataset.num;
        if (!n) return;
        const v = Math.max(+e.target.min, Math.min(+e.target.max, parseInt(e.target.value, 10) || +e.target.min));
        e.target.value = v;
        st[n] = v;
        App.refresh();
      });
    },
  });
};

App.init();
