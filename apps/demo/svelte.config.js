import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import remarkGfm from 'remark-gfm';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvex_options = {
	extensions: ['.svx'],
	layout: {
		_: join(__dirname, 'src/lib/mdsvex/MdsvexArticleLayout.svelte')
	},
	remarkPlugins: [remarkGfm],
	smartypants: {
		dashes: 'oldschool'
	},
	highlight: {
		alias: {
			ts: 'typescript',
			js: 'javascript'
		}
	}
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.svx'],
	preprocess: [vitePreprocess(), mdsvex(mdsvex_options)],
	kit: {
		adapter: adapter()
	}
};

export default config;
