'use strict';
/* 数据层：所有数据保存在浏览器 localStorage */

const DB_KEY = 'mytick.data.v1';
let S = null;

const PRI_LIST = [5, 3, 1, 0];
const PRI = {
  5: { name: '高优先级', short: '高' },
  3: { name: '中优先级', short: '中' },
  1: { name: '低优先级', short: '低' },
  0: { name: '无优先级', short: '无' },
};
const LIST_COLORS = [null, '#0071e3', '#248a3d', '#c93400', '#d70015', '#8e8e93'];
const REPEAT_NAMES = { daily: '每天', weekday: '每个工作日', weekly: '每周', monthly: '每月', yearly: '每年' };
const REMIND_NAMES = { 0: '准时', 5: '提前 5 分钟', 30: '提前 30 分钟', 60: '提前 1 小时', 1440: '提前 1 天' };

const DEFAULT_SETTINGS = {
  theme: 'light', weekStart: 1,
  pomoLen: 25, shortBreak: 5, longBreak: 15, longEvery: 4, autoBreak: true,
  showCompleted: true, sound: true,
};
const DEFAULT_UI = {
  view: 'tasks', list: 'today', sel: null, sort: {}, collapsed: {}, sbCollapsed: {},
  calMode: 'month', calDate: null, habitSel: null,
};
const DEFAULT_POMO = { mode: 'pomo', phase: 'idle', running: false, startAt: 0, elapsed: 0, duration: 0, taskId: null, cycle: 0, sessionStart: 0 };

function makeTask(p) {
  const now = Date.now();
  return Object.assign({
    id: U.uid(), title: '', content: '', listId: 'inbox', priority: 0,
    dueDate: null, dueTime: null, reminder: null, repeat: null,
    tags: [], items: [], status: 0, completedAt: null,
    createdAt: now, modifiedAt: now, order: 0,
    deleted: false, deletedAt: null, pomos: 0, focusMin: 0, remindedKey: null,
  }, p);
}

function seedData() {
  const t = U.today();
  const d = (n) => U.addDays(t, n);
  const s = {
    version: 1,
    lists: [
      { id: 'inbox', name: '收集箱', color: null },
      { id: 'l_work', name: '工作', color: '#0071e3' },
      { id: 'l_life', name: '个人生活', color: '#248a3d' },
      { id: 'l_shop', name: '购物清单', color: '#c93400' },
    ],
    tags: [{ name: '重要' }, { name: '学习' }],
    tasks: [],
    habits: [],
    pomoRecords: [],
    settings: Object.assign({}, DEFAULT_SETTINGS),
    ui: Object.assign({}, DEFAULT_UI),
    pomo: Object.assign({}, DEFAULT_POMO),
  };
  let order = 0;
  const add = (p) => s.tasks.push(makeTask(Object.assign({ order: order++ }, p)));
  add({
    title: '欢迎使用「我的滴答清单」', dueDate: t, listId: 'inbox',
    content: '这是一个完全运行在浏览器里的待办清单，数据保存在本机。\n\n左侧图标栏可以切换：任务、日历、四象限、番茄专注、习惯打卡。',
    items: [
      { id: U.uid(), title: '点开一个任务，看看右侧的详情面板', done: true },
      { id: U.uid(), title: '试着给任务加子任务、标签和描述', done: false },
      { id: U.uid(), title: '右键任务可以快速改日期、优先级', done: false },
    ],
  });
  add({ title: '在上方输入框试试：明天下午3点 开会 #重要 !高', dueDate: t, listId: 'inbox', priority: 3 });
  add({ title: '把任务拖到左侧清单即可移动，拖到日历上即可改日期', dueDate: t, listId: 'inbox' });
  add({ title: '整理本周周报', dueDate: t, dueTime: '17:00', reminder: 0, listId: 'l_work', priority: 5, tags: ['重要'] });
  add({ title: '准备下周例会材料', dueDate: d(2), listId: 'l_work', priority: 3 });
  add({ title: '回复客户邮件', dueDate: d(-1), listId: 'l_work', priority: 1 });
  add({ title: '读完《原则》第三章', dueDate: d(1), listId: 'l_life', tags: ['学习'] });
  add({ title: '每天喝 8 杯水', dueDate: t, repeat: 'daily', listId: 'l_life' });
  add({ title: '去健身房', dueDate: d(1), dueTime: '19:30', listId: 'l_life' });
  add({ title: '牛奶', listId: 'l_shop' });
  add({ title: '鸡蛋', listId: 'l_shop' });
  add({ title: '全麦面包', listId: 'l_shop' });

  const rec = {};
  for (let i = 1; i <= 5; i++) rec[d(-i)] = 1;
  s.habits = [
    { id: U.uid(), name: '早起', emoji: '☀️', freq: 'daily', days: [], goal: 1, records: Object.assign({}, rec), createdAt: Date.now() },
    { id: U.uid(), name: '阅读 30 分钟', emoji: '📚', freq: 'daily', days: [], goal: 1, records: { [d(-1)]: 1, [d(-2)]: 1 }, createdAt: Date.now() },
    { id: U.uid(), name: '运动', emoji: '🏃', freq: 'weekly', days: [1, 3, 5], goal: 1, records: {}, createdAt: Date.now() },
    { id: U.uid(), name: '喝水', emoji: '💧', freq: 'daily', days: [], goal: 8, records: { [t]: 3 }, createdAt: Date.now() },
  ];
  return s;
}

const Store = {
  _timer: null,
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DB_KEY) || 'null'); } catch (e) { d = null; }
    S = d && Array.isArray(d.tasks) ? d : seedData();
    Store.normalize();
  },
  normalize() {
    S.settings = Object.assign({}, DEFAULT_SETTINGS, S.settings);
    S.ui = Object.assign({}, DEFAULT_UI, S.ui);
    S.pomo = Object.assign({}, DEFAULT_POMO, S.pomo);
    S.lists = S.lists || [];
    if (!S.lists.find((l) => l.id === 'inbox')) S.lists.unshift({ id: 'inbox', name: '收集箱', color: null });
    S.tags = S.tags || [];
    S.habits = S.habits || [];
    S.pomoRecords = S.pomoRecords || [];
    S.tasks = S.tasks.map((t) => makeTask(t));
    S.tasks.forEach((t) => {
      if (!S.lists.find((l) => l.id === t.listId)) t.listId = 'inbox';
      t.tags.forEach(Tags.ensure);
    });
    if (S.ui.sel && !T.get(S.ui.sel)) S.ui.sel = null;
  },
  save() {
    clearTimeout(Store._timer);
    Store._timer = setTimeout(Store.flush, 150);
  },
  flush() {
    clearTimeout(Store._timer);
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(S));
    } catch (e) {
      if (typeof toast === 'function') toast('保存失败：浏览器存储空间不足', 'error');
    }
  },
};

/* ---------- 任务 ---------- */
const T = {
  get: (id) => S.tasks.find((t) => t.id === id),
  live: () => S.tasks.filter((t) => !t.deleted),
  minOrder() {
    let m = 0;
    for (const t of S.tasks) if (t.order < m) m = t.order;
    return m;
  },
  add(p) {
    const t = makeTask(Object.assign({ order: T.minOrder() - 1 }, p));
    S.tasks.push(t);
    t.tags.forEach(Tags.ensure);
    return t;
  },
  update(id, patch) {
    const t = T.get(id);
    if (!t) return null;
    Object.assign(t, patch);
    t.modifiedAt = Date.now();
    if ('dueDate' in patch || 'dueTime' in patch || 'reminder' in patch) t.remindedKey = null;
    if (!t.dueDate) { t.dueTime = null; t.repeat = null; }
    if (patch.tags) patch.tags.forEach(Tags.ensure);
    return t;
  },
  /** 完成 / 取消完成。重复任务会生成一条已完成记录，并把原任务顺延到下一次 */
  complete(id, done = true) {
    const t = T.get(id);
    if (!t) return null;
    if (done && t.status !== 2 && t.repeat && t.dueDate) {
      const copy = makeTask(Object.assign(JSON.parse(JSON.stringify(t)), {
        id: U.uid(), status: 2, completedAt: Date.now(), repeat: null, repeatFrom: t.id,
      }));
      S.tasks.push(copy);
      let next = nextRepeat(t.dueDate, t.repeat);
      const today = U.today();
      while (next < today) next = nextRepeat(next, t.repeat);
      t.dueDate = next;
      t.items.forEach((i) => { i.done = false; });
      t.remindedKey = null;
      t.modifiedAt = Date.now();
      return { repeated: true, next };
    }
    t.status = done ? 2 : 0;
    t.completedAt = done ? Date.now() : null;
    t.modifiedAt = Date.now();
    return { repeated: false };
  },
  remove(id) {
    const t = T.get(id);
    if (t) { t.deleted = true; t.deletedAt = Date.now(); }
    if (S.ui.sel === id) S.ui.sel = null;
  },
  restore(id) {
    const t = T.get(id);
    if (!t) return;
    t.deleted = false;
    t.deletedAt = null;
    if (!S.lists.find((l) => l.id === t.listId)) t.listId = 'inbox';
  },
  purge(id) {
    S.tasks = S.tasks.filter((t) => t.id !== id);
    if (S.ui.sel === id) S.ui.sel = null;
  },
  duplicate(id) {
    const t = T.get(id);
    if (!t) return null;
    const c = JSON.parse(JSON.stringify(t));
    c.id = U.uid();
    c.items.forEach((i) => { i.id = U.uid(); });
    c.createdAt = c.modifiedAt = Date.now();
    c.order = t.order - 0.5;
    c.pomos = 0; c.focusMin = 0; c.remindedKey = null;
    S.tasks.push(makeTask(c));
    return c;
  },
  listOf(t) {
    return S.lists.find((l) => l.id === t.listId) || S.lists[0];
  },
};

function nextRepeat(date, rep) {
  switch (rep) {
    case 'daily': return U.addDays(date, 1);
    case 'weekday': {
      let d = U.addDays(date, 1);
      while (U.dow(d) === 0 || U.dow(d) === 6) d = U.addDays(d, 1);
      return d;
    }
    case 'weekly': return U.addDays(date, 7);
    case 'monthly': return U.addMonths(date, 1);
    case 'yearly': return U.addMonths(date, 12);
  }
  return U.addDays(date, 1);
}

/* ---------- 清单 ---------- */
const L = {
  get: (id) => S.lists.find((l) => l.id === id),
  user: () => S.lists.filter((l) => l.id !== 'inbox'),
  add(name, color) {
    const l = { id: 'l_' + U.uid(), name, color: color || null };
    S.lists.push(l);
    return l;
  },
  remove(id) {
    if (id === 'inbox') return;
    S.tasks.forEach((t) => {
      if (t.listId === id) {
        t.listId = 'inbox';
        if (!t.deleted) { t.deleted = true; t.deletedAt = Date.now(); }
      }
    });
    S.lists = S.lists.filter((l) => l.id !== id);
  },
};

/* ---------- 标签 ---------- */
const Tags = {
  all: () => S.tags,
  ensure(name) {
    if (name && !S.tags.find((t) => t.name === name)) S.tags.push({ name });
  },
  rename(old, nw) {
    nw = nw.trim().replace(/^#/, '');
    if (!nw || old === nw) return;
    S.tasks.forEach((t) => {
      t.tags = Array.from(new Set(t.tags.map((g) => (g === old ? nw : g))));
    });
    S.tags = S.tags.filter((g) => g.name !== old);
    Tags.ensure(nw);
    if (S.ui.list === 'tag:' + old) S.ui.list = 'tag:' + nw;
  },
  remove(name) {
    S.tasks.forEach((t) => { t.tags = t.tags.filter((g) => g !== name); });
    S.tags = S.tags.filter((g) => g.name !== name);
    if (S.ui.list === 'tag:' + name) S.ui.list = 'today';
  },
};

/* ---------- 撤销 ---------- */
const Undo = {
  snap: null,
  take() { Undo.snap = JSON.stringify(S.tasks); },
  restore() {
    if (!Undo.snap) return;
    S.tasks = JSON.parse(Undo.snap);
    Undo.snap = null;
    App.refresh();
  },
};

/* ---------- 习惯 ---------- */
const H = {
  get: (id) => S.habits.find((h) => h.id === id),
  isDue(h, date) {
    return h.freq !== 'weekly' || (h.days || []).includes(U.dow(date));
  },
  count: (h, date) => h.records[date] || 0,
  done: (h, date) => (h.records[date] || 0) >= (h.goal || 1),
  tap(h, date) {
    const c = H.count(h, date), g = h.goal || 1;
    if (c >= g) delete h.records[date];
    else h.records[date] = c + 1;
  },
  firstDay(h) {
    const keys = Object.keys(h.records).sort();
    const created = U.ymd(new Date(h.createdAt || Date.now()));
    return keys.length && keys[0] < created ? keys[0] : created;
  },
  streak(h) {
    let d = U.today();
    if (!H.done(h, d)) d = U.addDays(d, -1);
    const first = H.firstDay(h);
    let n = 0;
    while (d >= first) {
      if (H.isDue(h, d)) {
        if (H.done(h, d)) n++;
        else break;
      }
      d = U.addDays(d, -1);
    }
    return n;
  },
  longest(h) {
    let d = H.firstDay(h);
    const end = U.today();
    let best = 0, cur = 0;
    while (d <= end) {
      if (H.isDue(h, d)) {
        if (H.done(h, d)) { cur++; best = Math.max(best, cur); } else if (d !== end) cur = 0;
      }
      d = U.addDays(d, 1);
    }
    return best;
  },
  total(h) {
    return Object.keys(h.records).filter((k) => H.done(h, k)).length;
  },
};
