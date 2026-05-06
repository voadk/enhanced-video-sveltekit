import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import pLimit from 'p-limit';

const limiter = pLimit(Math.max(1, os.cpus().length));

let ffmpeg_banner_cache: string | null = null;

export function assertFfmpeg(): string {
	if (ffmpeg_banner_cache !== null) return ffmpeg_banner_cache;
	let ffmpeg_result;
	let ffprobe_result;
	try {
		ffmpeg_result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' });
		ffprobe_result = spawnSync('ffprobe', ['-version'], { encoding: 'utf-8' });
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
	has_audio: boolean;
}

interface FfprobeOutput {
	streams?: Array<{
		codec_type?: string;
		width?: number;
		height?: number;
		duration?: string | number;
	}>;
	format?: {
		duration?: string | number;
	};
}

export async function probe(src_path: string): Promise<ProbeResult> {
	const stdout = await run_capture('ffprobe', [
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
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		throw new Error(`enhanced-video: could not read dimensions of ${src_path}`);
	}
	return { width, height, duration, has_audio: !!audio };
}

interface EncodeOpts {
	src: string;
	out: string;
	has_audio: boolean;
	width?: number;
	onProgress?: (outTimeUs: number) => void;
}

export function encodeAv1Webm({
	src,
	out,
	has_audio,
	width,
	onProgress
}: EncodeOpts): Promise<void> {
	const args = ['-i', src];
	if (width) args.push('-vf', `scale=${width}:-2`);
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

export function encodeH264Mp4({
	src,
	out,
	has_audio,
	width,
	onProgress
}: EncodeOpts): Promise<void> {
	const args = ['-i', src];
	if (width) args.push('-vf', `scale=${width}:-2`);
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

export function encodePoster({
	src,
	out,
	width
}: {
	src: string;
	out: string;
	width?: number;
}): Promise<void> {
	const filter = width ? `select=eq(n\\,0),scale=${width}:-2` : 'select=eq(n\\,0)';
	return run_ffmpeg(['-i', src, '-vf', filter, '-frames:v', '1', '-q:v', '3', out]);
}

function run_ffmpeg(args: string[], onProgress?: (outTimeUs: number) => void): Promise<void> {
	return limiter(
		() =>
			new Promise<void>((resolve, reject) => {
				const base = ['-y', '-hide_banner', '-loglevel', 'error', '-nostats'];
				if (onProgress) base.push('-progress', 'pipe:1');
				const child = spawn('ffmpeg', [...base, ...args], {
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
