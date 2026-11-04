'use strict';
/* 日历视图：月视图 / 周视图（含时间轴），支持拖动改日期 */

const HOUR_H = 48;

/** 某个日期范围内的任务（含重复任务的未来实例） */
function tasksInRange(from, to) {
  const map = {};
  const push = (d, t, ghost) => { (map[d] = map[d] || []).push({ t, ghost }); };
  for (const t of S.tasks) {
    if (t.deleted || !t.dueDate) continue;
    if (t.dueDate >= from && t.dueDate <= to) push(t.dueDate, t, false);
    if (t.repeat && t.status !== 2) {
      let d = nextRepeat(t.dueDate, t.repeat);
      let guard = 0;
      while (d <= to && guard++ < 400) {
        if (d >= from) push(d, t, true);
        d = nextRepeat(d, t.repeat);
      }
    }
  }
  Object.values(map).forEach((arr) => arr.sort((a, b) =>
    (a.t.status === 2) - (b.t.status === 2) || (a.t.dueTime || '99').localeCompare(b.t.dueTime || '99') || b.t.priority - a.t.priority));
  return map;
}

function calChip(o) {
  const t = o.t;
  return '<div class="cal-chip pri-' + t.priority + (t.status === 2 ? ' done' : '') + (o.ghost ? ' ghost' : '') + (S.ui.sel === t.id ? ' sel' : '') +
    '" data-act="sel" data-id="' + t.id + '"' + (o.ghost ? '' : ' data-drag-id="' + t.id + '" draggable="true"') + ' title="' + U.esc(t.title) + '">' +
    (t.dueTime ? '<span class="cc-time">' + t.dueTime + '</span>' : '') + '<span class="cc-title">' + U.esc(t.title || '无标题') + '</span></div>';
}

const CalView = {
  render(root) {
    if (!root.querySelector('.cal-pane')) {
      root.innerHTML = '<section class="pane cal-pane"><div class="lp-head"></div><div class="cal-body"></div></section><aside class="pane detail hidden"></aside>';
    }
    const el = root.querySelector('.cal-pane');
    const mode = S.ui.calMode;
    const anchor = S.ui.calDate || U.today();
    let title;
    if (mode === 'month') {
      const d = U.toDate(anchor);
      title = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
    } else {
      const ws = U.weekStart(anchor), we = U.addDays(ws, 6);
      const a = U.toDate(ws), b = U.toDate(we);
      title = a.getFullYear() + '年' + (a.getMonth() + 1) + '月' + a.getDate() + '日 – ' + (a.getMonth() === b.getMonth() ? '' : (b.getMonth() + 1) + '月') + b.getDate() + '日';
    }
    el.querySelector('.lp-head').innerHTML =
      '<h1>' + title + '</h1><div class="sp"></div>' +
      '<div class="seg"><button class="' + (mode === 'month' ? 'active' : '') + '" data-act="cal-mode" data-m="month">月</button>' +
      '<button class="' + (mode === 'week' ? 'active' : '') + '" data-act="cal-mode" data-m="week">周</button></div>' +
      '<button class="btn btn-sm" data-act="cal-today">今天</button>' +
      '<button class="icon-btn" data-act="cal-nav" data-d="-1" title="上一页">' + ic('chevL', 18) + '</button>' +
      '<button class="icon-btn" data-act="cal-nav" data-d="1" title="下一页">' + ic('chevR', 18) + '</button>';
    const body = el.querySelector('.cal-body');
    const sc = body.querySelector('.wk-scroll');
    const keep = sc ? sc.scrollTop : null;
    const wasMode = body.dataset.mode;
    body.dataset.mode = mode;
    body.innerHTML = mode === 'month' ? CalView.month(anchor) : CalView.week(anchor);
    const ns = body.querySelector('.wk-scroll');
    if (ns) ns.scrollTop = keep != null && wasMode === 'week' ? keep : 7.5 * HOUR_H;
    Detail.render(root.querySelector('.detail'));
  },

  month(anchor) {
    const ms = U.monthStart(anchor);
    const start = U.weekStart(ms);
    const dim = new Date(U.toDate(ms).getFullYear(), U.toDate(ms).getMonth() + 1, 0).getDate();
    const rows = Math.ceil((U.diff(ms, start) + dim) / 7);
    const end = U.addDays(start, rows * 7 - 1);
    const map = tasksInRange(start, end);
    const today = U.today();
    let html = '<div class="cal-month" style="grid-template-rows:auto repeat(' + rows + ',1fr)">';
    for (let i = 0; i < 7; i++) {
      const wd = (S.settings.weekStart + i) % 7;
      html += '<div class="cm-wd' + (wd === 0 || wd === 6 ? ' we' : '') + '">周' + U.WD[wd] + '</div>';
    }
    const MAX = 4;
    for (let i = 0; i < rows * 7; i++) {
      const d = U.addDays(start, i);
      const items = map[d] || [];
      const other = d.slice(0, 7) !== ms.slice(0, 7);
      const day = +d.slice(8);
      html += '<div class="cm-cell' + (other ? ' other' : '') + (d === today ? ' today' : '') + '" data-act="cal-cell" data-date="' + d + '" data-drop="date:' + d + '">' +
        '<div class="cm-num"><span>' + (day === 1 ? (+d.slice(5, 7)) + '月' + day + '日' : day) + '</span></div>' +
        '<div class="cm-tasks">' + items.slice(0, MAX).map(calChip).join('') +
        (items.length > MAX ? '<div class="cm-more" data-act="cal-more" data-date="' + d + '">还有 ' + (items.length - MAX) + ' 项</div>' : '') +
        '</div></div>';
    }
    return html + '</div>';
  },

  week(anchor) {
    const ws = U.weekStart(anchor);
    const we = U.addDays(ws, 6);
    const map = tasksInRange(ws, we);
    const today = U.today();
    const days = [];
    for (let i = 0; i < 7; i++) days.push(U.addDays(ws, i));
    let head = '<div class="wk-head"><div class="wk-gut"></div>';
    let all = '<div class="wk-allday"><div class="wk-gut">全天</div>';
    let cols = '';
    days.forEach((d) => {
      const items = map[d] || [];
      head += '<div class="wk-dh' + (d === today ? ' today' : '') + '"><span>周' + U.WD[U.dow(d)] + '</span><b>' + (+d.slice(8)) + '</b></div>';
      all += '<div class="wk-ad" data-act="cal-cell" data-date="' + d + '" data-drop="date:' + d + '">' + items.filter((o) => !o.t.dueTime).map(calChip).join('') + '</div>';
      const timed = items.filter((o) => o.t.dueTime);
      // 简单分栏：同一小时内的任务并排
      const lanes = [];
      const placed = timed.map((o) => {
        const [hh, mm] = o.t.dueTime.split(':').map(Number);
        const st = hh * 60 + mm;
        let lane = lanes.findIndex((end) => end <= st);
        if (lane < 0) { lane = lanes.length; lanes.push(0); }
        lanes[lane] = st + 55;
        return { o, st, lane };
      });
      const n = Math.max(1, lanes.length);
      cols += '<div class="wk-col' + (d === today ? ' today' : '') + '" data-act="wk-slot" data-date="' + d + '" data-drop="slot:' + d + '">' +
        placed.map((p) => {
          const t = p.o.t;
          return '<div class="wk-ev pri-' + t.priority + (t.status === 2 ? ' done' : '') + (p.o.ghost ? ' ghost' : '') + (S.ui.sel === t.id ? ' sel' : '') +
            '" style="top:' + (p.st / 60 * HOUR_H + 1) + 'px;height:' + (HOUR_H - 4) + 'px;left:calc(' + (p.lane * 100 / n) + '% + 2px);width:calc(' + (100 / n) + '% - 4px)"' +
            ' data-act="sel" data-id="' + t.id + '"' + (p.o.ghost ? '' : ' data-drag-id="' + t.id + '" draggable="true"') + '>' +
            '<b>' + U.esc(t.title || '无标题') + '</b><span>' + t.dueTime + '</span></div>';
        }).join('') +
        (d === today ? '<div class="wk-now" style="top:' + ((new Date().getHours() * 60 + new Date().getMinutes()) / 60 * HOUR_H) + 'px"></div>' : '') +
        '</div>';
    });
    head += '</div>';
    all += '</div>';
    let gut = '<div class="wk-hours">';
    for (let i = 0; i < 24; i++) gut += '<div class="wk-h"><span>' + (i ? U.pad(i) + ':00' : '') + '</span></div>';
    gut += '</div>';
    return '<div class="cal-week">' + head + all + '<div class="wk-scroll"><div class="wk-grid">' + gut + cols + '</div></div></div>';
  },
};

function calAddPop(pt, date, time) {
  const el = h('<div class="cal-add"><div class="ca-h">' + ic('plus', 15) + '<span>' + U.dayLabel(date) + (time ? ' ' + time : '') + '</span></div>' +
    '<input class="input wide" placeholder="添加任务，回车保存"></div>');
  const inp = el.querySelector('input');
  inp.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229 || e.key !== 'Enter') return;
    const v = inp.value.trim();
    if (!v) return;
    const p = parseQuick(v);
    const t = T.add({
      title: p.title, listId: p.listId || 'inbox', priority: p.priority || 0,
      dueDate: p.dueDate || date, dueTime: p.dueTime || time || null, repeat: p.repeat || null, tags: p.tags,
      reminder: p.dueTime || time ? 0 : null,
    });
    Pop.close();
    S.ui.sel = isMobile() ? null : t.id;
    App.refresh();
  });
  Pop.open(pt, el);
  setTimeout(() => inp.focus());
}

A['cal-mode'] = (el) => { S.ui.calMode = el.dataset.m; App.refresh(); };
A['cal-today'] = () => { S.ui.calDate = U.today(); App.refresh(); };
A['cal-nav'] = (el) => {
  const d = +el.dataset.d;
  const a = S.ui.calDate || U.today();
  S.ui.calDate = S.ui.calMode === 'month' ? U.addMonths(U.monthStart(a), d) : U.addDays(a, 7 * d);
  App.refresh();
};
A['cal-cell'] = (el, e) => {
  if (e.target.closest('.cal-chip, .cm-more')) return;
  calAddPop({ x: e.clientX, y: e.clientY }, el.dataset.date, null);
};
A['wk-slot'] = (el, e) => {
  if (e.target.closest('.wk-ev')) return;
  const y = e.clientY - el.getBoundingClientRect().top;
  const min = Math.max(0, Math.min(23 * 60 + 30, Math.floor(y / HOUR_H * 2) * 30));
  calAddPop({ x: e.clientX, y: e.clientY }, el.dataset.date, U.pad(Math.floor(min / 60)) + ':' + U.pad(min % 60));
};
A['cal-more'] = (el) => {
  const d = el.dataset.date;
  const items = tasksInRange(d, d)[d] || [];
  const box = h('<div class="cal-dayp"><div class="ca-h"><span>' + U.dayLabel(d) + '</span></div><div class="cdp-list">' + items.map(calChip).join('') + '</div></div>');
  box.addEventListener('click', (e) => {
    const c = e.target.closest('.cal-chip');
    if (c) { Pop.close(); S.ui.sel = c.dataset.id; App.refresh(); }
  });
  Pop.open(el, box);
};
