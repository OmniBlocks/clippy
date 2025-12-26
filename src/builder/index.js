import { build as esbuild } from "esbuild";
import { findProjectPath, parseScratch } from "./parse-scratch.js";
import { createConsola } from "consola";
import { logZodError } from "./format-zod-error.js";
import path from "node:path";
import fg from "fast-glob";
import { wrapIIFEPlugin } from "./wrap-iife-plugin.js";
import { clippyPlugin } from "./clippy-plugin.js";

export const build = async ({
  minify,
  target,
  verbose,
  develop,
  esbuildOptions,
  consolaInstance,
}) => {
  const consola = consolaInstance ?? createConsola({ level: verbose ? 999 : 3 });

  try {
    // 1. Restore Path & Config Discovery
    const projectPath = findProjectPath();
    consola.debug(`Found Scratch config at ${projectPath}`);

    const config = parseScratch();
    consola.debug(config);

    const blocksDir = path.join(projectPath, "src/blocks");
    const blockFiles = await fg("*.js", { cwd: blocksDir, absolute: true });
    if (blockFiles.length === 0) consola.warn("No blocks found in src/blocks!");

    const menusDir = path.join(projectPath, "src/menus");
    const menuFiles = await fg("*.js", { cwd: menusDir, absolute: true });

    const result = await esbuild({
      entryPoints: ['clippy:scratch'],
      bundle: true,
      format: "iife",
      minifyIdentifiers: false,
      minifySyntax: minify,
      minifyWhitespace: minify,
      treeShaking: !develop,
      keepNames: true,
      sourcesContent: false,
      legalComments: "inline",
      sourcemap: develop ? "inline" : false,
      target: target || (develop ? "esnext" : "es2018"),
      plugins: [
        clippyPlugin(config, blockFiles, menuFiles, develop),
        wrapIIFEPlugin("Scratch"),
        {
          name: "preserve-scratch",
          setup(build) {
            build.onResolve({ filter: /^Scratch$/ }, args => ({ path: args.path, external: true }));
          },
        },
      ],
      ...esbuildOptions,
      write: false,
    });

    let resultText = result.outputFiles[0].text;

    if (develop) {
      const devSnippet = `
(function(){
  try {
    const ws = new WebSocket('ws://localhost:8000');
    ws.onmessage = (e) => JSON.parse(e.data).type === 'extension_update' && location.reload();
    ws.onopen = () => console.log('[Clippy Dev] Connected');
  } catch(e) { console.warn('[Clippy Dev] WebSocket failed', e); }
})();\n`;
      resultText = devSnippet + resultText;
    }

    if (config.galleryData) {
      const g = config.galleryData;
      const galleryComments =
        `// Name: ${JSON.stringify(g.name || config.name).slice(1, -1)}\n` +
        `// ID: ${JSON.stringify(config.id).slice(1, -1)}\n` +
        `// Description: ${JSON.stringify(g.description || "").slice(1, -1)}\n` +
        `// License: ${JSON.stringify(g.license || "unlicense").slice(1, -1)}\n\n`;
      resultText = galleryComments + resultText;
    }

    return resultText;

  } catch (err) {
    logZodError(consola, err, { verbose });
    process.exitCode = 1;
    return null;
  }
};