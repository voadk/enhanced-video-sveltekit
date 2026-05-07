# AGENTS.md

Context for AI agents implementing features in this repo. Read top-to-bottom before changing anything.

## Project shape

pnpm monorepo, one publishable package + one demo consumer:

- **`packages/enhanced-video/`** — published as **`enhanced-video-sveltekit`** on npm. The library.
- **`apps/demo/`** — SvelteKit app that consumes the library via workspace link. Used to dogfood and verify changes.

The library mirrors `@sveltejs/enhanced-img`'s shape: a Vite plugin pair (markup transform + loader) that processes a custom `<enhanced:video>` Svelte tag at build time. AV1 + H.264 output via ffmpeg, auto-extracted poster, lazy loading.

## Stack

- **Svelte 5** (runes), **SvelteKit 2**, **Vite 7**, **pnpm 10**
- **TypeScript** everywhere — `.ts` source, `.svelte` files use `<script lang="ts">`
- **Tailwind v4** + **shadcn-svelte** (luma style, hugeicons) in the demo
- **ffmpeg** + **ffprobe** required on `PATH` for the library to function (`brew install ffmpeg`)

## Commands

```bash
pnpm install                                      # bootstraps: builds dist, wires husky hook
pnpm dev                                          # demo on :5173 with live library
pnpm build                                        # production build of demo
pnpm check                                        # type-check everything
pnpm view:cliff                                   # preview unreleased changelog locally
pnpm --filter enhanced-video-sveltekit dev        # tsc --watch on the library only
pnpm --filter enhanced-video-sveltekit build      # one-off rebuild of dist/
```

## Critical files

### Library — `packages/enhanced-video/src/`

| File | Role |
|------|------|
| `index.ts` | Exports `enhancedVideos()` → `[markup_plugin, loader_plugin]`. Skips on `process.versions.webcontainer`. |
| `markup-plugin.ts` | Vite `transform` hook (`order: 'pre'`). Finds `<enhanced:video>` markup, rewrites to `<EnhancedVideo metadata={...}>` + injected imports. Uses `svelte-parse-markup` + `zimmerframe`. |
| `loader-plugin.ts` | Vite plugin (`enforce: 'pre'`). Handles `?enhanced-video` query: probe → encode → cache → emit asset (build) / dev middleware (serve). HTTP range support. HMR via `handleHotUpdate`. |
| `ffmpeg.ts` | `assertFfmpeg()`, `probe()`, `encodeAv1Webm()`, `encodeH264Mp4()`, `encodePoster()`. Concurrency capped by `p-limit(cpus)`. Filters SVT banner spam from error messages. |
| `cache.ts` | Content-hash cache helpers; cache lives at `node_modules/.cache/enhanced-video/<sha256>/`. |
| `progress.ts` | Singleton `progress` exported. TTY: live multi-job progress bar via ANSI. Non-TTY: plain start/done lines. |
| `types.ts` | Shared types: `EnhancedVideoMetadata`, `EnhancedVideoSource`, `Codec`, `CachedMeta`, etc. |
| `runtime/EnhancedVideo.svelte` | The runtime component. IntersectionObserver-based lazy gating on `<source>` children. Poster overlay fades on actual playback (`timeupdate`/`playing`/`error`/1.5s fallback). |
| `runtime/index.ts` | Re-export barrel. Consumers import `from 'enhanced-video-sveltekit/runtime'`. |

### Demo — `apps/demo/`

- `vite.config.ts` — `plugins: [tailwindcss(), enhancedVideos(), sveltekit()]`. Order matters: `enhancedVideos()` before `sveltekit()`.
- `src/routes/+page.svelte` — showcase page. shadcn-svelte components + 3 `<enhanced:video>` tags (1 eager hero, 2 lazy).
- `src/lib/utils.ts` — `cn()` + `WithElementRef` / `WithoutChild` / `WithoutChildren` helpers (required by shadcn-svelte components).
- `components.json` — shadcn-svelte config: `style: luma`, `iconLibrary: hugeicons`, `typescript: true`. To re-fetch: `pnpm dlx shadcn-svelte add <name> --overwrite`.
- `src/lib/*.{mp4,mov,webm,...}` — gitignored. Drop your own video files there to use the demo.

### Config — repo root

- `pnpm-workspace.yaml` — workspace + `onlyBuiltDependencies` allowlist (`@tailwindcss/oxide`, `esbuild`)
- `cliff.toml` — git-cliff config for auto-CHANGELOG generation
- `commitlint.config.js` — extends `@commitlint/config-conventional`
- `.husky/commit-msg` — runs `pnpm exec commitlint --edit "$1"`
- `.github/workflows/publish.yml` — CI: build on every push/PR, publish + tag + GitHub Release on version bump on `main`

## Conventions

### Commits — Conventional Commits enforced

The husky `commit-msg` hook **rejects** anything that isn't `<type>(scope?): <subject>`. Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`. Scopes are free-form.

`feat:` and `fix:` headline release notes. Use them for user-visible behavior. Use `chore:` for internal cleanup, `ci:` for workflow/CI changes, `docs:` for README/AGENTS edits.

If you genuinely need to bypass (rebasing in a non-conventional commit, etc.) use `git commit --no-verify` — but never for normal work, otherwise the auto-CHANGELOG develops gaps.

### TypeScript

- Strict mode (`tsconfig.base.json` extended by both packages).
- Library compiles with `moduleResolution: NodeNext` — imports use `.js` extensions even from `.ts` source: `import './foo.js'`. Do not use extensionless imports.
- Library `prepare` script runs `tsc` on every `pnpm install`, populating `dist/`.
- Demo uses `tsconfig.json` (no jsconfig) and `vite.config.ts`.

### Names that look swappable but aren't

These stayed `enhanced-video` even after the npm rename to `enhanced-video-sveltekit`. Don't rename them:

- `[enhanced-video]` — log prefix in `progress.ts`
- `?enhanced-video` — Vite query string (`QUERY` constant in `loader-plugin.ts`)
- `/@enhanced-video/` — dev middleware base path (`BASE_PATH`)
- `node_modules/.cache/enhanced-video/` — cache directory
- `<enhanced:video>` — markup tag name

The npm name is the package's external identity; these are internal namespaces — shorter, never user-facing.

### Architecture invariants

- The markup plugin must run **before** `vite-plugin-svelte:compile`. That's why `transform.order: 'pre'` and `configResolved` reads `vite-plugin-svelte:config`'s `api.filter.id`.
- The loader plugin must run **before** Vite's default asset handler. That's why `enforce: 'pre'`.
- Cache key = `sha256(source-bytes ⊕ JSON(args) ⊕ pkg-version ⊕ ffmpeg-version-banner)`. Anything that changes the bytes invalidates automatically.
- **Build mode**: `this.emitFile({ type: 'asset', source, name, originalFileName })` → Vite returns `__VITE_ASSET__hash__` placeholder, replaces in final output.
- **Dev mode**: register file path in the in-memory `generated_assets: Map<id, {path, contentType}>`; the `configureServer` middleware streams it on `/@enhanced-video/<id>` with HTTP range support.
- The runtime gates `<source>` rendering on a `loaded` state controlled by `IntersectionObserver`. `<source>` elements are not rendered (and the browser fetches nothing) until the wrapper is within `rootMargin: 200px` of the viewport.
- The runtime's poster fade is gated on **actual playback**, not first-frame decode. Listens to `timeupdate`/`playing`/`error`, with a 1.5s safety timeout if none fire (autoplay-blocked edge case).

## Common tasks — recipes

### Add a new encoder format (e.g. VP9)

1. `ffmpeg.ts`: add `encodeVp9Webm({ src, out, has_audio, width, onProgress })` following the AV1 pattern. Use `-c:v libvpx-vp9 ...`.
2. `loader-plugin.ts`: add the codec to `CONTENT_TYPES` (`vp9webm: 'video/webm'`) and `SOURCE_TYPES` (`vp9webm: 'video/webm; codecs=vp09....'`). Branch in `load()` to push the task + artifact when `formats.includes('vp9')`. Wire `progress.update(id, 'vp9', us)`.
3. `types.ts`: add `'vp9'` to the `Codec` union.
4. Bump `package.json` version (cache invalidation).

### Add a runtime prop on `<EnhancedVideo>`

1. Extend the `Props` type in `runtime/EnhancedVideo.svelte`.
2. The markup plugin passes through unknown attributes verbatim via `serialize_passthrough_attributes`. If you want a *typed* prop set on `<enhanced:video>` and consumed by the runtime, add the attr name to `PASS_THROUGH_DROP` in `markup-plugin.ts` and handle it explicitly when rewriting.

### Add a query directive (e.g. `?bitrate=2M`)

1. `loader-plugin.ts`'s `load()`: parse `params.get('bitrate')`.
2. Include in the `args` object so the cache key reflects it (different bitrates → different cache entries).
3. Pass to the encoder function as a new option.

### Change cache invariants

The hash already includes `pkg-version`. If you change encoder semantics in a way that should invalidate existing caches, bump `packages/enhanced-video/package.json` version. Don't add ad-hoc cache-busting strings.

### Modify the markup transform

`markup-plugin.ts`'s handler walks the AST via `zimmerframe`'s `walk` — never `svelte/compiler`'s `walk` (deprecated). Use `svelte-parse-markup`'s `parse`, never `svelte/compiler`'s `parse` directly (the former handles `<script lang="ts">` blocks correctly without parsing TS inside script). Edits go through `magic-string` so source maps stay correct: `s.update(node.start, node.end, replacement)`.

## Verification

After every library change:

```bash
pnpm --filter enhanced-video-sveltekit check     # type-check
pnpm --filter enhanced-video-sveltekit build     # writes dist/
pnpm dev                                         # demo on :5173
```

Visual checks against the demo at http://localhost:5173:

- Eager hero `<enhanced:video loading="eager">` renders + autoplays
- Two lazy `<enhanced:video>` below stay cold until scroll, then load + play independently (no serial delay between them)
- Poster image fades out when actual motion starts, not when bytes arrive
- Chrome Network tab: AV1 webm requested, H.264 mp4 not. Safari: H.264 mp4. Both via `/@enhanced-video/<hash>.<ext>` URLs
- Terminal: progress bar during cold encode, `→ <name> (cached: webm, mp4)` on warm starts
- To force a cold encode: `rm -rf apps/demo/node_modules/.cache/enhanced-video`

## Release flow

**Do not** hand-edit the CHANGELOG, hand-create tags, or hand-create GitHub Releases. The workflow does all three.

To release:

1. Bump `version` in `packages/enhanced-video/package.json`.
2. Push the version-bump commit to `main` (with all preceding feature/fix commits also pushed and using Conventional prefixes).
3. CI does: `tsc` → `npm publish --provenance` → `git-cliff` regenerates `CHANGELOG.md` and writes per-version notes → commits CHANGELOG back as `chore(changelog): release vX.Y.Z [skip ci]` → pushes `vX.Y.Z` tag → `gh release create` with the notes.

Backfilling a missed Release (one-off): `git-cliff --current --strip all > /tmp/notes.md && gh release create vX.Y.Z --notes-file /tmp/notes.md`.

## Out of scope (current limitations)

- Dynamic `src={someVar}` — markup plugin throws a clear error. Use string literals.
- HLS / DASH adaptive streaming
- Subtitle / caption tracks
- `@sveltejs/enhanced-img` integration for responsive posters (planned)
- First-time encode of long videos in dev can exceed Vite's hard-coded 60s SSR module-fetch timeout. Refresh after the `✓` line works (cache hit). Run `pnpm build` once to warm the cache, or use a smaller test clip.
