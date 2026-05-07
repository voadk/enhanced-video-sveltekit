import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CachedMeta, EncodeArgs } from './types.js';

const PKG_VERSION = (() => {
	try {
		const pkg_path = fileURLToPath(new URL('../package.json', import.meta.url));
		return JSON.parse(readFileSync(pkg_path, 'utf-8')).version as string;
	} catch {
		return '0.0.0';
	}
})();

function find_node_modules(cwd: string): string {
	let dir = cwd;
	while (true) {
		const candidate = path.join(dir, 'node_modules');
		if (existsSync(candidate)) return candidate;
		const parent = path.dirname(dir);
		if (parent === dir) return path.join(cwd, 'node_modules');
		dir = parent;
	}
}

export function getCacheRoot(root: string, override?: string | null): string {
	const dir = override
		? path.isAbsolute(override)
			? override
			: path.resolve(root, override)
		: path.join(find_node_modules(root), '.cache', 'enhanced-video');
	mkdirSync(dir, { recursive: true });
	return dir;
}

export function getCacheKey(
	source_bytes: Buffer,
	args: EncodeArgs,
	ffmpeg_banner: string
): string {
	const h = createHash('sha256');
	h.update(source_bytes);
	h.update('\0');
	h.update(JSON.stringify(args));
	h.update('\0');
	h.update(PKG_VERSION);
	h.update('\0');
	h.update(ffmpeg_banner);
	return h.digest('hex');
}

export function getCacheDir(root: string, key: string, override?: string | null): string {
	const dir = path.join(getCacheRoot(root, override), key);
	mkdirSync(dir, { recursive: true });
	return dir;
}

export function readMeta(dir: string): CachedMeta | null {
	const file = path.join(dir, 'meta.json');
	if (!existsSync(file)) return null;
	try {
		return JSON.parse(readFileSync(file, 'utf-8')) as CachedMeta;
	} catch {
		return null;
	}
}

export function writeMeta(dir: string, meta: CachedMeta): void {
	writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
}

const LOCK_FILE = 'encode.lock';

/** Try to acquire an exclusive encode lock. Returns true if acquired, false if another encoder holds a fresh lock. */
export function tryAcquireLock(dir: string, maxAgeMs: number): boolean {
	const lock = path.join(dir, LOCK_FILE);
	if (existsSync(lock)) {
		try {
			const stat = statSync(lock);
			const ageMs = Date.now() - stat.mtimeMs;
			if (ageMs < maxAgeMs) return false;
		} catch {
			/* fall through and overwrite */
		}
	}
	try {
		writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
		return true;
	} catch {
		return false;
	}
}

export function releaseLock(dir: string): void {
	const lock = path.join(dir, LOCK_FILE);
	try {
		unlinkSync(lock);
	} catch {
		/* ignore */
	}
}

export function isLocked(dir: string, maxAgeMs: number): boolean {
	const lock = path.join(dir, LOCK_FILE);
	if (!existsSync(lock)) return false;
	try {
		const stat = statSync(lock);
		return Date.now() - stat.mtimeMs < maxAgeMs;
	} catch {
		return false;
	}
}
