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
