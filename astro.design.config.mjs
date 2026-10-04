import { defineConfig } from "astro/config";
import { createSiteConfig } from "./astro.config.mjs";

const shared = createSiteConfig({ preview: true });
export default defineConfig({
  ...shared,
  outDir: "./.astro/orbital-build",
  integrations: [...shared.integrations, {
    name: "orbital-preview-routes",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        injectRoute({ pattern: "/design-preview/", entrypoint: "./src/features/orbital/Preview.astro" });
        injectRoute({ pattern: "/design-preview/articles/[...slug]/", entrypoint: "./src/features/orbital/Article.astro" });
        injectRoute({ pattern: "/design-preview/contributions.json", entrypoint: "./src/features/orbital/contributions.ts" });
      },
    },
  }],
  devToolbar: { enabled: false },
  vite: { ...shared.vite, server: { watch: { ignored: ["**/vendor/**", "**/.git/**"] } } },
});
