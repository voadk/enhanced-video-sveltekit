<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { HTMLVideoAttributes } from 'svelte/elements';
	import type { EnhancedVideoMetadata } from '../types.js';

	type Props = Omit<HTMLVideoAttributes, 'src' | 'poster'> & {
		metadata: EnhancedVideoMetadata;
		loading?: 'lazy' | 'eager';
	};

	let {
		metadata,
		class: className = '',
		style = '',
		preload = 'metadata',
		loading = 'lazy',
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
		let observer: IntersectionObserver | undefined;
		let trackerCleanup: (() => void) | undefined;
		let activated = false;

		function activate() {
			if (activated) return;
			activated = true;
			loaded = true;
			void tick().then(() => {
				const el = videoEl;
				if (!el) return;
				el.load();
				el.play().catch(() => {});
				trackerCleanup = trackPlayback(el);
			});
		}

		if (loading === 'lazy' && typeof IntersectionObserver !== 'undefined' && wrapperEl) {
			observer = new IntersectionObserver(
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
			observer.observe(wrapperEl);
		} else {
			activate();
		}

		return () => {
			observer?.disconnect();
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
		{...rest}
	>
		{#if loaded}
			{#each metadata.sources as source (source.src)}
				<source src={source.src} type={source.type} size={source.height} />
			{/each}
		{/if}
	</video>
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
