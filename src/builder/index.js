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
    const blockIds = [];
    blockFiles.forEach((file, i) => {
      const importPath = path.relative("/tmp/clippy", file).replace(/\\/g, "/");
      const fileName = path.basename(file, ".js");
      entryContent += `import block${i} from "${importPath}";\n`;
      blockIds.push({ varName: `block${i}`, opcode: fileName });
    });

    // Import menus
    const menusEntries = [];
    menuFiles.forEach((file, i) => {
      const importPath = path.relative("/tmp/clippy", file).replace(/\\/g, "/");
      entryContent += `import menu${i} from "${importPath}";\n`;
      menusEntries.push(`CLIPPY_MENU_${i}: menu${i}`);
    });

    // Dev reload snippet
    if (develop) {
      entryContent += `
/*! NOTE: Dev mode is enabled.
    You should not paste extensions from dev server into websites or projects.
    Use "clippy build" instead. */
(function(){
  try {
    const ws = new WebSocket('ws://localhost:8000');
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'extension_update') location.reload();
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
        ${blockIds
          .map(b => {
            // We create a temporary representation that excludes 'def'
            const spreadLogic = `Object.fromEntries(Object.entries(${b.varName}).filter(([k]) => k !== 'def'))`;
            
            return `{
              opcode: ${JSON.stringify(b.opcode)},
              ...${spreadLogic}
            }`;
          })
          .join(",\n")}
      ],
      menus: {
        ${menusEntries.join(",\n")}
      }
    };
  }

  ${blockIds
    .map(b => `
  ${b.opcode}(args) {
    const result = ${b.varName}.def ? ${b.varName}.def(args) : undefined;
    ${develop ? `if (result === undefined) console.warn('A block has been removed. This may CORRUPT existing projects.');` : ""}
    return result;
  }`)
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
      plugins: [
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
