<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	let {
		class: className,
		href,
		children,
		...rest
	}: HTMLAnchorAttributes & { children?: Snippet } = $props();
</script>

<a
	{href}
	class={cn(
		'font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary',
		className
	)}
	target={typeof href === 'string' && href.startsWith('http') ? '_blank' : undefined}
	rel={typeof href === 'string' && href.startsWith('http') ? 'noopener noreferrer' : undefined}
	{...rest}
>
	{#if children}{@render children()}{/if}
</a>
