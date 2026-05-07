export type VideoFormat = 'mp4' | 'webm' | 'mp4_hevc' | 'av1';

export interface EnhancedVideosOptions {
	/** Output formats. Default: ['mp4', 'webm'] */
	formats?: VideoFormat[];
	/** Target output heights in px. Default: [1080, 720, 480]. Only resolutions <= source height are emitted. */
	resolutions?: number[];
	/** FPS cap (capped at min(fps, source_fps)). Default: source FPS. */
	fps?: number;
	/** Disk cache location. Default: <nearest-node_modules>/.cache/enhanced-video */
	cacheDirectory?: string;
	/** Concurrent ffmpeg processes. Default: max(1, cpus - 1). */
	maxJobs?: number;
	/** Stale lock cleanup threshold (ms). Locks older than this are treated as orphaned. Default: 7200000 (2h). */
	lockMaxAgeMs?: number;
	/** Explicit path to the ffmpeg binary. Overrides static-binary autodetection and PATH. */
	ffmpegPath?: string;
	/** Explicit path to the ffprobe binary. Overrides static-binary autodetection and PATH. */
	ffprobePath?: string;
}

export interface EnhancedVideoSource {
	src: string;
	type: string;
	format: VideoFormat;
	width: number;
	height: number;
}

export interface EnhancedVideoPoster {
	/** Always present — universal fallback for `<img>` */
	jpg: string;
	/** WebP variant (~30% smaller than jpg). Skipped if encoder unavailable. */
	webp?: string;
	/** AVIF variant (~50% smaller than jpg). Skipped if encoder unavailable. */
	avif?: string;
}

export interface EnhancedVideoMetadata {
	/** Source video width in px */
	width: number;
	/** Source video height in px */
	height: number;
	/** Source video duration in seconds */
	duration: number;
	poster: EnhancedVideoPoster;
	sources: EnhancedVideoSource[];
}

export interface CachedArtifact {
	format: VideoFormat;
	height: number;
	width: number;
	file: string;
}

export interface CachedPoster {
	jpg: string;
	webp?: string;
	avif?: string;
}

export interface CachedMeta {
	width: number;
	height: number;
	duration: number;
	artifacts: CachedArtifact[];
	poster_files: CachedPoster;
}

export interface EncodeArgs {
	formats: VideoFormat[];
	resolutions: number[];
	fps: number | null;
	version: number;
}
