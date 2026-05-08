import process from 'node:process';
import type { Plugin } from 'vite';
import { loader_plugin } from './loader-plugin.js';
import { markup_plugin } from './markup-plugin.js';
import type { EnhancedVideosOptions } from './types.js';

export type {
	AdvancedOptions,
	EnhancedVideoMetadata,
	EnhancedVideoPoster,
	EnhancedVideoSource,
	EnhancedVideosOptions,
	HwAccel,
	Quality,
	QualityOverrides,
	QualityProfile,
	VideoFormat
} from './types.js';

/**
 * Vite plugins that turn `<enhanced:video src="...">` into multi-resolution
 * AV1 / VP9 / HEVC / H.264 sources, an auto-extracted poster, and a runtime
 * component with lazy IntersectionObserver loading.
 *
 * Requires `ffmpeg` and `ffprobe`. The plugin resolves them in this order:
 * 1. `advanced.ffmpegPath` / `advanced.ffprobePath` options
 * 2. `ffmpeg-ffprobe-static` package (if installed)
 * 3. `ffmpeg-static` + `ffprobe-static` packages (if installed)
 * 4. System `PATH`
 */
export function enhancedVideos(options: EnhancedVideosOptions = {}): Plugin[] {
	if (process.versions.webcontainer) return [];
	return [markup_plugin(), loader_plugin(options)];
}
