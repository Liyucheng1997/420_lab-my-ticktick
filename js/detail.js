'use strict';
/* 任务详情面板 + 任务通用操作（完成、删除、右键菜单） */

function shortTitle(s) {
  s = s || '无标题';
  return s.length > 14 ? s.slice(0, 14) + '…' : s;
}

function dateClass(t) {
  if (!t.dueDate || t.status === 2) return '';
  const today = U.today();
  if (t.dueDate < today) return 'overdue';
  if (t.dueDate === today) {
    if (t.dueTime) {
      const now = new Date();
      if (t.dueTime < U.pad(now.getHours()) + ':' + U.pad(now.getMinutes())) return 'overdue';
    }
    return 'today';
  }
  return '';
}

function listDot(l) {
  if (!l || l.id === 'inbox') return ic('inbox', 14);
  return '<span class="dot" style="background:' + (l.color || 'var(--text-4)') + '"></span>';
}

const Detail = {
  render(el, force) {
    const t = S.ui.sel && T.get(S.ui.sel);
    if (!t) {
      el.classList.add('hidden');
      el.innerHTML = '';
      el.dataset.id = '';
      document.body.classList.remove('detail-open');
      return;
    }
    el.classList.remove('hidden');
    document.body.classList.add('detail-open');
    if (!el.dataset.bound) Detail.bind(el);
    const ae = document.activeElement;
    if (!force && el.dataset.id === t.id && el.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      Detail.chrome(el, t);
      return;
    }
    const fresh = el.dataset.id !== t.id;
    el.dataset.id = t.id;
    const ro = t.deleted ? ' readonly' : '';
    el.innerHTML =
      (t.deleted ? '<div class="dt-banner">' + ic('trash', 15) + '<span>此任务在垃圾桶中</span><button class="btn btn-sm" data-act="restore" data-id="' + t.id + '">恢复</button></div>' : '') +
      '<div class="dt-top"></div>' +
      '<div class="dt-body">' +
      '<textarea class="dt-title" rows="1" placeholder="准备做什么？"' + ro + '>' + U.esc(t.title) + '</textarea>' +
      '<div class="dt-tags"></div>' +
      '<textarea class="dt-content" placeholder="添加描述…"' + ro + '>' + U.esc(t.content) + '</textarea>' +
      '<div class="dt-sub-h"></div>' +
      '<div class="dt-subs">' + t.items.map((i) =>
        '<div class="st-row' + (i.done ? ' done' : '') + '" data-sid="' + i.id + '">' +
        '<button class="cb sm' + (i.done ? ' on' : '') + '" data-act="st-toggle" data-sid="' + i.id + '"></button>' +
        '<input class="st-in" data-sid="' + i.id + '" value="' + U.esc(i.title) + '"' + ro + '>' +
        '<button class="icon-btn sm st-del" data-act="st-del" data-sid="' + i.id + '" title="删除子任务">' + ic('x', 14) + '</button></div>').join('') +
      '</div>' +
      (t.deleted ? '' : '<div class="st-add">' + ic('plus', 16) + '<input class="st-new" placeholder="添加子任务，回车保存"></div>') +
      '</div>' +
      '<div class="dt-foot"></div>';
    Detail.chrome(el, t);
    $$('textarea', el).forEach(autosize);
    if (fresh) el.querySelector('.dt-body').scrollTop = 0;
  },

  /** 只刷新非输入区域（顶部栏、标签、子任务计数、底部栏） */
  chrome(el, t) {
    const done = t.status === 2;
    const dc = dateClass(t);
    let dateLabel = '日期与重复';
    if (t.dueDate) dateLabel = U.friendly(t.dueDate) + (t.dueTime ? ' ' + t.dueTime : '');
    el.querySelector('.dt-top').innerHTML =
      '<button class="icon-btn only-mobile" data-act="dt-close">' + ic('arrowL', 18) + '</button>' +
      '<button class="cb lg pri-' + t.priority + (done ? ' on' : '') + '" data-act="toggle" data-id="' + t.id + '" title="' + (done ? '标记为未完成' : '完成') + '"></button>' +
      '<span class="dt-vsep"></span>' +
      '<button class="dt-date ' + dc + (t.dueDate ? ' set' : '') + '" data-act="dt-date">' + ic('calendar', 16) + '<span>' + dateLabel + '</span>' +
      (t.repeat ? ic('repeat', 14) : '') + (t.reminder != null && t.dueDate ? ic('bell', 14) : '') + '</button>' +
      '<div class="sp"></div>' +
      '<button class="icon-btn pc-' + t.priority + '" data-act="dt-pri" title="' + PRI[t.priority].name + '">' + ic(t.priority ? 'flagFill' : 'flag', 18) + '</button>' +
      '<button class="icon-btn hide-mobile" data-act="dt-close" title="关闭 (Esc)">' + ic('x', 18) + '</button>';

    el.querySelector('.dt-tags').innerHTML = t.tags.map((g) =>
      '<span class="tag-chip lg">#' + U.esc(g) + (t.deleted ? '' : '<button data-act="tag-x" data-tag="' + U.esc(g) + '">' + ic('x', 11, 2.2) + '</button>') + '</span>').join('') +
      (t.deleted ? '' : '<button class="tag-add" data-act="dt-tag">' + ic('tag', 13) + (t.tags.length ? '' : '<span>添加标签</span>') + '</button>');

    const dn = t.items.filter((i) => i.done).length;
    el.querySelector('.dt-sub-h').innerHTML = t.items.length
      ? ic('listChecks', 14) + '<span>子任务</span><span class="cnt">' + dn + '/' + t.items.length + '</span>'
      : '';

    const l = T.listOf(t);
    const focus = t.pomos || t.focusMin
      ? '<span class="dt-meta" title="累计专注">' + ic('timer', 14) + (t.pomos ? t.pomos + ' 个番茄 · ' : '') + U.dur(t.focusMin || 0) + '</span>'
      : '';
    el.querySelector('.dt-foot').innerHTML =
      '<button class="dt-list" data-act="dt-list"' + (t.deleted ? ' disabled' : '') + '>' + listDot(l) + '<span>' + U.esc(l.name) + '</span>' + ic('chevD', 14) + '</button>' +
      '<div class="sp"></div>' + focus +
      (t.deleted
        ? '<button class="icon-btn" data-act="purge" data-id="' + t.id + '" title="彻底删除">' + ic('trash', 18) + '</button>'
        : '<button class="icon-btn" data-act="dt-focus" title="开始专注">' + ic('timer', 18) + '</button>' +
          '<button class="icon-btn" data-act="dt-more" title="更多">' + ic('more', 18) + '</button>');
  },

  bind(el) {
    el.dataset.bound = '1';
    const cur = () => T.get(el.dataset.id);
    el.addEventListener('input', (e) => {
      const t = cur();
      if (!t || t.deleted) return;
      const tg = e.target;
      if (tg.classList.contains('dt-title')) {
        T.update(t.id, { title: tg.value.replace(/\n/g, ' ') });
        autosize(tg);
      } else if (tg.classList.contains('dt-content')) {
        T.update(t.id, { content: tg.value });
        autosize(tg);
      } else if (tg.classList.contains('st-in')) {
        const it = t.items.find((i) => i.id === tg.dataset.sid);
        if (it) { it.title = tg.value; t.modifiedAt = Date.now(); }
      } else return;
      App.refresh();
    });
    el.addEventListener('keydown', (e) => {
      const t = cur();
      if (!t || t.deleted || e.isComposing || e.keyCode === 229) return;
      const tg = e.target;
      if (tg.classList.contains('dt-title') && e.key === 'Enter') {
        e.preventDefault();
        el.querySelector('.dt-content').focus();
      } else if (tg.classList.contains('st-new') && e.key === 'Enter') {
        const v = tg.value.trim();
        if (!v) return;
        t.items.push({ id: U.uid(), title: v, done: false });
        App.refresh();
        Detail.render(el, true);
        el.querySelector('.st-new').focus();
      } else if (tg.classList.contains('st-in')) {
        const idx = t.items.findIndex((i) => i.id === tg.dataset.sid);
        if (e.key === 'Enter') {
          e.preventDefault();
          const ni = { id: U.uid(), title: '', done: false };
          t.items.splice(idx + 1, 0, ni);
          App.refresh();
          Detail.render(el, true);
          el.querySelector('.st-in[data-sid="' + ni.id + '"]').focus();
        } else if (e.key === 'Backspace' && tg.value === '') {
          e.preventDefault();
          t.items.splice(idx, 1);
          const prev = t.items[idx - 1];
          App.refresh();
          Detail.render(el, true);
          const f = prev ? el.querySelector('.st-in[data-sid="' + prev.id + '"]') : el.querySelector('.st-new');
          if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const rows = $$('.st-in', el);
          const j = rows.indexOf(tg) + (e.key === 'ArrowUp' ? -1 : 1);
          if (rows[j]) { e.preventDefault(); rows[j].focus(); }
        }
      }
    });
  },
};

/* ---------- 通用任务操作 ---------- */
function selTask() {
  return S.ui.sel && T.get(S.ui.sel);
}

function completeTask(id, done, rowEl, cbEl) {
  const t = T.get(id);
  if (!t || t.deleted) return;
  const go = () => {
    Undo.take();
    const r = T.complete(id, done);
    App.refresh();
    if (done) {
      Sound.chime && S.settings.sound && Sound.tick();
      toast(r.repeated ? '已完成，下一次：' + U.friendly(r.next) : '已完成「' + shortTitle(t.title) + '」', 'success', { label: '撤销', fn: Undo.restore });
    }
  };
  if (done && rowEl) {
    if (cbEl) cbEl.classList.add('on');
    rowEl.classList.add('completing');
    setTimeout(go, 320);
  } else go();
}

function deleteTask(id) {
  Undo.take();
  T.remove(id);
  App.refresh();
  toast('已移到垃圾桶', null, { label: '撤销', fn: Undo.restore });
}

Sound.tick = function () {
  try {
    const ctx = Sound.ctx || (Sound.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(1200, t0);
    o.frequency.exponentialRampToValueAtTime(1800, t0 + 0.08);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.3);
  } catch (e) { /* 忽略 */ }
};

A.toggle = (el) => {
  const t = T.get(el.dataset.id);
  if (!t) return;
  completeTask(t.id, t.status !== 2, el.closest('.task-row, .cal-chip, .wk-ev'), el);
};
A.sel = (el, e) => {
  if (e.target.closest('button, input')) return;
  S.ui.sel = el.dataset.id;
  App.refresh();
};
A['dt-close'] = () => { S.ui.sel = null; App.refresh(); };
A['dt-date'] = (el) => {
  const t = selTask();
  if (!t || t.deleted) return;
  DatePicker.open(el, t, (p) => { T.update(t.id, p); App.refresh(); });
};
A['dt-pri'] = (el) => {
  const t = selTask();
  if (!t || t.deleted) return;
  priorityMenu(el, t.priority, (p) => { T.update(t.id, { priority: p }); App.refresh(); });
};
A['dt-list'] = (el) => {
  const t = selTask();
  if (!t) return;
  listMenu(el, t.listId, (id) => { T.update(t.id, { listId: id }); App.refresh(); });
};
A['dt-tag'] = (el) => {
  const t = selTask();
  if (!t) return;
  tagPicker(el, t.tags, (tags) => { T.update(t.id, { tags }); App.refresh(); });
};
A['tag-x'] = (el) => {
  const t = selTask();
  if (!t) return;
  T.update(t.id, { tags: t.tags.filter((g) => g !== el.dataset.tag) });
  App.refresh();
};
A['dt-focus'] = () => {
  const t = selTask();
  if (!t) return;
  Pomo.setTask(t.id);
  App.go('pomo');
};
A['dt-more'] = (el) => {
  const t = selTask();
  if (!t) return;
  Menu.open(el, [
    { label: '复制任务', icon: 'copy', fn: () => { const c = T.duplicate(t.id); S.ui.sel = c.id; App.refresh(); toast('已复制'); } },
    { label: '开始专注', icon: 'timer', fn: () => A['dt-focus']() },
    { sep: true },
    { label: '删除', icon: 'trash', danger: true, fn: () => deleteTask(t.id) },
  ], { align: 'right' });
};
A['st-toggle'] = (el) => {
  const t = selTask();
  if (!t || t.deleted) return;
  const it = t.items.find((i) => i.id === el.dataset.sid);
  if (!it) return;
  it.done = !it.done;
  t.modifiedAt = Date.now();
  if (it.done) Sound.tick();
  App.refresh();
};
A['st-del'] = (el) => {
  const t = selTask();
  if (!t || t.deleted) return;
  t.items = t.items.filter((i) => i.id !== el.dataset.sid);
  App.refresh();
};
A.restore = (el) => {
  T.restore(el.dataset.id);
  App.refresh();
  toast('已恢复', 'success');
};
A.purge = async (el) => {
  const ok = await Modal.confirm({ title: '彻底删除这个任务？', msg: '删除后无法恢复。', ok: '彻底删除', danger: true });
  if (!ok) return;
  T.purge(el.dataset.id);
  App.refresh();
};

/* ---------- 任务右键菜单 ---------- */
function taskContextMenu(id, x, y) {
  const t = T.get(id);
  if (!t) return;
  if (t.deleted) {
    Menu.open({ x, y }, [
      { label: '恢复', icon: 'restore', fn: () => { T.restore(id); App.refresh(); } },
      { label: '彻底删除', icon: 'trash', danger: true, fn: () => A.purge({ dataset: { id } }) },
    ]);
    return;
  }
  const today = U.today();
  const nextMon = U.addDays(U.weekStart(today), 7 + ((1 - S.settings.weekStart + 7) % 7));
  const el = h('<div class="menu ctx">' +
    '<div class="menu-header">日期</div>' +
    '<div class="ctx-icons">' +
    '<button data-c="d" data-v="' + today + '" title="今天" class="' + (t.dueDate === today ? 'on' : '') + '">' + ic('sun', 18) + '</button>' +
    '<button data-c="d" data-v="' + U.addDays(today, 1) + '" title="明天" class="' + (t.dueDate === U.addDays(today, 1) ? 'on' : '') + '">' + ic('sunrise', 18) + '</button>' +
    '<button data-c="d" data-v="' + nextMon + '" title="下周一" class="' + (t.dueDate === nextMon ? 'on' : '') + '">' + ic('calNext', 18) + '</button>' +
    '<button data-c="dp" title="自定义">' + ic('calDays', 18) + '</button>' +
    '<button data-c="d" data-v="" title="清除日期">' + ic('calX', 18) + '</button></div>' +
    '<div class="menu-header">优先级</div>' +
    '<div class="ctx-icons">' + PRI_LIST.map((p) =>
      '<button data-c="p" data-v="' + p + '" title="' + PRI[p].name + '" class="pc-' + p + (t.priority === p ? ' on' : '') + '">' + ic(p ? 'flagFill' : 'flag', 18) + '</button>').join('') + '</div>' +
    '<div class="menu-sep"></div>' +
    '<div class="menu-item" data-c="list"><span class="menu-icon">' + ic('folder', 16) + '</span><span class="menu-label">移动到…</span></div>' +
    '<div class="menu-item" data-c="tag"><span class="menu-icon">' + ic('tag', 16) + '</span><span class="menu-label">标签…</span></div>' +
    '<div class="menu-item" data-c="focus"><span class="menu-icon">' + ic('timer', 16) + '</span><span class="menu-label">开始专注</span></div>' +
    '<div class="menu-item" data-c="dup"><span class="menu-icon">' + ic('copy', 16) + '</span><span class="menu-label">复制任务</span></div>' +
    '<div class="menu-sep"></div>' +
    '<div class="menu-item danger" data-c="del"><span class="menu-icon">' + ic('trash', 16) + '</span><span class="menu-label">删除</span></div>' +
    '</div>');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    const c = b.dataset.c;
    Pop.close();
    const pt = { x, y };
    if (c === 'd') T.update(id, b.dataset.v ? { dueDate: b.dataset.v } : { dueDate: null, dueTime: null, reminder: null, repeat: null });
    else if (c === 'p') T.update(id, { priority: +b.dataset.v });
    else if (c === 'dp') return DatePicker.open(pt, t, (p) => { T.update(id, p); App.refresh(); });
    else if (c === 'list') return listMenu(pt, t.listId, (lid) => { T.update(id, { listId: lid }); App.refresh(); });
    else if (c === 'tag') return tagPicker(pt, t.tags, (tags) => { T.update(id, { tags }); App.refresh(); });
    else if (c === 'focus') { Pomo.setTask(id); App.go('pomo'); return; }
    else if (c === 'dup') T.duplicate(id);
    else if (c === 'del') return deleteTask(id);
    App.refresh();
  });
  Pop.open({ x, y }, el);
}
