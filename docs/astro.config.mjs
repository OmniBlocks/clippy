// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	base: '/clippy',
	integrations: [
		starlight({
			title: 'Clippy',
			social: [{ icon: 'codeberg', label: 'Codeberg', href: 'https://codeberg.org/actd/clippy' }],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Intro', slug: 'tutorial' },
						{ label: 'Hello, world!', slug: 'tutorial/hello-world' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
