# enhanced-video-sveltekit

Build-time video optimization for Svelte/SvelteKit. Drop in `<enhanced:video>` (or `<video:enhanced>`) — get back multi-resolution AV1 / VP9 / HEVC / H.264 sources, an auto-extracted poster, lazy IntersectionObserver loading, and zero layout shift.

```svelte
<enhanced:video src="$lib/clip.mp4" autoplay muted loop playsinline />
```

becomes (at build time):

- `clip_1080p.{mp4,webm}` — H.264 + VP9 at 1080p
- `clip_720p.{mp4,webm}` — H.264 + VP9 at 720p
- `clip_480p.{mp4,webm}` — H.264 + VP9 at 480p
- `clip_poster.jpg` — first frame, shown until the video starts playing
- A `<video>` element with all `<source>` children (browser picks the best supported), wrapper `aspect-ratio` for zero CLS, and lazy IntersectionObserver gating

## Install

```bash
pnpm add -D enhanced-video-sveltekit
```

`ffmpeg` and `ffprobe` are required at build time. The plugin resolves them in this order:

1. `ffmpegPath` / `ffprobePath` plugin options (explicit)
2. `ffmpeg-ffprobe-static` package (if installed)
3. `ffmpeg-static` + `ffprobe-static` packages (if installed)
4. System `PATH`

```bash
# Option A: install static binaries (zero setup, larger node_modules)
pnpm add -D ffmpeg-ffprobe-static
# or
pnpm add -D ffmpeg-static ffprobe-static

# Option B: use system FFmpeg (recommended)
brew install ffmpeg            # macOS
sudo apt-get install ffmpeg    # Debian/Ubuntu
choco install ffmpeg           # Windows
```

## Setup

`enhancedVideos()` (or its alias `enhancedVideo()`) goes **before** the Svelte plugin in `vite.config.ts`. Works with both SvelteKit and standalone Vite + Svelte.

### SvelteKit

```ts
import { enhancedVideos } from 'enhanced-video-sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';

export default {
  plugins: [
    enhancedVideos({
      formats: ['mp4', 'webm'],
      resolutions: [1080, 720, 480]
    }),
    sveltekit()
  ]
};
```

### Vite + Svelte (no SvelteKit)

```ts
import { enhancedVideo } from 'enhanced-video-sveltekit';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [enhancedVideo({ formats: ['mp4'] }), svelte()]
});
```

## Options

| Option           | Type            | Default                                      | Description                            |
| ---------------- | --------------- | -------------------------------------------- | -------------------------------------- |
| `formats`        | `VideoFormat[]` | `['mp4', 'webm']`                            | Output formats: `'mp4'`, `'webm'`, `'mp4_hevc'`, `'av1'`. |
| `resolutions`    | `number[]`      | `[1080, 720, 480]`                           | Target heights in px. Only resolutions ≤ source height are emitted. |
| `fps`            | `number`        | source FPS                                   | FPS cap (`min(fps, source_fps)`). |
| `cacheDirectory` | `string`        | `<nearest-node_modules>/.cache/enhanced-video` | Disk cache location. |
| `maxJobs`        | `number`        | `max(1, cpus - 1)`                           | Concurrent ffmpeg processes. |
| `ffmpegPath`     | `string`        | auto-resolved                                | Custom ffmpeg binary path. |
| `ffprobePath`    | `string`        | auto-resolved                                | Custom ffprobe binary path. |
| `lockMaxAgeMs`   | `number`        | `7200000` (2h)                               | Stale lock cleanup threshold. |

## Encoding formats

| Format     | Codec  | Audio  | Container | Notes                                  |
| ---------- | ------ | ------ | --------- | -------------------------------------- |
| `mp4`      | H.264  | AAC    | MP4       | Universal, CRF 23.                     |
| `webm`     | VP9    | Opus   | WebM      | Smaller, CRF 32, broad support.        |
| `mp4_hevc` | H.265  | AAC    | MP4       | Smallest in MP4 family, CRF 28, `hvc1` tag for Safari. |
| `av1`      | AV1    | Opus   | WebM      | Best compression. Decode supported on Chrome 100+, Firefox 100+, Safari 17+. |

## Authoring

Use `<enhanced:video>` (or `<video:enhanced>` — the two are aliases) in any `.svelte` file:

```svelte
<enhanced:video
  src="./assets/hero.mp4"
  autoplay
  muted
  loop
  playsinline
  loading="eager"
/>
```

All standard `<video>` attributes pass through (`autoplay`, `muted`, `loop`, `controls`, `preload`, `playsinline`, `class`, `style`, `id`, `aria-*`, `data-*`, event handlers, bindings). User-supplied `poster` is dropped — the build always extracts a fresh one.

### Custom props

| Prop      | Default      | What it does                                                                 |
|-----------|--------------|------------------------------------------------------------------------------|
| `loading` | `"lazy"`     | `"lazy"`: `<source>` rendering and download gated by IntersectionObserver (200 px rootMargin). `"eager"`: load immediately like a normal `<video>`. |
| `preload` | `"metadata"` | Forwarded to the underlying `<video>`. Default avoids saturating Chrome's 6-connection HTTP/1.1 pool with eager video downloads. |

## Programmatic import

Two query strings are supported:

```ts
// Rich metadata (used by the runtime component)
import meta from './hero.mp4?enhanced-video';
// meta = { width, height, duration, poster, sources: [{src, type, format, width, height}, ...] }

// Dict shape (svelte-enhanced-video compatible)
import vars from './hero.mp4?enhanced';
// vars = { mp4: { '1080p': '/url', '720p': '/url' }, webm: {...}, mp4_hevc: {...}, av1: {...} }
```

## Dev vs build behavior

**Dev** — On the first request for an unencoded video, the loader probes the source and returns a placeholder module pointing at the original file (served via Vite middleware). Encoding runs in the background; when it finishes, the importing modules are invalidated and a full HMR reload swaps in the optimized variants. Page render is never blocked on encoding.

**Build** — All variants are encoded synchronously before the build completes. Missing ffmpeg or encoding errors fail the build.

## Cache

Encodes are cached at `<cacheDirectory>/<hash>/` (default: `node_modules/.cache/enhanced-video/<hash>/`). Layout:

```
<hash>/
├── meta.json            # cached probe + artifact paths
├── encode.lock          # exclusive lock during encoding
├── poster.jpg           # extracted first frame
├── video_1080p.mp4
├── video_720p.mp4
├── video_480p.mp4
├── video_1080p.webm
├── video_720p.webm
└── video_480p.webm
```

Cache key = `sha256(source-bytes ⊕ encoder-args ⊕ package.version ⊕ ffmpeg-version-banner)`. Editing the source, upgrading ffmpeg, bumping the package, or changing options invalidates entries automatically.

A first-time encode shows live progress (in a TTY) or per-file start/done lines (in CI):

```
[enhanced-video] hero.mp4               ████████░░░░░░░░░░░░░░░░  37%   8.2s  mp4+webm
[enhanced-video] ✓ hero.mp4  21.5s [mp4_1080p: 2.0MB, mp4_720p: 1.2MB, webm_1080p: 2.3MB, webm_720p: 1.6MB]
```

Subsequent runs are sub-second:

```
[enhanced-video] → hero.mp4  (cached: mp4, webm, 1080p,720p,480p)
```

## Browser support

The browser plays the first source it can decode. Source ordering is format-then-resolution-descending. Default:

| Browser            | Format used      |
|--------------------|------------------|
| Modern Chrome/Edge | H.264 1080p (then VP9 / AV1 if H.264 missing) |
| Firefox            | H.264 1080p / VP9 |
| Safari 17+         | H.264 1080p / HEVC if `mp4_hevc` enabled |

Override the format priority by reordering the `formats` option (e.g. `['av1', 'webm', 'mp4_hevc', 'mp4']` to push modern formats first).

## Requirements

- Node ≥ 18
- ffmpeg ≥ 6 with `libsvtav1`, `libvpx-vp9`, `libx264`, `libx265`. Homebrew, Debian's `ffmpeg`, and Chocolatey all bundle these by default. Static-binary packages (`ffmpeg-ffprobe-static`, `ffmpeg-static`) bundle them too.
- Svelte ^5
- `@sveltejs/vite-plugin-svelte` ^6 or ^7
- Vite ^6.3 or ≥ 7

## Limitations

- `src` must be a static string literal. `<enhanced:video src={var}>` throws — use a string.
- No HLS / DASH adaptive streaming (sources are static `<source>` tags).
- No subtitle / caption track processing.
- ffmpeg encoder parameters (CRF, preset, codec flags) are hardcoded per format.
- Cache is not auto-pruned. Delete `<cacheDirectory>` to reclaim disk space.

## License

MIT
