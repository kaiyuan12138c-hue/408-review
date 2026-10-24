# 考研 408 复习计划 App — GitHub 同类项目调研

> 调研时间：2026-10-18
> 检索范围：GitHub 仓库搜索（`ebbinghaus` / `艾宾浩斯` / `408 考研` / `spaced repetition`）+ 项目 README 原文核对

## 一、结论先说

1. **有同类项目，但没有一个完全匹配。** 最接近的是 `Cang-yun/Mnemo-Mobile`（安卓/iOS，基于艾宾浩斯，带"记住/模糊/遗忘"反馈和补救复习），但它是通用的"计划/知识点"工具，没有 408 章节体系。
2. **408 相关的 GitHub 仓库几乎全是"资料/真题/刷题"**，解决的是"学什么"，不解决"什么时候该复习"。
3. **没有任何项目同时做到**：408 四科章节预置 + 手机端 + 自动排复习 + 每日学习记录 + 纯本地零部署。
4. **自己做一个轻量 Web App（PWA）是当前性价比最高的路**：手机浏览器打开即用、可加到桌面、数据存本机、不需要装任何开发工具。

---

## 二、最相关的 6 个项目

| 项目 | 形态 | 匹配度 | 关键能力 | 短板 |
|---|---|---|---|---|
| [Cang-yun/Mnemo-Mobile](https://github.com/Cang-yun/Mnemo-Mobile) | 安卓/iOS App（v1.0.0 已发布 APK + ipa，MIT） | ★★★★☆ | 计划→知识点；艾宾浩斯间隔 1/2/4/7/15/30 天；自动排程、逾期顺延；今日任务勾选 + 记住/模糊/遗忘反馈并自动生成补救复习；月视图；Markdown 笔记；薄弱追踪；WebDAV/JSON 备份 | 概念是"计划/知识点"，无 408 章节预置；需装 APK；界面偏通用 |
| [taka727/study-curve](https://github.com/taka727/study-curve) | Obsidian 插件（MIT） | ★★★★（若你已用 Obsidian） | 整篇笔记按阶梯复习 1/3/7/14/30/60/90 天；四档评分（☆初见/◯记住/△模糊/✗忘了）；**考试日期拉回**：考期之后的复习提前到考试日，考前 7 天全部笔记强制重现 | 依赖 Obsidian；**界面目前只有日文**；以"笔记"为单位，不是章节 |
| [st3v3nmw/obsidian-spaced-repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition) | Obsidian 插件 | ★★★ | FSRS / SM-2 算法；闪卡与整篇笔记复习；有中文界面；统计图表 | 卡片制，做章节级复习偏重；同样依赖 Obsidian |
| [Anki](https://github.com/ankitects/anki) + [FSRS](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler) | 桌面/手机 App | ★★☆ | 业界最强间隔重复引擎；FSRS 用难度/稳定性/可提取性三变量建模，比固定艾宾浩斯间隔更准 | 卡片制，408 章节要手工建卡；学习成本高；对"记录今天学了哪章"这件事支持很弱 |
| [lczmx/MemoryCard](https://github.com/lczmx/MemoryCard) | Web（FastAPI + Vue3，GPL-3） | ★★ | 艾宾浩斯复习计划 + 可自定义曲线；HTML5 端 | 要自建服务器（Docker + MySQL + Nginx）；demo 已失效；GPL-3 |
| [Outlier9/EbbinghausScheduler](https://github.com/Outlier9/EbbinghausScheduler) | Windows 桌面小工具（Python/Tk） | ★★ | 输入学习周期，直接生成"第 N 天学第几组、复习第几组"的表格 | 只出表、不跟踪完成情况；桌面端；作者自述"很丑很简陋" |

## 三、408 专属仓库（是资料，不是软件）

搜 `408 考研` 排名靠前的全是笔记/真题仓库，可以当学习内容来源，但都不提供复习调度：

- [ddy-ddy/cs-408](https://github.com/ddy-ddy/cs-408) — 6.3k★，408 复习经验 + OneNote 笔记
- [CodePanda66/CSPostgraduate-408](https://github.com/CodePanda66/CSPostgraduate-408) — 5.7k★，资料与真题（已归档）
- [xiaolei565/aimto408](https://github.com/xiaolei565/aimto408) — 4.6k★，408 复习路线
- [lanlankaoyanshan/408Bester](https://github.com/lanlankaoyanshan/408Bester) — 1.5k★，按月学习规划 + 视频书籍资源
- [songmuhan/408](https://github.com/songmuhan/408) — 历年真题与答案
- [lij768423-svg/408-](https://github.com/lij768423-svg/408-) — 408 刷题 Web 应用（题库/错题/收藏）

## 四、值得抄的两个设计

1. **记忆反馈要分档，不能只有"完成/未完成"**（来自 Mnemo-Mobile）
   - 记住 → 正常进入下一档
   - 模糊 → 间隔不推进，同一档再来一次
   - 遗忘 → 退回第一档 + **次日自动插入一次补救复习**
   这比"打勾"更贴近真实遗忘过程，也让日历不至于虚高。

2. **考试日期要能"拉回"复习**（来自 study-curve）
   - 考期之后的复习自动提前到考期前
   - 考前最后 7 天，所有章节强制过一遍
   你距离初试只有约 69 天，"1/2/4/7/15/30 天"这套间隔跑到后面正好撞上考期，这个机制是刚需。

## 五、需要安装什么？

| 路线 | 需要装的东西 | 说明 |
|---|---|---|
| **A. 自研 PWA（推荐）** | **什么都不用装** | 本机已有 Node v24（仅本地预览时可选使用）；产物是几个静态文件，手机浏览器直接打开 |
| B. 自研后打包成 APK | JDK 17 + Android SDK/Studio（约 3–5 GB）+ Gradle | 只有"必须是一个能装的应用"时才值得，可后期再加 |
| C. 直接用 Mnemo-Mobile | 不需要开发工具，下载 APK 安装即可 | 想马上有个能用的，这是最快路径 |
| D. Obsidian + study-curve | Obsidian（免费，约 100 MB）+ 插件 | 适合你本来就在 Obsidian 里记笔记 |

## 六、如果要自研，功能清单（基于以上调研）

**核心闭环**
- 章节库：王道 408 四科共 26 章预置（数据结构 8 / 组成原理 7 / 操作系统 5 / 计算机网络 6），可增删改
- 记录学习：选科目 → 选章节（可多选）→ 掌握度 → 备注，自动生成整条复习链
- 今日页：今天该复习的章节 + 逾期未复习 + 今日新学，一键"完成/模糊/忘了"
- 遗忘曲线可视化：每个章节一条衰减曲线，复习点处曲线抬升

**408 特有**
- 四科分色、分科进度
- 初试倒计时（默认 2026-12-27，可改）
- 考前 7 天总复习模式

**数据**
- 纯本地存储，JSON 导出/导入备份
- 离线可用，加到手机桌面像原生 App

---

*本文件由调研整理，非最终方案。具体技术选型待确认。*
