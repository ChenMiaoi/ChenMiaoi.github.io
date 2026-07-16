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

## Developing

```bash
pnpm install
pnpm dev       # local dev server
pnpm build     # build to dist/ + Pagefind search index
pnpm preview   # preview the production build (search works here)
```

## Publishing

Push to `main` — the workflow in `.github/workflows/deploy.yml` builds and deploys automatically.
