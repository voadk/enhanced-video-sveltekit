<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card/index.js';
	let tab = $state<'cli' | 'config'>('cli');
</script>

<div class="not-prose my-8 w-full max-w-2xl">
	<Card class="overflow-hidden border-border/80 shadow-sm">
		<CardHeader class="flex flex-row flex-wrap items-center gap-2 border-b border-border/60 bg-muted/30 py-3">
			<span class="text-xs font-medium text-muted-foreground">Example</span>
			<div class="ml-auto flex gap-1 rounded-full bg-muted p-1">
				<Button
					type="button"
					size="sm"
					variant={tab === 'cli' ? 'default' : 'ghost'}
					class="h-8 rounded-full px-3 text-xs"
					onclick={() => (tab = 'cli')}>CLI</Button>
				<Button
					type="button"
					size="sm"
					variant={tab === 'config' ? 'default' : 'ghost'}
					class="h-8 rounded-full px-3 text-xs"
					onclick={() => (tab = 'config')}>Vite</Button>
			</div>
		</CardHeader>
		<CardContent class="p-0">
			{#if tab === 'cli'}
				<div class="space-y-3 bg-card p-5 font-mono text-[13px] leading-relaxed">
					<div class="flex flex-wrap items-center gap-2">
						<Badge variant="secondary" class="font-mono text-[10px]">shell</Badge>
						<span class="text-muted-foreground">Install into a SvelteKit app</span>
					</div>
					<pre
						class="m-0 overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-foreground"
					><code>pnpm add -D enhanced-video-sveltekit</code></pre>
				</div>
			{:else}
				<div class="space-y-3 bg-card p-5 font-mono text-[13px] leading-relaxed">
					<div class="flex flex-wrap items-center gap-2">
						<Badge variant="secondary" class="font-mono text-[10px]">vite.config.ts</Badge>
						<span class="text-muted-foreground">Plugin order matters</span>
					</div>
					<pre
						class="m-0 overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-foreground"
					><code>plugins: [tailwindcss(), enhancedVideos(), sveltekit()]</code></pre>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
