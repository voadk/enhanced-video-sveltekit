import process from 'node:process';
import type { Plugin } from 'vite';
import { loader_plugin } from './loader-plugin.js';
import { markup_plugin } from './markup-plugin.js';

export type { EnhancedVideoMetadata, EnhancedVideoSource, Codec } from './types.js';

/**
 * Vite plugins that enable `<enhanced:video>` markup in Svelte components.
 * At build time, source videos are transcoded to AV1 (.webm) and H.264 (.mp4),
 * a poster JPEG is extracted from the first frame, and the markup is replaced
 * with the `<EnhancedVideo>` runtime component.
 *
 * Requires `ffmpeg` and `ffprobe` on `PATH`.
 */
export function enhancedVideos(): Plugin[] {
	if (process.versions.webcontainer) return [];
	return [markup_plugin(), loader_plugin()];
}
