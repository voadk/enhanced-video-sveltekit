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
}

export interface EnhancedVideoSource {
	src: string;
	type: string;
	format: VideoFormat;
	width: number;
	height: number;
}

export interface EnhancedVideoMetadata {
	/** Source video width in px */
	width: number;
	/** Source video height in px */
	height: number;
	/** Source video duration in seconds */
	duration: number;
	poster: string;
	sources: EnhancedVideoSource[];
}

export interface CachedArtifact {
	format: VideoFormat;
	height: number;
	width: number;
	file: string;
}

export interface CachedMeta {
	width: number;
	height: number;
	duration: number;
	artifacts: CachedArtifact[];
	poster_file: string;
}

export interface EncodeArgs {
	formats: VideoFormat[];
	resolutions: number[];
	fps: number | null;
	version: number;
}
