<script module lang="ts">
	import MdA from './md/MdA.svelte';
	import MdBlockquote from './md/MdBlockquote.svelte';
	import MdH1 from './md/MdH1.svelte';
	import MdH2 from './md/MdH2.svelte';
	import MdH3 from './md/MdH3.svelte';
	import MdHr from './md/MdHr.svelte';
	import MdLi from './md/MdLi.svelte';
	import MdOl from './md/MdOl.svelte';
	import MdP from './md/MdP.svelte';
	import MdPre from './md/MdPre.svelte';
	import MdStrong from './md/MdStrong.svelte';
	import MdTable from './md/MdTable.svelte';
	import MdTd from './md/MdTd.svelte';
	import MdTh from './md/MdTh.svelte';
	import MdThead from './md/MdThead.svelte';
	import MdTr from './md/MdTr.svelte';
	import MdUl from './md/MdUl.svelte';

	export {
		MdA as a,
		MdBlockquote as blockquote,
		MdH1 as h1,
		MdH2 as h2,
		MdH3 as h3,
		MdHr as hr,
		MdLi as li,
		MdOl as ol,
		MdP as p,
		MdPre as pre,
		MdStrong as strong,
		MdTable as table,
		MdTd as td,
		MdTh as th,
		MdThead as thead,
		MdTr as tr,
		MdUl as ul
	};
</script>

<script lang="ts">
	import 'prism-themes/themes/prism-one-light.css';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	let {
		title = 'Documentation',
		description = '',
		updated,
		children
	}: {
		title?: string;
		description?: string;
		updated?: string;
		children: Snippet;
	} = $props();
</script>

<article
	class={cn(
		'mx-auto w-full max-w-[min(100%,52rem)]',
		'prose prose-neutral max-w-none dark:prose-invert',
		'prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight',
		'prose-p:leading-relaxed prose-li:leading-relaxed',
		'prose-pre:bg-transparent prose-pre:p-0'
	)}
>
	<header class="not-prose mb-10 space-y-3 border-b border-border pb-8">
		<div class="flex flex-wrap items-center gap-2">
			<Badge variant="secondary" class="rounded-full px-2.5 font-mono text-[11px] uppercase tracking-wider">
				SvelteKit
			</Badge>
			<Badge variant="outline" class="rounded-full px-2.5 font-mono text-[11px] uppercase tracking-wider">
				Vite
			</Badge>
		</div>
		<h1 class="m-0 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
		{#if description}
			<p class="m-0 max-w-2xl text-base text-muted-foreground">{description}</p>
		{/if}
		{#if updated}
			<p class="m-0 text-xs text-muted-foreground">Last updated <time datetime={updated}>{updated}</time></p>
		{/if}
	</header>

	<div class="mdsvex-body">
		{@render children()}
	</div>

	<Separator class="not-prose my-14" />

	<footer class="not-prose flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
		<span>Written in MDsveX; examples use shadcn-svelte.</span>
		<a class="font-medium text-primary hover:underline" href="/">← Back to demo</a>
	</footer>
</article>
