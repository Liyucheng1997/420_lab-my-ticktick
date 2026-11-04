'use strict';
/* 番茄专注：番茄钟 / 正计时，专注记录与统计 */

const RING_R = 136;
const RING_C = 2 * Math.PI * RING_R;

const Pomo = {
  elapsed() {
    const p = S.pomo;
    return p.elapsed + (p.running ? (Date.now() - p.startAt) / 1000 : 0);
  },
  left() {
    return S.pomo.duration - Pomo.elapsed();
  },
  counting() {
    return S.pomo.phase !== 'idle';
  },
  isWatch() {
    return S.pomo.mode === 'watch' && S.pomo.phase === 'focus';
  },
  setTask(id) {
    S.pomo.taskId = id;
    Store.save();
  },
  start(phase) {
    const p = S.pomo, st = S.settings;
    p.phase = phase;
    p.duration = (phase === 'focus' ? st.pomoLen : phase === 'short' ? st.shortBreak : st.longBreak) * 60;
    p.elapsed = 0;
    p.startAt = Date.now();
    p.sessionStart = Date.now();
    p.running = true;
    Sound.ctx || Sound.tick(); // 预热音频（需要用户手势）
    App.refresh();
  },
  pause() {
    const p = S.pomo;
    if (!p.running) return;
    p.elapsed += (Date.now() - p.startAt) / 1000;
    p.running = false;
    App.refresh();
  },
  resume() {
    const p = S.pomo;
    if (p.running) return;
    p.startAt = Date.now();
    p.running = true;
    App.refresh();
  },
  reset() {
    Object.assign(S.pomo, { phase: 'idle', running: false, elapsed: 0, duration: 0, startAt: 0 });
    document.title = '我的滴答清单';
    App.refresh();
  },
  record(sec) {
    const p = S.pomo;
    const t = p.taskId && T.get(p.taskId);
    const min = Math.round(sec / 6) / 10;
    S.pomoRecords.push({
      id: U.uid(), taskId: p.taskId || null, title: t ? t.title : '', start: p.sessionStart, end: Date.now(),
      min, kind: p.mode === 'watch' ? 'watch' : 'pomo',
    });
    if (t) {
      t.focusMin = Math.round(((t.focusMin || 0) + min) * 10) / 10;
      if (p.mode !== 'watch') t.pomos = (t.pomos || 0) + 1;
    }
  },
  async stop() {
    const p = S.pomo;
    if (p.phase === 'focus') {
      const sec = Pomo.elapsed();
      if (p.mode === 'watch') {
        if (sec >= 60) { Pomo.record(sec); toast('已记录专注 ' + U.dur(sec / 60), 'success'); }
        else toast('专注不足 1 分钟，未记录');
      } else {
        const ok = await Modal.confirm({ title: '放弃这个番茄？', msg: '未完成的番茄不会被记录。', ok: '放弃', danger: true, icon: 'timer' });
        if (!ok) return;
      }
    }
    Pomo.reset();
  },
  finish() {
    const p = S.pomo;
    if (p.phase === 'focus') {
      Pomo.record(p.duration);
      p.cycle = (p.cycle || 0) + 1;
      const t = p.taskId && T.get(p.taskId);
      sysNotify('番茄完成！', (t ? '「' + t.title + '」' : '') + '休息一下吧', () => App.go('pomo'));
      toast('番茄完成，休息一下吧', 'success');
      if (S.settings.autoBreak) {
        Pomo.start(p.cycle % S.settings.longEvery === 0 ? 'long' : 'short');
        return;
      }
      p.phase = 'idle';
      p.running = false;
      p.pendingBreak = true;
    } else {
      sysNotify('休息结束', '开始下一个番茄吧', () => App.go('pomo'));
      toast('休息结束，开始下一个番茄吧');
      p.phase = 'idle';
      p.running = false;
    }
    document.title = '我的滴答清单';
    App.refresh();
  },
  tick() {
    const p = S.pomo;
    if (!p.running) return;
    if (!Pomo.isWatch() && Pomo.left() <= 0) { Pomo.finish(); return; }
    Pomo.paint();
  },
  timeText() {
    const p = S.pomo;
    if (p.phase === 'idle') return U.mmss((p.mode === 'watch' ? 0 : S.settings.pomoLen) * 60);
    return U.mmss(Pomo.isWatch() ? Pomo.elapsed() : Math.ceil(Pomo.left()));
  },
  progress() {
    const p = S.pomo;
    if (p.phase === 'idle') return 0;
    if (Pomo.isWatch()) return (Pomo.elapsed() % 3600) / 3600;
    return Math.min(1, Pomo.elapsed() / p.duration);
  },
  paint() {
    const txt = Pomo.timeText();
    const tEl = $('#pm-time');
    if (tEl) tEl.textContent = txt;
    const ring = $('#pm-ring');
    if (ring) ring.style.strokeDashoffset = String(RING_C * (1 - Pomo.progress()));
    const rb = $('.rail-btn[data-view="pomo"] .rb-time');
    if (rb) rb.textContent = Pomo.counting() ? txt : '';
    const p = S.pomo;
    if (p.phase !== 'idle') document.title = txt + (p.phase === 'focus' ? ' 专注中' : ' 休息中') + (p.running ? '' : '（已暂停）') + ' · 我的滴答清单';
  },
  stats() {
    const today = U.today();
    const recs = S.pomoRecords;
    const td = recs.filter((r) => U.ymd(new Date(r.end)) === today);
    const sum = (a) => a.reduce((s, r) => s + r.min, 0);
    return {
      todayPomo: td.filter((r) => r.kind === 'pomo').length,
      todayMin: sum(td),
      totalPomo: recs.filter((r) => r.kind === 'pomo').length,
      totalMin: sum(recs),
    };
  },
};

const PomoView = {
  render(root) {
    if (!root.querySelector('.pm-main')) {
      root.innerHTML = '<section class="pane pm-main"></section><aside class="pm-side"><div class="pane pm-stats"></div><div class="pane pm-recs"></div></aside>';
    }
    const p = S.pomo;
    const t = p.taskId && T.get(p.taskId);
    const phaseText = p.phase === 'idle' ? (p.pendingBreak ? '番茄完成，可以休息了' : '准备开始') :
      p.phase === 'focus' ? (p.running ? '专注中' : '已暂停') : (p.running ? (p.phase === 'long' ? '长休息中' : '休息中') : '休息已暂停');
    let ctrl = '';
    if (p.phase === 'idle') {
      ctrl = '<button class="btn btn-primary btn-lg" data-act="pm-start">' + ic('play', 16) + (p.mode === 'watch' ? '开始计时' : '开始专注') + '</button>';
      if (p.pendingBreak) ctrl += '<button class="btn btn-lg" data-act="pm-break">' + ic('coffee', 16) + '开始休息</button>';
    } else if (p.phase === 'focus') {
      ctrl = (p.running
        ? '<button class="btn btn-lg" data-act="pm-pause">' + ic('pause', 16) + '暂停</button>'
        : '<button class="btn btn-primary btn-lg" data-act="pm-resume">' + ic('play', 16) + '继续</button>') +
        '<button class="btn btn-lg btn-ghost-danger" data-act="pm-stop">' + ic('stop', 14) + (p.mode === 'watch' ? '结束' : '放弃') + '</button>';
    } else {
      ctrl = (p.running
        ? '<button class="btn btn-lg" data-act="pm-pause">' + ic('pause', 16) + '暂停</button>'
        : '<button class="btn btn-primary btn-lg" data-act="pm-resume">' + ic('play', 16) + '继续</button>') +
        '<button class="btn btn-lg" data-act="pm-skip">' + ic('skip', 16) + '跳过休息</button>';
    }
    const isBreak = p.phase === 'short' || p.phase === 'long';
    root.querySelector('.pm-main').innerHTML =
      '<div class="lp-head"><h1>番茄专注</h1><div class="sp"></div>' +
      '<div class="seg"><button class="' + (p.mode === 'pomo' ? 'active' : '') + '" data-act="pm-mode" data-m="pomo">番茄</button>' +
      '<button class="' + (p.mode === 'watch' ? 'active' : '') + '" data-act="pm-mode" data-m="watch">正计时</button></div></div>' +
      '<div class="pm-center">' +
      '<button class="pm-task" data-act="pm-task">' + (t ? '<span class="muted">专注任务</span><b>' + U.esc(t.title || '无标题') + '</b>' : '<span class="muted">选择要专注的任务</span>') + ic('chevD', 14) + '</button>' +
      '<div class="pm-ring' + (isBreak ? ' brk' : '') + '"><svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="' + RING_R + '" class="track"/>' +
      '<circle id="pm-ring" cx="150" cy="150" r="' + RING_R + '" class="bar" stroke-dasharray="' + RING_C + '" stroke-dashoffset="' + RING_C * (1 - Pomo.progress()) + '"/></svg>' +
      '<div class="pm-in"><div id="pm-time" class="pm-time">' + Pomo.timeText() + '</div><div class="pm-phase">' + phaseText + '</div></div></div>' +
      '<div class="pm-ctrl">' + ctrl + '</div>' +
      (p.mode === 'pomo' ? '<div class="pm-cycle">' + Array.from({ length: S.settings.longEvery }, (_, i) =>
        '<i class="' + (i < (p.cycle || 0) % S.settings.longEvery ? 'on' : '') + '"></i>').join('') + '<span>每 ' + S.settings.longEvery + ' 个番茄一次长休息</span></div>' : '') +
      '</div>';

    const st = Pomo.stats();
    root.querySelector('.pm-stats').innerHTML = '<div class="card-title">概览</div><div class="stat-grid">' +
      '<div class="stat"><span>今日番茄</span><b>' + st.todayPomo + '</b></div>' +
      '<div class="stat"><span>今日专注</span><b>' + U.dur(st.todayMin).replace(/(\d+)/g, '<em>$1</em>') + '</b></div>' +
      '<div class="stat"><span>总番茄</span><b>' + st.totalPomo + '</b></div>' +
      '<div class="stat"><span>总专注</span><b>' + U.dur(st.totalMin).replace(/(\d+)/g, '<em>$1</em>') + '</b></div></div>';

    const recs = S.pomoRecords.slice().sort((a, b) => b.end - a.end).slice(0, 60);
    let rh = '<div class="card-title">专注记录</div>';
    if (!recs.length) rh += '<div class="empty sm">' + ic('timer', 32, 1.4) + '<div>完成第一个番茄后，记录会出现在这里</div></div>';
    else {
      let last = '';
      rh += '<div class="rec-list">';
      recs.forEach((r) => {
        const d = U.ymd(new Date(r.end));
        if (d !== last) { rh += '<div class="rec-day">' + (U.diff(d, U.today()) === 0 ? '今天' : U.dayLabel(d)) + '</div>'; last = d; }
        const tt = r.taskId && T.get(r.taskId);
        rh += '<div class="rec"><span class="rec-ico ' + r.kind + '">' + ic(r.kind === 'pomo' ? 'timer' : 'clock', 14) + '</span>' +
          '<div class="rec-main"><b>' + U.esc((tt && tt.title) || r.title || '专注') + '</b><span>' + U.hm(r.start) + ' – ' + U.hm(r.end) + '</span></div>' +
          '<span class="rec-min">' + U.dur(r.min) + '</span></div>';
      });
      rh += '</div>';
    }
    root.querySelector('.pm-recs').innerHTML = rh;
    Pomo.paint();
  },
};

A['pm-start'] = () => { S.pomo.pendingBreak = false; Pomo.start('focus'); };
A['pm-break'] = () => { S.pomo.pendingBreak = false; Pomo.start((S.pomo.cycle || 0) % S.settings.longEvery === 0 ? 'long' : 'short'); };
A['pm-pause'] = () => Pomo.pause();
A['pm-resume'] = () => Pomo.resume();
A['pm-stop'] = () => Pomo.stop();
A['pm-skip'] = () => Pomo.reset();
A['pm-mode'] = async (el) => {
  const m = el.dataset.m;
  if (m === S.pomo.mode) return;
  if (S.pomo.phase !== 'idle') {
    const ok = await Modal.confirm({ title: '切换模式会结束当前计时', ok: '切换', icon: 'timer' });
    if (!ok) return;
    if (S.pomo.mode === 'watch' && S.pomo.phase === 'focus' && Pomo.elapsed() >= 60) Pomo.record(Pomo.elapsed());
  }
  S.pomo.mode = m;
  S.pomo.pendingBreak = false;
  Pomo.reset();
};
A['pm-task'] = (el) => {
  const box = h('<div class="taskpick"><input class="input sm wide" placeholder="搜索任务"><div class="tkp-list"></div></div>');
  const inp = box.querySelector('input'), list = box.querySelector('.tkp-list');
  const render = () => {
    const q = inp.value.trim().toLowerCase();
    const arr = S.tasks.filter((t) => !t.deleted && t.status !== 2 && (!q || t.title.toLowerCase().includes(q))).sort(cmpDate).slice(0, 50);
    list.innerHTML = '<div class="menu-item" data-id=""><span class="menu-icon">' + ic('x', 15) + '</span><span class="menu-label">不关联任务</span></div>' +
      arr.map((t) => '<div class="menu-item" data-id="' + t.id + '"><span class="menu-icon pc-' + t.priority + '">' + ic('checkSquare', 15) + '</span><span class="menu-label">' + U.esc(t.title || '无标题') + '</span>' +
        (t.dueDate ? '<span class="menu-shortcut">' + U.friendly(t.dueDate) + '</span>' : '') + '</div>').join('');
  };
  list.addEventListener('click', (e) => {
    const it = e.target.closest('.menu-item');
    if (!it) return;
    Pomo.setTask(it.dataset.id || null);
    Pop.close();
    App.refresh();
  });
  inp.addEventListener('input', render);
  render();
  Pop.open(el, box);
  setTimeout(() => inp.focus());
};
A.noop = () => {};
