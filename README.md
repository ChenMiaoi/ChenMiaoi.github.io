# Nay's Blog

My personal blog about operating systems, kernels, drivers and low-level engineering.

**Live at <https://chenmiaoi.github.io>**

Built with [Astro](https://astro.build) and the [Fuwari](https://github.com/saicaca/fuwari) theme,
deployed to GitHub Pages via GitHub Actions.

## Writing

- New post: `pnpm new-post <name>`, then edit `src/content/posts/<name>.md`
- Frontmatter: `title` / `published` / `tags` / `category` / `series` (+ optional `seriesOrder`)
- Series metadata (title & description shown on `/series/`): `src/content/series/<slug>.md`
- Post URLs keep the old Hexo permalink format: `/:year/:month/:day/:slug/`
- Code blocks preserve line breaks and scroll horizontally by default, keeping source code and text diagrams aligned. Use the `text` language for plain-text diagrams. Add `wrap` after the language in a fence only when soft wrapping is appropriate (for example, `sh wrap`).
- The article template renders the page title as `h1`. Start article sections with `##`; older posts using `#` are normalized during rendering, with their heading text and link anchors preserved. A non-empty `description` also appears as the article's introduction.

## Developing

Use Node.js 24 or newer and pnpm 9.15.9 (pinned in `package.json`). CI uses
Node.js 24 as well. Install from the lockfile with `pnpm install --frozen-lockfile`.

Astro 7 content collections are configured in `src/content.config.ts`; collection
IDs preserve existing article and series permalinks. Markdown uses the unified
processor for the site's remark/rehype plugins and Expressive Code. Tailwind 3
runs through `postcss.config.mjs`, with its base styles imported explicitly, so
the production theme and orbital preview keep their existing design.

The `serialize-javascript` override is scoped to Swup's transitive
`rollup-plugin-terser@7.0.2` dependency. It replaces the vulnerable 4.x release
with 7.1.2; the plugin's worker/minification path was checked with the new version.
Keep pnpm at the pinned version when installing this lockfile.

As of 2026-10-04, the remaining audit finding is
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
in `braces@3.0.3`, used by build/watch tooling. Upstream has no patched version.
Do not suppress it in the audit configuration. Recheck with
`pnpm audit --registry=https://registry.npmjs.org` (the configured mirror does not
provide an audit endpoint).

Run `pnpm sync:contributions` after `gh auth login` to refresh open GitHub issues and PRs. The account and repository allowlist are in `scripts/contribution-activity.config.json`; keep the repository URLs aligned with the displayed projects. The command searches both authored and assigned records, follows pagination, deduplicates overlaps, and saves a timestamped public snapshot to `src/data/contribution-activity.json`. Failed or incomplete searches leave the previous snapshot intact. Builds read this snapshot without invoking `gh` or exposing credentials. Refresh before publishing to update statuses: closed or merged PRs disappear from the open list, while verified merged commits are maintained separately below. Mailing-list patches and comment/review-only participation are not included.

For quick ad hoc lookup: `gh search prs --repo llvm/llvm-project --author ChenMiaoi --state open` or `gh search issues --repo llvm/llvm-project --assignee ChenMiaoi --state open`. Use `--repo rust-lang/cargo` for Cargo.

Contribution projects live in `contributionConfig.projects` in `src/config.ts`. Linux records use `mailingListLabel` and `mailingListUrl`; llvm-project and Cargo use `reviewType: "pull-request"` and each record's `pullRequest: { number, url }`. Add only verified merged records, with their upstream commit SHA, date and title. Patch previews use that commit in the configured repository, or an explicit `patch` value. An empty list means no records have been added, not that the author has no contributions.

```bash
pnpm install
pnpm dev       # local dev server
pnpm build     # build to dist/ + Pagefind search index
pnpm preview   # preview the production build (search works here)
```

## Publishing

Push to `main` — the workflow in `.github/workflows/deploy.yml` builds and deploys automatically.
