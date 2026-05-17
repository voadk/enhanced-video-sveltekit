<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	type Tone = 'info' | 'success' | 'warning';

	let {
		title,
		tone = 'info',
		class: className,
		children
	}: {
		title: string;
		tone?: Tone;
		class?: string;
		children: Snippet;
	} = $props();

	const shell = {
		info: 'border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.08]',
		success: 'border-emerald-500/30 bg-emerald-500/[0.06] dark:bg-emerald-500/[0.1]',
		warning: 'border-amber-500/35 bg-amber-500/[0.07] dark:bg-amber-500/[0.12]'
	} satisfies Record<Tone, string>;
</script>

<Alert.Root class={cn('not-prose my-6 rounded-2xl', shell[tone], className)}>
	<Alert.Title>{title}</Alert.Title>
	<Alert.Description class="text-[15px] leading-relaxed">
		{@render children()}
	</Alert.Description>
</Alert.Root>
