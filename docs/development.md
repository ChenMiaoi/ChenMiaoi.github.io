# 博客开发与维护

这里记录 Miao's Blog 的本地开发、文章写作、数据同步与发布方式。

[返回个人介绍](README.zh-CN.md) · [本地开发](#本地开发) · [写作指南](#写作指南) · [项目结构](#项目结构) · [贡献数据](#贡献数据) · [验证与发布](#验证与发布)

## Orbital 正式站

Orbital 是唯一的网站界面。文章档案、系列、知识地图、开源贡献、关于和文章阅读都使用同一套轨道空间设计。

`pnpm dev` 开发本站，`pnpm build` 生成唯一的 `dist/`，`pnpm preview` 查看正式构建。首页为 `/`，已有文章永久链接保留。

页面和交互说明见 [Orbital 文档](orbital/README.md)。

## 本地开发

### 环境

- **Node.js 24 或更新版本**；CI 使用 Node.js 24。
- **pnpm 9.15.9**，与 `package.json` 的 `packageManager` 一致。
- **Git**；仅在刷新贡献数据时需要已登录的 GitHub CLI（`gh`）。

核心技术为 Astro 7、Svelte 5、TypeScript 与 Tailwind CSS 3。依赖版本以 [package.json](../package.json) 和 [pnpm-lock.yaml](../pnpm-lock.yaml) 为准。

```sh
git clone https://github.com/ChenMiaoi/ChenMiaoi.github.io.git
cd ChenMiaoi.github.io
pnpm install --frozen-lockfile
pnpm dev
```

打开 [localhost:4321](http://localhost:4321/)。Windows PowerShell 如果限制执行 `pnpm.ps1`，可将命令中的 `pnpm` 换成 `pnpm.cmd`。

文章档案的搜索直接筛选标题、摘要、标签和系列，在开发和正式构建中均可使用。构建还生成 Pagefind 全文索引和独立问答服务使用的内容索引。查看正式产物：

```sh
pnpm build
pnpm preview
```

## 写作指南

### 新建文章

```sh
pnpm new-post kernel-notes
```

脚本创建 `src/content/posts/kernel-notes.md`。当前内容集合读取 `.md` 文件，字段由 [src/content.config.ts](../src/content.config.ts) 校验。下面是一份可参考的文章头部：

```yaml
---
title: 内核阅读札记
published: 2026-10-05
description: 从一个具体问题出发，记录源码路径、推导过程与验证结果。
tags: [Linux, 内核]
category: linux
series: linux-memory-management
seriesOrder: 2
lang: zh_CN
draft: true
---
```

| 字段 | 用途 |
| --- | --- |
| `title`、`published` | 必填；文章标题与发布日期，日期使用 `YYYY-MM-DD` |
| `updated` | 可选；内容更新日期 |
| `description` | 摘要；非空时也会显示在文章开头 |
| `image` | 可选；封面图片路径 |
| `tags`、`category` | 标签列表与分类 |
| `series`、`seriesOrder` | 所属系列的 slug 与阅读顺序；独立文章可以省略 |
| `lang` | 文章语言标记；内容的中英文分组还取决于文件名 |
| `draft` | 草稿开关；开发模式可预览，正式构建排除草稿 |

新建脚本默认写入 `draft: false`；未完成的文章请改为 `true`，准备发布时再切回 `false`。

### 正文与永久链接

- 模板会将文章标题渲染为 `h1`，正文从 `##` 开始。历史文章中的一级标题会在渲染时规范化，保留标题文字与链接锚点。
- 代码块默认保留换行和缩进，长行在块内横向滚动。纯文本结构图使用 `text`；需要软换行时，在语言后加 `wrap`，例如 `sh wrap`。
- 行内公式使用 `$...$`，独立公式使用 `$$...$$`。文章图片可放在 `public/images/posts/`，正文通过 `/images/posts/文件名` 引用。
- 文章链接沿用 `/:year/:month/:day/:slug/`。文件名参与生成 slug，`published` 决定日期，因此重命名文件或修改发布日期会改变链接；修订正文时可使用 `updated` 记录日期。

### 组织系列

在 `src/content/series/` 中创建 Markdown 文件，文件名作为系列 slug。例如 `kernel-notes.md`：

```yaml
---
title: 内核阅读札记
description: 以实际执行路径组织的源码阅读记录。
parent: linux-memory-management
order: 2
---
```

顶层系列省略 `parent`。文章通过 `series: kernel-notes` 加入该系列，用 `seriesOrder` 指定章节顺序。

系列最多嵌套三级；不存在的父系列、循环引用和超深层级会使构建失败。目录先展示子系列，再展示直属文章：子系列按 `order` 排序，文章优先按 `seriesOrder`，未指定顺序时按发布日期从早到晚排列。

### 维护翻译

中文文章使用 `kernel-notes.md`，英文版本使用 `kernel-notes.en.md`。英文版本去掉 `.en` 后复用同一个 slug，路由增加 `/en/` 前缀；对应译文应保持相同的发布日期。

| 入口 | 界面语言 | 正文来源 |
| --- | --- | --- |
| `/` | 简体中文 | 中文文章 |
| `/en/` | English | `*.en.md` 英文文章 |
| `/zh_TW/` | 繁體中文 | 复用中文文章 |
| `/ja/` | 日本語 | 复用中文文章 |

这些入口不会自动翻译文章。语言路由与正文选择规则位于 [src/constants/locales.ts](../src/constants/locales.ts)；界面文案位于 `src/i18n/`。

## 项目结构

```text
src/
├── content/                 文章、系列和关于页面的 Markdown
├── content.config.ts       内容集合及字段校验
├── config.ts               站点、导航、个人资料与文章许可配置
├── data/                   贡献项目配置与公开数据快照
├── lib/                    内容组织、永久链接、系列树和贡献数据模型
├── pages/                  正式站路由及公开内容索引
├── components/             页面组件、阅读器与交互组件
├── features/orbital/        Orbital 页面、数据转换与贡献端点
├── styles/                 Orbital 样式
└── constants/              内容语言与路径前缀
public/                     图片、头像与图标等静态资源
scripts/                    新建文章、同步、构建验证与部署工具
rag/                        可选的文章问答服务
archive/                    保留的历史内容，不进入当前内容集合
docs/                       架构、设计与维护文档
```

常见修改入口：

| 想修改的内容 | 文件或目录 |
| --- | --- |
| 站点名称、头像、简介 | [src/config.ts](../src/config.ts) |
| 正式域名、Markdown 插件和构建集成 | [astro.config.mjs](../astro.config.mjs) |
| Orbital 视觉 | [src/styles/orbital/](../src/styles/orbital/) |
| 开源项目、账号和已确认提交 | [src/data/contribution-projects.json](../src/data/contribution-projects.json) |

模块职责、数据流和页面生命周期见 [项目架构](architecture.md)。

## 贡献数据

贡献页面使用提交到仓库的公开快照。普通开发和构建无需 GitHub 凭据，也不会临时下载贡献补丁。

需要更新数据时，先登录 GitHub CLI，再按顺序执行：

```sh
gh auth login
pnpm sync:contributions
pnpm sync:contribution-details
```

| 数据文件 | 内容与维护方式 |
| --- | --- |
| `src/data/contribution-projects.json` | 账号、项目仓库、已确认的上游提交及来源链接，人工维护 |
| `src/data/contribution-activity.json` | 自动发现本人创建、被指派或参与讨论的开放记录；保留已跟踪记录的合并与关闭历史 |
| `src/data/contribution-details.json` | 自动同步正文、改动、讨论和本人 PR 的已确认上游合并提交 |

每个同步命令在请求完成且校验通过后替换对应快照；失败时保留该文件的旧版本。同步后检查数据差异，再随站点修改一起提交。

进行中的 Issue / PR 与成果档案分开展示。本人 PR 合并后，同步程序读取 GitHub
确认的 `merge_commit_sha`，自动收录对应上游提交及改动，并关联原 PR。
“收录提交”统计按 SHA 去重的已收录上游记录；PR 的开发提交历史单独显示，
例如 5 次开发提交经 squash 合并后只增加 1 条上游记录。仅参与讨论的他人 PR
不会计入本人提交，未合并 PR 的测试合并 SHA 也不会被收录。
邮件列表贡献仍在项目配置中维护。此前已跟踪的 Issue / PR 在合并或关闭后保留，
活动发现不导入未曾跟踪的全部历史。

## 验证与发布

### 常用检查

所有命令在仓库根目录执行：

| 命令 | 作用 |
| --- | --- |
| `pnpm check` | Astro、Svelte 与 TypeScript 诊断 |
| `pnpm lint` | 检查源码，不自动修改文件 |
| `pnpm format:check` | 检查公共模块与客户端脚本的格式 |
| `pnpm test` | 内容规则、系列树、贡献阅读器与标题处理测试 |
| `pnpm build` | 生成正式站、Pagefind 搜索索引和本地问答索引 |
| `pnpm test:build` | 检查 Orbital 构建、文章正文、永久链接、贡献详情和问答引用 |
| `pnpm verify` | 依次运行上述 lint、格式、类型、测试、正式构建和产物检查 |

`pnpm test:build` 需要先完成 `pnpm build`。发布前运行 `pnpm verify`；涉及布局或交互时，还应在浏览器检查桌面和移动端的页面、阅读器及导航。

需要自动修复时使用 `pnpm lint:fix` 或 `pnpm format`。后者会格式化整个 `src/`，提交前应检查修改范围。

### 多语言目录

文章与系列的 frontmatter 使用 `translations.en`、`translations.zh_TW` 和
`translations.ja` 保存目录标题、摘要和可选的标签译文。目录翻译与正文语言
独立；未提供正文译文时，阅读器继续显示中文原文并提示原文语言。新增公开条目
时应同时补齐三份目录译文，搜索会同时匹配原文和各语言的目录关键词。
个人简介的译文在 `src/config.ts` 的 `profileConfig.bioTranslations` 中维护。
`scripts/i18n.test.mjs` 检查目录译文完整性与界面文字的翻译接入。

### 构建与部署

正式站点地址在 `astro.config.mjs` 中配置为 `https://nyachen.cn`。构建后的 `dist/` 可由静态 Web 服务器托管；`rag/index.json` 是独立服务使用的索引，不在 `dist/` 内。

[GitHub Actions 工作流](../.github/workflows/deploy.yml) 对面向 `main` 的 PR 和 `main` 推送执行验证，部署只在 `main` 的非 PR 运行中进行。发布产物为正式站的 `dist/`，部署目标与环境配置以工作流为准。

手动服务器部署入口为 `pnpm deploy:site`，配置参考 [.deploy.env.example](../.deploy.env.example)。部署配置与服务端密钥保留在本地或服务器环境中。

### 可选的文章问答服务

`pnpm build` 从公开的 `content-index.json` 生成 `rag/index.json`，索引不包含草稿。问答后端位于 [rag/server.mjs](../rag/server.mjs)，需要单独配置并运行，静态站部署不会自动启动它。

服务端配置参考 [rag/.env.example](../rag/.env.example)，包括索引路径、允许的来源、模型接口和认证设置；在环境变量已配置的情况下使用 `pnpm start:rag` 启动。Linux 服务配置可参考 [systemd 示例](../scripts/rag-service.service.example)。

前端通过构建时的 `PUBLIC_RAG_API_URL` 指定服务地址，未设置时使用 `https://api.nyachen.cn`。自建站点时应替换为自己的地址；模型密钥仅配置在服务端。

<details>
<summary>依赖维护说明</summary>

安装时使用锁文件与固定的 pnpm 版本。依赖审计使用官方 registry：

```sh
pnpm audit --registry=https://registry.npmjs.org
```

此前维护记录在 2026-10-04 标记了构建工具依赖 `braces@3.0.3` 的 [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)；当前状态应以重新审计结果为准，不在审计配置中忽略该项。

依赖已随唯一 Orbital 界面精简，锁文件是构建依赖的唯一依据。

</details>

## 参与与许可

欢迎通过 [Issue](https://github.com/ChenMiaoi/ChenMiaoi.github.io/issues) 反馈内容错误、失效链接或使用问题，也欢迎提交修正。较大的功能或设计调整请先讨论，提交约定见 [CONTRIBUTING.md](../CONTRIBUTING.md)。

- **站点代码**：沿用 [MIT License](../LICENSE)，保留 Fuwari 的原始版权声明。
- **博客文章**：页面标注 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)，配置位于 `src/config.ts`。
- **引用内容与第三方资源**：遵循各自的许可和来源说明；Orbital 图标来源见 [ICON-SOURCES.md](orbital/ICON-SOURCES.md)。

感谢 Fuwari 提供的起点，以及 Astro、Svelte 和相关开源项目提供的工具。
