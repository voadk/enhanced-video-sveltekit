<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { HTMLVideoAttributes } from 'svelte/elements';
	import type { EnhancedVideoMetadata } from '../types.js';

	type Props = Omit<HTMLVideoAttributes, 'src' | 'poster'> & {
		metadata: EnhancedVideoMetadata;
		/** When sources load. `'lazy'` (default): IntersectionObserver-gated. `'eager'`: load immediately. `'click'`: poster + play button until user clicks. */
		loading?: 'lazy' | 'eager' | 'click';
		/** Auto-pause when scrolled out of viewport, resume when scrolled back. Default true. */
		autoPause?: boolean;
		/** Honor `prefers-reduced-motion` by suppressing autoplay. Default true. */
		respectReducedMotion?: boolean;
		/** ARIA label for the click-to-play button. Default 'Play video'. */
		playLabel?: string;
	};

	let {
		metadata,
		class: className = '',
		style = '',
		preload = 'metadata',
		loading = 'lazy',
		autoPause = true,
		respectReducedMotion = true,
		playLabel = 'Play video',
		autoplay,
		...rest
	}: Props = $props();

	let wrapperEl = $state<HTMLDivElement | undefined>(undefined);
	let videoEl = $state<HTMLVideoElement | undefined>(undefined);
	let posterHidden = $state(false);
	let loaded = $state(false);
	let activated = $state(false);
	let clickedToPlay = $state(false);

	let trackerCleanup: (() => void) | undefined;
	let reducedMotionWanted = false;

	function reveal() {
		posterHidden = true;
	}

	function trackPlayback(el: HTMLVideoElement): () => void {
		if (!el.paused && el.currentTime > 0) {
			reveal();
			return () => {};
		}

		const onTimeUpdate = () => {
			if (el.currentTime > 0) finish();
		};
		const onPlaying = () => finish();
		const onError = () => finish();
		const fallback = setTimeout(finish, 1500);

		el.addEventListener('timeupdate', onTimeUpdate);
		el.addEventListener('playing', onPlaying);
		el.addEventListener('error', onError);

		function finish() {
			reveal();
			clearTimeout(fallback);
			el.removeEventListener('timeupdate', onTimeUpdate);
			el.removeEventListener('playing', onPlaying);
			el.removeEventListener('error', onError);
		}

		return finish;
	}

	function activate(forcePlay = false): void {
		if (activated) return;
		activated = true;
		loaded = true;
		const wantsPlay = forcePlay || (autoplay !== undefined && autoplay !== false && !reducedMotionWanted);
		void tick().then(() => {
			const el = videoEl;
			if (!el) return;
			el.load();
			if (wantsPlay) {
				el.play().catch(() => {});
				trackerCleanup = trackPlayback(el);
			} else {
				reveal();
			}
		});
	}

	function onPlayClick(): void {
		clickedToPlay = true;
		activate(true);
	}

	onMount(() => {
		let lazyObserver: IntersectionObserver | undefined;
		let visibilityObserver: IntersectionObserver | undefined;
		let reducedMotionMq: MediaQueryList | undefined;
		let pausedByVisibility = false;

		reducedMotionWanted =
			respectReducedMotion &&
			typeof window !== 'undefined' &&
			window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (loading === 'click') {
			// Wait for the user to click. Don't observe; don't activate.
		} else if (loading === 'lazy' && typeof IntersectionObserver !== 'undefined' && wrapperEl) {
			lazyObserver = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (entry.isIntersecting) {
							activate();
							break;
						}
					}
				},
				{ rootMargin: '200px' }
			);
			lazyObserver.observe(wrapperEl);
		} else {
			activate();
		}

		if (autoPause && typeof IntersectionObserver !== 'undefined' && wrapperEl) {
			visibilityObserver = new IntersectionObserver(
				(entries) => {
					const el = videoEl;
					if (!el) return;
					for (const entry of entries) {
						if (entry.isIntersecting) {
							if (pausedByVisibility) {
								el.play().catch(() => {});
								pausedByVisibility = false;
							}
						} else if (!el.paused) {
							el.pause();
							pausedByVisibility = true;
						}
					}
				},
				{ threshold: 0 }
			);
			visibilityObserver.observe(wrapperEl);
		}

		if (
			respectReducedMotion &&
			typeof window !== 'undefined' &&
			window.matchMedia
		) {
			reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
			const onChange = (e: MediaQueryListEvent) => {
				const el = videoEl;
				if (!el) return;
				if (e.matches && !el.paused) el.pause();
			};
			reducedMotionMq.addEventListener('change', onChange);
		}

		return () => {
			lazyObserver?.disconnect();
			visibilityObserver?.disconnect();
			trackerCleanup?.();
		};
	});
</script>

<div
	bind:this={wrapperEl}
	class={`enhanced-video-wrapper ${className}`}
	style={`aspect-ratio: ${metadata.width} / ${metadata.height};${style ? ' ' + style : ''}`}
>
	<video
		bind:this={videoEl}
		width={metadata.width}
		height={metadata.height}
		{preload}
		{autoplay}
		{...rest}
	>
		{#if loaded}
			{#each metadata.sources as source (source.src)}
				<source src={source.src} type={source.type} size={source.height} />
			{/each}
		{/if}
	</video>
	{#if metadata.poster && metadata.poster.jpg}
		<picture
			class="enhanced-video-poster"
			class:enhanced-video-poster-hidden={posterHidden}
		>
			{#if metadata.poster.avif}
				<source type="image/avif" srcset={metadata.poster.avif} />
			{/if}
			{#if metadata.poster.webp}
				<source type="image/webp" srcset={metadata.poster.webp} />
			{/if}
			<img
				src={metadata.poster.jpg}
				alt=""
				aria-hidden="true"
				loading="lazy"
				decoding="async"
				width={metadata.width}
				height={metadata.height}
			/>
		</picture>
	{/if}
	{#if loading === 'click' && !clickedToPlay}
		<button
			type="button"
			class="enhanced-video-play"
			aria-label={playLabel}
			onclick={onPlayClick}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path d="M8 5v14l11-7z" fill="currentColor" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.enhanced-video-wrapper {
		position: relative;
		display: block;
		overflow: hidden;
	}
	.enhanced-video-wrapper > video,
	.enhanced-video-wrapper > .enhanced-video-poster,
	.enhanced-video-wrapper > .enhanced-video-poster img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.enhanced-video-poster {
		opacity: 1;
		transition: opacity 200ms ease-out;
		pointer-events: none;
	}
	.enhanced-video-poster-hidden {
		opacity: 0;
	}
	.enhanced-video-play {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.15);
		border: none;
		cursor: pointer;
		transition: background 150ms ease-out;
		color: white;
	}
	.enhanced-video-play:hover,
	.enhanced-video-play:focus-visible {
		background: rgba(0, 0, 0, 0.3);
		outline: none;
	}
	.enhanced-video-play svg {
		width: clamp(48px, 12%, 96px);
		height: clamp(48px, 12%, 96px);
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
	}
</style>
