import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedVideos } from 'enhanced-video-sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), enhancedVideos({ resolutions: [360] }), sveltekit()]
});
