# enhanced-video-sveltekit

Build-time video optimization for SvelteKit. Drop in an `<enhanced:video>` tag — get back AV1 + H.264 sources, an auto-extracted poster image, lazy loading, and zero layout shift.

```svelte
<enhanced:video src="$lib/clip.mp4" autoplay muted loop playsinline />
```

becomes (at build time):

- `clip.webm` — AV1 (modern, ~2× smaller than H.264)
- `clip.mp4` — H.264 fallback for older browsers and Safari
- `clip-poster.jpg` — first frame, shown until the video starts playing
- A `<video>` element with both sources, an overlaid poster `<img>`, intrinsic dimensions to prevent CLS, and IntersectionObserver-based lazy loading

## Features

- **Two formats out of the box**: AV1/WebM (modern) + H.264/MP4 (universal fallback). Browser picks the best one supported.
- **Automatic poster**: first frame extracted with ffmpeg, rendered as an `<img>` overlay, fades out when the video actually starts playing (not just when bytes arrive).
- **Lazy by default**: `<source>` elements aren't rendered and the video doesn't request a single byte until the wrapper enters the viewport. The poster shows until then.
- **Zero CLS**: width/height + `aspect-ratio` from the source video are baked into the SSR HTML.
- **On-disk content cache**: encodes are keyed by source bytes ⊕ encoder args ⊕ ffmpeg version. Subsequent dev starts and builds are instant.
- **Progress logging**: terminal progress bar in TTY mode, plain start/done logs in CI.
- **Dev + build parity**: same query API, same runtime, same cache. Dev mode streams cached files via middleware (with HTTP range support); build mode emits content-hashed assets.

## Install

```bash
pnpm add -D enhanced-video-sveltekit
# or
npm install -D enhanced-video-sveltekit
```

You also need `ffmpeg` and `ffprobe` on your `PATH`:

```bash
brew install ffmpeg            # macOS
sudo apt-get install ffmpeg    # Debian/Ubuntu
choco install ffmpeg           # Windows
```

The plugin checks for ffmpeg on startup and fails with install instructions if it's missing.

## Setup

```js
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedVideos } from 'enhanced-video-sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [enhancedVideos(), sveltekit()]
});
```

`enhancedVideos()` must come **before** `sveltekit()` in the plugin array.

## Usage

```svelte
<enhanced:video src="$lib/clip.mp4" autoplay muted loop playsinline />
```

### Standard `<video>` attributes

All standard `<video>` attributes pass through untouched: `autoplay`, `muted`, `loop`, `controls`, `playsinline`, `class`, `style`, `id`, `aria-*`, `data-*`, event handlers (`onclick`, etc.), and bindings.

A user-supplied `poster` attribute is **dropped** — the build always extracts a fresh one from the source video.

### Custom props

| Prop      | Default      | What it does                                                                 |
|-----------|--------------|------------------------------------------------------------------------------|
| `loading` | `"lazy"`     | `"lazy"`: only download when the wrapper is within 200 px of the viewport. `"eager"`: load immediately, like a normal `<video>`. |
| `preload` | `"metadata"` | Forwarded to the underlying `<video>`. Default avoids hogging Chrome's 6-connection HTTP/1.1 pool with eager video downloads. |

```svelte
<!-- above-the-fold hero: load right away -->
<enhanced:video src="$lib/hero.mp4" autoplay muted loop loading="eager" />

<!-- everywhere else: lazy is the default -->
<enhanced:video src="$lib/clip.mp4" autoplay muted loop />
```

### Query directives on `src`

```svelte
<enhanced:video src="$lib/clip.mp4?width=1280" autoplay muted loop />
<enhanced:video src="$lib/clip.mp4?formats=h264" autoplay muted loop />
```

| Directive | Values                | Effect                                                          |
|-----------|-----------------------|-----------------------------------------------------------------|
| `width`   | integer               | Scale the output to this width, height auto from aspect ratio. |
| `formats` | `av1`, `h264`, comma  | Limit the output formats. Default: `av1,h264`.                  |

Different directive combinations produce different cache entries — you can have `clip.mp4`, `clip.mp4?width=1280`, and `clip.mp4?width=640` side by side without overlap.

### Dynamic `src`

`<enhanced:video src={someVar}>` is **not supported** in the current version. Use a string literal so the build can resolve the file. Tracked for v0.2.

## How it works

`enhancedVideos()` returns two Vite plugins:

1. **Markup plugin** — a Svelte preprocessor that runs as a Vite `transform` hook with `order: 'pre'`. Uses `svelte-parse-markup` + `zimmerframe` to find `<enhanced:video>` elements and rewrite them to `<EnhancedVideo metadata={__ENHANCED_VIDEO_N__} {...passthrough} />` with a corresponding `import __ENHANCED_VIDEO_N__ from './clip.mp4?enhanced-video'` injected into the `<script>` block.

2. **Loader plugin** — handles the `?enhanced-video` query: probes the source with `ffprobe`, transcodes via ffmpeg (AV1/WebM and H.264/MP4 in parallel under a `p-limit(cpus)` semaphore), extracts the first frame as a poster JPEG, caches everything in `node_modules/.cache/enhanced-video/<sha256>/`, and returns a metadata module that the runtime consumes.

The runtime (`EnhancedVideo.svelte`) renders a wrapper `<div>` with `aspect-ratio`, a `<video>` element with the encoded sources (gated by IntersectionObserver when `loading="lazy"`), and an overlaid `<img>` poster that fades out on actual playback start (listens to `playing`/`timeupdate`/`error` with a 1.5 s safety fallback).

## Cache

Encodes are cached at `node_modules/.cache/enhanced-video/<hash>/`:

```
<hash>/
├── meta.json          # cached probe + artifact paths
├── poster.jpg         # extracted first frame
├── video.mp4          # H.264
└── video.webm         # AV1
```

The hash is `sha256(source-bytes ⊕ encoder-argv ⊕ package.version ⊕ ffmpeg-version-banner)`. Anything that changes the bytes — editing the source, upgrading ffmpeg, bumping the package — invalidates the cache automatically.

Subsequent runs are sub-second:

```
[enhanced-video] → clip.mp4  (cached: webm, mp4)
```

A first-time encode shows live progress (in a TTY) or per-file start/done lines (in CI):

```
[enhanced-video] clip.mp4                     ████████░░░░░░░░░░░░░░░░  37%   8.2s  av1+h264
[enhanced-video] ✓ clip.mp4  21.5s [webm: 690KB, mp4: 553KB]
```

## Browser support

| Browser            | Format used                                  |
|--------------------|----------------------------------------------|
| Chrome 100+, Edge  | AV1 / WebM                                   |
| Firefox 100+       | AV1 / WebM                                   |
| Safari 17+         | AV1 / WebM (hardware decode where available) |
| Older browsers     | H.264 / MP4 fallback                         |

`IntersectionObserver` is required for lazy loading; if it's missing, the runtime falls back to eager activation. Supported in every browser since 2019.

## Requirements

- Node ≥ 18
- ffmpeg ≥ 6 with `libsvtav1` (AV1) and `libx264` (H.264). Homebrew, Debian's `ffmpeg`, and Chocolatey all bundle these by default.
- Svelte ^5
- `@sveltejs/vite-plugin-svelte` ^6 or ^7
- Vite ^6.3 or ≥ 7

## Limitations (current version)

- No HLS / DASH adaptive streaming.
- No subtitle / caption track processing.
- Dynamic `src={var}` not supported — string literals only.
- Ships a poster as a plain `<img>`. Integration with `@sveltejs/enhanced-img` for responsive posters is on the roadmap.
- First-time encoding of a long video in dev mode can exceed Vite's hard-coded 60 s SSR module-fetch timeout. The encode continues in the background and a refresh after the `✓` line works (cache hit). Run `pnpm build` once to warm the cache if this bites.

## License

MIT
