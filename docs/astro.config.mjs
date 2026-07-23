// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://omniblocks.github.io",
  base: "/clippy",
  integrations: [
    starlight({
      title: "Clippy",
      social: [
        {
          icon: "github",
          label: "Github",
          href: "https://github.com/OmniBlocks/clippy",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            // Each item here is one entry in the navigation menu.
            { label: "Intro", slug: "tutorial" },
            { label: "Hello, world!", slug: "tutorial/hello-world" },
          ],
        },
      ],
    }),
  ],
});
