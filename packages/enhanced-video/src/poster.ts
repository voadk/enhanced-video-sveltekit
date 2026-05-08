import sharp from 'sharp';
import { extractFirstFramePng } from './ffmpeg.js';
import type { QualityProfile } from './types.js';

export interface PosterOutputs {
	jpg: string;
	webp: string;
	avif: string;
}

export interface EncodePosterSetOpts {
	src: string;
	jpgOut: string;
	webpOut: string;
	avifOut: string;
	poster: QualityProfile['poster'];
	/** Target output height; preserves aspect ratio. */
	height?: number;
}

/**
 * Extract the first video frame via ffmpeg (as PNG, the universal format) and
 * convert it to JPG, WebP, and AVIF in parallel via sharp. Sharp ships
 * pre-built binaries — no dependence on how the local ffmpeg was compiled.
 */
export async function encodePosterSet({
	src,
	jpgOut,
	webpOut,
	avifOut,
	poster,
	height
}: EncodePosterSetOpts): Promise<PosterOutputs> {
	const png = await extractFirstFramePng({ src, height });

	await Promise.all([
		sharp(png).jpeg({ quality: poster.jpg, mozjpeg: true }).toFile(jpgOut),
		sharp(png).webp({ quality: poster.webp, effort: 4 }).toFile(webpOut),
		sharp(png).avif({ quality: poster.avif, effort: 4 }).toFile(avifOut)
	]);

	return { jpg: jpgOut, webp: webpOut, avif: avifOut };
}
