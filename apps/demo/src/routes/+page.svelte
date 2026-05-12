<script lang="ts">
	const installCmd = 'pnpm add -D enhanced-video-sveltekit';
	let copied = $state(false);

	async function copyInstall() {
		try {
			await navigator.clipboard.writeText(installCmd);
			copied = true;
			setTimeout(() => (copied = false), 1200);
		} catch {}
	}
</script>

<div class="mx-auto max-w-[880px] px-7">
	<header class="flex h-16 items-center justify-between">
		<div class="flex items-center gap-2.5 font-mono text-[13px]">
			<span
				class="grid h-5 w-5 place-items-center rounded-[5px] bg-foreground text-[10px] font-semibold text-background"
				>▶</span
			>
			<span>enhanced-video-sveltekit</span>
		</div>
		<a
			class="font-mono text-[12.5px] text-muted-foreground hover:text-foreground"
			href="https://github.com/voadk/enhanced-video-sveltekit"
			target="_blank"
			rel="noopener">GitHub ↗</a
		>
	</header>

	<section class="pt-[88px] pb-16 max-[720px]:pt-14 max-[720px]:pb-10">
		<h1
			class="m-0 max-w-[18ch] text-[clamp(36px,5vw,52px)] leading-[1.05] font-medium tracking-[-0.03em]"
		>
			Drop in <span
				class="inline-block -translate-y-[0.06em] rounded-[7px] bg-foreground px-[0.18em] py-[0.04em] font-mono text-[0.78em] font-medium tracking-[-0.04em] text-background"
				>&lt;enhanced:video&gt;</span
			><br />
			ship lighter video.
		</h1>
		<p class="mt-[22px] max-w-[52ch] text-base text-muted-foreground">
			Build-time video pipeline for SvelteKit. Multi-resolution AV1 + H.264, auto-extracted poster,
			lazy by default. One tag, zero config.
		</p>

		<div
			class="mt-[30px] inline-flex items-center overflow-hidden rounded-[9px] border border-border bg-card font-mono text-[13px] shadow-[0_1px_2px_oklch(0_0_0_/_0.04)]"
		>
			<div class="flex items-center gap-2.5 py-[9px] pr-4 pl-[14px]">
				<span class="text-[oklch(0.7_0_0)]">$</span>
				<span>{installCmd}</span>
			</div>
			<button
				type="button"
				onclick={copyInstall}
				title="Copy"
				aria-label="Copy install command"
				class="cursor-pointer self-stretch border-0 border-l border-border bg-transparent px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
			>
				{#if copied}
					<svg
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
					>
				{:else}
					<svg
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						><rect x="9" y="9" width="13" height="13" rx="2" /><path
							d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
						/></svg
					>
				{/if}
			</button>
		</div>
	</section>

	<div
		class="mt-12 grid grid-cols-4 gap-2.5 max-[720px]:grid-cols-3 max-[480px]:grid-cols-2"
	>
		<enhanced:video
			src="$lib/coverr-tel-aviv-from-above-3095-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-old-italian-city-5822-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-the-perfect-wave-2027-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-walking-near-a-water-fountain-9764-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-kitwinan-hills-602-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-traffic-in-the-city-4869-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-a-beach-in-tel-aviv-2045-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-jeep-road-trip-2408-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-city-boulevard-8888-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-sunset-in-bali-4090-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-ferris-wheel-3530-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
		<enhanced:video
			src="$lib/coverr-golden-statue-intersection-5060-1080p.mp4"
			autoplay
			muted
			loop
			playsinline
			class="rounded-lg border border-border bg-card"
			style="aspect-ratio: 16 / 10"
		></enhanced:video>
	</div>

	<footer
		class="mt-24 flex items-center justify-between border-t border-border pt-7 pb-10 font-mono text-[12.5px] text-muted-foreground"
	>
		<span>MIT</span>
		<div class="flex gap-[18px]">
			<a
				class="hover:text-foreground"
				href="https://github.com/voadk/enhanced-video-sveltekit#readme"
				target="_blank"
				rel="noopener">Docs</a
			>
			<a
				class="hover:text-foreground"
				href="https://github.com/voadk/enhanced-video-sveltekit"
				target="_blank"
				rel="noopener">GitHub</a
			>
			<a
				class="hover:text-foreground"
				href="https://www.npmjs.com/package/enhanced-video-sveltekit"
				target="_blank"
				rel="noopener">npm</a
			>
		</div>
	</footer>
</div>
