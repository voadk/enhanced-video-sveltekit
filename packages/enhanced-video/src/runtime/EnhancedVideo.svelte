<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { HTMLVideoAttributes } from 'svelte/elements';
	import type { EnhancedVideoMetadata } from '../types.js';

	type Props = Omit<HTMLVideoAttributes, 'src' | 'poster'> & {
		metadata: EnhancedVideoMetadata;
		/** When the sources are loaded. `'lazy'` (default) gates download by IntersectionObserver. `'eager'` loads immediately. */
		loading?: 'lazy' | 'eager';
		/** Auto-pause when scrolled out of viewport, resume when scrolled back. Default true. Pass `false` to disable. */
		autoPause?: boolean;
		/** Honor `prefers-reduced-motion` by suppressing autoplay. Default true. Pass `false` to override. */
		respectReducedMotion?: boolean;
	};

	let {
		metadata,
		class: className = '',
		style = '',
		preload = 'metadata',
		loading = 'lazy',
		autoPause = true,
		respectReducedMotion = true,
		autoplay,
		...rest
	}: Props = $props();

	let wrapperEl = $state<HTMLDivElement | undefined>(undefined);
	let videoEl = $state<HTMLVideoElement | undefined>(undefined);
	let posterHidden = $state(false);
	let loaded = $state(false);

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

	onMount(() => {
		let lazyObserver: IntersectionObserver | undefined;
		let visibilityObserver: IntersectionObserver | undefined;
		let trackerCleanup: (() => void) | undefined;
		let reducedMotionMq: MediaQueryList | undefined;
		let activated = false;
		let pausedByVisibility = false;

		const reducedMotionWanted =
			respectReducedMotion &&
			typeof window !== 'undefined' &&
			window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const shouldAutoplay = autoplay !== undefined && autoplay !== false && !reducedMotionWanted;

		function activate() {
			if (activated) return;
			activated = true;
			loaded = true;
			void tick().then(() => {
				const el = videoEl;
				if (!el) return;
				el.load();
				if (shouldAutoplay) {
					el.play().catch(() => {});
					trackerCleanup = trackPlayback(el);
				} else {
					reveal();
				}
			});
		}

		if (loading === 'lazy' && typeof IntersectionObserver !== 'undefined' && wrapperEl) {
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
	{#if metadata.poster}
		<img
			class="enhanced-video-poster"
			class:enhanced-video-poster-hidden={posterHidden}
			src={metadata.poster}
			alt=""
			aria-hidden="true"
			loading="lazy"
			decoding="async"
			width={metadata.width}
			height={metadata.height}
		/>
	{/if}
</div>

<style>
	.enhanced-video-wrapper {
		position: relative;
		display: block;
		overflow: hidden;
	}
	.enhanced-video-wrapper > video,
	.enhanced-video-wrapper > .enhanced-video-poster {
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
</style>
