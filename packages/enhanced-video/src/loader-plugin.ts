import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig, Rollup } from 'vite';
import {
	assertFfmpeg,
	configureConcurrency,
	encodeAv1Webm,
	encodeH264Mp4,
	encodePoster,
	probe
} from './ffmpeg.js';
import { getCacheDir, getCacheKey, readMeta, writeMeta } from './cache.js';
import { progress } from './progress.js';
import type {
	CachedArtifact,
	CachedMeta,
	EnhancedVideoMetadata,
	EnhancedVideoSource,
	EnhancedVideosOptions,
	VideoFormat
} from './types.js';

const QUERY = 'enhanced-video';
const BASE_PATH = '/@enhanced-video/';

const DEFAULT_FORMATS: VideoFormat[] = ['mp4', 'webm'];
const DEFAULT_RESOLUTIONS = [1080, 720, 480];

const FORMAT_EXT: Record<VideoFormat, string> = {
	mp4: 'mp4',
	webm: 'webm'
};

const FORMAT_CONTENT_TYPE: Record<VideoFormat, string> = {
	mp4: 'video/mp4',
	webm: 'video/webm'
};

const FORMAT_SOURCE_TYPE: Record<VideoFormat, string> = {
	mp4: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
	webm: 'video/webm; codecs="av01.0.04M.08"'
};

const POSTER_CONTENT_TYPE = 'image/jpeg';

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

interface AssetEntry {
	path: string;
	contentType: string;
}

export function loader_plugin(options: EnhancedVideosOptions = {}): Plugin {
	const formats = options.formats ?? DEFAULT_FORMATS;
	const resolutions = unique_sorted_desc(options.resolutions ?? DEFAULT_RESOLUTIONS);
	const fps_cap = options.fps ?? null;
	const cache_dir_option = options.cacheDirectory ?? null;
	const max_jobs = options.maxJobs ?? null;

	let vite_config: ResolvedConfig;
	const generated_assets = new Map<string, AssetEntry>();
	const source_to_ids = new Map<string, Set<string>>();
	const logged_cache_hits = new Set<string>();

	return {
		name: 'enhanced-video:loader',
		enforce: 'pre',

		configResolved(config) {
			vite_config = config;
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
			const args = { formats, resolutions, fps: fps_cap, version: 2 };
			const key = getCacheKey(source_bytes, args, banner);
			const cache_dir = getCacheDir(vite_config.root, key, cache_dir_option);

			const cached = readMeta(cache_dir);
			let meta: CachedMeta;
			if (cached) {
				if (!logged_cache_hits.has(id)) {
					logged_cache_hits.add(id);
					const formats_seen = unique_sorted_desc(
						cached.artifacts.map((a) => a.height)
					).join('p,');
					progress.logCacheHit(
						path.basename(pathname),
						[...new Set(cached.artifacts.map((a) => a.format)), `${formats_seen}p`]
					);
				}
				meta = cached;
			} else {
				const probed = await probe(pathname);

				const target_heights = resolutions.filter((h) => h <= probed.height);
				if (target_heights.length === 0) target_heights.push(probed.height);

				const effective_fps =
					fps_cap !== null && fps_cap > 0 ? Math.min(fps_cap, probed.fps) : null;

				const tasks: Array<Promise<void>> = [];
				const artifact_specs: CachedArtifact[] = [];
				const tracked_formats = formats.map((f) => f);

				const job_label = path.basename(pathname);
				const duration_us = Math.max(1, Math.round(probed.duration * 1_000_000));
				progress.start(id, job_label, duration_us, tracked_formats);

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
					progress.update(id, fmt, progress_current[fmt]);
				};

				try {
					for (const fmt of formats) {
						let last_time = 0;
						for (const out_height of target_heights) {
							const out_width = aspect_width(probed.width, probed.height, out_height);
							const ext = FORMAT_EXT[fmt];
							const out = path.join(cache_dir, `video_${out_height}p.${ext}`);

							const onProgress = (us: number) => {
								const delta = Math.max(0, us - last_time);
								last_time = us;
								updateProgress(fmt, delta);
							};

							const opts = {
								src: pathname,
								out,
								has_audio: probed.has_audio,
								height: out_height,
								fps: effective_fps ?? undefined,
								onProgress
							};

							if (fmt === 'mp4') tasks.push(encodeH264Mp4(opts));
							else if (fmt === 'webm') tasks.push(encodeAv1Webm(opts));

							artifact_specs.push({
								format: fmt,
								height: out_height,
								width: out_width,
								file: out
							});
						}
					}

					const poster_height = target_heights[0];
					const poster_out = path.join(cache_dir, 'poster.jpg');
					tasks.push(encodePoster({ src: pathname, out: poster_out, height: poster_height }));

					await Promise.all(tasks);

					meta = {
						width: probed.width,
						height: probed.height,
						duration: probed.duration,
						artifacts: artifact_specs,
						poster_file: poster_out
					} satisfies CachedMeta;
					writeMeta(cache_dir, meta);

					const sizes: Record<string, number> = {};
					for (const a of artifact_specs) {
						const k = `${a.format}_${a.height}p`;
						try {
							sizes[k] = statSync(a.file).size;
						} catch {
							/* ignore */
						}
					}
					progress.finish(id, sizes);
				} catch (err) {
					progress.fail(id, err instanceof Error ? err.message : String(err));
					throw err;
				}
			}

			const sources: EnhancedVideoSource[] = [];
			for (const a of meta.artifacts) {
				const ext = FORMAT_EXT[a.format];
				const url = await register_asset.call(this, a.file, ext, key, pathname, a.height);
				sources.push({
					src: url,
					type: FORMAT_SOURCE_TYPE[a.format] ?? FORMAT_CONTENT_TYPE[a.format],
					format: a.format,
					height: a.height,
					width: a.width
				});
			}
			const poster_url = await register_asset.call(this, meta.poster_file, 'jpg', key, pathname);

			const out_meta: EnhancedVideoMetadata = {
				width: meta.width,
				height: meta.height,
				duration: meta.duration,
				poster: poster_url,
				sources
			};

			track_source(source_to_ids, pathname, id);

			return `export default ${JSON.stringify(out_meta)};`;

			async function register_asset(
				this: Rollup.PluginContext,
				file: string,
				ext: string,
				hash: string,
				original: string,
				height?: number
			): Promise<string> {
				const content_type =
					ext === 'jpg'
						? POSTER_CONTENT_TYPE
						: (FORMAT_CONTENT_TYPE[ext as VideoFormat] ?? 'application/octet-stream');
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
