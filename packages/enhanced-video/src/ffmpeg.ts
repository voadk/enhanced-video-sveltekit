import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import pLimit, { type LimitFunction } from 'p-limit';

let limiter: LimitFunction = pLimit(Math.max(1, os.cpus().length - 1));

export function configureConcurrency(maxJobs: number): void {
	const n = Math.max(1, Math.floor(maxJobs));
	limiter = pLimit(n);
}

const node_require = createRequire(import.meta.url);

let ffmpeg_bin = 'ffmpeg';
let ffprobe_bin = 'ffprobe';
let binaries_resolved = false;

function try_resolve_static(): { ffmpeg?: string; ffprobe?: string } {
	const out: { ffmpeg?: string; ffprobe?: string } = {};
	try {
		const m = node_require('ffmpeg-ffprobe-static') as {
			ffmpegPath?: string;
			ffprobePath?: string;
		};
		if (typeof m.ffmpegPath === 'string') out.ffmpeg = m.ffmpegPath;
		if (typeof m.ffprobePath === 'string') out.ffprobe = m.ffprobePath;
	} catch {
		/* not installed */
	}
	if (!out.ffmpeg) {
		try {
			const m = node_require('ffmpeg-static');
			const p = typeof m === 'string' ? m : (m && m.default) || (m && m.path);
			if (typeof p === 'string') out.ffmpeg = p;
		} catch {
			/* not installed */
		}
	}
	if (!out.ffprobe) {
		try {
			const m = node_require('ffprobe-static') as { path?: string } | string;
			const p = typeof m === 'string' ? m : m?.path;
			if (typeof p === 'string') out.ffprobe = p;
		} catch {
			/* not installed */
		}
	}
	return out;
}

export function configureBinaries(opts: { ffmpegPath?: string; ffprobePath?: string }): void {
	binaries_resolved = false;
	ffmpeg_bin = 'ffmpeg';
	ffprobe_bin = 'ffprobe';

	const found = try_resolve_static();
	if (found.ffmpeg) ffmpeg_bin = found.ffmpeg;
	if (found.ffprobe) ffprobe_bin = found.ffprobe;

	if (opts.ffmpegPath) ffmpeg_bin = opts.ffmpegPath;
	if (opts.ffprobePath) ffprobe_bin = opts.ffprobePath;
}

let ffmpeg_banner_cache: string | null = null;

export function assertFfmpeg(): string {
	if (ffmpeg_banner_cache !== null) return ffmpeg_banner_cache;
	if (!binaries_resolved) {
		const found = try_resolve_static();
		if (found.ffmpeg && ffmpeg_bin === 'ffmpeg') ffmpeg_bin = found.ffmpeg;
		if (found.ffprobe && ffprobe_bin === 'ffprobe') ffprobe_bin = found.ffprobe;
		binaries_resolved = true;
	}
	let ffmpeg_result;
	let ffprobe_result;
	try {
		ffmpeg_result = spawnSync(ffmpeg_bin, ['-version'], { encoding: 'utf-8' });
		ffprobe_result = spawnSync(ffprobe_bin, ['-version'], { encoding: 'utf-8' });
	} catch (err) {
		throw new Error(missing_message(err instanceof Error ? err.message : String(err)));
	}
	if (ffmpeg_result.status !== 0 || ffprobe_result.status !== 0) {
		throw new Error(missing_message('non-zero exit'));
	}
	const banner =
		(ffmpeg_result.stdout || '').split('\n')[0] +
		' | ' +
		(ffprobe_result.stdout || '').split('\n')[0];
	ffmpeg_banner_cache = banner;
	return banner;
}

function missing_message(detail: string): string {
	return [
		`enhanced-video: ffmpeg (or ffprobe) not found on PATH (${detail}).`,
		'Install:',
		'  macOS:   brew install ffmpeg',
		'  Debian:  apt-get install ffmpeg',
		'  Windows: choco install ffmpeg'
	].join('\n');
}

export interface ProbeResult {
	width: number;
	height: number;
	duration: number;
	fps: number;
	has_audio: boolean;
}

interface FfprobeOutput {
	streams?: Array<{
		codec_type?: string;
		width?: number;
		height?: number;
		duration?: string | number;
		r_frame_rate?: string;
		avg_frame_rate?: string;
	}>;
	format?: {
		duration?: string | number;
	};
}

function parse_fps(rate: string | undefined): number {
	if (!rate) return 0;
	const [num, den] = rate.split('/').map(Number);
	if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
	return num / den;
}

export async function probe(src_path: string): Promise<ProbeResult> {
	const stdout = await run_capture(ffprobe_bin, [
		'-v',
		'error',
		'-print_format',
		'json',
		'-show_streams',
		'-show_format',
		src_path
	]);
	let data: FfprobeOutput;
	try {
		data = JSON.parse(stdout);
	} catch {
		throw new Error(`enhanced-video: ffprobe returned invalid JSON for ${src_path}`);
	}
	const streams = data.streams ?? [];
	const video = streams.find((s) => s.codec_type === 'video');
	const audio = streams.find((s) => s.codec_type === 'audio');
	if (!video) throw new Error(`enhanced-video: no video stream found in ${src_path}`);
	const width = Number(video.width);
	const height = Number(video.height);
	const duration = Number(data.format?.duration ?? video.duration ?? 0);
	const fps = parse_fps(video.r_frame_rate) || parse_fps(video.avg_frame_rate) || 30;
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		throw new Error(`enhanced-video: could not read dimensions of ${src_path}`);
	}
	return { width, height, duration, fps, has_audio: !!audio };
}

interface EncodeOpts {
	src: string;
	out: string;
	has_audio: boolean;
	/** Target output height in px (preserves aspect ratio, even-rounded width). */
	height?: number;
	/** FPS cap. */
	fps?: number;
	onProgress?: (outTimeUs: number) => void;
}

function build_vf(height: number | undefined): string | null {
	if (!height) return null;
	return `scale=-2:${height}`;
}

export function encodeAv1Webm({
	src,
	out,
	has_audio,
	height,
	fps,
	onProgress
}: EncodeOpts): Promise<void> {
	const args = ['-i', src];
	const vf = build_vf(height);
	if (vf) args.push('-vf', vf);
	if (fps) args.push('-r', String(fps));
	args.push(
		'-c:v',
		'libsvtav1',
		'-crf',
		'30',
		'-preset',
		'8',
		'-g',
		'240',
		'-svtav1-params',
		'log-level=3'
	);
	if (has_audio) args.push('-c:a', 'libopus', '-b:a', '96k');
	else args.push('-an');
	args.push('-f', 'webm', out);
	return run_ffmpeg(args, onProgress);
}

export function encodeVp9Webm({
	src,
	out,
	has_audio,
	height,
	fps,
	onProgress
}: EncodeOpts): Promise<void> {
	const args = ['-i', src];
	const vf = build_vf(height);
	if (vf) args.push('-vf', vf);
	if (fps) args.push('-r', String(fps));
	args.push(
		'-c:v',
		'libvpx-vp9',
		'-crf',
		'32',
		'-b:v',
		'0',
		'-pix_fmt',
		'yuv420p',
		'-row-mt',
		'1',
		'-deadline',
		'good',
		'-cpu-used',
		'2'
	);
	if (has_audio) args.push('-c:a', 'libopus', '-b:a', '96k');
	else args.push('-an');
	args.push('-f', 'webm', out);
	return run_ffmpeg(args, onProgress);
}

export function encodeH264Mp4({
	src,
	out,
	has_audio,
	height,
	fps,
	onProgress
}: EncodeOpts): Promise<void> {
	const args = ['-i', src];
	const vf = build_vf(height);
	if (vf) args.push('-vf', vf);
	if (fps) args.push('-r', String(fps));
	args.push(
		'-c:v',
		'libx264',
		'-crf',
		'23',
		'-preset',
		'medium',
		'-pix_fmt',
		'yuv420p',
		'-movflags',
		'+faststart'
	);
	if (has_audio) args.push('-c:a', 'aac', '-b:a', '128k');
	else args.push('-an');
	args.push('-f', 'mp4', out);
	return run_ffmpeg(args, onProgress);
}

export function encodeH265Mp4({
	src,
	out,
	has_audio,
	height,
	fps,
	onProgress
}: EncodeOpts): Promise<void> {
	const args = ['-i', src];
	const vf = build_vf(height);
	if (vf) args.push('-vf', vf);
	if (fps) args.push('-r', String(fps));
	args.push(
		'-c:v',
		'libx265',
		'-crf',
		'28',
		'-preset',
		'medium',
		'-pix_fmt',
		'yuv420p',
		'-tag:v',
		'hvc1',
		'-movflags',
		'+faststart',
		'-x265-params',
		'log-level=error'
	);
	if (has_audio) args.push('-c:a', 'aac', '-b:a', '128k');
	else args.push('-an');
	args.push('-f', 'mp4', out);
	return run_ffmpeg(args, onProgress);
}

export function encodePoster({
	src,
	out,
	height
}: {
	src: string;
	out: string;
	height?: number;
}): Promise<void> {
	const filter = height ? `select=eq(n\\,0),scale=-2:${height}` : 'select=eq(n\\,0)';
	return run_ffmpeg(['-i', src, '-vf', filter, '-frames:v', '1', '-q:v', '3', out]);
}

export function encodePosterWebp({
	src,
	out,
	height
}: {
	src: string;
	out: string;
	height?: number;
}): Promise<void> {
	const filter = height ? `select=eq(n\\,0),scale=-2:${height}` : 'select=eq(n\\,0)';
	return run_ffmpeg([
		'-i',
		src,
		'-vf',
		filter,
		'-frames:v',
		'1',
		'-c:v',
		'libwebp',
		'-quality',
		'80',
		out
	]);
}

export function encodePosterAvif({
	src,
	out,
	height
}: {
	src: string;
	out: string;
	height?: number;
}): Promise<void> {
	const filter = height ? `select=eq(n\\,0),scale=-2:${height}` : 'select=eq(n\\,0)';
	return run_ffmpeg([
		'-i',
		src,
		'-vf',
		filter,
		'-frames:v',
		'1',
		'-c:v',
		'libsvtav1',
		'-svtav1-params',
		'log-level=3',
		'-still-picture',
		'1',
		'-crf',
		'30',
		out
	]);
}

function run_ffmpeg(args: string[], onProgress?: (outTimeUs: number) => void): Promise<void> {
	return limiter(
		() =>
			new Promise<void>((resolve, reject) => {
				const base = ['-y', '-hide_banner', '-loglevel', 'error', '-nostats'];
				if (onProgress) base.push('-progress', 'pipe:1');
				const child = spawn(ffmpeg_bin, [...base, ...args], {
					stdio: ['ignore', onProgress ? 'pipe' : 'ignore', 'pipe']
				});
				let stderr = '';
				let buf = '';
				child.stderr?.on('data', (chunk: Buffer) => {
					stderr += chunk.toString();
				});
				if (onProgress && child.stdout) {
					let last_time = 0;
					child.stdout.on('data', (chunk: Buffer) => {
						buf += chunk.toString();
						const lines = buf.split('\n');
						buf = lines.pop() ?? '';
						for (const line of lines) {
							const eq = line.indexOf('=');
							if (eq === -1) continue;
							const key = line.slice(0, eq).trim();
							const value = line.slice(eq + 1).trim();
							if (key === 'out_time_us' || key === 'out_time_ms') {
								const n = parseInt(value, 10);
								if (Number.isFinite(n) && n >= 0) last_time = n;
							} else if (key === 'progress') {
								if (last_time > 0) onProgress(last_time);
							}
						}
					});
				}
				child.on('error', reject);
				child.on('close', (code, signal) => {
					if (code === 0) resolve();
					else {
						const filtered = stderr
							.split('\n')
							.filter((l) => !/^Svt\[(info|warn|error)\]:/.test(l) && l.trim() !== '')
							.join('\n')
							.trim();
						const detail = filtered || stderr.trim() || '(no output)';
						reject(
							new Error(
								`enhanced-video: ffmpeg failed (exit ${code ?? `signal ${signal}`})\n${detail.slice(-2000)}`
							)
						);
					}
				});
			})
	);
}

function run_capture(cmd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) resolve(stdout);
			else
				reject(
					new Error(
						`enhanced-video: ${cmd} failed (exit ${code})\n${stderr.trim().slice(-2000)}`
					)
				);
		});
	});
}
