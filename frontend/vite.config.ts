import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const isTest = !!(globalThis as unknown as Record<string, { env?: Record<string, string> }>).process?.env?.VITEST;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0',
		port: 5173,
		proxy: {
			'/api': {
				target: 'http://backend:8080',
				changeOrigin: true
			}
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['src/tests/setup.ts'],
		alias: {
			// Svelte 5 needs browser build for component testing with jsdom
			'svelte': 'svelte'
		},
		server: {
			deps: {
				inline: [/svelte/]
			}
		}
	},
	resolve: {
		conditions: isTest ? ['browser'] : []
	}
});
