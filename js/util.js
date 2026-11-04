'use strict';
/* 通用工具：日期、转义、DOM */

const U = {
  WD: ['日', '一', '二', '三', '四', '五', '六'],

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
  pad(n) {
    return String(n).padStart(2, '0');
  },
  ymd(d) {
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  },
  today() {
    return U.ymd(new Date());
  },
  toDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  addDays(s, n) {
    const d = U.toDate(s);
    d.setDate(d.getDate() + n);
    return U.ymd(d);
  },
  addMonths(s, n) {
    const d = U.toDate(s);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return U.ymd(d);
  },
  /** a - b，单位：天 */
  diff(a, b) {
    return Math.round((U.toDate(a) - U.toDate(b)) / 86400000);
  },
  dow(s) {
    return U.toDate(s).getDay();
  },
  weekStart(s) {
    const ws = (typeof S !== 'undefined' && S && S.settings) ? S.settings.weekStart : 1;
    const off = (U.dow(s) - ws + 7) % 7;
    return U.addDays(s, -off);
  },
  monthStart(s) {
    return s.slice(0, 8) + '01';
  },
  validYMD(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getMonth() !== m - 1) return null;
    return U.ymd(dt);
  },
  md(s) {
    const d = U.toDate(s);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  },
  /** 今天 / 明天 / 周三 / 11月8日 */
  friendly(s) {
    if (!s) return '';
    const n = U.diff(s, U.today());
    if (n === 0) return '今天';
    if (n === 1) return '明天';
    if (n === -1) return '昨天';
    if (n === 2) return '后天';
    const d = U.toDate(s);
    if (n > 2 && n < 7) return '周' + U.WD[d.getDay()];
    if (d.getFullYear() === new Date().getFullYear()) return U.md(s);
    return d.getFullYear() + '年' + U.md(s);
  },
  dayLabel(s) {
    const n = U.diff(s, U.today());
    const wd = '周' + U.WD[U.dow(s)];
    if (n === 0) return '今天 · ' + wd;
    if (n === 1) return '明天 · ' + wd;
    return U.md(s) + ' · ' + wd;
  },
  hm(ts) {
    const d = new Date(ts);
    return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
  },
  mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return (h ? h + ':' + U.pad(m) : U.pad(m)) + ':' + U.pad(s);
  },
  dur(min) {
    min = Math.round(min);
    if (min < 60) return min + '分钟';
    const h = Math.floor(min / 60), m = min % 60;
    return h + '小时' + (m ? m + '分' : '');
  },
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function isTyping() {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
}

function isMobile() {
  return window.innerWidth < 760;
}

/** 全局动作表：元素上写 data-act="xxx"，点击时调用 A.xxx(el, event) */
const A = {};
