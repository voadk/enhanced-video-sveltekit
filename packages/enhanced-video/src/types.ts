export type Codec = 'av1' | 'h264';

export interface EnhancedVideoSource {
	src: string;
	type: string;
	format: 'webm' | 'mp4';
}

export interface EnhancedVideoMetadata {
	width: number;
	height: number;
	duration: number;
	poster: string;
	sources: EnhancedVideoSource[];
}

export interface CachedArtifact {
	format: 'webm' | 'mp4';
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
	formats: Codec[];
	width: number | null;
	version: number;
}
