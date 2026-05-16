import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig, Rollup, ViteDevServer } from 'vite';
import {
	assertFfmpeg,
	configureBinaries,
	configureConcurrency,
	encodeAv1Webm,
	encodeH264Mp4,
	encodeH265Mp4,
	encodeVp9Webm,
	probe,
	type ProbeResult
} from './ffmpeg.js';
import { encodePosterSet } from './poster.js';
import {
	getCacheDir,
	getCacheKey,
	isLocked,
	readMeta,
	releaseLock,
	tryAcquireLock,
	writeMeta
} from './cache.js';
import { progress } from './progress.js';
import { QUALITY_VALUES, resolveProfile } from './quality.js';
import type {
	CachedArtifact,
	CachedMeta,
	CachedPoster,
	EnhancedVideoMetadata,
	EnhancedVideoPoster,
	EnhancedVideoSource,
	EnhancedVideosOptions,
	HwAccel,
	Quality,
	VideoFormat
} from './types.js';

const QUERY = 'enhanced-video';
const BASE_PATH = '/@enhanced-video/';

const DEFAULT_FORMATS: VideoFormat[] = ['mp4', 'webm'];
const DEFAULT_RESOLUTIONS = [1080, 720, 480];
const DEFAULT_QUALITY: Quality = 'balanced';
const DEFAULT_HW_ACCEL: HwAccel = 'auto';
const DEFAULT_LOCK_MAX_AGE_MS = 7200000;

const VALID_FORMATS: ReadonlyArray<VideoFormat> = ['mp4', 'webm', 'mp4_hevc', 'av1'];
const VALID_HW_ACCEL: ReadonlyArray<HwAccel> = [
	'auto',
	'videotoolbox',
	'nvenc',
	'vaapi',
	'qsv',
	false
];

const FORMAT_EXT: Record<VideoFormat, string> = {
	mp4: 'mp4',
	webm: 'webm',
	mp4_hevc: 'mp4',
	av1: 'webm'
};

const FORMAT_CONTENT_TYPE: Record<VideoFormat, string> = {
	mp4: 'video/mp4',
	webm: 'video/webm',
	mp4_hevc: 'video/mp4',
	av1: 'video/webm'
};

const FORMAT_SOURCE_TYPE: Record<VideoFormat, string> = {
	mp4: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
	webm: 'video/webm; codecs="vp09.00.10.08"',
	mp4_hevc: 'video/mp4; codecs="hvc1.1.6.L93.B0,mp4a.40.2"',
	av1: 'video/webm; codecs="av01.0.04M.08"'
};

const SOURCE_CONTENT_TYPE: Record<string, string> = {
	mp4: 'video/mp4',
	mov: 'video/quicktime',
	m4v: 'video/x-m4v',
	webm: 'video/webm',
	mkv: 'video/x-matroska',
	ogg: 'video/ogg',
	ogv: 'video/ogg'
};

const POSTER_CONTENT_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	webp: 'image/webp',
	avif: 'image/avif'
};

function has_query(id: string): boolean {
	return id.includes(`?${QUERY}`) || id.includes(`&${QUERY}`);
}

function parse_id(id: string): { pathname: string; params: URLSearchParams } {
	const [pathname, search = ''] = id.split('?');
	return { pathname, params: new URLSearchParams(search) };
}

function aspect_width(srcWidth: number, srcHeight: number, height: number): number {
	return Math.round((srcWidth * height) / srcHeight / 2) * 2;
}

function unique_sorted_desc(values: number[]): number[] {
	return Array.from(new Set(values)).sort((a, b) => b - a);
}

/** Pick output heights for a given source: drop heights taller than the source,
 *  and dedupe heights that are within 10% of an already-selected larger one. */
function select_target_heights(resolutions: number[], src_height: number): number[] {
	const sorted = unique_sorted_desc(resolutions);
	const result: number[] = [];
	for (const h of sorted) {
		if (h > src_height) continue;
		if (result.length > 0 && h > result[result.length - 1] * 0.9) continue;
		result.push(h);
	}
	if (result.length === 0) result.push(src_height);
	return result;
}

function suggest_format(unknown: string): VideoFormat | null {
	const lower = String(unknown).toLowerCase().replace(/[._-]/g, '');
	const aliases: Record<string, VideoFormat> = {
		h265: 'mp4_hevc',
		hevc: 'mp4_hevc',
		x265: 'mp4_hevc',
		mp4hevc: 'mp4_hevc',
		h264: 'mp4',
		x264: 'mp4',
		avc: 'mp4',
		mp4h264: 'mp4',
		vp9: 'webm',
		vp8: 'webm',
		av01: 'av1',
		aom: 'av1'
	};
	if (aliases[lower]) return aliases[lower];
	for (const v of VALID_FORMATS) {
		if (lower === v.replace('_', '')) return v;
	}
	return null;
}

function format_list<T>(values: ReadonlyArray<T>, quote = true): string {
	return values
		.map((v) => (quote && typeof v === 'string' ? `'${v}'` : String(v)))
		.join(', ');
}

function validate_options(opts: EnhancedVideosOptions): void {
	if (opts.formats !== undefined) {
		if (!Array.isArray(opts.formats) || opts.formats.length === 0) {
			throw new Error("enhanced-video: 'formats' must be a non-empty array.");
		}
		for (const f of opts.formats) {
			if (!VALID_FORMATS.includes(f as VideoFormat)) {
				const sug = suggest_format(String(f));
				throw new Error(
					`enhanced-video: unknown format '${String(f)}'.` +
						(sug ? ` Did you mean '${sug}'?` : '') +
						` Valid: ${format_list(VALID_FORMATS)}.`
				);
			}
		}
	}

	if (opts.resolutions !== undefined) {
		if (!Array.isArray(opts.resolutions) || opts.resolutions.length === 0) {
			throw new Error("enhanced-video: 'resolutions' must be a non-empty array of positive integers.");
		}
		for (const h of opts.resolutions) {
			if (!Number.isInteger(h) || (h as number) <= 0) {
				throw new Error(`enhanced-video: 'resolutions' must contain positive integers, got ${String(h)}.`);
			}
		}
	}

	if (opts.quality !== undefined && !QUALITY_VALUES.includes(opts.quality)) {
		throw new Error(
			`enhanced-video: invalid quality '${String(opts.quality)}'. Valid: ${format_list(QUALITY_VALUES)}.`
		);
	}

	if (opts.maxJobs !== undefined && (!Number.isFinite(opts.maxJobs) || opts.maxJobs < 1)) {
		throw new Error(`enhanced-video: 'maxJobs' must be a positive number, got ${String(opts.maxJobs)}.`);
	}

	if (opts.advanced) {
		const { hwAccel, fps } = opts.advanced;
		if (hwAccel !== undefined && !VALID_HW_ACCEL.includes(hwAccel as HwAccel)) {
			const valid = VALID_HW_ACCEL.map((v) => (v === false ? 'false' : `'${v}'`)).join(', ');
			throw new Error(
				`enhanced-video: invalid advanced.hwAccel '${String(hwAccel)}'. Valid: ${valid}.`
			);
		}
		if (fps !== undefined && (!Number.isFinite(fps) || fps <= 0)) {
			throw new Error(`enhanced-video: 'advanced.fps' must be a positive number, got ${String(fps)}.`);
		}
	}
}

interface AssetEntry {
	path: string;
	contentType: string;
}

export function loader_plugin(options: EnhancedVideosOptions = {}): Plugin {
	validate_options(options);

	const formats = options.formats ?? DEFAULT_FORMATS;
	const resolutions = unique_sorted_desc(options.resolutions ?? DEFAULT_RESOLUTIONS);
	const quality = options.quality ?? DEFAULT_QUALITY;
	const profile = resolveProfile(quality, options.advanced?.overrides);
	const cache_dir_option = options.cacheDirectory ?? null;
	const max_jobs = options.maxJobs ?? null;
	const advanced = options.advanced ?? {};
	const fps_cap = advanced.fps ?? null;
	const lock_max_age_ms = advanced.lockMaxAgeMs ?? DEFAULT_LOCK_MAX_AGE_MS;
	const hw_accel: HwAccel = advanced.hwAccel ?? DEFAULT_HW_ACCEL;

	let vite_config: ResolvedConfig;
	let dev_server: ViteDevServer | null = null;
	const generated_assets = new Map<string, AssetEntry>();
	const source_to_ids = new Map<string, Set<string>>();
	const logged_cache_hits = new Set<string>();
	const in_flight_encodes = new Map<string, Promise<void>>();

	return {
		name: 'enhanced-video:loader',
		enforce: 'pre',

		configResolved(config) {
			vite_config = config;
			configureBinaries({
				ffmpegPath: advanced.ffmpegPath,
				ffprobePath: advanced.ffprobePath
			});
			assertFfmpeg();
			if (max_jobs !== null) configureConcurrency(max_jobs);
		},

		resolveId(id) {
			if (has_query(id)) return id;
			return null;
		},

		async load(id) {
			if (!has_query(id)) return null;

			const { pathname } = parse_id(id);
			if (!existsSync(pathname)) {
				throw new Error(`enhanced-video: source file not found: ${pathname}`);
			}

			const banner = assertFfmpeg();
			const source_bytes = readFileSync(pathname);
			const args = {
				formats,
				resolutions,
				fps: fps_cap,
				hwAccel: hw_accel,
				profile,
				version: 8
			};
			const key = getCacheKey(source_bytes, args, banner);
			const cache_dir = getCacheDir(vite_config.root, key, cache_dir_option);

			track_source(source_to_ids, pathname, id);

			const cached = readMeta(cache_dir);
			if (cached) {
				if (!logged_cache_hits.has(id)) {
					logged_cache_hits.add(id);
					const heights = unique_sorted_desc(cached.artifacts.map((a) => a.height));
					progress.logCacheHit(path.basename(pathname), [
						...new Set(cached.artifacts.map((a) => a.format)),
						heights.map((h) => `${h}p`).join(',')
					]);
				}
				return emit_module.call(this, cached, key, pathname);
			}

			const probed = await probe(pathname);

			if (vite_config.command === 'serve') {
				kick_background_encode(id, pathname, probed, key, cache_dir);
				return emit_placeholder.call(this, probed, key, pathname);
			}

			await encode_all(id, pathname, probed, cache_dir);
			const meta = readMeta(cache_dir);
			if (!meta) throw new Error(`enhanced-video: encode succeeded but meta missing for ${pathname}`);
			return emit_module.call(this, meta, key, pathname);

			function kick_background_encode(
				module_id: string,
				src_path: string,
				probed_info: ProbeResult,
				cache_key: string,
				cache_path: string
			): void {
				if (in_flight_encodes.has(cache_key)) return;
				if (isLocked(cache_path, lock_max_age_ms)) return;
				if (!tryAcquireLock(cache_path, lock_max_age_ms)) return;

				const promise = (async () => {
					try {
						await encode_all(module_id, src_path, probed_info, cache_path);
					} finally {
						releaseLock(cache_path);
					}
				})()
					.then(() => {
						const ids = source_to_ids.get(src_path);
						if (!dev_server || !ids) return;
						for (const dep_id of ids) {
							const mod = dev_server.moduleGraph.getModuleById(dep_id);
							if (mod) dev_server.moduleGraph.invalidateModule(mod);
						}
						dev_server.hot.send({ type: 'full-reload', path: '*' });
					})
					.catch((err) => {
						progress.fail(module_id, err instanceof Error ? err.message : String(err));
					})
					.finally(() => {
						in_flight_encodes.delete(cache_key);
					});

				in_flight_encodes.set(cache_key, promise);
			}

			async function encode_all(
				module_id: string,
				src_path: string,
				probed_info: ProbeResult,
				cache_path: string
			): Promise<void> {
				const target_heights = select_target_heights(resolutions, probed_info.height);

				const effective_fps =
					fps_cap !== null && fps_cap > 0 ? Math.min(fps_cap, probed_info.fps) : null;

				const tasks: Array<Promise<void>> = [];
				const artifact_specs: CachedArtifact[] = [];
				const tracked_formats = formats.map((f) => f);

				const job_label = path.basename(src_path);
				const duration_us = Math.max(1, Math.round(probed_info.duration * 1_000_000));
				progress.start(module_id, job_label, duration_us, tracked_formats);

				const progress_max: Record<string, number> = {};
				const progress_current: Record<string, number> = {};
				for (const f of tracked_formats) {
					progress_max[f] = duration_us * target_heights.length;
					progress_current[f] = 0;
				}
				const updateProgress = (fmt: VideoFormat, deltaUs: number) => {
					progress_current[fmt] = Math.min(
						progress_max[fmt],
						progress_current[fmt] + deltaUs
					);
					progress.update(module_id, fmt, progress_current[fmt]);
				};

				for (const fmt of formats) {
					let last_time = 0;
					for (const out_height of target_heights) {
						const out_width = aspect_width(probed_info.width, probed_info.height, out_height);
						const ext = FORMAT_EXT[fmt];
						const out = path.join(cache_path, `video_${out_height}p.${ext}`);

						const onProgress = (us: number) => {
							const delta = Math.max(0, us - last_time);
							last_time = us;
							updateProgress(fmt, delta);
						};

						const opts = {
							src: src_path,
							out,
							has_audio: probed_info.has_audio,
							height: out_height,
							fps: effective_fps ?? undefined,
							profile,
							onProgress
						};

						if (fmt === 'mp4') tasks.push(encodeH264Mp4({ ...opts, hwAccel: hw_accel }));
						else if (fmt === 'webm') tasks.push(encodeVp9Webm(opts));
						else if (fmt === 'mp4_hevc')
							tasks.push(encodeH265Mp4({ ...opts, hwAccel: hw_accel }));
						else if (fmt === 'av1') tasks.push(encodeAv1Webm(opts));

						artifact_specs.push({
							format: fmt,
							height: out_height,
							width: out_width,
							file: out
						});
					}
				}

				const poster_height = target_heights[0];
				const poster_jpg = path.join(cache_path, 'poster.jpg');
				const poster_webp = path.join(cache_path, 'poster.webp');
				const poster_avif = path.join(cache_path, 'poster.avif');
				const poster_files: CachedPoster = { jpg: poster_jpg };

				tasks.push(
					encodePosterSet({
						src: src_path,
						jpgOut: poster_jpg,
						webpOut: poster_webp,
						avifOut: poster_avif,
						poster: profile.poster,
						height: poster_height
					}).then((out) => {
						poster_files.webp = out.webp;
						poster_files.avif = out.avif;
					})
				);

				try {
					await Promise.all(tasks);

					const meta: CachedMeta = {
						width: probed_info.width,
						height: probed_info.height,
						duration: probed_info.duration,
						artifacts: artifact_specs,
						poster_files
					};
					writeMeta(cache_path, meta);

					const sizes: Record<string, number> = {};
					for (const a of artifact_specs) {
						const k = `${a.format}_${a.height}p`;
						try {
							sizes[k] = statSync(a.file).size;
						} catch {
							/* ignore */
						}
					}
					progress.finish(module_id, sizes);
				} catch (err) {
					progress.fail(module_id, err instanceof Error ? err.message : String(err));
					throw err;
				}
			}

			async function emit_module(
				this: Rollup.PluginContext,
				cached_meta: CachedMeta,
				cache_key: string,
				src_path: string
			): Promise<string> {
				const sources: EnhancedVideoSource[] = [];
				for (const a of cached_meta.artifacts) {
					const ext = FORMAT_EXT[a.format];
					const url = await register_asset.call(this, a.file, ext, cache_key, src_path, a.height);
					sources.push({
						src: url,
						type: FORMAT_SOURCE_TYPE[a.format] ?? FORMAT_CONTENT_TYPE[a.format],
						format: a.format,
						height: a.height,
						width: a.width
					});
				}
				const poster: EnhancedVideoPoster = {
					jpg: await register_asset.call(this, cached_meta.poster_files.jpg, 'jpg', cache_key, src_path)
				};
				if (cached_meta.poster_files.webp) {
					poster.webp = await register_asset.call(
						this,
						cached_meta.poster_files.webp,
						'webp',
						cache_key,
						src_path
					);
				}
				if (cached_meta.poster_files.avif) {
					poster.avif = await register_asset.call(
						this,
						cached_meta.poster_files.avif,
						'avif',
						cache_key,
						src_path
					);
				}
				const out_meta: EnhancedVideoMetadata = {
					width: cached_meta.width,
					height: cached_meta.height,
					duration: cached_meta.duration,
					poster,
					sources
				};
				return `export default ${JSON.stringify(out_meta)};`;
			}

			async function emit_placeholder(
				this: Rollup.PluginContext,
				probed_info: ProbeResult,
				cache_key: string,
				src_path: string
			): Promise<string> {
				const src_ext = path.extname(src_path).slice(1).toLowerCase() || 'mp4';
				const content_type = SOURCE_CONTENT_TYPE[src_ext] ?? 'video/mp4';
				const dev_id = `${cache_key}.source.${src_ext}`;
				generated_assets.set(dev_id, { path: src_path, contentType: content_type });
				const source_url = BASE_PATH + dev_id;

				const out_meta: EnhancedVideoMetadata = {
					width: probed_info.width,
					height: probed_info.height,
					duration: probed_info.duration,
					poster: { jpg: '' },
					sources: [
						{
							src: source_url,
							type: content_type,
							format: 'mp4',
							width: probed_info.width,
							height: probed_info.height
						}
					]
				};
				return `export default ${JSON.stringify(out_meta)};`;
			}

			async function register_asset(
				this: Rollup.PluginContext,
				file: string,
				ext: string,
				hash: string,
				original: string,
				height?: number
			): Promise<string> {
				const content_type =
					POSTER_CONTENT_TYPES[ext] ??
					FORMAT_CONTENT_TYPE[ext as VideoFormat] ??
					'application/octet-stream';
				const suffix = height ? `.${height}p` : '';
				if (vite_config.command === 'serve') {
					const dev_id = `${hash}${suffix}.${ext}`;
					generated_assets.set(dev_id, { path: file, contentType: content_type });
					return BASE_PATH + dev_id;
				}
				const handle = this.emitFile({
					type: 'asset',
					source: readFileSync(file),
					name: `enhanced-video-${hash.slice(0, 8)}${suffix}.${ext}`,
					originalFileName: path.relative(vite_config.root, original)
				});
				return `__VITE_ASSET__${handle}__`;
			}
		},

		configureServer(server) {
			dev_server = server;
			server.middlewares.use((req, res, next) => {
				if (!req.url || !req.url.startsWith(BASE_PATH)) return next();
				const id = req.url.slice(BASE_PATH.length).split('?')[0];
				const entry = generated_assets.get(id);
				if (!entry) return next();
				let stat;
				try {
					stat = statSync(entry.path);
				} catch {
					return next();
				}

				const range = req.headers.range;
				if (range) {
					const match = /^bytes=(\d*)-(\d*)$/.exec(range);
					if (match) {
						const start = match[1] ? parseInt(match[1], 10) : 0;
						const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
						if (start <= end && end < stat.size) {
							res.statusCode = 206;
							res.setHeader('Content-Type', entry.contentType);
							res.setHeader('Content-Length', String(end - start + 1));
							res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
							res.setHeader('Accept-Ranges', 'bytes');
							createReadStream(entry.path, { start, end }).pipe(res);
							return;
						}
					}
				}

				res.statusCode = 200;
				res.setHeader('Content-Type', entry.contentType);
				res.setHeader('Content-Length', String(stat.size));
				res.setHeader('Accept-Ranges', 'bytes');
				createReadStream(entry.path).pipe(res);
			});
		},

		handleHotUpdate({ file, server }) {
			const ids = source_to_ids.get(file);
			if (!ids || ids.size === 0) return;
			const modules = [];
			for (const id of ids) {
				const mod = server.moduleGraph.getModuleById(id);
				if (mod) modules.push(mod);
			}
			return modules;
		}
	};
}

function track_source(map: Map<string, Set<string>>, src: string, id: string): void {
	let set = map.get(src);
	if (!set) {
		set = new Set();
		map.set(src, set);
	}
	set.add(id);
}
