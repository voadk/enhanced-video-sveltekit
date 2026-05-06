import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig, Rollup } from 'vite';
import {
	assertFfmpeg,
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
	Codec,
	EnhancedVideoMetadata,
	EnhancedVideoSource
} from './types.js';

const QUERY = 'enhanced-video';
const BASE_PATH = '/@enhanced-video/';

const CONTENT_TYPES: Record<string, string> = {
	webm: 'video/webm',
	mp4: 'video/mp4',
	jpg: 'image/jpeg'
};

const SOURCE_TYPES: Record<string, string> = {
	webm: 'video/webm; codecs=av01.0.04M.08',
	mp4: 'video/mp4; codecs=avc1.42E01E,mp4a.40.2'
};

function has_query(id: string): boolean {
	return id.includes(`?${QUERY}`) || id.includes(`&${QUERY}`);
}

function parse_id(id: string): { pathname: string; params: URLSearchParams } {
	const [pathname, search = ''] = id.split('?');
	return { pathname, params: new URLSearchParams(search) };
}

interface AssetEntry {
	path: string;
	contentType: string;
}

export function loader_plugin(): Plugin {
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
		},

		resolveId(id) {
			if (has_query(id)) return id;
			return null;
		},

		async load(id) {
			if (!has_query(id)) return null;

			const { pathname, params } = parse_id(id);
			if (!existsSync(pathname)) {
				throw new Error(`enhanced-video: source file not found: ${pathname}`);
			}

			const formats_param = params.get('formats');
			const formats = (formats_param ? formats_param.split(',') : ['av1', 'h264']) as Codec[];
			const width_param = params.get('width');
			const width_override = width_param ? parseInt(width_param, 10) : null;

			const banner = assertFfmpeg();
			const source_bytes = readFileSync(pathname);
			const args = { formats, width: width_override, version: 1 };
			const key = getCacheKey(source_bytes, args, banner);
			const cache_dir = getCacheDir(vite_config.root, key);

			const cached = readMeta(cache_dir);
			let meta: CachedMeta;
			if (cached) {
				if (!logged_cache_hits.has(id)) {
					logged_cache_hits.add(id);
					progress.logCacheHit(
						path.basename(pathname),
						cached.artifacts.map((a) => a.format)
					);
				}
				meta = cached;
			} else {
				const probed = await probe(pathname);
				const target_width = width_override ?? probed.width;
				const target_height = width_override
					? Math.round((probed.height * width_override) / probed.width / 2) * 2
					: probed.height;

				const tasks: Array<Promise<void>> = [];
				const artifact_specs: CachedArtifact[] = [];
				const tracked_formats: string[] = [];

				if (formats.includes('av1')) tracked_formats.push('av1');
				if (formats.includes('h264')) tracked_formats.push('h264');

				const job_label = path.basename(pathname);
				const duration_us = Math.max(1, Math.round(probed.duration * 1_000_000));
				progress.start(id, job_label, duration_us, tracked_formats);

				try {
					if (formats.includes('av1')) {
						const out = path.join(cache_dir, 'video.webm');
						tasks.push(
							encodeAv1Webm({
								src: pathname,
								out,
								has_audio: probed.has_audio,
								width: width_override ?? undefined,
								onProgress: (us) => progress.update(id, 'av1', us)
							})
						);
						artifact_specs.push({ format: 'webm', file: out });
					}
					if (formats.includes('h264')) {
						const out = path.join(cache_dir, 'video.mp4');
						tasks.push(
							encodeH264Mp4({
								src: pathname,
								out,
								has_audio: probed.has_audio,
								width: width_override ?? undefined,
								onProgress: (us) => progress.update(id, 'h264', us)
							})
						);
						artifact_specs.push({ format: 'mp4', file: out });
					}
					const poster_out = path.join(cache_dir, 'poster.jpg');
					tasks.push(
						encodePoster({ src: pathname, out: poster_out, width: width_override ?? undefined })
					);

					await Promise.all(tasks);

					meta = {
						width: target_width,
						height: target_height,
						duration: probed.duration,
						artifacts: artifact_specs,
						poster_file: poster_out
					} satisfies CachedMeta;
					writeMeta(cache_dir, meta);

					const sizes: Record<string, number> = {};
					for (const a of artifact_specs) {
						try {
							sizes[a.format] = statSync(a.file).size;
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
				const url = await register_asset.call(this, a.file, a.format, key, pathname);
				sources.push({
					src: url,
					type: SOURCE_TYPES[a.format] ?? CONTENT_TYPES[a.format] ?? 'application/octet-stream',
					format: a.format
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
				original: string
			): Promise<string> {
				const content_type = CONTENT_TYPES[ext] ?? 'application/octet-stream';
				if (vite_config.command === 'serve') {
					const dev_id = `${hash}.${ext}`;
					generated_assets.set(dev_id, { path: file, contentType: content_type });
					return BASE_PATH + dev_id;
				}
				const handle = this.emitFile({
					type: 'asset',
					source: readFileSync(file),
					name: `enhanced-video-${hash.slice(0, 8)}.${ext}`,
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
