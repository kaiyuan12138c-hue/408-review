/*!
 * 408 复习曲线 — 排程核心
 * 纯函数实现，不依赖 DOM，可在浏览器与 Node 中复用（用于单元测试）。
 *
 * 设计要点
 *  - 单一事实来源：所有学习/复习动作都写进 log，章节状态由 log 回放得出。
 *    这样「撤销」只需删掉一条记录，状态自然回到之前的样子。
 *  - 阶梯式间隔：每成功复习一次，stage +1，下次间隔取 intervals[stage]。
 *    默认 1/2/4/7/15/30 天，即累计在第 1/3/7/14/29/59 天复习。
 *  - 三档反馈：记住 / 模糊 / 忘了，分别推进、原地重来、退回起点。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Scheduler = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DAY = 86400000;
  var DEFAULT_INTERVALS = [1, 2, 4, 7, 15, 30];

  /* ---------------- 日期工具 ---------------- */

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /** Date -> 'YYYY-MM-DD'（本地时区） */
  function toKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** 'YYYY-MM-DD' -> 本地零点 Date */
  function parseKey(key) {
    var p = String(key).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function todayKey() { return toKey(new Date()); }

  /** 在日期上加减天数，返回 key */
  function addDays(key, n) {
    var d = parseKey(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
  }

  /** 从 a 到 b 相差多少天（b 晚于 a 为正） */
  function diffDays(a, b) {
    return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / DAY);
  }

  function weekdayCN(key) { return '日一二三四五六'[parseKey(key).getDay()]; }

  /** '2026-10-19' -> '10月19日'（跨年时带上年份） */
  function fmtCN(key, ref) {
    var d = parseKey(key);
    var y = (ref ? parseKey(ref) : new Date()).getFullYear();
    var head = d.getFullYear() === y ? '' : d.getFullYear() + '年';
    return head + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /** 相对今天的口语化日期 */
  function humanDate(key, today) {
    var n = diffDays(today, key);
    if (n === 0) return '今天';
    if (n === 1) return '明天';
    if (n === 2) return '后天';
    if (n === -1) return '昨天';
    if (n === -2) return '前天';
    return fmtCN(key, today);
  }

  /* ---------------- 杂项 ---------------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** 把 '1,2,4,7' / [1,2,4,7] / '1 2 4' 统一成升序去重的正整数数组 */
  function normalizeIntervals(input) {
    var arr;
    if (typeof input === 'string') arr = input.split(/[,，、\s]+/);
    else if (Array.isArray(input)) arr = input.slice();
    else arr = [];

    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var n = Math.round(Number(arr[i]));
      if (!isFinite(n) || n <= 0 || n > 365) continue;
      if (seen[n]) continue;
      seen[n] = true;
      out.push(n);
    }
    out.sort(function (a, b) { return a - b; });
    return out.length ? out : DEFAULT_INTERVALS.slice();
  }

  /* ---------------- 状态回放 ---------------- */

  var KIND_LEARN = 'learn';
  var KIND_REVIEW = 'review';
  var GOOD = 'good';
  var FUZZY = 'fuzzy';
  var BAD = 'bad';

  function emptyProgress(chapterId) {
    return {
      chapterId: chapterId,
      stage: -1,          // -1 = 从未学过；0..n-1 = 已完成 n 次复习；>= n = 已掌握
      nextDue: null,
      startedAt: null,
      lastAt: null,
      learnCount: 0,
      reviewCount: 0,
      good: 0,
      fuzzy: 0,
      bad: 0,
      lapses: 0,
      history: []         // 该章的事件，按时间升序
    };
  }

  function compareEvent(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    var x = a.at || 0, y = b.at || 0;
    if (x !== y) return x - y;
    return (a._i || 0) - (b._i || 0);
  }

  /**
   * 由 log 回放得到每章进度。
   * @returns {{map: Map<string, object>, intervals: number[]}}
   */
  function chapterStates(log, chapters, settings) {
    var intervals = normalizeIntervals(settings && settings.intervals);
    var map = new Map();
    var i;
    for (i = 0; i < chapters.length; i++) map.set(chapters[i].id, emptyProgress(chapters[i].id));

    var events = [];
    for (i = 0; i < (log || []).length; i++) {
      var e = log[i];
      if (!e || !e.date) continue;
      events.push({ e: e, date: e.date, at: e.at || 0, _i: i });
    }
    events.sort(compareEvent);

    for (i = 0; i < events.length; i++) {
      var ev = events[i].e;
      var st = map.get(ev.chapterId);
      if (!st) continue;                       // 章节已被删除，忽略其历史
      st.history.push(ev);

      if (ev.kind === KIND_LEARN) {
        st.learnCount++;
        st.startedAt = st.startedAt || ev.date;
        st.lastAt = ev.date;
        // 熟练度高的章节，直接视为已跨过第 0 档，首复习间隔更长
        if (ev.mastery === 'solid') {
          st.stage = Math.min(1, intervals.length);
          st.nextDue = st.stage >= intervals.length ? null : addDays(ev.date, intervals[st.stage]);
        } else {
          st.stage = 0;
          st.nextDue = addDays(ev.date, intervals[0]);
        }
        continue;
      }

      if (ev.kind !== KIND_REVIEW) continue;

      st.reviewCount++;
      st.lastAt = ev.date;
      var cur = st.stage < 0 ? 0 : st.stage;

      if (ev.quality === GOOD) {
        st.good++;
        st.stage = Math.min(cur + 1, intervals.length);
        st.nextDue = st.stage >= intervals.length ? null : addDays(ev.date, intervals[st.stage]);
      } else if (ev.quality === FUZZY) {
        st.fuzzy++;
        st.stage = Math.min(cur, intervals.length - 1);
        st.nextDue = addDays(ev.date, intervals[st.stage]);
      } else {
        st.bad++;
        st.lapses++;
        st.stage = 0;
        st.nextDue = addDays(ev.date, intervals[0]);
      }
    }

    return { map: map, intervals: intervals };
  }

  /* ---------------- 状态判定 ---------------- */

  /**
   * @returns {{code:'new'|'mastered'|'overdue'|'due'|'upcoming', days?:number, due?:string}}
   */
  function statusOf(st, today, intervals) {
    if (!st || st.stage < 0 || !st.startedAt) return { code: 'new' };
    if (st.nextDue === null) return { code: 'mastered' };
    var n = diffDays(today, st.nextDue);
    if (n < 0) return { code: 'overdue', days: -n, due: st.nextDue };
    if (n === 0) return { code: 'due', due: st.nextDue };
    return { code: 'upcoming', days: n, due: st.nextDue };
  }

  /** 人类可读的状态文案 */
  function statusText(status) {
    switch (status.code) {
      case 'new': return '未学';
      case 'mastered': return '已掌握';
      case 'overdue': return '逾期 ' + status.days + ' 天';
      case 'due': return '今天复习';
      default: return status.days === 1 ? '明天复习' : status.days + ' 天后';
    }
  }

  /** 今天需要处理的复习（逾期 + 到期），按到期日升序 */
  function dueQueue(log, chapters, settings, today) {
    var built = chapterStates(log, chapters, settings);
    var overdue = [], due = [];
    for (var i = 0; i < chapters.length; i++) {
      var ch = chapters[i];
      var st = built.map.get(ch.id);
      var status = statusOf(st, today, built.intervals);
      if (status.code === 'overdue') overdue.push({ chapter: ch, progress: st, status: status });
      else if (status.code === 'due') due.push({ chapter: ch, progress: st, status: status });
    }
    overdue.sort(function (a, b) { return a.status.due < b.status.due ? -1 : 1; });
    due.sort(function (a, b) { return a.chapter.order - b.chapter.order; });
    return { overdue: overdue, due: due, map: built.map, intervals: built.intervals };
  }

  /**
   * 未来复习预习（演示用，不写状态）。
   * 假设每次都按时完成、且都点「记住」。
   */
  function projectQueue(st, settings, limit, today) {
    var intervals = normalizeIntervals(settings && settings.intervals);
    var out = [];
    if (!st || st.stage < 0 || st.nextDue === null) return out;
    var stage = st.stage;
    var due = st.nextDue;
    // 已经逾期时，按「今天补上」往后排，避免预习表里出现过去的日期
    if (today && diffDays(today, due) < 0) due = today;
    var guard = 0;
    while (due && out.length < (limit || 8) && guard++ < 30) {
      out.push({ stage: stage, due: due });
      var next = stage + 1;
      if (next >= intervals.length) break;
      due = addDays(due, intervals[next]);
      stage = next;
    }
    return out;
  }

  /* ---------------- 统计 ---------------- */

  function activeDates(log) {
    var set = new Set();
    for (var i = 0; i < log.length; i++) set.add(log[i].date);
    return set;
  }

  /** 连续打卡：今天有记录就从今天往前数，否则从昨天往前数 */
  function streakOf(log, today) {
    var set = activeDates(log);
    var cur = 0;
    var start = set.has(today) ? today : addDays(today, -1);
    var probe = start;
    while (set.has(probe)) {
      cur++;
      probe = addDays(probe, -1);
    }

    var best = 0, run = 0, prev = null;
    var dates = Array.from(set).sort();
    for (var i = 0; i < dates.length; i++) {
      if (prev && diffDays(prev, dates[i]) === 1) run++;
      else run = 1;
      if (run > best) best = run;
      prev = dates[i];
    }
    return { current: cur, best: best, todayActive: set.has(today) };
  }

  function stats(log, chapters, settings, today) {
    var built = chapterStates(log, chapters, settings);
    var started = 0, mastered = 0, reviewTotal = 0, learnTotal = 0, lapses = 0;
    var i, ch, st;

    for (i = 0; i < chapters.length; i++) {
      ch = chapters[i];
      st = built.map.get(ch.id);
      if (st.stage >= 0) started++;
      if (st.stage >= 0 && st.nextDue === null) mastered++;
      lapses += st.lapses;
    }
    for (i = 0; i < log.length; i++) {
      if (log[i].kind === KIND_REVIEW) reviewTotal++;
      else if (log[i].kind === KIND_LEARN) learnTotal++;
    }

    var bySubject = {};
    for (i = 0; i < chapters.length; i++) {
      ch = chapters[i];
      st = built.map.get(ch.id);
      var s = bySubject[ch.subject] || (bySubject[ch.subject] = { total: 0, started: 0, mastered: 0 });
      s.total++;
      if (st.stage >= 0) s.started++;
      if (st.stage >= 0 && st.nextDue === null) s.mastered++;
    }

    var todayReviews = 0, todayLearns = 0;
    for (i = 0; i < log.length; i++) {
      if (log[i].date !== today) continue;
      if (log[i].kind === KIND_REVIEW) todayReviews++;
      else if (log[i].kind === KIND_LEARN) todayLearns++;
    }

    var streak = streakOf(log, today);
    var recent = [];
    for (i = 13; i >= 0; i--) {
      var key = addDays(today, -i);
      var c = 0;
      for (var j = 0; j < log.length; j++) if (log[j].date === key) c++;
      recent.push({ date: key, count: c });
    }

    return {
      total: chapters.length,
      started: started,
      mastered: mastered,
      untouched: chapters.length - started,
      reviewTotal: reviewTotal,
      learnTotal: learnTotal,
      lapses: lapses,
      avgStage: averageStage(built.map, chapters, built.intervals),
      bySubject: bySubject,
      todayReviews: todayReviews,
      todayLearns: todayLearns,
      streak: streak,
      recent: recent,
      intervals: built.intervals
    };
  }

  function averageStage(map, chapters, intervals) {
    var sum = 0, n = 0;
    for (var i = 0; i < chapters.length; i++) {
      var st = map.get(chapters[i].id);
      if (!st || st.stage < 0) continue;
      sum += Math.min(st.stage, intervals.length);
      n++;
    }
    return n ? sum / n : 0;
  }

  /* ---------------- 遗忘曲线（可视化用） ---------------- */

  /**
   * 计算保持率曲线采样点。
   * R(t) = r0 * exp(-(t - t_event) / tau)，每次复习把 tau 拉长。
   */
  function retentionSeries(progress, today, daysAhead) {
    var events = (progress.history || []).filter(function (e) {
      return e.kind === KIND_LEARN || e.kind === KIND_REVIEW;
    });
    if (!events.length) return null;

    var start = events[0].date;
    var end = addDays(today, daysAhead == null ? 21 : daysAhead);
    var span = Math.max(1, diffDays(start, end));

    var marks = [];
    var tau = 1.2, r0 = 1;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.kind === KIND_LEARN) { tau = 1.2; r0 = 1; }
      else if (e.quality === GOOD) { tau = Math.min(tau * 1.9, 90); r0 = 0.93; }
      else if (e.quality === FUZZY) { tau = Math.min(tau * 1.2, 90); r0 = 0.72; }
      else { tau = 1.0; r0 = 0.45; }
      marks.push({ t: diffDays(start, e.date), tau: tau, r0: r0, event: e });
    }

    var pts = [];
    var stepCount = Math.min(720, Math.max(60, span * 12));
    var mi = 0;
    var curTau = marks[0].tau, curR0 = marks[0].r0;
    for (var s = 0; s <= stepCount; s++) {
      var t = (span * s) / stepCount;
      while (mi + 1 < marks.length && marks[mi + 1].t <= t) {
        mi++;
        curTau = marks[mi].tau;
        curR0 = marks[mi].r0;
      }
      var dt = t - marks[mi].t;
      var r = dt < 0 ? 1 : curR0 * Math.exp(-dt / curTau);
      pts.push({ t: t, r: Math.max(0, Math.min(1, r)) });
    }

    return {
      start: start,
      end: end,
      span: span,
      points: pts,
      marks: marks.map(function (m) { return { t: m.t, date: addDays(start, Math.round(m.t)), event: m.event }; }),
      todayT: diffDays(start, today)
    };
  }

  return {
    DAY: DAY,
    DEFAULT_INTERVALS: DEFAULT_INTERVALS,
    KIND_LEARN: KIND_LEARN,
    KIND_REVIEW: KIND_REVIEW,
    GOOD: GOOD,
    FUZZY: FUZZY,
    BAD: BAD,

    toKey: toKey,
    parseKey: parseKey,
    todayKey: todayKey,
    addDays: addDays,
    diffDays: diffDays,
    weekdayCN: weekdayCN,
    fmtCN: fmtCN,
    humanDate: humanDate,
    uid: uid,
    normalizeIntervals: normalizeIntervals,

    chapterStates: chapterStates,
    statusOf: statusOf,
    statusText: statusText,
    dueQueue: dueQueue,
    projectQueue: projectQueue,
    stats: stats,
    streakOf: streakOf,
    retentionSeries: retentionSeries
  };
});
