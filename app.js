/*!
 * 408 复习曲线 — 界面逻辑
 */
(function () {
  'use strict';

  var S = window.Scheduler;
  var PRESET = window.CHAPTER_PRESETS;
  var STORE_KEY = 'kaoyan408.curve.v1';

  var SUBJECTS = PRESET.subjects;
  var SUBJECT_KEYS = {};
  SUBJECTS.forEach(function (s) { SUBJECT_KEYS[s.name] = s.key; });

  var QUALITY_LABEL = { good: '记住了', fuzzy: '有点模糊', bad: '忘了' };
  var MASTERY_LABEL = { rusty: '生疏', ok: '一般', solid: '熟练' };

  var ICONS = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M8 14h3M8 17.2h6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H19v14.4H6.2A2.2 2.2 0 0 0 4 19.6z"/><path d="M4 19.6A2.2 2.2 0 0 1 6.2 17.4H19V21H6.2A2.2 2.2 0 0 1 4 18.8z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20v-6M12 20V5M19 20v-9"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h9M17.5 7H20M4 17h3M11.5 17H20"/><circle cx="15" cy="7" r="2.4"/><circle cx="9" cy="17" r="2.4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 12.5h9L17.5 7"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h9.5a4.5 4.5 0 1 1 0 9H8"/><path d="M7.5 5.5 4 9l3.5 3.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>'
  };

  /* ==================== 工具 ==================== */

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function subjectKey(name) { return SUBJECT_KEYS[name] || 'ds'; }
  function subjectColor(name) { return 'var(--' + subjectKey(name) + ')'; }
  function chapterById(id) {
    for (var i = 0; i < state.chapters.length; i++) if (state.chapters[i].id === id) return state.chapters[i];
    return null;
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2100);
  }

  function buzz(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ==================== 状态 ==================== */

  function defaultSettings() {
    return {
      examDate: '2026-12-27',
      intervals: [1, 2, 4, 7, 15, 30],
      dailyGoal: 2,
      sprintDays: 10,
      theme: 'auto'
    };
  }

  function defaultState() {
    return {
      version: 1,
      settings: defaultSettings(),
      chapters: PRESET.chapters.map(function (c, i) {
        return { id: c.id, subject: c.subject, name: c.name, tip: c.tip || '', builtin: true, order: i };
      }),
      log: [],
      ui: { tab: 'today', subjectFilter: 'all' }
    };
  }

  function normalize(raw) {
    var base = defaultState();
    if (!raw || typeof raw !== 'object') return base;

    var out = {
      version: 1,
      settings: Object.assign(defaultSettings(), raw.settings || {}),
      chapters: Array.isArray(raw.chapters) && raw.chapters.length
        ? raw.chapters.filter(function (c) { return c && c.id && c.name && c.subject; }).map(function (c, i) {
            return {
              id: String(c.id),
              subject: String(c.subject),
              name: String(c.name),
              tip: c.tip ? String(c.tip) : '',
              builtin: !!c.builtin,
              order: typeof c.order === 'number' ? c.order : i
            };
          })
        : base.chapters,
      log: Array.isArray(raw.log) ? raw.log.filter(function (e) {
        return e && e.chapterId && e.date && (e.kind === 'learn' || e.kind === 'review');
      }) : [],
      ui: Object.assign({ tab: 'today', subjectFilter: 'all' }, raw.ui || {})
    };
    out.settings.intervals = S.normalizeIntervals(out.settings.intervals);
    if (!out.chapters.length) out.chapters = base.chapters;
    return out;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('保存失败：浏览器存储可能已满'); }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? normalize(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }

  var state = load() || defaultState();
  state.chapters.sort(function (a, b) { return a.order - b.order; });

  /* ==================== 派生数据 ==================== */

  var view = null;
  var renderedTab = null;
  var sheetState = null;

  function derive() {
    var today = S.todayKey();
    var q = S.dueQueue(state.log, state.chapters, state.settings, today);
    var st = S.stats(state.log, state.chapters, state.settings, today);
    var exam = state.settings.examDate;
    return {
      today: today,
      q: q,
      stats: st,
      intervals: q.intervals,
      examDays: exam ? S.diffDays(today, exam) : null
    };
  }

  /** 今天的事件，按时间倒序 */
  function todayEvents(kind) {
    return state.log.filter(function (e) {
      return e.date === view.today && (!kind || e.kind === kind);
    }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  }

  function sprintList() {
    var examDays = view.examDays;
    var win = state.settings.sprintDays || 10;
    if (examDays === null || examDays < 0 || examDays > win) return [];
    var inQueue = {};
    view.q.overdue.concat(view.q.due).forEach(function (x) { inQueue[x.chapter.id] = 1; });
    todayEvents('review').forEach(function (e) { inQueue[e.chapterId] = 1; });

    var list = [];
    state.chapters.forEach(function (ch) {
      if (inQueue[ch.id]) return;
      var st = view.q.map.get(ch.id);
      if (!st || st.stage < 0 || st.nextDue === null) return;
      list.push({ chapter: ch, progress: st, status: { code: 'sprint' } });
    });
    list.sort(function (a, b) {
      return String(a.progress.lastAt || '').localeCompare(String(b.progress.lastAt || ''));
    });
    return list;
  }

  /* ==================== 渲染 ==================== */

  function render() {
    view = derive();
    applyTheme();

    var header = $('#appHeader');
    header.innerHTML = headerHTML();

    var keepScroll = renderedTab === state.ui.tab;
    var y = window.scrollY;
    var main = $('#appMain');
    if (state.ui.tab === 'today') main.innerHTML = viewToday();
    else if (state.ui.tab === 'chapters') main.innerHTML = viewChapters();
    else if (state.ui.tab === 'stats') main.innerHTML = viewStats();
    else main.innerHTML = viewSettings();

    renderTabbar();

    if (keepScroll) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
    renderedTab = state.ui.tab;

    if (sheetState && sheetState.type === 'detail') drawSheet();

    requestAnimationFrame(drawCanvases);
  }

  function headerHTML() {
    var days = view.examDays;
    var badge;
    if (days === null) badge = '<div class="countdown muted">未设考期</div>';
    else if (days < 0) badge = '<div class="countdown muted">考试已过 ' + (-days) + ' 天</div>';
    else badge = '<div class="countdown' + (days <= 30 ? ' urgent' : '') + '">距初试 <b>' + days + '</b> 天</div>';

    return '<div class="hd-left">' +
      '<div class="hd-title">408 复习曲线</div>' +
      '<div class="hd-sub">' + S.fmtCN(view.today, view.today) + ' · 周' + S.weekdayCN(view.today) + '</div>' +
      '</div>' + badge;
  }

  function renderTabbar() {
    var tabs = [
      { key: 'today', name: '今日', icon: ICONS.today },
      { key: 'chapters', name: '章节', icon: ICONS.book },
      { key: 'stats', name: '统计', icon: ICONS.chart },
      { key: 'settings', name: '设置', icon: ICONS.gear }
    ];
    $('#tabbar').innerHTML = tabs.map(function (t) {
      return '<button class="tab' + (state.ui.tab === t.key ? ' on' : '') + '" data-act="tab" data-tab="' + t.key + '">' +
        t.icon + '<span>' + t.name + '</span></button>';
    }).join('');
  }


  /* ---------------- 今日 ---------------- */

  function ringHTML(done, total) {
    var C = 238.76;
    var pct = total ? Math.min(1, done / total) : 0;
    return '<div class="ring-wrap">' +
      '<svg class="ring" viewBox="0 0 84 84">' +
      '<circle class="ring-bg" cx="42" cy="42" r="38"/>' +
      '<circle class="ring-fg" cx="42" cy="42" r="38" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C - C * pct).toFixed(1) + '"/>' +
      '</svg>' +
      '<div class="ring-center"><b>' + done + '<span style="font-size:12px;color:var(--text-3);font-weight:500">/' + total + '</span></b><span>今日复习</span></div>' +
      '</div>';
  }

  function viewToday() {
    var overdue = view.q.overdue;
    var due = view.q.due;
    var reviewed = todayEvents('review');
    var learned = todayEvents('learn');
    var sprint = sprintList();

    var pending = overdue.length + due.length;
    var total = pending + reviewed.length;
    var done = reviewed.length;

    var html = '';

    /* 概览卡 */
    var streak = view.stats.streak;
    var meta = [];
    if (pending === 0 && done === 0) meta.push('今天暂无复习任务');
    else if (pending === 0) meta.push('今日复习已清空');
    else meta.push('还有 ' + pending + ' 章待复习');
    if (done) meta.push('已完成 ' + done + ' 章');

    html += '<section class="card hero">' +
      '<div class="hero-body">' +
      '<div class="hero-eyebrow">' + (streak.current > 0 ? '连续第 ' + streak.current + ' 天' : '开始你的第一天') + '</div>' +
      '<div class="hero-main">' + greeting() + '</div>' +
      '<div class="hero-meta">' + meta.join('<span class="dot"></span>') + '</div>' +
      '</div>' +
      ringHTML(done, total) +
      '</section>' +
      '<button class="hero-cta" data-act="record"><span style="font-size:17px;line-height:1;font-weight:400">＋</span>记录学习</button>';

    /* 逾期 */
    if (overdue.length) {
      html += sectionHead('逾期未复习', overdue.length, true);
      overdue.forEach(function (item) { html += reviewCardHTML(item, {}); });
    }

    /* 今日到期 */
    if (due.length) {
      html += sectionHead('今天该复习', due.length, false);
      due.forEach(function (item) { html += reviewCardHTML(item, {}); });
    }

    /* 考前冲刺 */
    if (sprint.length) {
      html += sectionHead('考前冲刺 · 全部过一遍', sprint.length, false, '剩余 ' + view.examDays + ' 天');
      sprint.forEach(function (item) { html += reviewCardHTML(item, { sprint: true }); });
    }

    /* 今日已复习 */
    if (reviewed.length) {
      html += sectionHead('今天已复习', reviewed.length, false);
      html += '<div class="card">' + reviewed.map(function (e) {
        var ch = chapterById(e.chapterId);
        if (!ch) return '';
        var cls = e.quality === 'good' ? 'ok' : (e.quality === 'fuzzy' ? 'warn' : 'bad');
        return '<div class="row">' +
          '<div class="row-icon ' + (e.quality === 'good' ? 'ok' : '') + '" style="color:' + (e.quality === 'good' ? '' : (e.quality === 'fuzzy' ? 'var(--warn)' : 'var(--bad)')) + '">' +
          (e.quality === 'good' ? '✓' : (e.quality === 'fuzzy' ? '~' : '×')) + '</div>' +
          '<div class="row-main"><div class="row-title">' + esc(ch.name) + '</div>' +
          '<div class="row-sub">' + esc(ch.subject) + ' · ' + QUALITY_LABEL[e.quality] + ' · ' + hhmm(e.at) + '</div></div>' +
          '<button class="icon-btn" data-act="undo" data-event="' + e.id + '" aria-label="撤销">' + ICONS.undo + '</button>' +
          '</div>';
      }).join('') + '</div>';
    }

    /* 今日新学 */
    if (learned.length) {
      html += sectionHead('今天新学', learned.length, false);
      html += '<div class="card">' + learned.map(function (e) {
        var ch = chapterById(e.chapterId);
        if (!ch) return '';
        var sub = esc(ch.subject) + ' · 熟练度 ' + (MASTERY_LABEL[e.mastery] || '一般');
        if (e.note) sub += ' · ' + esc(e.note);
        return '<div class="row">' +
          '<div class="row-icon"><i style="width:9px;height:9px;border-radius:50%;background:' + subjectColor(ch.subject) + '"></i></div>' +
          '<div class="row-main"><div class="row-title">' + esc(ch.name) + '</div>' +
          '<div class="row-sub">' + sub + '</div></div>' +
          '<button class="icon-btn" data-act="undo" data-event="' + e.id + '" aria-label="撤销">' + ICONS.undo + '</button>' +
          '</div>';
      }).join('') + '</div>';
    }

    /* 空状态 */
    if (!overdue.length && !due.length && !sprint.length && !learned.length && !reviewed.length) {
      html += '<div class="card empty">' +
        '<div class="empty-emoji">📖</div>' +
        '<div class="empty-title">今天还没有记录</div>' +
        '<div class="empty-desc">学完一章就点上面的「记录学习」<br>系统会按艾宾浩斯曲线自动排出复习计划</div>' +
        '</div>';
    } else if (!overdue.length && !due.length && !sprint.length) {
      html += '<div class="card empty">' +
        '<div class="empty-emoji">🌤</div>' +
        '<div class="empty-title">今天的复习清空了</div>' +
        '<div class="empty-desc">可以继续往后学新章节<br>或者去「章节」里看看接下来的安排</div>' +
        '</div>';
    }

    return html;
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 6) return '还在学，辛苦了';
    if (h < 11) return '早上好，先过一遍昨天的';
    if (h < 14) return '中午好';
    if (h < 19) return '下午好，继续推进';
    return '晚上好，收个尾';
  }

  function sectionHead(title, n, warn, right) {
    return '<div class="section-head">' +
      '<div class="section-title' + (warn ? ' warn' : '') + '">' + esc(title) +
      (n != null ? '<span class="n">' + n + '</span>' : '') + '</div>' +
      (right ? '<div class="section-link" style="color:var(--text-3)">' + esc(right) + '</div>' : '') +
      '</div>';
  }

  function reviewCardHTML(item, opts) {
    var ch = item.chapter;
    var st = item.progress;
    var status = item.status;
    var total = view.intervals.length;
    var stageNo = Math.min(st.stage + 1, total);

    var pill;
    if (status.code === 'overdue') pill = '<span class="pill overdue">逾期 ' + status.days + ' 天</span>';
    else if (status.code === 'due') pill = '<span class="pill due">今天</span>';
    else if (status.code === 'sprint') pill = '<span class="pill sprint">冲刺</span>';
    else pill = '<span class="pill upcoming">' + S.statusText(status) + '</span>';

    return '<article class="card review-card" style="--subject:' + subjectColor(ch.subject) + '">' +
      '<div class="rc-top"><div class="rc-title">' +
      '<div class="rc-name">' + esc(ch.name) + '</div>' +
      '<div class="rc-sub"><span>' + esc(ch.subject) + '</span><span class="sep">·</span>' +
      '<span>第 ' + stageNo + '/' + total + ' 次复习</span><span class="sep">·</span>' + pill +
      '</div></div></div>' +
      '<div class="rc-actions">' +
      '<button class="grade bad" data-act="grade" data-id="' + ch.id + '" data-q="bad">忘了</button>' +
      '<button class="grade fuzzy" data-act="grade" data-id="' + ch.id + '" data-q="fuzzy">模糊</button>' +
      '<button class="grade good" data-act="grade" data-id="' + ch.id + '" data-q="good">记住了</button>' +
      '</div></article>';
  }

  function relDays(due) {
    var n = S.diffDays(view.today, due);
    if (n < 0) return '已逾期 ' + (-n) + ' 天';
    if (n === 0) return '就是今天';
    return '还有 ' + n + ' 天';
  }

  function hhmm(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* ---------------- 章节 ---------------- */

  function viewChapters() {
    var filter = state.ui.subjectFilter || 'all';
    var chips = [{ key: 'all', name: '全部', color: '' }].concat(SUBJECTS.map(function (s) {
      return { key: s.name, name: s.name, color: 'var(--' + s.key + ')' };
    }));

    var html = '<div class="filter-bar">' + chips.map(function (c) {
      var on = (filter === 'all' ? c.key === 'all' : c.key === filter);
      return '<button class="chip' + (on ? ' on' : '') + '" data-act="filter" data-key="' + esc(c.key) + '">' +
        (c.color && !on ? '<i class="c" style="background:' + c.color + '"></i>' : '') + esc(c.name) + '</button>';
    }).join('') + '</div>';

    var groups = SUBJECTS.filter(function (s) { return filter === 'all' || s.name === filter; });

    groups.forEach(function (subject) {
      var chapters = state.chapters.filter(function (c) { return c.subject === subject.name; });
      var started = 0, mastered = 0;
      chapters.forEach(function (ch) {
        var st = view.q.map.get(ch.id);
        if (st && st.stage >= 0) started++;
        if (st && st.stage >= 0 && st.nextDue === null) mastered++;
      });
      var pct = chapters.length ? Math.round((started / chapters.length) * 100) : 0;

      html += '<section class="card subject-card">' +
        '<div class="subject-head"><div class="bar-wrap">' +
        '<div class="subject-name"><i class="c" style="background:var(--' + subject.key + ')"></i>' + esc(subject.name) +
        '<span class="subject-count">' + started + '/' + chapters.length + '</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%;background:var(--' + subject.key + ')"></i></div>' +
        '</div>' +
        '<button class="icon-btn" data-act="record" data-subject="' + esc(subject.name) + '" aria-label="添加学习记录">' + ICONS.plus + '</button>' +
        '</div>';

      chapters.forEach(function (ch) {
        var st = view.q.map.get(ch.id);
        var status = S.statusOf(st, view.today, view.intervals);
        var pillCls = 'new', pillTxt = '未学';
        if (status.code === 'mastered') { pillCls = 'mastered'; pillTxt = '已掌握'; }
        else if (status.code === 'overdue') { pillCls = 'overdue'; pillTxt = '逾期 ' + status.days + ' 天'; }
        else if (status.code === 'due') { pillCls = 'due'; pillTxt = '今天'; }
        else if (status.code === 'upcoming') { pillCls = 'upcoming'; pillTxt = S.fmtCN(status.due, view.today); }

        html += '<button class="ch-row' + (st && st.stage >= 0 ? ' done' : '') + '" data-act="detail" data-id="' + ch.id + '">' +
          '<span class="ch-name">' + esc(ch.name) + '</span>' +
          (ch.tip ? '<span class="ch-tip">' + esc(ch.tip) + '</span>' : '') +
          '<span class="pill ' + pillCls + '">' + pillTxt + '</span>' +
          '</button>';
      });

      html += '<button class="ch-row" data-act="addChapter" data-subject="' + esc(subject.name) + '" style="color:var(--text-3)">' +
        '<span class="ch-name" style="color:var(--text-3);font-weight:500">＋ 新增章节</span></button>';
      html += '</section>';
    });

    return html;
  }

  /* ---------------- 统计 ---------------- */

  function viewStats() {
    var st = view.stats;
    var html = '';

    html += '<div class="stat-grid" style="margin-top:14px">' +
      statCell(st.started + '<small>/' + st.total + '</small>', '已学章节') +
      statCell(st.mastered, '已掌握') +
      statCell(st.reviewTotal, '累计复习次数') +
      statCell(st.streak.current + '<small>天</small>', '连续打卡') +
      '</div>';

    /* 14 天活动 */
    var max = 1;
    st.recent.forEach(function (d) { if (d.count > max) max = d.count; });
    html += '<section class="card chart-card" style="margin-top:12px">' +
      '<div class="chart-head"><div class="chart-title">最近 14 天</div>' +
      '<div class="tiny muted">最长连续 ' + st.streak.best + ' 天</div></div>' +
      '<div class="bars">' + st.recent.map(function (d) {
        var h = Math.round((d.count / max) * 100);
        var isToday = d.date === view.today;
        return '<div class="b' + (d.count ? ' has' : '') + (isToday ? ' today' : '') + '">' +
          '<i style="height:' + (d.count ? Math.max(6, h) : 3) + '%"></i>' +
          '<span>' + (isToday ? '今' : S.parseKey(d.date).getDate()) + '</span></div>';
      }).join('') + '</div>' +
      '</section>';

    /* 分科进度 */
    html += sectionHead('分科进度', null, false);
    html += '<div class="card" style="padding:15px">';
    SUBJECTS.forEach(function (s, i) {
      var d = st.bySubject[s.name] || { total: 0, started: 0, mastered: 0 };
      var pct = d.total ? Math.round((d.started / d.total) * 100) : 0;
      html += '<div style="' + (i ? 'margin-top:14px' : '') + '">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">' +
        '<span style="font-weight:600">' + esc(s.name) + '</span>' +
        '<span class="tiny muted num">' + d.started + '/' + d.total + ' · 掌握 ' + d.mastered + '</span>' +
        '</div>' +
        '<div class="bar"><i style="width:' + pct + '%;background:var(--' + s.key + ')"></i></div>' +
        '</div>';
    });
    html += '</div>';

    /* 遗忘曲线对比 */
    html += sectionHead('遗忘曲线', null, false);
    html += '<div class="card chart-card">' +
      '<div class="chart-head"><div class="chart-title">复习 vs 不复习</div></div>' +
      '<div class="chart-legend">' +
      '<span><i style="background:' + 'var(--text-3)' + '"></i>不复习</span>' +
      '<span><i style="background:' + 'var(--accent)' + '"></i>按 1/2/4/7/15/30 天复习</span>' +
      '</div>' +
      '<canvas id="compareCanvas" style="height:130px;margin-top:6px"></canvas>' +
      '</div>';

    /* 其他 */
    html += '<section class="card" style="margin-top:12px;padding:4px 15px">' +
      statRow('累计学习记录', st.learnTotal + ' 次') +
      statRow('平均复习进度', st.avgStage.toFixed(1) + ' / ' + st.intervals.length) +
      statRow('遗忘次数', st.lapses + ' 次') +
      '</section>';

    return html;
  }

  function statCell(val, label) {
    return '<div class="card stat-cell"><div class="stat-val">' + val + '</div>' +
      '<div class="stat-label">' + esc(label) + '</div></div>';
  }

  function statRow(label, value) {
    return '<div class="setting"><div class="setting-main"><div class="setting-label" style="font-weight:500">' +
      esc(label) + '</div></div><div class="num tiny muted">' + esc(value) + '</div></div>';
  }

  /* ---------------- 设置 ---------------- */

  function schedulePoints(arr) {
    var t = 0;
    return arr.map(function (v) { t += v; return t; });
  }

  function viewSettings() {
    var s = state.settings;
    var points = schedulePoints(S.normalizeIntervals(s.intervals));

    return '<div class="setting-group" style="margin-top:14px">' +
      '<div class="setting-group-title">考研信息</div>' +
      '<div class="card">' +
      settingRow('初试日期', '用于倒计时与考前冲刺', '<input type="date" data-setting="examDate" value="' + esc(s.examDate || '') + '">') +
      settingRow('考前冲刺', '最后 N 天把所有章节过一遍', '<input type="number" min="1" max="60" data-setting="sprintDays" value="' + (s.sprintDays || 10) + '">') +
      '</div></div>' +

      '<div class="setting-group">' +
      '<div class="setting-group-title">复习节奏</div>' +
      '<div class="card">' +
      '<div class="setting wide"><div class="setting-main">' +
      '<div class="setting-label">复习间隔（天）</div>' +
      '<div class="setting-hint">用逗号分隔。当前计划：第 ' + points.join('、') + ' 天复习</div>' +
      '<input type="text" data-setting="intervals" value="' + esc(S.normalizeIntervals(s.intervals).join(',')) + '" inputmode="numeric">' +
      '</div></div>' +
      settingRow('每日目标', '每天新学几章（仅作参考）', '<input type="number" min="1" max="20" data-setting="dailyGoal" value="' + (s.dailyGoal || 2) + '">') +
      '</div></div>' +

      '<div class="setting-group">' +
      '<div class="setting-group-title">外观</div>' +
      '<div class="card">' +
      settingRow('主题', '', '<select data-setting="theme">' +
        opt('auto', '跟随系统', s.theme) + opt('light', '浅色', s.theme) + opt('dark', '深色', s.theme) +
        '</select>') +
      '</div></div>' +

      '<div class="setting-group">' +
      '<div class="setting-group-title">数据</div>' +
      '<div class="card" style="padding:12px 15px">' +
      '<button class="btn-line" data-act="export">导出备份（JSON）</button>' +
      '<button class="btn-line" data-act="import" style="margin-top:9px">从备份恢复</button>' +
      '<button class="btn-line danger" data-act="reset" style="margin-top:9px">清空全部记录</button>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '</div>' +
      '<div class="setting-hint" style="padding:9px 4px 0">数据只保存在这台设备的浏览器里，不会上传。建议每周导出一次备份。</div>' +
      '</div>' +

      '<div class="about">408 复习曲线 v1.0<br>' +
      '共 ' + state.chapters.length + ' 章 · ' + state.log.length + ' 条记录<br>' +
      '复习间隔基于艾宾浩斯遗忘曲线</div>';
  }

  function settingRow(label, hint, control) {
    return '<div class="setting"><div class="setting-main">' +
      '<div class="setting-label">' + esc(label) + '</div>' +
      (hint ? '<div class="setting-hint">' + esc(hint) + '</div>' : '') +
      '</div>' + control + '</div>';
  }

  function opt(value, label, current) {
    return '<option value="' + value + '"' + (current === value ? ' selected' : '') + '>' + label + '</option>';
  }

  /* ==================== 画布 ==================== */

  function drawCanvases() {
    var curve = $('#curveCanvas');
    if (curve && curve.dataset.chapter) drawChapterCurve(curve, curve.dataset.chapter);
    var compare = $('#compareCanvas');
    if (compare) drawCompareCurve(compare);
  }

  function prepCanvas(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 300;
    var h = canvas.clientHeight || 130;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function drawChapterCurve(canvas, chapterId) {
    var st = view.q.map.get(chapterId);
    if (!st) return;
    var series = S.retentionSeries(st, view.today, 21);
    var p = prepCanvas(canvas);
    var ctx = p.ctx, w = p.w, h = p.h;

    var padL = 30, padR = 10, padT = 12, padB = 22;
    var iw = w - padL - padR, ih = h - padT - padB;

    var ink = cssVar('--text-3') || '#999';
    var grid = cssVar('--border-strong') || '#ddd';
    var accent = cssVar('--accent') || '#5348e0';
    var bad = cssVar('--bad') || '#df3f4a';

    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = ink;
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;

    /* 网格 */
    [1, 0.5, 0].forEach(function (v) {
      var y = padT + ih * (1 - v);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.globalAlpha = v === 0 ? 0.9 : 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(v * 100) + '%', 2, y);
    });

    if (!series) {
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.fillText('还没有学习记录', w / 2, h / 2);
      return;
    }

    var xOf = function (t) { return padL + (t / series.span) * iw; };
    var yOf = function (r) { return padT + ih * (1 - r); };

    /* 曲线填充 */
    var grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
    grad.addColorStop(0, hexA(accent, 0.22));
    grad.addColorStop(1, hexA(accent, 0.01));
    ctx.beginPath();
    ctx.moveTo(xOf(series.points[0].t), yOf(series.points[0].r));
    series.points.forEach(function (pt) { ctx.lineTo(xOf(pt.t), yOf(pt.r)); });
    ctx.lineTo(xOf(series.span), padT + ih);
    ctx.lineTo(xOf(0), padT + ih);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    /* 曲线 */
    ctx.beginPath();
    series.points.forEach(function (pt, i) {
      var x = xOf(pt.t), y = yOf(pt.r);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    /* 今天 */
    if (series.todayT >= 0 && series.todayT <= series.span) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = bad;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(xOf(series.todayT), padT);
      ctx.lineTo(xOf(series.todayT), padT + ih);
      ctx.stroke();
      ctx.restore();
    }

    /* 复习点 */
    series.marks.forEach(function (m) {
      var x = xOf(m.t), y = yOf(1);
      var past = m.t <= series.todayT;
      ctx.beginPath();
      ctx.arc(x, y, past ? 3 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = past ? accent : (cssVar('--surface') || '#fff');
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });

    /* 日期轴 */
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var ticks = 3;
    for (var i = 0; i <= ticks; i++) {
      var t = (series.span * i) / ticks;
      var label = S.fmtCN(S.addDays(series.start, Math.round(t)), view.today).replace('月', '/').replace('日', '');
      var x = xOf(t);
      ctx.textAlign = i === 0 ? 'left' : (i === ticks ? 'right' : 'center');
      ctx.fillText(label, x, padT + ih + 6);
    }
  }

  function drawCompareCurve(canvas) {
    var p = prepCanvas(canvas);
    var ctx = p.ctx, w = p.w, h = p.h;
    var padL = 30, padR = 10, padT = 10, padB = 22;
    var iw = w - padL - padR, ih = h - padT - padB;
    var days = 30;

    var ink = cssVar('--text-3') || '#999';
    var grid = cssVar('--border-strong') || '#ddd';
    var accent = cssVar('--accent') || '#5348e0';
    var dim = cssVar('--text-2') || '#999';

    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.strokeStyle = grid;
    ctx.fillStyle = ink;
    ctx.lineWidth = 1;

    [1, 0.5, 0].forEach(function (v) {
      var y = padT + ih * (1 - v);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.globalAlpha = v === 0 ? 0.9 : 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(v * 100) + '%', 2, y);
    });

    var xOf = function (t) { return padL + (t / days) * iw; };
    var yOf = function (r) { return padT + ih * (1 - r); };

    /* 不复习 */
    ctx.beginPath();
    for (var t = 0; t <= days; t += 0.25) {
      var x = xOf(t), y = yOf(Math.exp(-t / 1.2));
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = dim;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    /* 按计划复习 */
    var points = schedulePoints(S.normalizeIntervals(state.settings.intervals));
    var tau = 1.2, r0 = 1, idx = 0;
    ctx.beginPath();
    for (var t2 = 0; t2 <= days; t2 += 0.2) {
      while (idx < points.length && points[idx] <= t2) {
        tau = Math.min(tau * 1.9, 90);
        r0 = 0.93;
        idx++;
      }
      var lastReview = idx > 0 ? points[idx - 1] : 0;
      var r = t2 < lastReview ? 1 : r0 * Math.exp(-(t2 - lastReview) / tau);
      var xx = xOf(t2), yy = yOf(Math.max(0, Math.min(1, r)));
      if (t2 === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    /* 复习点 */
    points.forEach(function (d) {
      if (d > days) return;
      ctx.beginPath();
      ctx.arc(xOf(d), yOf(0.93), 3, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    });

    /* 轴 */
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    [0, 10, 20, 30].forEach(function (d) {
      ctx.textAlign = d === 0 ? 'left' : (d === 30 ? 'right' : 'center');
      ctx.fillText(d + '天', xOf(d), padT + ih + 6);
    });
  }

  /** 把 #rrggbb 或 var() 解析出的颜色转成带透明度的 rgba */
  function hexA(color, alpha) {
    var c = String(color).trim();
    if (c.indexOf('#') === 0) {
      if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      var r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
    return c;
  }

  /* ==================== 弹层 ==================== */

  function openSheet(type, ctx) {
    sheetState = Object.assign({ type: type }, ctx || {});
    var root = $('#sheetRoot');
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    drawSheet();
    requestAnimationFrame(function () { root.classList.add('show'); });
  }

  function closeSheet() {
    var root = $('#sheetRoot');
    root.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (!root.classList.contains('show')) {
        root.hidden = true;
        root.innerHTML = '';
      }
    }, 240);
    sheetState = null;
  }

  function drawSheet() {
    if (!sheetState) return;
    var root = $('#sheetRoot');
    var html = '';
    if (sheetState.type === 'record') html = recordSheetHTML();
    else if (sheetState.type === 'detail') html = detailSheetHTML();
    else if (sheetState.type === 'addChapter') html = addChapterHTML();
    else if (sheetState.type === 'help') html = helpSheetHTML();

    root.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' +
      '<div class="sheet-grip"></div>' + html + '</div>';
    requestAnimationFrame(drawCanvases);
  }

  function sheetHeadHTML(title) {
    return '<div class="sheet-head"><div class="sheet-title">' + esc(title) + '</div>' +
      '<button class="sheet-close" data-sheet-act="close" aria-label="关闭">✕</button></div>';
  }

  /* ---------------- 记录学习 ---------------- */

  function recordSheetHTML() {
    var ctx = sheetState;
    return sheetHeadHTML('记录学习') +
      '<div class="sheet-body">' +
      '<div class="field"><div class="field-label">科目</div>' +
      '<div class="chip-row">' +
      SUBJECTS.map(function (s) {
        return '<button class="chip' + (ctx.subject === s.name ? ' on' : '') + '" data-sheet-act="subject" data-subject="' + esc(s.name) + '">' +
          (ctx.subject === s.name ? '' : '<i class="c" style="background:var(--' + s.key + ')"></i>') + esc(s.name) + '</button>';
      }).join('') +
      '</div></div>' +

      '<div class="field"><div class="field-label">章节<span class="hint">可多选</span></div>' +
      '<div class="pick-grid" id="pickGrid">' + pickGridHTML() + '</div></div>' +

      '<div class="field"><div class="field-label">熟练度<span class="hint">熟练的章节首复习间隔更长</span></div>' +
      '<div class="seg" id="masterySeg">' +
      ['rusty', 'ok', 'solid'].map(function (m) {
        return '<button class="' + m + (ctx.mastery === m ? ' on' : '') + '" data-sheet-act="mastery" data-m="' + m + '">' +
          MASTERY_LABEL[m] + '</button>';
      }).join('') +
      '</div></div>' +

      '<div class="field"><div class="field-label">学习日期</div>' +
      '<input type="date" id="recDate" value="' + esc(ctx.date) + '" max="' + view.today + '" ' +
      'style="width:100%;padding:11px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2)"></div>' +

      '<div class="field"><div class="field-label">备注<span class="hint">可选</span></div>' +
      '<textarea class="note" id="recNote" rows="2" placeholder="比如：页数、做题情况、卡住的地方">' + esc(ctx.note) + '</textarea></div>' +
      '</div>' +

      '<div class="sheet-foot">' +
      '<button class="btn-primary" id="recSubmit" data-sheet-act="submitRecord">记录学习</button>' +
      '</div>';
  }

  function pickGridHTML() {
    var ctx = sheetState;
    var chapters = state.chapters.filter(function (c) { return c.subject === ctx.subject; });
    if (!chapters.length) return '<div class="tiny muted">这个科目还没有章节</div>';
    return chapters.map(function (ch) {
      var st = view.q.map.get(ch.id);
      var status = S.statusOf(st, view.today, view.intervals);
      var meta;
      if (status.code === 'new') meta = '未学';
      else if (status.code === 'mastered') meta = '已掌握';
      else if (status.code === 'overdue') meta = '逾期 ' + status.days + ' 天';
      else meta = '下次 ' + S.humanDate(status.due, view.today);
      return '<button class="pick' + (ctx.sel[ch.id] ? ' on' : '') + '" data-sheet-act="toggle" data-id="' + ch.id + '">' +
        esc(ch.name) + '<div class="p-sub">' + meta + '</div></button>';
    }).join('');
  }

  function updateSubmitLabel() {
    var btn = $('#recSubmit');
    if (!btn) return;
    var n = Object.keys(sheetState.sel).length;
    btn.textContent = n ? '记录学习（' + n + ' 章）' : '记录学习';
    btn.disabled = n === 0;
  }

  /* ---------------- 章节详情 ---------------- */

  function detailSheetHTML() {
    var ch = chapterById(sheetState.chapterId);
    if (!ch) return sheetHeadHTML('章节') + '<div class="sheet-body"><div class="muted tiny">章节不存在</div></div>';

    var st = view.q.map.get(ch.id) || { stage: -1, history: [], nextDue: null };
    var status = S.statusOf(st, view.today, view.intervals);
    var total = view.intervals.length;
    var stage = Math.max(0, Math.min(st.stage, total));

    var statusPill;
    if (status.code === 'new') statusPill = '<span class="pill new">未学</span>';
    else if (status.code === 'mastered') statusPill = '<span class="pill mastered">已掌握</span>';
    else if (status.code === 'overdue') statusPill = '<span class="pill overdue">逾期 ' + status.days + ' 天</span>';
    else if (status.code === 'due') statusPill = '<span class="pill due">今天复习</span>';
    else statusPill = '<span class="pill upcoming">' + S.fmtCN(status.due, view.today) + '</span>';

    var html = sheetHeadHTML('章节详情') + '<div class="sheet-body">';

    html += '<div class="detail-hero">' +
      '<div class="detail-title">' + esc(ch.name) + '</div>' +
      '<div class="detail-meta">' +
      '<span style="color:' + subjectColor(ch.subject) + ';font-weight:600">' + esc(ch.subject) + '</span>' +
      statusPill +
      (st.stage >= 0 ? '<span>已复习 ' + st.reviewCount + ' 次</span>' : '') +
      (st.lapses ? '<span style="color:var(--bad)">遗忘 ' + st.lapses + ' 次</span>' : '') +
      '</div></div>';

    /* 阶梯进度 */
    if (st.stage >= 0) {
      html += '<div class="field"><div class="field-label">复习阶梯<span class="hint">' + stage + ' / ' + total + '</span></div>' +
        '<div style="display:flex;gap:6px;margin-bottom:6px">';
      for (var i = 0; i < total; i++) {
        var on = i < stage;
        var now = i === stage && st.nextDue !== null;
        html += '<div style="flex:1;height:6px;border-radius:99px;background:' +
          (on ? 'var(--good)' : (now ? 'var(--accent)' : 'var(--surface-3)')) + '"></div>';
      }
      html += '</div><div class="tiny muted">' +
        (st.nextDue === null ? '全部复习完成' : '下次复习：' + S.fmtCN(st.nextDue, view.today) + '（' + relDays(st.nextDue) + '）') +
        '</div></div>';

      /* 曲线 */
      html += '<div class="field"><div class="field-label">记忆保持曲线<span class="hint">虚线为今天</span></div>' +
        '<canvas id="curveCanvas" data-chapter="' + ch.id + '" style="height:140px"></canvas></div>';

      /* 未来安排 */
      var future = S.projectQueue(st, state.settings, 6, view.today);
      if (future.length) {
        html += '<div class="field"><div class="field-label">接下来的复习<span class="hint">按计划完成时</span></div><div class="ladder">' +
          future.map(function (f) {
            return '<div class="ladder-step future">' +
              '<div class="ladder-dot">' + (f.stage + 1) + '</div>' +
              '<div class="ladder-body"><div class="ladder-name">第 ' + (f.stage + 1) + ' 次复习</div>' +
              '<div class="ladder-date">' + S.fmtCN(f.due, view.today) + ' · ' + relDays(f.due) + '</div></div>' +
              '</div>';
          }).join('') + '</div></div>';
      }
    }

    /* 历史 */
    var history = (st.history || []).slice().reverse();
    if (history.length) {
      html += '<div class="field"><div class="field-label">学习记录<span class="hint">共 ' + history.length + ' 条</span></div>' +
        '<div class="timeline">' + history.map(function (e) {
          var isLearn = e.kind === 'learn';
          var cls = isLearn ? 'learn' : (e.quality || '');
          var title = isLearn ? '首次学习' : QUALITY_LABEL[e.quality];
          var sub = isLearn ? ('熟练度 ' + (MASTERY_LABEL[e.mastery] || '一般')) : '';
          if (e.note) sub += (sub ? ' · ' : '') + e.note;
          return '<div class="tl-item">' +
            '<div class="tl-dot ' + cls + '"></div>' +
            '<div class="tl-body"><div class="tl-title">' + esc(title) + '</div>' +
            (sub ? '<div class="tl-sub">' + esc(sub) + '</div>' : '') + '</div>' +
            '<div class="tl-date">' + S.fmtCN(e.date, view.today) + '</div>' +
            '<button class="icon-btn" data-act="undo" data-event="' + e.id + '" aria-label="撤销">' + ICONS.undo + '</button>' +
            '</div>';
        }).join('') + '</div></div>';
    }

    html += '</div><div class="sheet-foot" style="display:flex;gap:10px">' +
      '<button class="btn-primary" data-act="record" data-id="' + ch.id + '">记录学习</button>' +
      (st.stage >= 0 ? '<button class="btn-line danger" style="width:auto;white-space:nowrap;padding:0 16px" data-act="resetChapter" data-id="' + ch.id + '">重置</button>' : '') +
      '</div>';

    return html;
  }

  /* ---------------- 新增章节 ---------------- */

  function addChapterHTML() {
    var subject = sheetState.subject;
    return sheetHeadHTML('新增章节') +
      '<div class="sheet-body">' +
      '<div class="field"><div class="field-label">科目</div>' +
      '<div class="chip-row">' +
      SUBJECTS.map(function (s) {
        return '<button class="chip' + (subject === s.name ? ' on' : '') + '" data-sheet-act="addSubject" data-subject="' + esc(s.name) + '">' +
          (subject === s.name ? '' : '<i class="c" style="background:var(--' + s.key + ')"></i>') + esc(s.name) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="field"><div class="field-label">章节名称</div>' +
      '<input type="text" id="addName" placeholder="例如：第9章 外部排序" ' +
      'style="width:100%;padding:12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2)"></div>' +
      '</div>' +
      '<div class="sheet-foot"><button class="btn-primary" data-sheet-act="submitChapter">添加</button></div>';
  }

  function helpSheetHTML() {
    return sheetHeadHTML('关于复习计划') +
      '<div class="sheet-body" style="font-size:13.5px;line-height:1.75;color:var(--text-2)">' +
      '<p style="margin-top:4px"><b style="color:var(--text)">间隔是怎么来的？</b><br>' +
      '按艾宾浩斯遗忘曲线的经典复习点：学完当天算第 0 天，之后在第 ' +
      schedulePoints(S.normalizeIntervals(state.settings.intervals)).join('、') + ' 天各复习一次。</p>' +
      '<p><b style="color:var(--text)">三个按钮的区别</b><br>' +
      '· 记住了 → 进入下一档，间隔拉长<br>' +
      '· 模糊 → 停在原档，同样的间隔再来一次<br>' +
      '· 忘了 → 退回第一档，明天重新复习</p>' +
      '<p><b style="color:var(--text)">逾期了会怎样？</b><br>' +
      '不会乱。从你实际完成的那天往后重新算，所以补上就行，不用手动改日期。</p>' +
      '<p><b style="color:var(--text)">考研 408 该怎么用</b><br>' +
      '学完一章就记一笔；每天先清「逾期」，再看「今天该复习」。' +
      '考前最后几天会自动出现「考前冲刺」列表，把所有章节过一遍。</p>' +
      '</div>';
  }

  /* ==================== 动作 ==================== */

  function grade(chapterId, quality) {
    var ch = chapterById(chapterId);
    if (!ch) return;
    state.log.push({
      id: S.uid(),
      chapterId: chapterId,
      kind: 'review',
      date: S.todayKey(),
      at: Date.now(),
      quality: quality
    });
    save();
    render();
    buzz(quality === 'good' ? 8 : 16);

    var st = S.chapterStates(state.log, state.chapters, state.settings).map.get(chapterId);
    if (st.nextDue === null) toast('《' + ch.name + '》已掌握 🎉');
    else toast(QUALITY_LABEL[quality] + ' · 下次 ' + S.humanDate(st.nextDue, S.todayKey()));
  }

  function undoEvent(eventId) {
    var idx = -1;
    for (var i = 0; i < state.log.length; i++) if (state.log[i].id === eventId) { idx = i; break; }
    if (idx < 0) return;
    state.log.splice(idx, 1);
    save();
    render();
    toast('已撤销');
  }

  function submitRecord() {
    var ctx = sheetState;
    var ids = Object.keys(ctx.sel);
    if (!ids.length) { toast('先选至少一个章节'); return; }

    var date = ctx.date || S.todayKey();
    var now = Date.now();
    ids.forEach(function (id, i) {
      state.log.push({
        id: S.uid() + i,
        chapterId: id,
        kind: 'learn',
        date: date,
        at: now + i,
        mastery: ctx.mastery,
        note: (ctx.note || '').trim()
      });
    });
    save();
    closeSheet();
    render();
    buzz(12);

    var sampleId = ids[0];
    var st = S.chapterStates(state.log, state.chapters, state.settings).map.get(sampleId);
    var msg = ids.length > 1
      ? '已记录 ' + ids.length + ' 章 · 下次 ' + S.humanDate(st.nextDue, S.todayKey())
      : '已记录 · 下次复习 ' + S.humanDate(st.nextDue, S.todayKey());
    toast(msg);
  }

  function addChapter() {
    var input = $('#addName');
    var name = (input && input.value || '').trim();
    if (!name) { toast('给章节起个名字'); return; }
    var subject = sheetState.subject;
    var maxOrder = 0;
    state.chapters.forEach(function (c) { maxOrder = Math.max(maxOrder, c.order || 0); });
    state.chapters.push({
      id: 'c' + S.uid(),
      subject: subject,
      name: name,
      tip: '',
      builtin: false,
      order: maxOrder + 1
    });
    state.chapters.sort(function (a, b) { return a.order - b.order; });
    save();
    closeSheet();
    render();
    toast('已添加《' + name + '》');
  }

  function resetChapter(chapterId) {
    var ch = chapterById(chapterId);
    if (!ch) return;
    if (!confirm('清空《' + ch.name + '》的全部学习与复习记录？')) return;
    state.log = state.log.filter(function (e) { return e.chapterId !== chapterId; });
    save();
    closeSheet();
    render();
    toast('已重置');
  }

  function exportData() {
    var payload = {
      app: '408-review-curve',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      chapters: state.chapters,
      log: state.log
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '408复习数据-' + S.todayKey() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('已导出备份');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var raw = JSON.parse(String(reader.result));
        var incoming = normalize({
          settings: raw.settings,
          chapters: raw.chapters,
          log: raw.log
        });
        if (!incoming.log.length && !incoming.chapters.length) throw new Error('empty');
        if (!confirm('用备份覆盖当前数据？\n备份含 ' + incoming.log.length + ' 条记录，当前有 ' + state.log.length + ' 条。')) return;
        state = incoming;
        state.ui = { tab: 'today', subjectFilter: 'all' };
        save();
        render();
        toast('已恢复备份');
      } catch (err) {
        toast('文件格式不对，无法恢复');
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm('清空全部学习记录？此操作不可撤销。\n建议先导出备份。')) return;
    if (!confirm('再确认一次：真的清空吗？')) return;
    state.log = [];
    save();
    render();
    toast('已清空');
  }

  function applyTheme() {
    var t = state.settings.theme || 'auto';
    var resolved = t;
    if (t === 'auto') {
      resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = resolved;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0c11' : '#f3f4f9');
  }

  /* ==================== 事件 ==================== */

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act],[data-sheet-act]') : null;
    if (!el) return;

    /* 弹层内动作 */
    if (el.dataset.sheetAct) {
      var act = el.dataset.sheetAct;

      if (act === 'close') { closeSheet(); return; }

      if (act === 'subject') {
        sheetState.subject = el.dataset.subject;
        $$('.filter-bar .chip', $('#sheetRoot')).forEach(function (b) {
          b.classList.toggle('on', b.dataset.subject === sheetState.subject);
        });
        $('#pickGrid').innerHTML = pickGridHTML();
        return;
      }

      if (act === 'toggle') {
        var id = el.dataset.id;
        if (sheetState.sel[id]) delete sheetState.sel[id];
        else sheetState.sel[id] = true;
        el.classList.toggle('on');
        updateSubmitLabel();
        return;
      }

      if (act === 'mastery') {
        sheetState.mastery = el.dataset.m;
        $$('#masterySeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === sheetState.mastery); });
        return;
      }

      if (act === 'submitRecord') { submitRecord(); return; }

      if (act === 'addSubject') {
        sheetState.subject = el.dataset.subject;
        $$('[data-sheet-act="addSubject"]').forEach(function (b) {
          b.classList.toggle('on', b.dataset.subject === sheetState.subject);
        });
        return;
      }

      if (act === 'submitChapter') { addChapter(); return; }
      return;
    }

    /* 页面动作 */
    var a = el.dataset.act;

    if (a === 'tab') {
      if (state.ui.tab === el.dataset.tab) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      state.ui.tab = el.dataset.tab;
      save();
      render();
      return;
    }

    if (a === 'grade') { grade(el.dataset.id, el.dataset.q); return; }
    if (a === 'undo') { undoEvent(el.dataset.event); return; }

    if (a === 'detail') {
      openSheet('detail', { chapterId: el.dataset.id });
      return;
    }

    if (a === 'record') {
      var presetId = el.dataset.id || null;
      var subject = el.dataset.subject;
      if (presetId) {
        var ch = chapterById(presetId);
        if (ch) subject = ch.subject;
      }
      openRecord(subject, presetId);
      return;
    }

    if (a === 'addChapter') { openSheet('addChapter', { subject: el.dataset.subject }); return; }

    if (a === 'filter') {
      state.ui.subjectFilter = el.dataset.key;
      save();
      render();
      return;
    }

    if (a === 'export') { exportData(); return; }
    if (a === 'import') { var f = $('#importFile'); if (f) f.click(); return; }
    if (a === 'reset') { resetAll(); return; }
    if (a === 'resetChapter') { resetChapter(el.dataset.id); return; }
    if (a === 'help') { openSheet('help'); return; }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'recNote') { if (sheetState) sheetState.note = t.value; return; }
    if (t.id === 'recDate') { if (sheetState) sheetState.date = t.value; return; }
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'importFile') {
      if (el.files && el.files[0]) importData(el.files[0]);
      el.value = '';
      return;
    }

    var key = el.dataset && el.dataset.setting;
    if (!key) return;

    if (key === 'examDate') {
      state.settings.examDate = el.value || null;
    } else if (key === 'intervals') {
      state.settings.intervals = S.normalizeIntervals(el.value);
    } else if (key === 'theme') {
      state.settings.theme = el.value;
    } else {
      var n = parseInt(el.value, 10);
      if (isFinite(n) && n > 0) state.settings[key] = n;
    }
    save();
    render();
    toast('已保存');
  });

  window.addEventListener('scroll', function () {
    var h = $('#appHeader');
    if (h) h.classList.toggle('scrolled', window.scrollY > 4);
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && view && view.today !== S.todayKey()) render();
  });

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if ((state.settings.theme || 'auto') === 'auto') applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  function openRecord(subject, presetId) {
    var sel = {};
    if (presetId) sel[presetId] = true;
    var fallback = SUBJECTS[0].name;
    if (state.ui.subjectFilter && state.ui.subjectFilter !== 'all' && SUBJECT_KEYS[state.ui.subjectFilter]) {
      fallback = state.ui.subjectFilter;
    }
    openSheet('record', {
      sel: sel,
      subject: subject || fallback,
      mastery: 'ok',
      note: '',
      date: S.todayKey()
    });
    updateSubmitLabel();
  }

  /* ==================== Service Worker ==================== */

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 离线缓存失败不影响使用 */ });
    });
  }

  /* ==================== 启动 ==================== */

  applyTheme();
  render();
  document.body.classList.add('booted');
  registerSW();

  // 首次使用引导：直接弹出帮助
  if (!state.log.length && !localStorage.getItem(STORE_KEY + '.seen')) {
    try { localStorage.setItem(STORE_KEY + '.seen', '1'); } catch (e) { /* ignore */ }
  }
})();
