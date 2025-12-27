import esbuild from "esbuild";
import { findProjectPath, parseScratch } from "./parse-scratch.js";
import { createConsola } from "consola";
import { logZodError } from "./format-zod-error.js";
import path from "node:path";
import fg from "fast-glob";
import { wrapIIFEPlugin } from "./wrap-iife-plugin.js";
import { clippyPlugin } from "./clippy-plugin.js";
import progressPlugin from "esbuild-plugin-progress"; 

export const build = async ({
  minify,
  target,
  mod,
  verbose,
  develop,
  esbuildOptions,
  consolaInstance,
}) => {
  const consola = consolaInstance;

  try {
    const projectPath = findProjectPath();
    consola.debug(`Found Scratch config at ${projectPath}`);

    const config = parseScratch();
    consola.debug(config);

    const blocksDir = path.join(projectPath, "src/blocks");
    const blockFiles = await fg("*.js", { cwd: blocksDir, absolute: true });
    if (blockFiles.length === 0) consola.warn("No blocks found in src/blocks!");

    const menusDir = path.join(projectPath, "src/menus");
    const menuFiles = await fg("*.js", { cwd: menusDir, absolute: true });

    const enableProgress = !process.env.CI;

    const context = await esbuild.context({
      entryPoints: ['$/scratch'],
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
      logLevel: verbose ? 'verbose' : 'silent',
      target: target || (develop ? "esnext" : "es2018"),
      plugins: [
        clippyPlugin(config, blockFiles, menuFiles, develop, mod),
        wrapIIFEPlugin("Scratch"),
        {
          name: "preserve-scratch",
          setup(build) {
            build.onResolve({ filter: /^Scratch$/ }, args => ({ path: args.path, external: true }));
          },
        },
        ...enableProgress ? [progressPlugin()] : []
      ],
      ...esbuildOptions,
      write: false,
    });

    return context;

  } catch (err) {
    logZodError(consola, err, { verbose });
    process.exitCode = 1;
    return null;
  }
};
