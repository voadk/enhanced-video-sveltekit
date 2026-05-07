# enhanced-video-sveltekit

Build-time video optimization for SvelteKit, modeled on [`@sveltejs/enhanced-img`](https://svelte.dev/docs/kit/images). Drop in an `<enhanced:video>` tag, get back AV1 + H.264 sources, an auto-extracted poster, and lazy loading.

```svelte
<enhanced:video src="$lib/clip.mp4" autoplay muted loop playsinline />
```

## Repo

This is a pnpm monorepo:

- **[`packages/enhanced-video`](packages/enhanced-video)** — the published library. See its [README](packages/enhanced-video/README.md) for usage.
- **`apps/demo`** — SvelteKit app that consumes the library locally for development and verification.

## Develop

```bash
pnpm install        # also builds packages/enhanced-video via its `prepare` script
pnpm dev            # runs apps/demo on http://localhost:5173
pnpm build          # production build of apps/demo
```

`ffmpeg` and `ffprobe` must be on `PATH`:

```bash
brew install ffmpeg            # macOS
sudo apt-get install ffmpeg    # Debian/Ubuntu
choco install ffmpeg           # Windows
```

When editing `packages/enhanced-video/src/`:

```bash
pnpm --filter enhanced-video-sveltekit dev    # tsc --watch
```

The demo picks up the rebuilt `dist/` automatically; refresh the browser.

## Commit messages

Conventional Commits are enforced via a husky `commit-msg` hook + commitlint (`@commitlint/config-conventional`). The hook is wired up automatically by the `prepare` script when you run `pnpm install`.

```
type(scope?): subject

feat:      new feature
fix:       bug fix
perf:      performance improvement
refactor:  internal restructure
docs:      documentation
test:      tests
build:     build system / deps
ci:        CI workflow
chore:     anything else
revert:    revert a previous commit
```

Bad commits are rejected by the hook before they land. The `cliff.toml` config groups these into the auto-generated `CHANGELOG.md` on release.

To preview the upcoming `[Unreleased]` section locally without releasing:

```bash
pnpm view:cliff
```

(Needs `git-cliff` on your `PATH` — `brew install git-cliff` once.)

## Publish to npm

There's a GitHub Actions workflow at [`.github/workflows/publish.yml`](.github/workflows/publish.yml) that publishes automatically.

### One-time setup

1. Create an npm automation access token: <https://www.npmjs.com/settings/~/tokens> → "Generate New Token" → **Automation** type.
2. Add it as a repo secret: GitHub repo → Settings → Secrets and variables → Actions → New repository secret → name `NPM_TOKEN`, value the token.
3. Make sure the package name in [`packages/enhanced-video/package.json`](packages/enhanced-video/package.json) is still available on npm (`npm view enhanced-video-sveltekit`). If taken, rename it.

### To release

1. Bump the version in `packages/enhanced-video/package.json`.
2. Commit + push to `main` (use [Conventional Commit](https://www.conventionalcommits.org/) prefixes for everything that's gone in since the last tag — `feat:`, `fix:`, `ci:`, `chore:`, etc.).

That's it. The workflow handles the rest:

1. `tsc` + `npm pack --dry-run` on every push and PR.
2. On push to `main` with a new version: `npm publish` with provenance, then [`git-cliff`](https://git-cliff.org/) regenerates `packages/enhanced-video/CHANGELOG.md` from commits since the previous tag, commits it back as `chore(changelog): release vX.Y.Z [skip ci]`, pushes a `vX.Y.Z` git tag, and creates a GitHub Release with the same notes.

The CHANGELOG groups commits by Conventional type (`feat:` → Features, `fix:` → Bug Fixes, `ci:` → CI, etc.). Non-Conventional commits are skipped. Configuration lives in [`cliff.toml`](cliff.toml). Pushes to `main` without a version bump don't release — same package, same release.

### Manual fallback

```bash
cd packages/enhanced-video
npm pack --dry-run     # inspect tarball contents
npm publish            # `prepublishOnly` re-runs `rm -rf dist && tsc` first
```

## License

MIT. See [`packages/enhanced-video/LICENSE`](packages/enhanced-video/LICENSE).
