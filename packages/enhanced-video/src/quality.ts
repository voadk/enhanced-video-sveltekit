import type { Quality, QualityOverrides, QualityProfile } from './types.js';

export const QUALITY_VALUES: ReadonlyArray<Quality> = ['web', 'balanced', 'archive'];

export const qualityProfiles: Record<Quality, QualityProfile> = {
	web: {
		h264: { crf: 26, preset: 'fast' },
		hevc: { crf: 30, preset: 'fast' },
		vp9: { crf: 34, cpuUsed: 4 },
		av1: { crf: 33, preset: 10 },
		audio: { mp4Bitrate: '128k', webmBitrate: '96k' },
		poster: { jpg: 80, webp: 75, avif: 45 }
	},
	balanced: {
		h264: { crf: 23, preset: 'medium' },
		hevc: { crf: 28, preset: 'medium' },
		vp9: { crf: 32, cpuUsed: 2 },
		av1: { crf: 30, preset: 8 },
		audio: { mp4Bitrate: '128k', webmBitrate: '96k' },
		poster: { jpg: 85, webp: 80, avif: 50 }
	},
	archive: {
		h264: { crf: 20, preset: 'slow' },
		hevc: { crf: 25, preset: 'slow' },
		vp9: { crf: 30, cpuUsed: 1 },
		av1: { crf: 27, preset: 6 },
		audio: { mp4Bitrate: '192k', webmBitrate: '128k' },
		poster: { jpg: 92, webp: 88, avif: 60 }
	}
};

export function resolveProfile(quality: Quality, overrides?: QualityOverrides): QualityProfile {
	const base = qualityProfiles[quality];
	if (!overrides) return base;
	return {
		h264: { ...base.h264, ...overrides.h264 },
		hevc: { ...base.hevc, ...overrides.hevc },
		vp9: { ...base.vp9, ...overrides.vp9 },
		av1: { ...base.av1, ...overrides.av1 },
		audio: { ...base.audio, ...overrides.audio },
		poster: { ...base.poster, ...overrides.poster }
	};
}
