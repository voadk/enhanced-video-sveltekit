const PREFIX = '[enhanced-video]';
const BAR_WIDTH = 24;
const FILLED = '█';
const EMPTY = '░';

interface ActiveJob {
	id: string;
	label: string;
	durationUs: number;
	tracked: Map<string, number>;
	startedAt: number;
}

export class ProgressManager {
	private active = new Map<string, ActiveJob>();
	private rendered = 0;
	private readonly tty: boolean;

	constructor() {
		this.tty = !!process.stderr.isTTY;
	}

	start(id: string, label: string, durationUs: number, formats: string[]): void {
		const job: ActiveJob = {
			id,
			label,
			durationUs: Math.max(1, durationUs),
			tracked: new Map(formats.map((f) => [f, 0])),
			startedAt: Date.now()
		};
		this.active.set(id, job);
		if (this.tty) {
			this.render();
		} else {
			process.stderr.write(`${PREFIX} encoding ${label} (${formats.join(', ')})\n`);
		}
	}

	update(id: string, format: string, outTimeUs: number): void {
		const job = this.active.get(id);
		if (!job) return;
		const prev = job.tracked.get(format);
		if (prev === undefined) return;
		if (outTimeUs <= prev) return;
		job.tracked.set(format, outTimeUs);
		if (this.tty) this.render();
	}

	finish(id: string, sizes?: Record<string, number>): void {
		const job = this.active.get(id);
		if (!job) return;
		const elapsed = (Date.now() - job.startedAt) / 1000;
		this.active.delete(id);
		if (this.tty) {
			this.eraseActive();
			process.stderr.write(this.formatDoneLine(job.label, elapsed, sizes) + '\n');
			this.render();
		} else {
			process.stderr.write(this.formatDoneLine(job.label, elapsed, sizes) + '\n');
		}
	}

	fail(id: string, message: string): void {
		const job = this.active.get(id);
		if (!job) return;
		this.active.delete(id);
		if (this.tty) {
			this.eraseActive();
			process.stderr.write(`${PREFIX} ✗ ${job.label}  ${message}\n`);
			this.render();
		} else {
			process.stderr.write(`${PREFIX} ${job.label} failed: ${message}\n`);
		}
	}

	logCacheHit(label: string, formats: string[]): void {
		const line = `${PREFIX} → ${label}  (cached: ${formats.join(', ')})\n`;
		if (this.tty) {
			this.eraseActive();
			process.stderr.write(line);
			this.render();
		} else {
			process.stderr.write(line);
		}
	}

	private formatDoneLine(label: string, elapsed: number, sizes?: Record<string, number>): string {
		const sizeText = sizes
			? ' [' +
				Object.entries(sizes)
					.map(([k, v]) => `${k}: ${formatBytes(v)}`)
					.join(', ') +
				']'
			: '';
		return `${PREFIX} ✓ ${label}  ${elapsed.toFixed(1)}s${sizeText}`;
	}

	private eraseActive(): void {
		if (this.rendered === 0) return;
		const out = process.stderr;
		out.write(`\x1b[${this.rendered}A\r\x1b[J`);
		this.rendered = 0;
	}

	private render(): void {
		this.eraseActive();
		if (this.active.size === 0) return;
		const lines: string[] = [];
		for (const job of this.active.values()) {
			lines.push(this.formatLine(job));
		}
		process.stderr.write(lines.join('\n') + '\n');
		this.rendered = lines.length;
	}

	private formatLine(job: ActiveJob): string {
		let sum = 0;
		for (const v of job.tracked.values()) sum += Math.min(v, job.durationUs) / job.durationUs;
		const fraction = job.tracked.size === 0 ? 0 : sum / job.tracked.size;
		const filled = Math.round(fraction * BAR_WIDTH);
		const bar = FILLED.repeat(filled) + EMPTY.repeat(BAR_WIDTH - filled);
		const pct = (fraction * 100).toFixed(0).padStart(3);
		const elapsed = ((Date.now() - job.startedAt) / 1000).toFixed(1).padStart(4);
		const formats = [...job.tracked.keys()].join('+');
		return `${PREFIX} ${truncate(job.label, 28).padEnd(28)} ${bar} ${pct}%  ${elapsed}s  ${formats}`;
	}
}

function truncate(s: string, n: number): string {
	if (s.length <= n) return s;
	return s.slice(0, n - 1) + '…';
}

function formatBytes(n: number): string {
	if (n < 1024) return `${n}B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
	return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

export const progress = new ProgressManager();
