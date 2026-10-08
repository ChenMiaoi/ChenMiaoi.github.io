# Project Commit Guidelines

These guidelines apply to the entire repository. Run all commands from the repository root using the project's pnpm and Biome versions. A Chinese translation is available in [AGENTS-CN.md](AGENTS-CN.md); keep both versions synchronized when changing these guidelines.

## Commit Message Format

Use Conventional Commits, consistent with the repository's existing history:

```text
<type>(<scope>): <subject>
```

- Use one of these types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`.
- Name the affected module in `scope`, such as `orbital`, `navigation`, `contributions`, or `i18n`. The scope may be omitted for repository-wide changes.
- Write a concise English subject in the imperative mood that describes the specific change. Do not end it with a period.
- Avoid vague subjects such as `update`, `misc`, or `WIP`.
- Each commit must contain one logical change. Keep broad formatting changes separate from functional changes.
- When context is needed, add a body after a blank line explaining the reason, risks, or migration steps.
- Mark breaking changes with `!` and add a `BREAKING CHANGE: ...` footer.

Examples:

```text
fix(navigation): open contributions from the welcome page
feat(contributions): add mission type filters
style(orbital): format components with Biome
docs: define commit and pre-commit checks
```

## Required Checks Before Every Commit

1. Inspect the working tree and diffs to confirm the scope. Preserve existing user changes and staged content:

   ```sh
   git status --short
   git diff
   git diff --stat
   git diff --cached
   ```

2. Format the code, then run lint and the read-only formatting check. All of these commands must succeed before committing:

   ```sh
   pnpm format
   pnpm lint
   pnpm format:check
   ```

   - `lint`, `lint:fix`, `format`, and `format:check` share the scope defined in `biome.json`: `src/`, `server/`, `scripts/`, MJS files under `rag/`, and JS, MJS, CJS, TS, and JSON configuration files at the repository root.
   - `pnpm format` modifies files processed by Biome within that scope. Review the resulting diff. `pnpm format:check` checks the same scope without modifying files.
   - CSS under `src/`, static assets, archived articles, generated RAG indexes, and build output are excluded. File types unsupported by Biome are skipped. Do not claim that these checks cover every file type.
   - Update the scope in `biome.json` when adding a source directory.
   - If lint fails, `pnpm lint:fix` may be used. Review the fixes and rerun the checks above.
   - Do not include unrelated formatting changes in the current commit. Leave them in the working tree and handle them separately.
   - If the execution policy blocks `pnpm` in Windows PowerShell, use `pnpm.cmd` for the same commands.

3. Run validation appropriate to the change: `pnpm check` and relevant tests for source changes; `pnpm verify` before publishing; and actual desktop and mobile browser workflows for layout or interaction changes.

4. Stage only explicit paths belonging to the current commit and review the final staged diff:

   ```sh
   git add <paths-for-this-commit>
   git diff --cached
   git diff --cached --stat
   git diff --cached --check
   ```

   Do not include unrelated changes, local configuration, logs, caches, build output, secrets, or real `.env` files. If sensitive content is found, stop the commit and report it. If source files change after validation, rerun the affected checks and review the staged content again.

## Committing and Reporting

- Create commits only when requested by the user. Authorization to commit locally does not authorize a push.
- Do not bypass failed checks or use `--no-verify`. Do not amend, reset, rebase, or force-push without an explicit request.
- After committing, report the commit SHA, subject, changed files, and actual validation results. Clearly identify checks that failed or were not run; never claim they passed.
