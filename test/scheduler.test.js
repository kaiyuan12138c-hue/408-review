const test = require('node:test');
const assert = require('node:assert');
const S = require('../scheduler.js');

const settings = { intervals: [1, 2, 4, 7, 15, 30] };
const chapters = [
  { id: 'a', subject: '数据结构', name: 'A', order: 0 },
  { id: 'b', subject: '操作系统', name: 'B', order: 1 }
];

let seq = 0;
function learn(id, date, mastery) {
  return { id: 'l' + (seq++), chapterId: id, kind: 'learn', date: date, at: 1, mastery: mastery || 'ok' };
}
function review(id, date, quality) {
  return { id: 'r' + (seq++), chapterId: id, kind: 'review', date: date, at: 2, quality: quality };
}
function stateOf(log) {
  return S.chapterStates(log, chapters, settings).map.get('a');
}

test('日期工具：跨月跨年', function () {
  assert.equal(S.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(S.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(S.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(S.diffDays('2026-10-18', '2026-12-27'), 70);
  assert.equal(S.diffDays('2026-12-27', '2026-10-18'), -70);
});

test('学完当天：进入第 0 档，次日复习', function () {
  const st = stateOf([learn('a', '2026-03-01')]);
  assert.equal(st.stage, 0);
  assert.equal(st.nextDue, '2026-03-02');
  assert.equal(st.startedAt, '2026-03-01');
});

test('熟练的章节跳过第一档', function () {
  const st = stateOf([learn('a', '2026-03-01', 'solid')]);
  assert.equal(st.stage, 1);
  assert.equal(st.nextDue, '2026-03-03');
});

test('连续记住走完整条阶梯并掌握', function () {
  const log = [learn('a', '2026-01-01')];
  const due = [];
  let cursor = stateOf(log).nextDue;
  while (cursor) {
    due.push(cursor);
    log.push(review('a', cursor, 'good'));
    cursor = stateOf(log).nextDue;
  }
  assert.deepEqual(due, ['2026-01-02', '2026-01-04', '2026-01-08', '2026-01-15', '2026-01-30', '2026-03-01']);
  const st = stateOf(log);
  assert.equal(st.stage, 6);
  assert.equal(st.nextDue, null);
  assert.equal(st.reviewCount, 6);
});

test('忘了：退回第一档，次日重来', function () {
  const st = stateOf([
    learn('a', '2026-03-01'),
    review('a', '2026-03-02', 'good'),
    review('a', '2026-03-04', 'bad')
  ]);
  assert.equal(st.stage, 0);
  assert.equal(st.nextDue, '2026-03-05');
  assert.equal(st.lapses, 1);
});

test('模糊：停在原档，同一间隔重来', function () {
  const st = stateOf([
    learn('a', '2026-03-01'),
    review('a', '2026-03-02', 'good'),
    review('a', '2026-03-04', 'fuzzy')
  ]);
  assert.equal(st.stage, 1);
  assert.equal(st.nextDue, '2026-03-06');
  assert.equal(st.fuzzy, 1);
});

test('逾期完成：从实际完成日往后算', function () {
  const st = stateOf([learn('a', '2026-03-01'), review('a', '2026-03-10', 'good')]);
  assert.equal(st.nextDue, '2026-03-12');
});

test('重复学习会重新开始一轮', function () {
  const st = stateOf([
    learn('a', '2026-03-01'),
    review('a', '2026-03-02', 'good'),
    learn('a', '2026-04-01')
  ]);
  assert.equal(st.stage, 0);
  assert.equal(st.nextDue, '2026-04-02');
  assert.equal(st.learnCount, 2);
});

test('日志乱序不影响回放结果', function () {
  const ordered = [learn('a', '2026-03-01'), review('a', '2026-03-02', 'good'), review('a', '2026-03-04', 'fuzzy')];
  const shuffled = [ordered[2], ordered[0], ordered[1]];
  const s1 = stateOf(ordered);
  const s2 = stateOf(shuffled);
  assert.equal(s1.stage, s2.stage);
  assert.equal(s1.nextDue, s2.nextDue);
});

test('间隔解析：字符串、去重、排序、容错', function () {
  assert.deepEqual(S.normalizeIntervals('1,2,4,7,15,30'), [1, 2, 4, 7, 15, 30]);
  assert.deepEqual(S.normalizeIntervals(' 4, 2 ,2, 1 '), [1, 2, 4]);
  assert.deepEqual(S.normalizeIntervals('1，2、3'), [1, 2, 3]);
  assert.deepEqual(S.normalizeIntervals('abc'), S.DEFAULT_INTERVALS);
  assert.deepEqual(S.normalizeIntervals([0, -1, 3]), [3]);
});

test('复习队列：只收到期和逾期，逾期按日期升序', function () {
  const log = [learn('a', '2026-10-01'), learn('b', '2026-10-05')];
  const q = S.dueQueue(log, chapters, settings, '2026-10-18');
  assert.equal(q.overdue.length, 2);
  assert.equal(q.overdue[0].chapter.id, 'a');
  assert.equal(q.overdue[1].chapter.id, 'b');
  assert.equal(q.due.length, 0);
});

test('未学和未到期的章不进入队列', function () {
  const log = [learn('a', '2026-10-17')];
  const q = S.dueQueue(log, chapters, settings, '2026-10-18');
  assert.equal(q.overdue.length, 0);
  assert.equal(q.due.length, 1);
  assert.equal(q.due[0].chapter.id, 'a');
});

test('状态判定', function () {
  const st = stateOf([learn('a', '2026-10-01')]);
  assert.equal(S.statusOf(st, '2026-10-18', [1, 2, 4]).code, 'overdue');
  assert.equal(S.statusOf(st, '2026-10-18', [1, 2, 4]).days, 16);
  assert.equal(S.statusOf(null, '2026-10-18', [1]).code, 'new');
});

test('连续打卡：今天有记录 / 今天没记录', function () {
  const log = [learn('a', '2026-10-16'), learn('a', '2026-10-17'), learn('a', '2026-10-18')];
  assert.equal(S.streakOf(log, '2026-10-18').current, 3);
  assert.equal(S.streakOf(log, '2026-10-18').best, 3);

  const gap = [learn('a', '2026-10-16'), learn('a', '2026-10-17')];
  assert.equal(S.streakOf(gap, '2026-10-18').current, 2);
  assert.equal(S.streakOf(gap, '2026-10-19').current, 0);
});

test('未来复习预习', function () {
  const st = stateOf([learn('a', '2026-03-01')]);
  assert.deepEqual(S.projectQueue(st, settings, 3).map(function (p) { return p.due; }),
    ['2026-03-02', '2026-03-04', '2026-03-08']);
});

test('逾期时预习从今天往后排', function () {
  const st = stateOf([learn('a', '2026-03-01')]);
  const p = S.projectQueue(st, settings, 3, '2026-03-10');
  assert.equal(p[0].due, '2026-03-10');
  assert.equal(p[1].due, '2026-03-12');
  assert.equal(p[2].due, '2026-03-16');
});

test('遗忘曲线：有记录才有曲线', function () {
  assert.equal(S.retentionSeries({ history: [] }, '2026-03-05', 10), null);
  const st = stateOf([learn('a', '2026-03-01'), review('a', '2026-03-02', 'good')]);
  const series = S.retentionSeries(st, '2026-03-05', 10);
  assert.ok(series && series.points.length > 0);
  assert.equal(series.start, '2026-03-01');
});

test('统计汇总', function () {
  const log = [learn('a', '2026-03-01'), review('a', '2026-03-02', 'good'), learn('b', '2026-03-02')];
  const s = S.stats(log, chapters, settings, '2026-03-03');
  assert.equal(s.total, 2);
  assert.equal(s.started, 2);
  assert.equal(s.reviewTotal, 1);
  assert.equal(s.learnTotal, 2);
  assert.equal(s.bySubject['数据结构'].started, 1);
});