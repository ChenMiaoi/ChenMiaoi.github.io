# 项目提交规范

本文件是 [AGENTS.md](AGENTS.md) 的中文译本，适用于整个仓库。所有命令均在仓库根目录执行，使用项目指定的 pnpm 和 Biome。修改规范时，应同步更新中英文版本。

## Commit 消息格式

必须使用 Conventional Commits，与仓库现有提交风格一致：

```text
<type>(<scope>): <subject>
```

- `type` 使用 `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore` 或 `revert`。
- `scope` 描述受影响的模块，例如 `orbital`、`navigation`、`contributions`、`i18n`；涉及整个项目时可省略。
- `subject` 使用简洁的英文祈使句，说明具体改动，末尾不加句号。
- 不得使用 `update`、`misc`、`WIP` 等无法说明改动的标题。
- 每个 commit 只包含一个逻辑改动；大范围纯格式化应与功能修改分开提交。
- 需要解释原因、风险或迁移方式时，在标题后空一行添加正文。
- 破坏性变更使用 `!`，并在正文末尾添加 `BREAKING CHANGE: ...`。

示例：

```text
fix(navigation): open contributions from the welcome page
feat(contributions): add mission type filters
style(orbital): format components with Biome
docs: define commit and pre-commit checks
```

## 提交前必须执行

1. 查看工作区和差异，确认修改范围，保留已有的用户修改与暂存内容：

   ```sh
   git status --short
   git diff
   git diff --stat
   git diff --cached
   ```

2. 格式化源码，再执行 lint 与只读格式检查。以下命令必须全部成功后才能提交：

   ```sh
   pnpm format
   pnpm lint
   pnpm format:check
   ```

   - `lint`、`lint:fix`、`format` 和 `format:check` 共用 `biome.json` 定义的范围：`src/`、`server/`、`scripts/`、`rag/` 中的 MJS，以及仓库根目录的 JS、MJS、CJS、TS、JSON 配置。
   - `pnpm format` 会修改上述范围内由 Biome 处理的文件，执行后必须检查差异；`pnpm format:check` 对相同范围执行只读检查。
   - 当前不检查 `src/` 下的 CSS、静态资源、归档文章、生成的 RAG 索引与构建产物，也会跳过 Biome 不支持的文件类型。不得宣称检查覆盖全部文件类型。
   - 新增源码目录时，必须同步更新 `biome.json` 的检查范围。
   - lint 失败时可运行 `pnpm lint:fix`，审查修复结果后重新执行上述检查。
   - 格式化产生的无关修改不得混入当前 commit，应保留在工作区并单独处理。
   - Windows PowerShell 中若 `pnpm` 被执行策略阻止，使用 `pnpm.cmd` 执行相同命令。

3. 按改动范围运行必要的验证：源码变更运行 `pnpm check` 与相关测试；发布前运行 `pnpm verify`；布局或交互变更还需检查实际浏览器中的桌面与移动端流程。

4. 仅按明确路径暂存本次提交的文件，审查最终暂存差异：

   ```sh
   git add <本次提交的文件路径>
   git diff --cached
   git diff --cached --stat
   git diff --cached --check
   ```

   不得加入无关修改、本地配置、日志、缓存、构建产物、密钥或真实 `.env` 文件。发现敏感内容时停止提交并报告。检查后若再次修改源码，必须重新运行受影响的检查并审查暂存内容。

## 提交与汇报

- 仅在用户要求提交时创建 commit；本地提交不代表获准 push。
- 不得跳过失败检查或使用 `--no-verify`；未经明确要求不得 amend、reset、rebase 或强制推送。
- 提交后报告 commit SHA、标题、修改文件和实际验证结果；未运行或失败的检查必须明确说明，不得声称通过。
