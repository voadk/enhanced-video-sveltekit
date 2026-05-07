import sharp from 'sharp';
import { extractFirstFramePng } from './ffmpeg.js';

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
	/** Target output height; preserves aspect ratio. */
	height?: number;
}

/**
 * Extract the first video frame via ffmpeg (as PNG, the universal format) and
 * convert it to JPG, WebP, and AVIF in parallel via sharp. Returns the paths
 * that were actually written.
 *
 * Sharp is platform-agnostic and ships pre-built binaries — no dependence on
 * how the local ffmpeg was compiled. This is why we use sharp for image
 * conversion instead of trying to talk libwebp/libavif into ffmpeg.
 */
export async function encodePosterSet({
	src,
	jpgOut,
	webpOut,
	avifOut,
	height
}: EncodePosterSetOpts): Promise<PosterOutputs> {
	const png = await extractFirstFramePng({ src, height });

	await Promise.all([
		sharp(png).jpeg({ quality: 85, mozjpeg: true }).toFile(jpgOut),
		sharp(png).webp({ quality: 80, effort: 4 }).toFile(webpOut),
		sharp(png).avif({ quality: 50, effort: 4 }).toFile(avifOut)
	]);

	return { jpg: jpgOut, webp: webpOut, avif: avifOut };
}
