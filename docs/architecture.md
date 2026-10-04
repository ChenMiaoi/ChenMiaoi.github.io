# 项目组织与维护边界

正式博客继续使用 Astro 页面和 Swup；Orbital 是独立构建的交互设计预览。两套界面共享内容集合、文章永久链接、系列树和贡献快照。界面组件不负责同步外部数据。

```text
src/content/                   文章、系列与独立内容的 Markdown 源文件
src/content.config.ts          Astro 内容校验
src/lib/content/               文章选择、日期链接、系列树、客户端资源缓存
src/lib/contributions/         项目配置校验、快照校验、记录模型与数据转换
src/data/                      项目配置与已同步的公开贡献快照
src/pages/                     正式站路由与公开内容索引
src/layouts/                   正式站页面外壳
src/scripts/                   正式站页面生命周期、滚动条与图片预览
src/components/pages/          正式站各语言共用的页面
src/components/orbital/        预览外壳及文章、系列、地图、开源、个人资料组件
src/features/orbital/          仅由预览配置注入的入口和静态内容端点
src/styles/orbital/            按界面职责组织的最终样式
scripts/                       数据同步、索引生成与验证
rag/                           可选问答服务和生成的本地索引
```

## 内容流

Astro 校验 Markdown → `getRawSortedPosts` / `getSeriesTree` → 正式页面、预览页面、`content-index.json`。

`content-index.json` 是公开文章的机器可读导出，包含正文 Markdown，不包含草稿。问答索引只消费这个构建产物，不再自行解析 frontmatter 或拼接永久链接。`pnpm build` 同时生成站点、Pagefind 索引和 `rag/index.json`。

预览首页只携带文章索引和目录。阅读器通过 `/design-preview/articles/<slug>/` 按需获取 Astro 渲染的正文，并缓存成功请求。失败允许重试，关闭面板后晚到的响应不会重新打开面板。静态文章仍可通过正式永久链接阅读。

## 开源贡献

唯一项目配置是 `src/data/contribution-projects.json`，包含账号、仓库、已确认提交及讨论链接。`src/config.ts` 仅转导出配置，供现有页面兼容使用。

1. `pnpm sync:contributions` 同步未关闭的 Issue / PR。
2. `pnpm sync:contribution-details` 同步这些记录和已确认提交的详情。
3. 两套页面均读取本地校验后的快照，构建不再联网下载贡献补丁。

同步失败保留原快照；校验失败应修正数据，不能在页面中静默丢弃。预览的贡献详情在进入开源页时加载，后续访问复用缓存。外部 Markdown 经服务端清理后才进入阅读器。

## 组件与样式

`ArchiveTerminal` 负责导航与全站外壳，`ArticleArchive` 负责筛选结果、选择及连接线，`ArticleReader` 负责正文请求、目录、阅读进度与面板生命周期。系列树的验证与顺序在纯数据模块中维护，界面只消费结果。

正式站的交互初始化由 `src/scripts/lifecycle.ts` 统一接入 Swup：替换页面前清理旧资源，页面呈现后挂载新资源。滚动条的观察器、公式滚动实例和图片预览分别在所属模块释放；全站布局不再承载这些实现。导航栏复用公共语言路径函数，并通过同一就绪入口注册页面切换回调。

`styles/orbital/index.css` 是唯一样式入口：tokens → base → shell → 各功能 → motion。颜色和共享变量归 tokens，页面几何归 shell，功能样式与其响应式状态保留在同一文件。新增设计调整直接修改所属规则，不再增加一份覆盖旧设计的主题文件。

## 本地命令与发布

```sh
pnpm dev                     # 正式站开发
pnpm dev:design --port 4332   # 独立设计预览开发
pnpm build                   # 正式构建，输出 dist/
pnpm build:design            # 预览构建，输出 .astro/orbital-build/
pnpm preview:design --port 4332
pnpm verify                  # lint、公共模块格式、类型、测试、两套构建及产物检查
```

正式构建不包含 `/design-preview/` 路由。CI 在 PR 和 main 上执行同一个 `verify`；只有 main 的非 PR 运行可以部署。`lint` 只检查，`lint:fix` 才修改文件。公共模块执行格式门禁，已有页面的全量格式整理保持独立，避免给架构变更引入无关格式差异。

回归验证覆盖日期与语言规则、系列循环/深度/阅读顺序、请求缓存重试、贡献快照和 Markdown 清理、实际文章路由、问答引用及预览发布边界。涉及样式或交互的修改，还需在浏览器检查五个页面、阅读器、桌面和移动端。
