<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="relative min-h-dvh bg-background">
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.55_0.2_264_/_0.14),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.45_0.18_264_/_0.22),transparent)]"
		aria-hidden="true"
	></div>
	<header
		class="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
	>
		<div class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
			<a
				href="/"
				class="flex items-center gap-2 font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
			>
				<span
					class="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-[11px] font-semibold text-background"
					>▶</span
				>
				<span class="hidden sm:inline">enhanced-video-sveltekit</span>
				<span class="sm:hidden">evsk</span>
			</a>
			<nav class="flex items-center gap-1 text-sm">
				<a
					href="/"
					class="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>Demo</a
				>
				<a
					href="/docs"
					class="rounded-full bg-muted px-3 py-1.5 font-medium text-foreground">Docs</a
				>
			</nav>
		</div>
	</header>

	<main class="relative mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
		{@render children()}
	</main>
</div>
