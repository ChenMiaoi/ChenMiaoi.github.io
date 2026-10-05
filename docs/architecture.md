# 项目组织与维护边界

Orbital 是唯一正式界面。Astro 生成页面和可独立访问的文章，Svelte 负责档案、系列、知识地图、开源、关于以及阅读面板。

```text
src/content/                   文章和系列 Markdown
src/content.config.ts          内容校验
src/lib/content/               内容选择、日期链接、系列树、路由与客户端缓存
src/lib/contributions/         贡献数据校验及转换
src/data/                      项目配置与公开贡献快照
src/pages/[...path].astro       统一生成各语言入口、板块、系列和文章永久链接
src/pages/                     RSS、robots、内容索引、贡献详情及 404
src/features/orbital/           唯一页面外壳与数据准备
src/components/orbital/         全站导航及各功能组件
src/styles/orbital/             唯一界面样式，按功能划分
scripts/                       同步、构建检查和部署工具
rag/                           可选问答后端及生成的本地索引
```

## 页面与阅读

首页 `/` 是轨道入口欢迎页，点击“进入档案”到 `/archive/`；板块使用 `/series/`、`/graph/`、`/contribution/` 和 `/about/`。`/contribution/` 重定向到默认项目页（如 `/contribution/linux/`），项目页才是贡献板块的唯一内容地址。原分页地址仍进入 Orbital 文章档案。内容语言前缀保留，英文仅显示实际维护的英文文章。旧首页的 `q`、`tag`、`category` 查询链接直接进入筛选后的档案；文章和板块直达链接不经过欢迎页。

文章沿用 `/:year/:month/:day/:slug/`。直接访问时，Astro 输出标题、元信息与完整正文；启用交互后打开 Orbital 阅读器。站内阅读通过同一永久链接按需获取正文，不依赖第二套文章地址。禁用 JavaScript 时仍可查看静态正文及文章链接。

导航、系列筛选与文章打开均同步浏览器地址；直接访问、刷新、前进和后退使用同一套路由解析。阅读器关闭后返回来源板块。文章请求成功后缓存，失败可以重试；过期请求不会重新打开已关闭的面板。

`content-index.json` 是公开文章的机器可读导出。草稿不会进入发布页、RSS、Pagefind 或问答索引。`pnpm build` 生成 Orbital 站点、Pagefind 和 `rag/index.json`。

## 贡献数据

项目配置唯一来源是 `src/data/contribution-projects.json`。`pnpm sync:contributions` 同步进行中的 Issue / PR，`pnpm sync:contribution-details` 保存已验证的记录详情。同步失败保留旧快照。

构建不联系 GitHub。GitHub Pages 从 `/contributions.json` 读取打包的快照；VPS 的同一路径由独立 Node 服务提供，活动列表和清理后的 Markdown 详情来自同一代数据。页面打开时、重新可见时及可见期间每分钟检查更新，保留当前项目、类型筛选和记录选择。

`server/contributions/` 每 15 分钟发现配置项目中由作者发起或被指派的未关闭 PR / Issue，并继续跟踪已收录记录的关闭、合并和重开。不会自动回填全部历史，也不自动发现 Linux 已合并提交；提交清单仍由项目配置维护。详情没有变化时复用上次结果。GitHub 限流时按响应头退避；所有请求和校验成功后，才原子替换 `/var/lib/nyachen-contributions/snapshot.json`。数据目录独立于发布目录，首次启动才导入内置快照，升级、回滚和重启不会重置记录。

## 组件与样式

`ArchiveTerminal` 管理正式导航和历史记录。`ArticleArchive` 管理搜索、分类、排序与选择；`ArticleReader` 管理正文、目录、阅读进度和面板生命周期。系列规则和路线解析放在可独立验证的纯数据模块中。

`WelcomePortal` 和 `styles/orbital/welcome.css` 管理入口画面，复用空间站背景与全站动效开关。轨道仪是装饰，不代表实时遥测。进入动画持续 520ms，可直接跳过；减少动态效果时立即进入。欢迎页、档案之间的前进后退遵循 URL，不依赖访问次数或本地存储标记。无 JavaScript 时入口仍是普通链接。

`styles/orbital/index.css` 依次加载 tokens、base、shell、功能样式和 motion。组件自己的响应式规则与主样式保存在同一文件，动态效果尊重系统偏好和用户设置。

## 验证与发布

```sh
pnpm dev
pnpm build
pnpm preview
pnpm verify
```

前端构建输出到 `dist/`，供 GitHub Pages 使用。`pnpm build:vps` 以该前端为基础，将独立贡献服务打包到 `.output/vps/runtime/server.mjs`，无需服务器安装 npm 依赖。`pnpm verify` 同时验证前端、服务并生成两种产物。构建检查确保每个 HTML 页面使用 Orbital、文章正文与永久链接完整、贡献详情可用、问答引用有效。CI 只负责测试和发布代码，定时数据同步由 VPS 服务承担。服务器也会拒绝缺少 Orbital 标识的首页。

涉及交互或布局时，实际检查五个板块、阅读器、历史导航、直接访问和刷新，以及桌面、平板、手机尺寸。部署与回滚见 [部署文档](deployment.md)。
