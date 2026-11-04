'use strict';
/* 智能识别：从一句话里识别日期、时间、重复、优先级、标签、清单
 * 例：明天下午3点 开会 #工作 !高 ~工作
 */

const CN_NUM = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const CN_WD = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0, 七: 0 };
const NUM = '(\\d{1,2}|[一二两三四五六七八九十]{1,3})';

function cn2n(s) {
  if (/^\d+$/.test(s)) return +s;
  if (s === '十') return 10;
  if (s[0] === '十') return 10 + (CN_NUM[s[1]] || 0);
  const i = s.indexOf('十');
  if (i > 0) return CN_NUM[s[0]] * 10 + (s[i + 1] ? CN_NUM[s[i + 1]] : 0);
  return CN_NUM[s] != null ? CN_NUM[s] : NaN;
}

function parseQuick(raw, ignore) {
  ignore = ignore || {};
  const today = U.today();
  const r = { title: '', tags: [], tokens: [] };
  let s = ' ' + raw + ' ';
  let periodDate = null;

  // 标签 #xxx
  if (!ignore.tag) {
    s = s.replace(/(^|\s)[#＃]([^\s#＃]+)/g, (m, a, tag) => {
      r.tags.push(tag);
      r.tokens.push({ type: 'tag', label: '#' + tag });
      return ' ';
    });
  }

  // 清单 ~xxx 或 ^xxx
  if (!ignore.list) {
    s = s.replace(/(^|\s)[~^～＾]([^\s]+)/, (m, a, name) => {
      const l = S.lists.find((x) => x.name === name) || S.lists.find((x) => x.name.startsWith(name));
      if (!l) return m;
      r.listId = l.id;
      r.tokens.push({ type: 'list', label: '清单：' + l.name });
      return ' ';
    });
  }

  // 优先级 !高 !中 !低 / !1 !2 !3
  if (!ignore.pri) {
    s = s.replace(/(^|\s)[!！](高|中|低|[123])(?=\s)/, (m, a, p) => {
      r.priority = { 高: 5, 中: 3, 低: 1, 1: 5, 2: 3, 3: 1 }[p];
      r.tokens.push({ type: 'pri', label: PRI[r.priority].name });
      return ' ';
    });
  }

  // 重复
  let repDay = null;
  if (!ignore.repeat) {
    const rules = [
      [/每个?工作日/, 'weekday'],
      [/每(天|日)/, 'daily'],
      [/每个?(周|星期|礼拜)([一二三四五六日天])?/, 'weekly', (m) => (m[2] ? { wd: CN_WD[m[2]] } : null)],
      [new RegExp('每个?月(?:' + NUM + '[号日])?'), 'monthly', (m) => (m[1] ? { md: cn2n(m[1]) } : null)],
      [/每年/, 'yearly'],
    ];
    for (const [re, v, extra] of rules) {
      const m = s.match(re);
      if (m) {
        r.repeat = v;
        repDay = extra ? extra(m) : null;
        r.tokens.push({ type: 'repeat', label: '重复：' + REPEAT_NAMES[v] });
        s = s.replace(m[0], ' ');
        break;
      }
    }
  }

  // 时间（先于日期处理，以便识别“今晚 / 明早”）
  if (!ignore.time) {
    const re = new RegExp('(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|明晚|今早|明早|夜里)?\\s*' + NUM + '(?:[:：](\\d{2})|点(钟)?(半|一刻|三刻|(\\d{1,2})分?)?|时)');
    const m = s.match(re);
    if (m) {
      const period = m[1] || '';
      const isCn = !/^\d+$/.test(m[2]);
      const hasTail = m[3] || m[4] || m[5];
      // 中文数字（如“一点点”）必须带时段或“钟/半/分”才算时间
      if (!(isCn && !period && !hasTail)) {
        let hh = cn2n(m[2]);
        let mm = 0;
        if (m[3]) mm = +m[3];
        else if (m[5] === '半') mm = 30;
        else if (m[5] === '一刻') mm = 15;
        else if (m[5] === '三刻') mm = 45;
        else if (m[6]) mm = +m[6];
        if (/下午|傍晚|晚上|今晚|明晚|夜里/.test(period) && hh < 12) hh += 12;
        if (period === '中午' && hh < 11) hh += 12;
        if (period === '凌晨' && hh === 12) hh = 0;
        if (hh === 24) hh = 0;
        if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
          r.dueTime = U.pad(hh) + ':' + U.pad(mm);
          if (/^今/.test(period)) periodDate = today;
          if (/^明/.test(period)) periodDate = U.addDays(today, 1);
          s = s.replace(m[0], ' ');
        }
      }
    }
  }

  // 日期
  if (!ignore.date) {
    const nextMD = (mo, d) => {
      const y = new Date().getFullYear();
      let v = U.validYMD(y, mo, d);
      if (v && v < today) v = U.validYMD(y + 1, mo, d);
      return v;
    };
    const nextDom = (d) => {
      const now = new Date();
      let v = U.validYMD(now.getFullYear(), now.getMonth() + 1, d);
      if (!v || v < today) {
        const n = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        v = U.validYMD(n.getFullYear(), n.getMonth() + 1, d);
      }
      return v;
    };
    const weekDay = (wd, k) => {
      const ws = U.weekStart(today);
      return U.addDays(ws, ((wd - S.settings.weekStart + 7) % 7) + 7 * k);
    };
    const upcoming = (wd) => U.addDays(today, (wd - U.dow(today) + 7) % 7);
    const rules = [
      [/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})[日号]?/, (m) => U.validYMD(+m[1], +m[2], +m[3])],
      [new RegExp(NUM + '月' + NUM + '[日号]?'), (m) => nextMD(cn2n(m[1]), cn2n(m[2]))],
      [/(?<![\d:：])(\d{1,2})\/(\d{1,2})(?!\d)/, (m) => nextMD(+m[1], +m[2])],
      [/大后天/, () => U.addDays(today, 3)],
      [/后天/, () => U.addDays(today, 2)],
      [/明天|明日|明晚|明早/, () => U.addDays(today, 1)],
      [/今天|今日|今晚|今早/, () => today],
      [/昨天/, () => U.addDays(today, -1)],
      [new RegExp(NUM + '天(?:后|以后|之后)'), (m) => U.addDays(today, cn2n(m[1]))],
      [/(下下|下)个?(?:周|星期|礼拜)([一二三四五六日天])/, (m) => weekDay(CN_WD[m[2]], m[1] === '下下' ? 2 : 1)],
      [/(?:这|本)个?(?:周|星期|礼拜)([一二三四五六日天])/, (m) => weekDay(CN_WD[m[1]], 0)],
      [/(?:周|星期|礼拜)([一二三四五六日天])/, (m) => upcoming(CN_WD[m[1]])],
      [/下个?(?:周|星期|礼拜)/, () => weekDay(S.settings.weekStart, 1)],
      [/下个?月/, () => U.addMonths(today, 1)],
      // 单独的“20号”前后要有空格，避免把“1号线”识别成日期
      [new RegExp('(?<=\\s)' + NUM + '[号日](?=\\s)'), (m) => nextDom(cn2n(m[1]))],
    ];
    for (const [re, fn] of rules) {
      const m = s.match(re);
      if (!m) continue;
      const v = fn(m);
      if (v) {
        r.dueDate = v;
        s = s.replace(m[0], ' ');
        break;
      }
    }
  }

  if (!r.dueDate && periodDate) r.dueDate = periodDate;
  if (!r.dueDate && r.repeat) {
    if (repDay && repDay.wd != null) r.dueDate = U.addDays(today, (repDay.wd - U.dow(today) + 7) % 7);
    else if (repDay && repDay.md) {
      const now = new Date();
      r.dueDate = U.validYMD(now.getFullYear(), now.getMonth() + 1, repDay.md);
      if (!r.dueDate || r.dueDate < today) r.dueDate = U.addMonths(U.validYMD(now.getFullYear(), now.getMonth() + 1, 1), 1).slice(0, 8) + U.pad(repDay.md);
    } else r.dueDate = today;
  }
  if (r.dueTime && !r.dueDate) r.dueDate = today;
  if (r.dueDate) {
    r.tokens.unshift({ type: 'date', label: U.friendly(r.dueDate) + (r.dueTime ? ' ' + r.dueTime : '') });
  } else if (r.dueTime) {
    r.tokens.unshift({ type: 'time', label: r.dueTime });
  }

  r.title = s.replace(/\s+/g, ' ').trim();
  if (!r.title) r.title = raw.trim();
  return r;
}
