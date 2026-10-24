/*!
 * 408 章节预设（按王道四科教材的章节划分）
 * 只提供目录骨架，方便「点两下就打卡」，不包含任何教材正文内容。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CHAPTER_PRESETS = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SUBJECTS = [
    { name: '数据结构',       key: 'ds', full: '数据结构' },
    { name: '计算机组成原理', key: 'co', full: '计算机组成原理' },
    { name: '操作系统',       key: 'os', full: '操作系统' },
    { name: '计算机网络',     key: 'cn', full: '计算机网络' }
  ];

  var CHAPTERS = [
    /* ---------- 数据结构 ---------- */
    { id: 'ds01', subject: '数据结构', name: '第1章 绪论', tip: '复杂度分析' },
    { id: 'ds02', subject: '数据结构', name: '第2章 线性表', tip: '链表大题' },
    { id: 'ds03', subject: '数据结构', name: '第3章 栈、队列和数组', tip: '' },
    { id: 'ds04', subject: '数据结构', name: '第4章 串', tip: 'KMP' },
    { id: 'ds05', subject: '数据结构', name: '第5章 树与二叉树', tip: '大题高频' },
    { id: 'ds06', subject: '数据结构', name: '第6章 图', tip: '算法大题' },
    { id: 'ds07', subject: '数据结构', name: '第7章 查找', tip: 'B树/哈希' },
    { id: 'ds08', subject: '数据结构', name: '第8章 排序', tip: '大题高频' },

    /* ---------- 计算机组成原理 ---------- */
    { id: 'co01', subject: '计算机组成原理', name: '第1章 计算机系统概述', tip: '' },
    { id: 'co02', subject: '计算机组成原理', name: '第2章 数据的表示和运算', tip: '浮点数' },
    { id: 'co03', subject: '计算机组成原理', name: '第3章 存储系统', tip: 'Cache 大题' },
    { id: 'co04', subject: '计算机组成原理', name: '第4章 指令系统', tip: '' },
    { id: 'co05', subject: '计算机组成原理', name: '第5章 中央处理器', tip: '数据通路' },
    { id: 'co06', subject: '计算机组成原理', name: '第6章 总线', tip: '' },
    { id: 'co07', subject: '计算机组成原理', name: '第7章 输入/输出系统', tip: '中断/DMA' },

    /* ---------- 操作系统 ---------- */
    { id: 'os01', subject: '操作系统', name: '第1章 计算机系统概述', tip: '' },
    { id: 'os02', subject: '操作系统', name: '第2章 进程与线程', tip: 'PV 大题' },
    { id: 'os03', subject: '操作系统', name: '第3章 内存管理', tip: '页表大题' },
    { id: 'os04', subject: '操作系统', name: '第4章 文件管理', tip: '' },
    { id: 'os05', subject: '操作系统', name: '第5章 输入/输出管理', tip: '' },

    /* ---------- 计算机网络 ---------- */
    { id: 'cn01', subject: '计算机网络', name: '第1章 计算机网络体系结构', tip: '' },
    { id: 'cn02', subject: '计算机网络', name: '第2章 物理层', tip: '' },
    { id: 'cn03', subject: '计算机网络', name: '第3章 数据链路层', tip: '滑动窗口' },
    { id: 'cn04', subject: '计算机网络', name: '第4章 网络层', tip: '路由/子网' },
    { id: 'cn05', subject: '计算机网络', name: '第5章 传输层', tip: 'TCP 大题' },
    { id: 'cn06', subject: '计算机网络', name: '第6章 应用层', tip: '' }
  ];

  CHAPTERS.forEach(function (c, i) { c.order = i; });

  return { subjects: SUBJECTS, chapters: CHAPTERS };
});
