'use strict';
/* 习惯打卡 */

const HABIT_EMOJI = ['☀️', '📚', '🏃', '💧', '🧘', '💪', '🍎', '😴', '✍️', '🎹', '🗣️', '🧹', '💊', '🚭', '🌙', '📝', '🎯', '🚶', '🥗', '🦷', '📵', '💰', '🌱', '❤️'];
let habitDay = null;
let habitMonth = null;

function habitRing(hb, date, size) {
  const c = H.count(hb, date), g = hb.goal || 1;
  const done = c >= g;
  const r = size / 2 - 3, C = 2 * Math.PI * r;
  return '<span class="hb-ring' + (done ? ' done' : '') + '" style="width:' + size + 'px;height:' + size + 'px">' +
    (!done && g > 1 && c > 0 ? '<svg viewBox="0 0 ' + size + ' ' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-dasharray="' + C + '" stroke-dashoffset="' + C * (1 - c / g) + '"/></svg>' : '') +
    (done ? ic('check', size * 0.5, 2.6) : (g > 1 ? '<em>' + c + '/' + g + '</em>' : '')) + '</span>';
}

function freqText(hb) {
  const f = hb.freq === 'weekly' ? '每周' + (hb.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => U.WD[d]).join('、') : '每天';
  return f + ((hb.goal || 1) > 1 ? ' · 每次 ' + hb.goal + ' 次' : '');
}

const HabitsView = {
  render(root) {
    if (!root.querySelector('.hb-pane')) {
      root.innerHTML = '<section class="pane hb-pane"></section><aside class="pane hb-detail hidden"></aside>';
    }
    const today = U.today();
    if (!habitDay || habitDay > today) habitDay = today;
    const ws = U.weekStart(today);
    let week = '<div class="hb-week">';
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(ws, i);
      const due = S.habits.filter((hb) => H.isDue(hb, d));
      const dn = due.filter((hb) => H.done(hb, d)).length;
      const pct = due.length ? dn / due.length : 0;
      const C = 2 * Math.PI * 15;
      week += '<button class="hbw-day' + (d === habitDay ? ' on' : '') + (d === today ? ' today' : '') + (d > today ? ' future' : '') + '" data-act="hb-day" data-d="' + d + '"' + (d > today ? ' disabled' : '') + '>' +
        '<span>周' + U.WD[U.dow(d)] + '</span>' +
        '<span class="hbw-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="track"/><circle cx="18" cy="18" r="15" class="bar" stroke-dasharray="' + C + '" stroke-dashoffset="' + C * (1 - pct) + '"/></svg><b>' + (+d.slice(8)) + '</b></span></button>';
    }
    week += '</div>';
    const due = S.habits.filter((hb) => H.isDue(hb, habitDay));
    const notDue = S.habits.filter((hb) => !H.isDue(hb, habitDay));
    const row = (hb) => '<div class="hb-row' + (S.ui.habitSel === hb.id ? ' sel' : '') + '" data-act="hb-sel" data-id="' + hb.id + '">' +
      '<span class="hb-emoji">' + hb.emoji + '</span>' +
      '<div class="hb-info"><b>' + U.esc(hb.name) + '</b><span>' + freqText(hb) + ' · 连续 ' + H.streak(hb) + ' 天</span></div>' +
      (H.isDue(hb, habitDay) ? '<button class="hb-check" data-act="hb-tap" data-id="' + hb.id + '" title="打卡">' + habitRing(hb, habitDay, 34) + '</button>' : '') + '</div>';
    let list;
    if (!S.habits.length) list = '<div class="empty">' + ic('target', 40, 1.4) + '<div>养成一个好习惯，从今天开始</div><button class="btn btn-primary" data-act="hb-add">' + ic('plus', 16) + '新建习惯</button></div>';
    else {
      const doneN = due.filter((hb) => H.done(hb, habitDay)).length;
      list = '<div class="hb-sum">' + (habitDay === today ? '今天' : U.dayLabel(habitDay)) + ' 已完成 <b>' + doneN + '</b> / ' + due.length + '</div>' +
        due.map(row).join('') +
        (notDue.length ? '<div class="hb-subh">这天不需要打卡</div>' + notDue.map(row).join('') : '');
    }
    root.querySelector('.hb-pane').innerHTML =
      '<div class="lp-head"><h1>习惯打卡</h1><div class="sp"></div><button class="btn btn-primary btn-sm" data-act="hb-add">' + ic('plus', 15) + '新建习惯</button></div>' +
      week + '<div class="hb-list">' + list + '</div>';
    HabitsView.detail(root.querySelector('.hb-detail'));
  },

  detail(el) {
    const hb = S.ui.habitSel && H.get(S.ui.habitSel);
    if (!hb) { el.classList.add('hidden'); el.innerHTML = ''; document.body.classList.remove('detail-open'); return; }
    el.classList.remove('hidden');
    document.body.classList.add('detail-open');
    const today = U.today();
    if (!habitMonth) habitMonth = U.monthStart(today);
    const ms = habitMonth;
    const start = U.weekStart(ms);
    const md = U.toDate(ms);
    const dim = new Date(md.getFullYear(), md.getMonth() + 1, 0).getDate();
    let dueN = 0, doneN = 0;
    let cells = '';
    for (let i = 0; i < 7; i++) cells += '<span class="dp-wd">' + U.WD[(S.settings.weekStart + i) % 7] + '</span>';
    for (let i = 0; i < 42; i++) {
      const d = U.addDays(start, i);
      const inM = d.slice(0, 7) === ms.slice(0, 7);
      const due = H.isDue(hb, d);
      const done = H.done(hb, d);
      if (inM && due && d <= today) { dueN++; if (done) doneN++; }
      const c = H.count(hb, d);
      cells += '<button class="hbc-day' + (inM ? '' : ' other') + (done ? ' done' : (c ? ' part' : '')) + (due ? '' : ' nodue') + (d === today ? ' today' : '') + '"' +
        (d > today ? ' disabled' : ' data-act="hb-tapd" data-d="' + d + '"') + '>' + (+d.slice(8)) + '</button>';
    }
    const rate = dueN ? Math.round(doneN / dueN * 100) : 0;
    el.innerHTML =
      '<div class="dt-top"><button class="icon-btn only-mobile" data-act="hb-close">' + ic('arrowL', 18) + '</button>' +
      '<span class="hb-emoji lg">' + hb.emoji + '</span><div class="hb-dt-name"><b>' + U.esc(hb.name) + '</b><span>' + freqText(hb) + '</span></div><div class="sp"></div>' +
      '<button class="icon-btn" data-act="hb-more" title="更多">' + ic('more', 18) + '</button>' +
      '<button class="icon-btn hide-mobile" data-act="hb-close" title="关闭">' + ic('x', 18) + '</button></div>' +
      '<div class="dt-body">' +
      '<div class="stat-grid">' +
      '<div class="stat"><span>' + ic('flame', 14) + '当前连续</span><b>' + H.streak(hb) + '<small>天</small></b></div>' +
      '<div class="stat"><span>' + ic('trophy', 14) + '最长连续</span><b>' + H.longest(hb) + '<small>天</small></b></div>' +
      '<div class="stat"><span>' + ic('checkCircle', 14) + '总打卡</span><b>' + H.total(hb) + '<small>天</small></b></div>' +
      '<div class="stat"><span>' + ic('chart', 14) + '本月完成率</span><b>' + rate + '<small>%</small></b></div></div>' +
      '<div class="hbc"><div class="dp-head"><b>' + md.getFullYear() + '年' + (md.getMonth() + 1) + '月</b><span>' +
      '<button class="icon-btn sm" data-act="hb-month" data-d="-1">' + ic('chevL', 16) + '</button>' +
      '<button class="icon-btn sm" data-act="hb-month" data-d="1">' + ic('chevR', 16) + '</button></span></div>' +
      '<div class="dp-grid hbc-grid">' + cells + '</div>' +
      '<div class="hbc-tip muted">点击日期可以补打卡或取消打卡</div></div>' +
      '</div>';
    void dim;
  },
};

function habitModal(hb) {
  const v = hb ? JSON.parse(JSON.stringify(hb)) : { name: '', emoji: HABIT_EMOJI[0], freq: 'daily', days: [1, 2, 3, 4, 5], goal: 1 };
  if (!v.days || !v.days.length) v.days = [1, 2, 3, 4, 5];
  const wdOrder = [1, 2, 3, 4, 5, 6, 0];
  Modal.open({
    title: hb ? '编辑习惯' : '新建习惯', width: 440,
    body: '<div class="form">' +
      '<input class="input wide" id="hm-name" placeholder="习惯名称，例如：早起、读书" maxlength="30" autofocus value="' + U.esc(v.name) + '">' +
      '<div class="emoji-grid">' + HABIT_EMOJI.map((e) => '<button class="emo' + (e === v.emoji ? ' on' : '') + '" data-e="' + e + '">' + e + '</button>').join('') + '</div>' +
      '<div class="form-row"><span class="form-label">频率</span><div class="seg" id="hm-freq">' +
      '<button data-f="daily" class="' + (v.freq !== 'weekly' ? 'active' : '') + '">每天</button>' +
      '<button data-f="weekly" class="' + (v.freq === 'weekly' ? 'active' : '') + '">每周几天</button></div></div>' +
      '<div class="form-row" id="hm-days-row"' + (v.freq === 'weekly' ? '' : ' hidden') + '><span class="form-label"></span><div class="wd-chips">' +
      wdOrder.map((d) => '<button class="chip' + (v.days.includes(d) ? ' active' : '') + '" data-d="' + d + '">周' + U.WD[d] + '</button>').join('') + '</div></div>' +
      '<div class="form-row"><span class="form-label">每天目标</span><input class="input num" id="hm-goal" type="number" min="1" max="99" value="' + (v.goal || 1) + '"><span class="muted">次</span></div>' +
      '</div>',
    footer: '<button class="btn" data-m="x">取消</button><button class="btn btn-primary" data-ok>' + (hb ? '保存' : '创建') + '</button>',
    onMount(box, m) {
      box.addEventListener('click', (e) => {
        const em = e.target.closest('.emo');
        if (em) { v.emoji = em.dataset.e; $$('.emo', box).forEach((x) => x.classList.toggle('on', x === em)); return; }
        const f = e.target.closest('#hm-freq button');
        if (f) {
          v.freq = f.dataset.f;
          $$('#hm-freq button', box).forEach((x) => x.classList.toggle('active', x === f));
          box.querySelector('#hm-days-row').hidden = v.freq !== 'weekly';
          return;
        }
        const d = e.target.closest('.wd-chips .chip');
        if (d) {
          const n = +d.dataset.d;
          v.days = v.days.includes(n) ? v.days.filter((x) => x !== n) : v.days.concat(n);
          d.classList.toggle('active');
        }
      });
      const save = () => {
        const name = box.querySelector('#hm-name').value.trim();
        if (!name) { box.querySelector('#hm-name').focus(); return; }
        if (v.freq === 'weekly' && !v.days.length) { toast('请至少选择一天', 'error'); return; }
        const goal = Math.max(1, Math.min(99, parseInt(box.querySelector('#hm-goal').value, 10) || 1));
        if (hb) Object.assign(hb, { name, emoji: v.emoji, freq: v.freq, days: v.days, goal });
        else {
          const nh = { id: U.uid(), name, emoji: v.emoji, freq: v.freq, days: v.days, goal, records: {}, createdAt: Date.now() };
          S.habits.push(nh);
          S.ui.habitSel = isMobile() ? null : nh.id;
        }
        m.close();
        App.refresh();
      };
      box.querySelector('[data-ok]').addEventListener('click', save);
      box.querySelector('#hm-name').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) save(); });
    },
  });
}

A['hb-add'] = () => habitModal(null);
A['hb-day'] = (el) => { habitDay = el.dataset.d; App.refresh(); };
A['hb-sel'] = (el, e) => {
  if (e.target.closest('.hb-check')) return;
  S.ui.habitSel = S.ui.habitSel === el.dataset.id && !isMobile() ? null : el.dataset.id;
  habitMonth = null;
  App.refresh();
};
A['hb-close'] = () => { S.ui.habitSel = null; App.refresh(); };
A['hb-tap'] = (el) => {
  const hb = H.get(el.dataset.id);
  if (!hb) return;
  H.tap(hb, habitDay);
  if (H.done(hb, habitDay)) { Sound.tick(); el.classList.add('pop'); }
  App.refresh();
};
A['hb-tapd'] = (el) => {
  const hb = H.get(S.ui.habitSel);
  if (!hb) return;
  const d = el.dataset.d;
  if (H.done(hb, d)) delete hb.records[d];
  else hb.records[d] = hb.goal || 1;
  App.refresh();
};
A['hb-month'] = (el) => {
  habitMonth = U.addMonths(habitMonth || U.monthStart(U.today()), +el.dataset.d);
  App.refresh();
};
A['hb-more'] = (el) => {
  const hb = H.get(S.ui.habitSel);
  if (!hb) return;
  Menu.open(el, [
    { label: '编辑', icon: 'pencil', fn: () => habitModal(hb) },
    { label: '删除', icon: 'trash', danger: true, fn: async () => {
      const ok = await Modal.confirm({ title: '删除习惯「' + hb.name + '」？', msg: '所有打卡记录会一起删除，无法恢复。', ok: '删除', danger: true });
      if (!ok) return;
      S.habits = S.habits.filter((x) => x.id !== hb.id);
      S.ui.habitSel = null;
      App.refresh();
    } },
  ], { align: 'right' });
};
