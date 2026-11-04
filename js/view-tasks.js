'use strict';
/* 任务视图：侧栏（智能清单 / 清单 / 标签）+ 任务列表 + 详情 */

const SMART = [
  { key: 'today', name: '今天', icon: 'sun' },
  { key: 'tomorrow', name: '明天', icon: 'sunrise' },
  { key: 'week', name: '最近7天', icon: 'calDays' },
  { key: 'inbox', name: '收集箱', icon: 'inbox' },
  { key: 'all', name: '所有', icon: 'layers' },
];

/** 清单元信息：名称、过滤条件、新建任务的默认值 */
function listMeta(key) {
  const today = U.today();
  const tmr = U.addDays(today, 1);
  const wk = U.addDays(today, 6);
  const sm = SMART.find((x) => x.key === key);
  switch (key) {
    case 'today': return { name: '今天', filter: (t) => t.dueDate && t.dueDate <= today, defaults: { dueDate: today }, empty: '今天没有任务，享受美好的一天' };
    case 'tomorrow': return { name: '明天', filter: (t) => t.dueDate === tmr, defaults: { dueDate: tmr }, empty: '明天还没有安排' };
    case 'week': return { name: '最近7天', filter: (t) => t.dueDate && t.dueDate <= wk, defaults: { dueDate: today }, empty: '未来 7 天没有任务' };
    case 'inbox': return { name: '收集箱', filter: (t) => t.listId === 'inbox', defaults: { listId: 'inbox' }, empty: '收集箱是空的，把想到的事都先记在这里' };
    case 'all': return { name: '所有', filter: () => true, defaults: {}, empty: '还没有任务' };
    case 'done': return { name: '已完成', filter: (t) => t.status === 2 };
    case 'trash': return { name: '垃圾桶', filter: (t) => t.deleted };
  }
  if (key.startsWith('list:')) {
    const l = L.get(key.slice(5));
    if (l) return { name: l.name, list: l, filter: (t) => t.listId === l.id, defaults: { listId: l.id }, empty: '这个清单还没有任务' };
  }
  if (key.startsWith('tag:')) {
    const g = key.slice(4);
    return { name: '#' + g, tag: g, filter: (t) => t.tags.includes(g), defaults: { tags: [g] }, empty: '没有带这个标签的任务' };
  }
  return sm ? listMeta(sm.key) : listMeta('today');
}

function countOf(key) {
  const m = listMeta(key);
  let n = 0;
  for (const t of S.tasks) if (!t.deleted && t.status !== 2 && m.filter(t)) n++;
  return n;
}

/* ---------- 侧栏 ---------- */
const Sidebar = {
  render(el) {
    const cur = S.ui.list;
    const item = (key, name, lead, opts) => {
      opts = opts || {};
      const n = opts.noCount ? 0 : countOf(key);
      return '<div class="nav-item' + (cur === key ? ' active' : '') + '" data-act="nav" data-key="' + U.esc(key) + '" data-drop="' + U.esc(key) + '"' +
        (opts.menu ? ' data-menu="' + opts.menu + '"' : '') + '>' +
        '<span class="ni-ico">' + lead + '</span><span class="ni-name">' + U.esc(name) + '</span>' +
        (n ? '<span class="ni-cnt">' + n + '</span>' : '') +
        (opts.menu ? '<button class="ni-more" data-act="' + opts.menu + '" data-key="' + U.esc(key) + '" title="更多">' + ic('more', 16) + '</button>' : '') +
        '</div>';
    };
    const sec = (id, title, addAct) => {
      const col = S.ui.sbCollapsed[id];
      return '<div class="sb-sec' + (col ? ' col' : '') + '" data-act="sb-col" data-id="' + id + '">' + ic('chevD', 14) + '<span>' + title + '</span>' +
        (addAct ? '<button class="ni-add" data-act="' + addAct + '" title="新建">' + ic('plus', 16) + '</button>' : '') + '</div>';
    };
    let html = '<div class="sb-group">' + SMART.map((s) => item(s.key, s.name, ic(s.icon, 18))).join('') + '</div>';
    html += sec('lists', '清单', 'list-add');
    if (!S.ui.sbCollapsed.lists) {
      const ls = L.user();
      html += ls.length
        ? ls.map((l) => item('list:' + l.id, l.name, l.color ? '<span class="dot lg" style="background:' + l.color + '"></span>' : ic('list', 18), { menu: 'list-menu' })).join('')
        : '<div class="sb-empty">点击 + 新建清单</div>';
    }
    html += sec('tags', '标签', 'tag-add');
    if (!S.ui.sbCollapsed.tags) {
      const tg = Tags.all();
      html += tg.length
        ? tg.map((g) => item('tag:' + g.name, g.name, ic('hash', 17), { menu: 'tag-menu' })).join('')
        : '<div class="sb-empty">输入任务时用 #标签 即可创建</div>';
    }
    html += '<div class="sb-group sb-bottom">' +
      item('done', '已完成', ic('checkCircle', 18), { noCount: true }) +
      item('trash', '垃圾桶', ic('trash', 18), { noCount: true }) + '</div>';
    el.innerHTML = html;
  },
};

A.nav = (el, e) => {
  if (e.target.closest('.ni-more')) return;
  S.ui.list = el.dataset.key;
  S.ui.view = 'tasks';
  S.ui.sel = null;
  document.body.classList.remove('side-open');
  App.refresh();
};
A['sb-col'] = (el, e) => {
  if (e.target.closest('.ni-add')) return;
  S.ui.sbCollapsed[el.dataset.id] = !S.ui.sbCollapsed[el.dataset.id];
  App.refresh();
};
A['side-toggle'] = () => document.body.classList.toggle('side-open');

function listModal(l) {
  let color = l ? l.color : LIST_COLORS[1];
  Modal.open({
    title: l ? '编辑清单' : '新建清单', width: 400,
    body: '<div class="form"><input class="input wide" id="lm-name" maxlength="40" placeholder="清单名称" autofocus value="' + U.esc(l ? l.name : '') + '">' +
      '<div class="form-row"><span class="form-label">颜色</span><div class="color-row">' +
      LIST_COLORS.map((c) => '<button class="color-sw' + (c === color ? ' on' : '') + '" data-color="' + (c || '') + '" style="' + (c ? 'background:' + c : '') + '" title="' + (c ? '' : '无颜色') + '">' + (c ? '' : ic('x', 12)) + '</button>').join('') +
      '</div></div></div>',
    footer: '<button class="btn" data-m="x">取消</button><button class="btn btn-primary" data-ok>' + (l ? '保存' : '创建') + '</button>',
    onMount(box, m) {
      const inp = box.querySelector('#lm-name');
      const ok = () => {
        const name = inp.value.trim();
        if (!name) { inp.focus(); return; }
        if (l) { l.name = name; l.color = color; }
        else {
          const nl = L.add(name, color);
          S.ui.list = 'list:' + nl.id;
          S.ui.view = 'tasks';
        }
        m.close();
        App.refresh();
      };
      box.querySelector('[data-ok]').addEventListener('click', ok);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) ok(); });
      box.querySelector('.color-row').addEventListener('click', (e) => {
        const b = e.target.closest('.color-sw');
        if (!b) return;
        color = b.dataset.color || null;
        $$('.color-sw', box).forEach((x) => x.classList.toggle('on', x === b));
      });
    },
  });
}

async function deleteList(l) {
  const n = S.tasks.filter((t) => t.listId === l.id && !t.deleted).length;
  const ok = await Modal.confirm({ title: '删除清单「' + l.name + '」？', msg: n ? '清单中的 ' + n + ' 个任务会移到垃圾桶。' : '', ok: '删除', danger: true });
  if (!ok) return;
  L.remove(l.id);
  if (S.ui.list === 'list:' + l.id) S.ui.list = 'today';
  App.refresh();
}

A['list-add'] = () => listModal(null);
A['list-menu'] = (el) => {
  const l = L.get(el.dataset.key.slice(5));
  if (!l) return;
  Menu.open(el, [
    { label: '编辑', icon: 'pencil', fn: () => listModal(l) },
    { label: '删除', icon: 'trash', danger: true, fn: () => deleteList(l) },
  ], { align: 'right' });
};
A['tag-add'] = async () => {
  const n = await Modal.prompt({ title: '新建标签', placeholder: '标签名称' });
  if (!n) return;
  Tags.ensure(n.replace(/^#/, '').replace(/\s+/g, ''));
  App.refresh();
};
A['tag-menu'] = (el) => {
  const name = el.dataset.key.slice(4);
  Menu.open(el, [
    { label: '重命名', icon: 'pencil', fn: async () => {
      const n = await Modal.prompt({ title: '重命名标签', value: name });
      if (n) { Tags.rename(name, n.replace(/\s+/g, '')); App.refresh(); }
    } },
    { label: '删除', icon: 'trash', danger: true, fn: async () => {
      const ok = await Modal.confirm({ title: '删除标签「' + name + '」？', msg: '只会从任务上移除这个标签，任务本身不受影响。', ok: '删除', danger: true });
      if (ok) { Tags.remove(name); App.refresh(); }
    } },
  ], { align: 'right' });
};

/* ---------- 任务行 ---------- */
function taskRow(t, ctx) {
  ctx = ctx || {};
  const done = t.status === 2;
  const meta = [];
  if (t.items.length) {
    const dn = t.items.filter((i) => i.done).length;
    meta.push('<span class="tm">' + ic('listChecks', 13) + dn + '/' + t.items.length + '</span>');
  }
  if (t.content && t.content.trim()) meta.push('<span class="tm">' + ic('text', 13) + '</span>');
  if (t.pomos) meta.push('<span class="tm">' + ic('timer', 13) + t.pomos + '</span>');
  t.tags.forEach((g) => meta.push('<span class="tag-chip">' + U.esc(g) + '</span>'));
  if (ctx.showList) {
    const l = T.listOf(t);
    meta.push('<span class="tm tm-list">' + U.esc(l.name) + '</span>');
  }
  if (t.dueDate) {
    meta.push('<span class="tm tm-date ' + dateClass(t) + '">' +
      (t.repeat ? ic('repeat', 12) : '') + (t.reminder != null ? ic('bell', 12) : '') +
      (ctx.hideDate && !t.dueTime ? '' : (ctx.hideDate ? t.dueTime : U.friendly(t.dueDate) + (t.dueTime ? ' ' + t.dueTime : ''))) + '</span>');
  }
  return '<div class="task-row' + (S.ui.sel === t.id ? ' sel' : '') + (done ? ' done' : '') + (t.deleted ? ' deleted' : '') +
    '" data-act="sel" data-id="' + t.id + '" data-drag-id="' + t.id + '"' + (ctx.noDrop ? '' : ' data-drop="row:' + t.id + '"') + ' draggable="true">' +
    (t.deleted
      ? '<span class="cb dis pri-' + t.priority + (done ? ' on' : '') + '"></span>'
      : '<button class="cb pri-' + t.priority + (done ? ' on' : '') + '" data-act="toggle" data-id="' + t.id + '"></button>') +
    '<div class="tr-title">' + (t.title ? U.esc(t.title) : '<span class="muted">无标题</span>') + '</div>' +
    '<div class="tr-meta">' + meta.join('') + '</div>' +
    (ctx.trash
      ? '<div class="tr-acts"><button class="icon-btn sm" data-act="restore" data-id="' + t.id + '" title="恢复">' + ic('restore', 16) + '</button>' +
        '<button class="icon-btn sm" data-act="purge" data-id="' + t.id + '" title="彻底删除">' + ic('x', 16) + '</button></div>'
      : '') +
    '</div>';
}

function emptyState(icon, text) {
  return '<div class="empty">' + ic(icon, 40, 1.4) + '<div>' + U.esc(text) + '</div></div>';
}

const cmpDate = (a, b) =>
  (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
  (a.dueTime || '99').localeCompare(b.dueTime || '99') ||
  b.priority - a.priority || a.order - b.order;

function groupTasks(tasks, sort, key) {
  if (sort === 'priority') {
    return PRI_LIST.map((p) => ({ id: 'p' + p, name: PRI[p].name, patch: { priority: p }, tasks: tasks.filter((t) => t.priority === p).sort(cmpDate) }))
      .filter((g) => g.tasks.length);
  }
  if (sort === 'title') return [{ id: 'all', tasks: tasks.sort((a, b) => a.title.localeCompare(b.title, 'zh')) }];
  if (sort === 'custom') return [{ id: 'all', tasks: tasks.sort((a, b) => a.order - b.order) }];
  const today = U.today(), tmr = U.addDays(today, 1), wk = U.addDays(today, 6);
  const bs = [];
  const add = (id, name, patch, f) => bs.push({ id, name, patch, f, tasks: [] });
  add('overdue', '已过期', null, (t) => t.dueDate && t.dueDate < today);
  if (key === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(today, i);
      add('d' + i, U.dayLabel(d), { dueDate: d }, (t) => t.dueDate === d);
    }
  } else {
    add('today', '今天', { dueDate: today }, (t) => t.dueDate === today);
    add('tomorrow', '明天', { dueDate: tmr }, (t) => t.dueDate === tmr);
    add('next7', '最近7天', null, (t) => t.dueDate > tmr && t.dueDate <= wk);
    add('later', '更远', null, (t) => t.dueDate > wk);
  }
  add('nodate', '无日期', { dueDate: null }, (t) => !t.dueDate);
  tasks.forEach((t) => { const b = bs.find((x) => x.f(t)); if (b) b.tasks.push(t); });
  bs.forEach((b) => b.tasks.sort(cmpDate));
  return bs.filter((b) => b.tasks.length);
}

function completedFor(key, meta) {
  const today = U.today();
  let arr = S.tasks.filter((t) => !t.deleted && t.status === 2);
  const doneDay = (t) => U.ymd(new Date(t.completedAt || 0));
  if (key === 'today') arr = arr.filter((t) => doneDay(t) === today || t.dueDate === today);
  else if (key === 'tomorrow') arr = arr.filter((t) => t.dueDate === U.addDays(today, 1));
  else if (key === 'week') arr = arr.filter((t) => doneDay(t) === today || (t.dueDate >= today && t.dueDate <= U.addDays(today, 6)));
  else arr = arr.filter(meta.filter);
  return arr.sort((a, b) => b.completedAt - a.completedAt).slice(0, 100);
}

function sectionHTML(key, g, ctx) {
  const ck = key + '|' + g.id;
  const col = S.ui.collapsed[ck];
  const rows = col ? '' : g.tasks.map((t) => taskRow(t, ctx)).join('');
  if (!g.name) return '<div class="sec" data-sec="' + g.id + '"><div class="sec-b">' + rows + '</div></div>';
  return '<div class="sec' + (col ? ' col' : '') + '" data-sec="' + g.id + '"' + (g.patch ? ' data-patch="' + U.esc(JSON.stringify(g.patch)) + '"' : '') + '>' +
    '<div class="sec-h" data-act="sec-toggle" data-k="' + U.esc(ck) + '"' + (g.patch ? ' data-drop="sec"' : '') + '>' + ic('chevD', 14) +
    '<span>' + U.esc(g.name) + '</span><span class="cnt">' + g.tasks.length + '</span></div>' +
    '<div class="sec-b">' + rows + '</div></div>';
}

/* ---------- 列表面板 ---------- */
const QA = { ignore: {}, preset: {} };

const ListPane = {
  render(el) {
    const key = S.ui.list;
    const meta = listMeta(key);
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      QA.ignore = {};
      QA.preset = {};
      const canAdd = key !== 'done' && key !== 'trash';
      el.innerHTML = '<div class="lp-head"></div>' +
        (canAdd ? '<div class="qa-wrap"><div class="qa">' + ic('plus', 18) +
          '<input class="qa-in" placeholder="" autocomplete="off">' +
          '<button class="icon-btn sm qa-date" data-act="qa-date" title="设置日期">' + ic('calendar', 17) + '</button>' +
          '<button class="icon-btn sm qa-pri" data-act="qa-pri" title="优先级">' + ic('flag', 17) + '</button>' +
          '</div><div class="qa-chips"></div></div>' : '') +
        '<div class="lp-body"></div>';
      if (canAdd) ListPane.bindQA(el);
    }
    const sort = S.ui.sort[key] || 'date';
    el.querySelector('.lp-head').innerHTML =
      '<button class="icon-btn only-mobile" data-act="side-toggle">' + ic('menu', 20) + '</button>' +
      '<h1>' + U.esc(meta.name) + '</h1>' +
      '<div class="sp"></div>' +
      (key === 'trash'
        ? '<button class="btn btn-sm" data-act="trash-empty">清空垃圾桶</button>'
        : key === 'done' ? '' : '<button class="icon-btn" data-act="sort-menu" title="排序：' + ({ date: '按时间', priority: '按优先级', title: '按标题', custom: '自定义' })[sort] + '">' + ic('sort', 18) + '</button>') +
      '<button class="icon-btn" data-act="lp-more" title="更多">' + ic('more', 18) + '</button>';
    const qi = el.querySelector('.qa-in');
    if (qi) {
      const target = meta.list ? meta.list.name : key === 'inbox' || !meta.defaults || !meta.defaults.listId ? '收集箱' : meta.name;
      qi.placeholder = '添加任务至「' + target + '」，回车即可保存';
      qi.title = '支持智能识别，例如：明天下午3点 开会 #标签 !高 ~清单名';
      ListPane.paintChips(el);
    }
    el.querySelector('.lp-body').innerHTML = ListPane.body(key, meta);
  },

  body(key, meta) {
    if (key === 'trash') {
      const arr = S.tasks.filter((t) => t.deleted).sort((a, b) => b.deletedAt - a.deletedAt);
      if (!arr.length) return emptyState('trash', '垃圾桶是空的');
      return '<div class="sec"><div class="sec-b">' + arr.map((t) => taskRow(t, { trash: true, showList: true, noDrop: true })).join('') + '</div></div>';
    }
    if (key === 'done') {
      const arr = S.tasks.filter((t) => !t.deleted && t.status === 2).sort((a, b) => b.completedAt - a.completedAt);
      if (!arr.length) return emptyState('checkCircle', '还没有完成的任务');
      const groups = [];
      arr.forEach((t) => {
        const d = U.ymd(new Date(t.completedAt || 0));
        let g = groups[groups.length - 1];
        if (!g || g.id !== d) groups.push(g = { id: d, name: U.diff(d, U.today()) === 0 ? '今天' : U.diff(d, U.today()) === -1 ? '昨天' : U.dayLabel(d), tasks: [] });
        g.tasks.push(t);
      });
      return groups.map((g) => sectionHTML(key, g, { showList: true, noDrop: true })).join('');
    }
    const tasks = S.tasks.filter((t) => !t.deleted && t.status !== 2 && meta.filter(t));
    const sort = S.ui.sort[key] || 'date';
    const groups = groupTasks(tasks, sort, key);
    const ctx = { showList: !meta.list && key !== 'inbox', hideDate: false };
    let html = groups.map((g) => sectionHTML(key, g, ctx)).join('');
    const done = S.settings.showCompleted ? completedFor(key, meta) : [];
    if (done.length) {
      const ck = key + '|__done';
      if (S.ui.collapsed[ck] === undefined) S.ui.collapsed[ck] = true;
      html += sectionHTML(key, { id: '__done', name: '已完成', tasks: done }, Object.assign({ noDrop: true }, ctx));
    }
    if (!tasks.length && !done.length) html = emptyState(key === 'today' ? 'sun' : 'checkSquare', meta.empty || '没有任务');
    else if (!tasks.length) html = '<div class="all-done">' + ic('checkCircle', 18) + '全部完成了，真棒！</div>' + html;
    return html;
  },

  paintChips(el) {
    const inp = el.querySelector('.qa-in');
    const box = el.querySelector('.qa-chips');
    if (!inp || !box) return;
    const v = inp.value.trim();
    const chips = [];
    if (QA.preset.dueDate) chips.push('<span class="qa-chip preset" data-act="qa-unpreset" data-k="dueDate">' + ic('calendar', 12) + U.friendly(QA.preset.dueDate) + (QA.preset.dueTime ? ' ' + QA.preset.dueTime : '') + ic('x', 11, 2.2) + '</span>');
    if (QA.preset.priority) chips.push('<span class="qa-chip preset pc-' + QA.preset.priority + '" data-act="qa-unpreset" data-k="priority">' + ic('flagFill', 12) + PRI[QA.preset.priority].name + ic('x', 11, 2.2) + '</span>');
    if (v) {
      const p = parseQuick(v, QA.ignore);
      p.tokens.forEach((tk) => {
        chips.push('<span class="qa-chip" data-act="qa-ignore" data-t="' + tk.type + '" title="点击取消识别">' + U.esc(tk.label) + '</span>');
      });
      Object.keys(QA.ignore).forEach((k) => {
        if (QA.ignore[k] && k !== 'time') chips.push('<span class="qa-chip off" data-act="qa-unignore" data-t="' + k + '" title="点击恢复识别">' + ({ date: '日期', tag: '标签', list: '清单', pri: '优先级', repeat: '重复' })[k] + '识别已关闭</span>');
      });
    }
    box.innerHTML = chips.join('');
    box.classList.toggle('show', chips.length > 0);
  },

  bindQA(el) {
    const inp = el.querySelector('.qa-in');
    inp.addEventListener('input', () => {
      if (!inp.value.trim()) QA.ignore = {};
      ListPane.paintChips(el);
    });
    inp.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { inp.value = ''; QA.ignore = {}; ListPane.paintChips(el); inp.blur(); return; }
      if (e.key !== 'Enter') return;
      const v = inp.value.trim();
      if (!v) return;
      const meta = listMeta(S.ui.list);
      const p = parseQuick(v, QA.ignore);
      const d = Object.assign({}, meta.defaults || {});
      const data = {
        title: p.title,
        listId: p.listId || d.listId || 'inbox',
        priority: p.priority != null ? p.priority : (QA.preset.priority || 0),
        dueDate: p.dueDate || QA.preset.dueDate || d.dueDate || null,
        dueTime: p.dueTime || (p.dueDate ? null : QA.preset.dueTime) || null,
        repeat: p.repeat || (p.dueDate ? null : QA.preset.repeat) || null,
        tags: Array.from(new Set([].concat(d.tags || [], p.tags))),
      };
      if (data.dueTime) data.reminder = 0;
      if (QA.preset.reminder != null && !p.dueDate) data.reminder = QA.preset.reminder;
      const t = T.add(data);
      inp.value = '';
      QA.ignore = {};
      App.refresh();
      ListPane.paintChips(el);
      requestAnimationFrame(() => {
        const row = document.querySelector('.task-row[data-id="' + t.id + '"]');
        if (row) { row.classList.add('flash'); row.scrollIntoView({ block: 'nearest' }); }
        else if (!meta.filter(t)) toast('已添加到「' + T.listOf(t).name + '」' + (t.dueDate ? ' · ' + U.friendly(t.dueDate) : ''));
      });
    });
  },
};

A['qa-ignore'] = (el) => {
  const t = el.dataset.t;
  QA.ignore[t] = true;
  if (t === 'date' || t === 'time') { QA.ignore.date = true; QA.ignore.time = true; }
  ListPane.paintChips($('.list-pane'));
  $('.qa-in').focus();
};
A['qa-unignore'] = (el) => {
  const t = el.dataset.t;
  delete QA.ignore[t];
  if (t === 'date') delete QA.ignore.time;
  ListPane.paintChips($('.list-pane'));
  $('.qa-in').focus();
};
A['qa-unpreset'] = (el) => {
  if (el.dataset.k === 'dueDate') { delete QA.preset.dueDate; delete QA.preset.dueTime; delete QA.preset.repeat; delete QA.preset.reminder; }
  else delete QA.preset.priority;
  ListPane.paintChips($('.list-pane'));
};
A['qa-date'] = (el) => {
  DatePicker.open(el, QA.preset, (p) => {
    Object.assign(QA.preset, p);
    ListPane.paintChips($('.list-pane'));
    $('.qa-in').focus();
  });
};
A['qa-pri'] = (el) => {
  priorityMenu(el, QA.preset.priority || 0, (p) => {
    QA.preset.priority = p || undefined;
    ListPane.paintChips($('.list-pane'));
    $('.qa-in').focus();
  });
};
A['sec-toggle'] = (el) => {
  const k = el.dataset.k;
  S.ui.collapsed[k] = !S.ui.collapsed[k];
  App.refresh();
};
A['sort-menu'] = (el) => {
  const key = S.ui.list;
  const cur = S.ui.sort[key] || 'date';
  const set = (v) => () => { S.ui.sort[key] = v; App.refresh(); };
  Menu.open(el, [
    { header: '排序方式' },
    { label: '按时间', icon: 'clock', checked: cur === 'date', fn: set('date') },
    { label: '按优先级', icon: 'flag', checked: cur === 'priority', fn: set('priority') },
    { label: '按标题', icon: 'text', checked: cur === 'title', fn: set('title') },
    { label: '自定义（可拖动排序）', icon: 'sort', checked: cur === 'custom', fn: set('custom') },
  ], { align: 'right' });
};
A['lp-more'] = (el) => {
  const key = S.ui.list;
  const meta = listMeta(key);
  const items = [];
  if (key !== 'trash' && key !== 'done') {
    items.push({ label: S.settings.showCompleted ? '隐藏已完成' : '显示已完成', icon: S.settings.showCompleted ? 'eyeOff' : 'eye', fn: () => { S.settings.showCompleted = !S.settings.showCompleted; App.refresh(); } });
  }
  if (meta.list) {
    items.push({ sep: true });
    items.push({ label: '编辑清单', icon: 'pencil', fn: () => listModal(meta.list) });
    items.push({ label: '删除清单', icon: 'trash', danger: true, fn: () => deleteList(meta.list) });
  }
  if (key === 'done') {
    items.push({ label: '清除所有已完成任务', icon: 'trash', danger: true, fn: async () => {
      const ok = await Modal.confirm({ title: '把所有已完成任务移到垃圾桶？', ok: '移到垃圾桶', danger: true });
      if (!ok) return;
      S.tasks.forEach((t) => { if (!t.deleted && t.status === 2) { t.deleted = true; t.deletedAt = Date.now(); } });
      App.refresh();
    } });
  }
  items.push({ sep: true });
  items.push({ label: '打印 / 导出为 PDF', icon: 'download', fn: () => window.print() });
  if (items[0].sep) items.shift();
  Menu.open(el, items, { align: 'right' });
};
A['trash-empty'] = async () => {
  const n = S.tasks.filter((t) => t.deleted).length;
  if (!n) return toast('垃圾桶已经是空的');
  const ok = await Modal.confirm({ title: '清空垃圾桶？', msg: n + ' 个任务将被彻底删除，无法恢复。', ok: '清空', danger: true });
  if (!ok) return;
  S.tasks = S.tasks.filter((t) => !t.deleted);
  S.ui.sel = null;
  App.refresh();
};

const TasksView = {
  render(root) {
    if (!root.querySelector('.list-pane')) {
      root.innerHTML = '<aside class="sidebar"></aside><section class="pane list-pane"></section><aside class="pane detail hidden"></aside><div class="side-mask" data-act="side-toggle"></div>';
    }
    Sidebar.render(root.querySelector('.sidebar'));
    ListPane.render(root.querySelector('.list-pane'));
    Detail.render(root.querySelector('.detail'));
  },
};
