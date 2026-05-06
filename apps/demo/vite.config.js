import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedVideos } from 'enhanced-video';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [enhancedVideos(), sveltekit()]
});
