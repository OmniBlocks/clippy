import { build as esbuild } from "esbuild";
import { findProjectPath, parseScratch } from "./parse-scratch.js";
import { createConsola } from "consola";
import { logZodError } from "./format-zod-error.js";
import path from "node:path";
import fs from "node:fs";
import fg from "fast-glob";
import { wrapIIFEPlugin } from "./wrap-iife-plugin.js";

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
    const projectPath = findProjectPath();
    consola.debug(`Found Scratch config at ${projectPath}`);

    const config = parseScratch();
    consola.debug(config);

    const blocksDir = path.join(projectPath, "src/blocks");
    const blockFiles = await fg("*.js", { cwd: blocksDir, absolute: true });
    if (blockFiles.length === 0) consola.warn("No blocks found in src/blocks!");

    const menusDir = path.join(projectPath, "src/menus");
    const menuFiles = await fg("*.js", { cwd: menusDir, absolute: true });

    let entryContent = "";

    // Import blocks
    blockFiles.forEach((file, i) => {
      const importPath = path.relative("/tmp/clippy", file).replace(/\\/g, "/");
      entryContent += `import block${i} from "${importPath}";\n`;
    });

    // Import menus
    const menusEntries = [];
    menuFiles.forEach((file, i) => {
      const importPath = path.relative("/tmp/clippy", file).replace(/\\/g, "/");
      entryContent += `import menu${i} from "${importPath}";\n`;
      menusEntries.push(`CLIPPY_MENU_${i}: menu${i}`);
    });

    // Include dev reload if needed
    if (develop) {
      entryContent += `
    /*!
    **************************************************************************
    *                                                                        *
    *  WARNING FOR DEVS:                                                     *
    *  This is a development reload script meant for the dev server only.    *
    *  Use "clippy build" instead of "clippy dev" to omit this snippet.      *
    *                                                                        *
    **************************************************************************
    */
    (function(){
      try {
        const ws = new WebSocket('ws://localhost:8000');
        ws.addEventListener('message', (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'extension_update') {
            console.log('[Clippy Dev] Reloading extension...');
            location.reload();
          }
        });
        ws.addEventListener('open', () => console.log('[Clippy Dev] Connected to dev server'));
        ws.addEventListener('close', () => console.log('[Clippy Dev] Disconnected from dev server'));
      } catch(e) {
        console.warn('[Clippy Dev] WebSocket failed', e);
      }
    })();\n`;
    }

    // Main extension class
    entryContent += `
/*! Built using Clippy, the extension compiler | https://codeberg.org/ampmod/clippy */
'use strict';

if (!Scratch.extensions.unsandboxed) {
  throw new Error(${JSON.stringify(config.name)} + ' must run unsandboxed');
}

class _CLIPPY_GENERATED_ {
  getInfo() {
    return {
      id: ${JSON.stringify(config.id)},
      name: ${JSON.stringify(config.name)},
      blocks: [
        ${blockFiles
          .map(
            (_, i) => `{
          opcode: ${JSON.stringify(`block${i}`)},
          blockType: block${i}.blockType,
          text: ${JSON.stringify(blockFiles[i].text || `block${i}`)}
        }`
          )
          .join(",\n")}
      ],
      menus: {
        ${menusEntries.join(",\n")}
      }
    };
  }

  ${blockFiles
    .map(
      (_, i) => `
  ${"block" + i}(args) {
    const result = block${i}.def ? block${i}.def(args) : undefined;
    ${develop ? `if (result === undefined) console.warn('A block has been removed. This may CORRUPT existing projects.');` : ""}
    return result;
  }`
    )
    .join("\n")}
}

Scratch.extensions.register(new _CLIPPY_GENERATED_());
`;

    // Make tmp directory
    const tmpDir = "/tmp/clippy";
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpEntryPath = path.join(tmpDir, "clippy-entry.js");
    fs.writeFileSync(tmpEntryPath, entryContent);

    // esbuild
    const result = await esbuild({
      entryPoints: [tmpEntryPath],
      bundle: true,
      format: "iife",
      minify: minify,
      minifyIdentifiers: false,
      minifySyntax: minify,
      minifyWhitespace: minify,
      keepNames: true,
      legalComments: "inline",
      sourcemap: develop ? "inline" : false,
      target: target || "es2018",
      plugins: [wrapIIFEPlugin("Scratch"), {
        name: "preserve-scratch",
        setup(build) {
          build.onResolve({ filter: /^Scratch$/ }, (args) => ({ path: args.path, external: true }));
        },
      }],
      ...esbuildOptions,
      write: false,
    });

    let resultText = result.outputFiles[0].text;

    // Gallery data
    if (config.galleryData && !develop) {
      const galleryComments =
        `// Name: ${JSON.stringify(config.galleryData.name || config.name).slice(1, -1)}\n` +
        `// ID: ${JSON.stringify(config.id).slice(1, -1)}\n` +
        `// Description: ${JSON.stringify(config.galleryData.description).slice(1, -1)}\n` +
        `// License: ${JSON.stringify(config.galleryData.license).slice(1, -1)}\n\n`;
        
      resultText = galleryComments + resultText;
    }

    return resultText;
  } catch (err) {
    logZodError(consola, err, { verbose });
    process.exitCode = 1;
    return null;
  }
};
