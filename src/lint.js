import { findProjectPath, parseScratch } from "./builder/parse-scratch.js";
import path from "node:path";
import fg from "fast-glob";
import { ESLint } from "eslint";
import { createConsola } from "consola";

export async function lintExtensionFiles({ develop = false, verbose = false } = {}) {
  const consola = createConsola({ level: verbose ? 999 : 3 });

  try {
    const projectPath = findProjectPath();
    consola.debug(`Found Scratch config at ${projectPath}`);

    parseScratch(); // just for validation/debug

    // Gather all relevant JS files
    const blocksDir = path.join(projectPath, "src/blocks");
    const blockFiles = await fg("*.js", { cwd: blocksDir, absolute: true });

    const menusDir = path.join(projectPath, "src/menus");
    const menuFiles = await fg("*.js", { cwd: menusDir, absolute: true });

    const filesToLint = [...blockFiles, ...menuFiles];
    if (filesToLint.length === 0) {
      consola.error("No JavaScript files found to lint.");
      process.exit(1);
    }

    // Run ESLint programmatically
    const eslint = new ESLint({});
    const results = await eslint.lintFiles(filesToLint);

    let totalErrors = 0;

    for (const result of results) {
      if (result.errorCount > 0 || result.warningCount > 0) {
        consola.warn(`\nFile: ${result.filePath}`);
        for (const msg of result.messages) {
          if (msg.severity === 2) totalErrors++; // count only errors
          consola.log(
            `  [${msg.severity === 2 ? "ERROR" : "WARN"}] Line ${msg.line}, Col ${msg.column}: ${msg.message} (${msg.ruleId})`
          );
        }
      }
    }

    if (totalErrors > 0) {
      consola.log(`\nTotal errors: ${totalErrors}`);
      process.exit(1);
    } else {
      consola.log("No ESLint errors found in your extension files.");
      process.exit(0);
    }
  } catch (err) {
    consola.fatal("Failed to lint extension files:", err);
    process.exit(1);
  }
}
