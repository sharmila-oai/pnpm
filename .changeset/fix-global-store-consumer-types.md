---
"@pnpm/deps.graph-builder": patch
"pnpm": patch
---

Fix TypeScript type resolution for global virtual store packages when the project provides the `@types` package for a dependency or peer dependency.
