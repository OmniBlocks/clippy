#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { build as createContext } from "./builder/index.js";
import { startDevServer } from "./builder/develop.js";
import { init } from "./init.js";
import path from "path";
import fs from "fs";
import { lintExtensionFiles } from "./lint.js";
import { findProjectPath } from "./builder/parse-scratch.js";
import { createConsola } from "consola";

let consolaInstance;

yargs(hideBin(process.argv))
  .scriptName("clippy")

  .middleware((argv) => {
    consolaInstance = createConsola({
      level: argv.verbose ? 999 : 3,
      formatOptions: { date: false },
    });
  })

  .command(
    "build",
    "Build based off the closest scratch.yaml file.",
    (yargs) => {
      return yargs
        .option("minify", {
          alias: "M",
          type: "boolean",
          describe: "Minify to reduce storage.",
        })
        .option("mod", {
          alias: "m",
          type: "string",
          default: "tw",
          describe: "The mod to target.",
        })
        .option("target", {
          alias: "t",
          type: "string",
          describe: "Build target.",
          default: "esnext", // Changed to esnext for cleaner output
        })
        .option("out", {
          alias: "o",
          type: "string",
          describe: "Output file path",
          default: "dist/extension.js",
        });
    },
    async (argv) => {
      const context = await createContext({
        verbose: argv.verbose,
        minify: argv.minify,
        target: argv.target,
        consolaInstance,
        mod: argv.mod,
      });

      if (!context) return process.exit(1);

      try {
        // 1. Rolldown returns a fresh generation result
        const result = await context.rebuild();

        // 2. Access the code from the chunk (Rolldown structure)
        const chunk = result.output.find((o) => o.type === "chunk");
        const js = chunk?.code;

        if (js) {
          const outPath = path.resolve(path.join(findProjectPath(), argv.out));
          const outDir = path.dirname(outPath);

          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

          fs.writeFileSync(outPath, js, "utf-8");
          consolaInstance.success(`Build written to ${outPath}`);
        } else {
          consolaInstance.error("Build failed, no code generated.");
        }
      } catch (err) {
        consolaInstance.error("Build error:", err);
        process.exit(1);
      } finally {
        await context.dispose();
      }
    },
  )

  .command(
    "init",
    "Init an extension.",
    (yargs) => yargs,
    async (argv) => {
      init();
    },
  )

  .command(
    "lint",
    "Lint this extension.",
    (yargs) => yargs.option("fix", { type: "boolean" }),
    async (argv) => {
      await lintExtensionFiles({ fix: argv.fix });
    },
  )

  .command(
    "dev",
    "Start the dev server.",
    (yargs) => {
      return yargs
        .option("target", {
          alias: "t",
          type: "string",
          default: "esnext",
        })
        .option("mod", {
          alias: "m",
          type: "string",
          default: "tw",
        })
        .option("port", {
          alias: "p",
          type: "number",
          default: 8000,
          description: "changing this requires sandboxAllowed to be enabled",
        });
    },
    async (argv) => {
      // startDevServer already handles the context and output mapping internally
      await startDevServer({
        port: argv.port,
        verbose: argv.verbose,
        mod: argv.mod,
        consolaInstance,
      });
    },
  )

  .option("verbose", {
    alias: "v",
    type: "boolean",
    description: "Run with verbose logging",
    global: true,
  })

  .parse();
