# enhanced-video

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
pnpm --filter enhanced-video dev    # tsc --watch
```

The demo picks up the rebuilt `dist/` automatically; refresh the browser.

## Publish to npm

There's a GitHub Actions workflow at [`.github/workflows/publish.yml`](.github/workflows/publish.yml) that publishes automatically.

### One-time setup

1. Create an npm automation access token: <https://www.npmjs.com/settings/~/tokens> → "Generate New Token" → **Automation** type.
2. Add it as a repo secret: GitHub repo → Settings → Secrets and variables → Actions → New repository secret → name `NPM_TOKEN`, value the token.
3. Make sure the package name in [`packages/enhanced-video/package.json`](packages/enhanced-video/package.json) is available on npm (`npm view enhanced-video`). If taken, rename it.

### To release

1. Bump the version in `packages/enhanced-video/package.json`.
2. Add an entry in `packages/enhanced-video/CHANGELOG.md`.
3. Commit + push to `main`.

The workflow runs `tsc` + `npm pack --dry-run` on every push and PR. On a push to `main`, if the `package.json` version isn't already on npm, it publishes (with `prepublishOnly` doing a clean rebuild) and pushes a `vX.Y.Z` git tag. Pushes to `main` without a version bump are ignored — same package, same release.

### Manual fallback

```bash
cd packages/enhanced-video
npm pack --dry-run     # inspect tarball contents
npm publish            # `prepublishOnly` re-runs `rm -rf dist && tsc` first
```

## License

MIT. See [`packages/enhanced-video/LICENSE`](packages/enhanced-video/LICENSE).
