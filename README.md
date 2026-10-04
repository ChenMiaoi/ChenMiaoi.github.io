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

```bash
pnpm install
pnpm dev       # local dev server
pnpm build     # build to dist/ + Pagefind search index
pnpm preview   # preview the production build (search works here)
```

## Publishing

Push to `main` — the workflow in `.github/workflows/deploy.yml` builds and deploys automatically.
