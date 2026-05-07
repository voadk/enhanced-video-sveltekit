import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedVideos } from 'enhanced-video';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [tailwindcss(), enhancedVideos(), sveltekit()] });
