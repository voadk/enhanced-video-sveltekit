# Changelog

## 0.0.1

Initial release.

- `<enhanced:video>` markup tag, processed at build time
- AV1 (`.webm`) + H.264 (`.mp4`) output via ffmpeg
- Poster JPEG extracted from the first frame
- `<EnhancedVideo>` Svelte 5 runtime with poster overlay that fades on playback start
- Lazy loading via IntersectionObserver, opt-out with `loading="eager"`
- On-disk content-hash cache at `node_modules/.cache/enhanced-video/`
- Terminal progress bar (TTY) / start-done logs (CI)
- Dev mode middleware with HTTP range support
- Build mode emits content-hashed assets via `this.emitFile()`
- HMR invalidation when source videos change
