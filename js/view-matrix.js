'use strict';
/* 四象限：按优先级划分，拖动任务即可改变优先级 */

const QUADS = [
  { p: 5, n: 'I', name: '重要且紧急' },
  { p: 3, n: 'II', name: '重要不紧急' },
  { p: 1, n: 'III', name: '不重要但紧急' },
  { p: 0, n: 'IV', name: '不重要不紧急' },
];

const MatrixView = {
  render(root) {
    if (!root.querySelector('.mx')) {
      root.innerHTML = '<section class="mx-wrap"><div class="lp-head bare"><h1>四象限</h1><div class="sp"></div>' +
        '<span class="muted mx-tip hide-mobile">拖动任务到其他象限即可调整优先级</span></div><div class="mx"></div></section>' +
        '<aside class="pane detail hidden"></aside>';
      root.querySelector('.mx').innerHTML = QUADS.map((q) =>
        '<div class="pane mq pc-' + q.p + '" data-drop="pri:' + q.p + '">' +
        '<div class="mq-h"><span class="mq-n">' + q.n + '</span><span class="mq-name">' + q.name + '</span><span class="cnt"></span></div>' +
        '<div class="mq-list"></div>' +
        '<div class="mq-add">' + ic('plus', 16) + '<input placeholder="添加任务" data-p="' + q.p + '"></div></div>').join('');
      root.querySelector('.mx').addEventListener('keydown', (e) => {
        const inp = e.target.closest('.mq-add input');
        if (!inp || e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
        const v = inp.value.trim();
        if (!v) return;
        const p = parseQuick(v);
        T.add({ title: p.title, priority: +inp.dataset.p, listId: p.listId || 'inbox', dueDate: p.dueDate || null, dueTime: p.dueTime || null, repeat: p.repeat || null, tags: p.tags, reminder: p.dueTime ? 0 : null });
        inp.value = '';
        App.refresh();
      });
    }
    const live = S.tasks.filter((t) => !t.deleted && t.status !== 2);
    QUADS.forEach((q) => {
      const box = root.querySelector('.mq.pc-' + q.p);
      const arr = live.filter((t) => t.priority === q.p).sort(cmpDate);
      box.querySelector('.cnt').textContent = arr.length || '';
      box.querySelector('.mq-list').innerHTML = arr.length
        ? arr.map((t) => taskRow(t, { showList: false, noDrop: true })).join('')
        : '<div class="mq-empty">暂无任务</div>';
    });
    Detail.render(root.querySelector('.detail'));
  },
};
