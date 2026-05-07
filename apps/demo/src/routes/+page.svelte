<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Video01Icon,
		Github01Icon,
		Download01Icon,
		Image01Icon,
		EyeIcon,
		Database02Icon,
		ServerStackIcon,
		Activity01Icon,
		SparklesIcon,
		ArrowRight01Icon,
		PlayCircleIcon,
		PackageIcon,
		FileEditIcon,
		ZapIcon
	} from '@hugeicons/core-free-icons';
	import type { IconSvgElement } from '@hugeicons/svelte';

	type Feature = { icon: IconSvgElement; title: string; text: string };

	const features: Feature[] = [
		{
			icon: SparklesIcon,
			title: 'AV1 + H.264',
			text: 'Modern AV1 (.webm) for capable browsers, H.264 (.mp4) fallback for the rest. Browser picks the best one supported.'
		},
		{
			icon: Image01Icon,
			title: 'Auto poster',
			text: 'First frame extracted with ffmpeg, rendered as an <img> overlay that fades out the moment the video actually starts playing.'
		},
		{
			icon: EyeIcon,
			title: 'Lazy by default',
			text: '<source> elements aren’t rendered and the video doesn’t request a single byte until the wrapper enters the viewport.'
		},
		{
			icon: Database02Icon,
			title: 'On-disk cache',
			text: 'Encodes are content-hashed by source bytes ⊕ encoder args ⊕ ffmpeg version. Subsequent dev starts and builds are instant.'
		},
		{
			icon: Activity01Icon,
			title: 'Live progress',
			text: 'Terminal progress bar in TTY mode, plain start/done logs in CI. See exactly which video is encoding and how long it took.'
		},
		{
			icon: ServerStackIcon,
			title: 'SSR-ready',
			text: 'Width/height + aspect-ratio baked into the SSR HTML. Zero CLS. Dev mode streams cached files via Vite middleware with HTTP range support.'
		}
	];
</script>

<div class="min-h-screen bg-background text-foreground">
	<header class="border-b border-border/50">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<div class="flex items-center gap-2">
				<HugeiconsIcon icon={Video01Icon} size={22} />
				<span class="font-mono text-sm font-medium">enhanced-video</span>
				<Badge variant="secondary" class="ml-1 font-mono text-[10px]">v0.0.1</Badge>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" href="https://github.com/voadk/enhanced-video-sveltekit" target="_blank">
					<HugeiconsIcon icon={Github01Icon} size={16} />
					GitHub
				</Button>
				<Button variant="default" size="sm" href="https://www.npmjs.com/package/enhanced-video" target="_blank">
					<HugeiconsIcon icon={PackageIcon} size={16} />
					npm
				</Button>
			</div>
		</div>
	</header>

	<section class="mx-auto max-w-6xl px-6 py-16 md:py-24">
		<div class="flex flex-col items-start gap-6">
			<Badge variant="outline" class="font-mono text-xs">
				<HugeiconsIcon icon={ZapIcon} size={12} class="mr-1" />
				Build-time video optimization for SvelteKit
			</Badge>
			<h1 class="text-4xl font-bold tracking-tight md:text-6xl">
				Drop in <code class="rounded-md bg-muted px-2 py-1 font-mono text-3xl text-primary md:text-5xl">&lt;enhanced:video&gt;</code>
			</h1>
			<p class="max-w-2xl text-lg text-muted-foreground md:text-xl">
				Get back AV1 + H.264 sources, an auto-extracted poster, lazy loading, and zero layout shift. One tag, zero config.
			</p>

			<div class="mt-2 w-full max-w-xl">
				<Tabs.Root value="pnpm">
					<Tabs.List class="grid w-fit grid-cols-3">
						<Tabs.Trigger value="pnpm">pnpm</Tabs.Trigger>
						<Tabs.Trigger value="npm">npm</Tabs.Trigger>
						<Tabs.Trigger value="bun">bun</Tabs.Trigger>
					</Tabs.List>
					<Tabs.Content value="pnpm">
						<pre class="overflow-x-auto rounded-md border bg-muted/50 p-4 font-mono text-sm"><code>pnpm add -D enhanced-video</code></pre>
					</Tabs.Content>
					<Tabs.Content value="npm">
						<pre class="overflow-x-auto rounded-md border bg-muted/50 p-4 font-mono text-sm"><code>npm install -D enhanced-video</code></pre>
					</Tabs.Content>
					<Tabs.Content value="bun">
						<pre class="overflow-x-auto rounded-md border bg-muted/50 p-4 font-mono text-sm"><code>bun add -d enhanced-video</code></pre>
					</Tabs.Content>
				</Tabs.Root>
			</div>

			<div class="flex flex-wrap items-center gap-3">
				<Button size="lg" href="#demo">
					<HugeiconsIcon icon={PlayCircleIcon} size={18} />
					See live demo
				</Button>
				<Button size="lg" variant="outline" href="https://github.com/voadk/enhanced-video-sveltekit#readme" target="_blank">
					Read the docs
					<HugeiconsIcon icon={ArrowRight01Icon} size={16} />
				</Button>
			</div>
		</div>
	</section>

	<Separator />

	<section id="demo" class="mx-auto max-w-6xl px-6 py-16 md:py-24">
		<div class="flex flex-col items-start gap-3">
			<Badge variant="secondary" class="font-mono text-xs">Live demo</Badge>
			<h2 class="text-3xl font-bold tracking-tight md:text-4xl">Three videos, three behaviours</h2>
			<p class="max-w-2xl text-muted-foreground">
				Each one is authored as a single <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">&lt;enhanced:video&gt;</code> tag. The first is eager &mdash; loaded right away because it&rsquo;s the hero. The other two stay cold until you scroll into them.
			</p>
		</div>

		<div class="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
			<div class="md:col-span-2">
				<div class="mb-3 flex items-center gap-2">
					<Badge variant="default" class="font-mono text-[10px]">EAGER</Badge>
					<span class="font-mono text-sm text-muted-foreground">$lib/clip2.mov</span>
				</div>
				<div class="overflow-hidden rounded-lg border shadow-lg">
					<enhanced:video
						src="$lib/clip2.mov"
						autoplay
						muted
						loop
						playsinline
						loading="eager"
					></enhanced:video>
				</div>
			</div>

			<div>
				<div class="mb-3 flex items-center gap-2">
					<Badge variant="outline" class="font-mono text-[10px]">LAZY</Badge>
					<span class="font-mono text-sm text-muted-foreground">$lib/clip.mp4</span>
				</div>
				<div class="overflow-hidden rounded-lg border shadow-lg">
					<enhanced:video src="$lib/clip.mp4" autoplay muted loop playsinline ></enhanced:video>
				</div>
			</div>

			<div>
				<div class="mb-3 flex items-center gap-2">
					<Badge variant="outline" class="font-mono text-[10px]">LAZY</Badge>
					<span class="font-mono text-sm text-muted-foreground">$lib/videoplayback.mp4</span>
				</div>
				<div class="overflow-hidden rounded-lg border shadow-lg">
					<enhanced:video src="$lib/videoplayback.mp4" autoplay muted loop playsinline ></enhanced:video>
				</div>
			</div>
		</div>

		<Alert class="mt-8">
			<HugeiconsIcon icon={EyeIcon} size={16} />
			<AlertTitle>Watch the network tab</AlertTitle>
			<AlertDescription>
				Chrome fetches AV1 (<code class="rounded bg-muted px-1 font-mono">.webm</code>); Safari falls back to H.264 (<code class="rounded bg-muted px-1 font-mono">.mp4</code>). Lazy videos don&rsquo;t request a single byte until you scroll past them &mdash; the poster <code class="rounded bg-muted px-1 font-mono">&lt;img&gt;</code> covers the gap.
			</AlertDescription>
		</Alert>
	</section>

	<Separator />

	<section class="mx-auto max-w-6xl px-6 py-16 md:py-24">
		<div class="flex flex-col items-start gap-3">
			<Badge variant="secondary" class="font-mono text-xs">Features</Badge>
			<h2 class="text-3xl font-bold tracking-tight md:text-4xl">Everything you'd want, nothing you wouldn't</h2>
			<p class="max-w-2xl text-muted-foreground">
				Modeled on <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">@sveltejs/enhanced-img</code>. Same plugin shape, same SSR story, same dev/build parity &mdash; for video.
			</p>
		</div>

		<div class="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each features as feature}
				<Card class="border bg-card/50 backdrop-blur transition-colors hover:bg-card">
					<CardHeader>
						<div class="flex h-10 w-10 items-center justify-center rounded-md border bg-primary/5 text-primary">
							<HugeiconsIcon icon={feature.icon} size={20} />
						</div>
						<CardTitle class="mt-3">{feature.title}</CardTitle>
						<CardDescription>{@html feature.text}</CardDescription>
					</CardHeader>
				</Card>
			{/each}
		</div>
	</section>

	<Separator />

	<section class="mx-auto max-w-6xl px-6 py-16 md:py-24">
		<div class="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
			<div class="flex flex-col gap-3">
				<Badge variant="secondary" class="font-mono text-xs">Usage</Badge>
				<h2 class="text-3xl font-bold tracking-tight md:text-4xl">Wire it up in two files</h2>
				<p class="text-muted-foreground">
					<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">enhancedVideos()</code> is a Vite plugin you add before <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">sveltekit()</code>. The <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">&lt;enhanced:video&gt;</code> tag works in any Svelte component anywhere in your app.
				</p>
				<Alert variant="default" class="mt-2">
					<HugeiconsIcon icon={Download01Icon} size={16} />
					<AlertTitle>One prerequisite</AlertTitle>
					<AlertDescription>
						<code class="rounded bg-muted px-1 font-mono">ffmpeg</code> + <code class="rounded bg-muted px-1 font-mono">ffprobe</code> on PATH. <code class="rounded bg-muted px-1 font-mono">brew install ffmpeg</code>, <code class="rounded bg-muted px-1 font-mono">apt-get install ffmpeg</code>, or <code class="rounded bg-muted px-1 font-mono">choco install ffmpeg</code>.
					</AlertDescription>
				</Alert>
			</div>

			<div class="flex flex-col gap-4">
				<div>
					<div class="mb-2 flex items-center gap-2">
						<HugeiconsIcon icon={FileEditIcon} size={14} class="text-muted-foreground" />
						<span class="font-mono text-xs text-muted-foreground">vite.config.js</span>
					</div>
					<pre class="overflow-x-auto rounded-md border bg-muted/50 p-4 font-mono text-sm leading-relaxed"><code>{`import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedVideos } from 'enhanced-video';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [enhancedVideos(), sveltekit()]
});`}</code></pre>
				</div>

				<div>
					<div class="mb-2 flex items-center gap-2">
						<HugeiconsIcon icon={FileEditIcon} size={14} class="text-muted-foreground" />
						<span class="font-mono text-xs text-muted-foreground">src/routes/+page.svelte</span>
					</div>
					<pre class="overflow-x-auto rounded-md border bg-muted/50 p-4 font-mono text-sm leading-relaxed"><code>{`<enhanced:video
  src="$lib/clip.mp4"
  autoplay
  muted
  loop
  playsinline
></enhanced:video>`}</code></pre>
				</div>
			</div>
		</div>
	</section>

	<footer class="border-t border-border/50">
		<div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<HugeiconsIcon icon={Video01Icon} size={14} />
				<span class="font-mono">enhanced-video</span>
				<Separator orientation="vertical" class="h-4" />
				<span>MIT</span>
			</div>
			<div class="flex items-center gap-1">
				<Button variant="ghost" size="sm" href="https://github.com/voadk/enhanced-video-sveltekit" target="_blank">
					<HugeiconsIcon icon={Github01Icon} size={14} />
					GitHub
				</Button>
				<Button variant="ghost" size="sm" href="https://www.npmjs.com/package/enhanced-video" target="_blank">
					<HugeiconsIcon icon={PackageIcon} size={14} />
					npm
				</Button>
			</div>
		</div>
	</footer>
</div>
