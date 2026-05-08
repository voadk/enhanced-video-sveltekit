# enhanced-video-sveltekit

Build-time video optimization for Svelte/SvelteKit. One tag, zero config.

```svelte
<enhanced:video src="./hero.mp4" autoplay muted loop playsinline />
```

You get:

- Multi-resolution H.264 (`.mp4`) and VP9 (`.webm`) — browser picks the best supported
- Auto-extracted poster as `<picture>` with AVIF / WebP / JPG variants — zero CLS
- Lazy IntersectionObserver gating — no bytes downloaded until the wrapper enters the viewport
- Auto-pause when scrolled out, respect for `prefers-reduced-motion`
- On-disk content-hashed cache — first encode is slow, every encode after is instant

## Install

```bash
pnpm add -D enhanced-video-sveltekit
```

`ffmpeg` and `ffprobe` are required at build time:

```bash
brew install ffmpeg            # macOS
sudo apt-get install ffmpeg    # Debian/Ubuntu
choco install ffmpeg           # Windows

# or, ship them as a dev dep (zero setup, larger node_modules):
pnpm add -D ffmpeg-ffprobe-static
```

## Setup

Add `enhancedVideos()` **before** the Svelte plugin in `vite.config.ts`. That's the whole config — sensible defaults handle the rest.

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedVideos } from 'enhanced-video-sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [enhancedVideos(), sveltekit()]
});
```

Standalone Vite + Svelte (no SvelteKit) works the same — just swap `sveltekit()` for `svelte()`.

## Authoring

`<enhanced:video>` works anywhere in any `.svelte` file. All standard `<video>` attributes pass through (`autoplay`, `muted`, `loop`, `controls`, `preload`, `playsinline`, `class`, `style`, `id`, `aria-*`, `data-*`, event handlers, bindings):

```svelte
<enhanced:video src="./hero.mp4" autoplay muted loop playsinline />
```

A user-supplied `poster` attribute is dropped — the build always extracts a fresh one.

`src` must be a static string literal: `<enhanced:video src={someVar}>` throws.

### Custom props

| Prop                  | Default        | What it does |
| --------------------- | -------------- | ------------ |
| `loading`             | `"lazy"`       | `"lazy"`: `<source>` rendering and download gated by IntersectionObserver. `"eager"`: load immediately. `"click"`: poster + play button until user clicks. |
| `preload`             | `"metadata"`   | Forwarded to the underlying `<video>`. |
| `autoPause`           | `true`         | Pause when the video scrolls out of viewport, resume on re-entry. |
| `respectReducedMotion`| `true`         | Skip autoplay when `prefers-reduced-motion: reduce` is set. |
| `playLabel`           | `"Play video"` | ARIA label for the click-to-play button (when `loading="click"`). |

## When you want to…

### …encode faster (CI, dev iteration)

```ts
enhancedVideos({ quality: 'web' })
```

Faster encoder presets and slightly higher CRF. Output is ~30% smaller too.

### …squeeze every byte

```ts
enhancedVideos({ quality: 'archive' })
```

Slow presets, lower CRF, higher poster quality. ~2-4× the encode time of `'balanced'`.

### …support older Safari (HEVC fallback)

```ts
enhancedVideos({ formats: ['mp4', 'mp4_hevc', 'webm'] })
```

### …push modern browsers onto AV1

```ts
enhancedVideos({ formats: ['av1', 'webm', 'mp4'] })
```

The browser picks the first source it can decode — order matters.

### …emit only one resolution

```ts
enhancedVideos({ resolutions: [720] })
```

Or a custom ladder: `resolutions: [1440, 720]`.

### …force software encoding (reproducible byte-identical output)

```ts
enhancedVideos({ advanced: { hwAccel: false } })
```

Default is `'auto'` — the plugin picks the best available H.264/HEVC accelerator (videotoolbox on macOS, nvenc on NVIDIA, etc.).

### …tune a specific codec

```ts
enhancedVideos({
  quality: 'balanced',
  advanced: {
    overrides: {
      h264: { crf: 18, preset: 'slow' },
      poster: { jpg: 95 }
    }
  }
})
```

Per-codec values from the chosen `quality` preset are spread first; your overrides win.

### …use a non-system ffmpeg

```ts
enhancedVideos({
  advanced: {
    ffmpegPath: '/opt/ffmpeg-7/bin/ffmpeg',
    ffprobePath: '/opt/ffmpeg-7/bin/ffprobe'
  }
})
```

## Programmatic import

If you'd rather build markup yourself, import the metadata directly:

```ts
import meta from './hero.mp4?enhanced-video';
// meta = { width, height, duration, poster: { jpg, webp?, avif? }, sources: [{ src, type, format, width, height }, …] }
```

## Dev vs build behavior

**Dev** — On the first request for an unencoded video, the loader probes the source and returns a placeholder pointing at the original file (served via Vite middleware with HTTP range support). Encoding runs in the background; when it finishes, importing modules are invalidated and an HMR reload swaps in the optimized variants. Page render is never blocked on encoding.

**Build** — All variants are encoded synchronously before the build completes. Missing ffmpeg or encoding errors fail the build.

## Cache

Encodes are cached at `<cacheDirectory>/<hash>/` (default: `node_modules/.cache/enhanced-video/<hash>/`). Cache key = `sha256(source-bytes ⊕ encoder-args ⊕ resolved-quality-profile ⊕ package-version ⊕ ffmpeg-version-banner)`. Editing the source, upgrading ffmpeg, bumping the package, changing `quality`, or adding overrides invalidates entries automatically.

## Browser support

| Browser            | Format used (default config)                          |
| ------------------ | ----------------------------------------------------- |
| Modern Chrome/Edge | H.264 (then VP9 if H.264 missing)                     |
| Firefox            | H.264 / VP9                                           |
| Safari 17+         | H.264 (HEVC if `mp4_hevc` enabled)                    |

## Reference

### `enhancedVideos(options?)`

| Option           | Type                                  | Default                                        | Description |
| ---------------- | ------------------------------------- | ---------------------------------------------- | ----------- |
| `formats`        | `VideoFormat[]`                       | `['mp4', 'webm']`                              | `'mp4'`, `'webm'`, `'mp4_hevc'`, `'av1'`. |
| `resolutions`    | `number[]`                            | `[1080, 720, 480]`                             | Target heights in px. Variants taller than the source are skipped; variants within 10% of an already-selected larger one are skipped. |
| `quality`        | `'web' \| 'balanced' \| 'archive'`    | `'balanced'`                                   | Encoder preset bundle (CRF, codec preset, audio bitrate, poster quality). |
| `cacheDirectory` | `string`                              | `<nearest-node_modules>/.cache/enhanced-video` | Disk cache location. |
| `maxJobs`        | `number`                              | `max(1, cpus - 1)`                             | Concurrent ffmpeg processes. |
| `advanced`       | `AdvancedOptions`                     | `{}`                                           | See below. |

### `AdvancedOptions`

| Option           | Type                          | Default       | Description |
| ---------------- | ----------------------------- | ------------- | ----------- |
| `hwAccel`        | `HwAccel`                     | `'auto'`      | `'auto'`, `'videotoolbox'`, `'nvenc'`, `'vaapi'`, `'qsv'`, or `false` for software-only. Honored by H.264 + HEVC; VP9 + AV1 always use software. |
| `fps`            | `number`                      | source FPS   | FPS cap (`min(fps, source_fps)`). |
| `ffmpegPath`     | `string`                      | auto-resolved | Custom ffmpeg binary path. |
| `ffprobePath`    | `string`                      | auto-resolved | Custom ffprobe binary path. |
| `lockMaxAgeMs`   | `number`                      | `7200000`     | Stale lock cleanup threshold. |
| `overrides`      | `QualityOverrides`            | `{}`          | Per-codec / poster overrides on top of `quality`. |

### `QualityOverrides`

```ts
{
  h264?:   { crf?: number; preset?: string };
  hevc?:   { crf?: number; preset?: string };
  vp9?:    { crf?: number; cpuUsed?: number };
  av1?:    { crf?: number; preset?: number };
  audio?:  { mp4Bitrate?: string; webmBitrate?: string };
  poster?: { jpg?: number; webp?: number; avif?: number };
}
```

### Encoding formats

| Format     | Codec | Audio | Container | Notes                                  |
| ---------- | ----- | ----- | --------- | -------------------------------------- |
| `mp4`      | H.264 | AAC   | MP4       | Universal.                             |
| `webm`     | VP9   | Opus  | WebM      | Smaller, broad support.                |
| `mp4_hevc` | H.265 | AAC   | MP4       | Smallest in MP4 family, `hvc1` tag for Safari. |
| `av1`      | AV1   | Opus  | WebM      | Best compression. Decode supported on Chrome 100+, Firefox 100+, Safari 17+. |

## Requirements

- Node ≥ 18
- ffmpeg ≥ 6 with `libsvtav1`, `libvpx-vp9`, `libx264`, `libx265`. Homebrew, Debian's `ffmpeg`, and Chocolatey all bundle these by default. Static-binary packages bundle them too.
- Svelte ^5
- `@sveltejs/vite-plugin-svelte` ^6 or ^7
- Vite ^6.3 or ≥ 7

## Limitations

- `src` must be a static string literal.
- No HLS / DASH adaptive streaming (sources are static `<source>` tags).
- No subtitle / caption track processing.
- Cache is not auto-pruned. Delete `<cacheDirectory>` to reclaim disk space.

## License

MIT
