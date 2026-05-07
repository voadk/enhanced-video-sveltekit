import process from 'node:process';
import type { Plugin } from 'vite';
import { loader_plugin } from './loader-plugin.js';
import { markup_plugin } from './markup-plugin.js';
import type { EnhancedVideosOptions } from './types.js';

export type {
	EnhancedVideoMetadata,
	EnhancedVideoPoster,
	EnhancedVideoSource,
	EnhancedVideosOptions,
	VideoFormat
} from './types.js';

/**
 * Vite plugins that enable `<enhanced:video>` (or `<video:enhanced>`) markup
 * in Svelte components. At build time, source videos are transcoded to
 * multi-resolution H.264/MP4, VP9/WebM, HEVC/MP4, and AV1/WebM variants;
 * a poster JPEG is extracted from the first frame; the markup is replaced
 * with the `<EnhancedVideo>` runtime component.
 *
 * Requires `ffmpeg` and `ffprobe`. The plugin resolves them in this order:
 * 1. `ffmpegPath` / `ffprobePath` options (explicit)
 * 2. `ffmpeg-ffprobe-static` package (if installed)
 * 3. `ffmpeg-static` + `ffprobe-static` packages (if installed)
 * 4. System `PATH`
 */
export function enhancedVideos(options: EnhancedVideosOptions = {}): Plugin[] {
	if (process.versions.webcontainer) return [];
	return [markup_plugin(), loader_plugin(options)];
}

/**
 * Singular alias for `enhancedVideos()`. Same behavior, matches the export
 * name used by `svelte-enhanced-video` for drop-in compatibility.
 */
export const enhancedVideo = enhancedVideos;
