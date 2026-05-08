export type VideoFormat = 'mp4' | 'webm' | 'mp4_hevc' | 'av1';

export type Quality = 'web' | 'balanced' | 'archive';

export type HwAccel = 'auto' | 'videotoolbox' | 'nvenc' | 'vaapi' | 'qsv' | false;

export interface QualityProfile {
	h264: { crf: number; preset: string };
	hevc: { crf: number; preset: string };
	vp9: { crf: number; cpuUsed: number };
	av1: { crf: number; preset: number };
	audio: { mp4Bitrate: string; webmBitrate: string };
	poster: { jpg: number; webp: number; avif: number };
}

export type QualityOverrides = {
	[K in keyof QualityProfile]?: Partial<QualityProfile[K]>;
};

export interface AdvancedOptions {
	/** Hardware encoder for H.264/HEVC. `'auto'` (default) picks the best available; explicit values force a specific accelerator (errors if missing); `false` forces software encoding. VP9/AV1 always use software. */
	hwAccel?: HwAccel;
	/** Output FPS cap (`min(fps, source_fps)`). Default: source FPS, uncapped. */
	fps?: number;
	/** Explicit ffmpeg binary path. Overrides static-binary autodetection and PATH. */
	ffmpegPath?: string;
	/** Explicit ffprobe binary path. */
	ffprobePath?: string;
	/** Stale lock cleanup threshold (ms). Locks older than this are treated as orphaned. Default: 7200000 (2h). */
	lockMaxAgeMs?: number;
	/** Per-codec / per-poster-format overrides on top of the chosen `quality` preset. */
	overrides?: QualityOverrides;
}

export interface EnhancedVideosOptions {
	/** Output formats. Default: `['mp4', 'webm']`. */
	formats?: VideoFormat[];
	/** Target output heights in px. Default: `[1080, 720, 480]`. Variants taller than the source are skipped automatically. */
	resolutions?: number[];
	/** Encoder quality preset. `'web'` favours small files & fast encodes; `'balanced'` (default) is the sweet spot; `'archive'` favours quality. */
	quality?: Quality;
	/** Disk cache location. Default: `<nearest-node_modules>/.cache/enhanced-video`. */
	cacheDirectory?: string;
	/** Concurrent ffmpeg processes. Default: `max(1, cpus - 1)`. */
	maxJobs?: number;
	/** Power-user knobs that the 95% case shouldn't need. */
	advanced?: AdvancedOptions;
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
	hwAccel: HwAccel;
	profile: QualityProfile;
	version: number;
}
