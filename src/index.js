#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { build as createContext } from './builder/index.js';
import { startDevServer } from './builder/develop.js';
import { init } from './init.js';
import path from 'path';
import fs from 'fs';
import { lintExtensionFiles } from './lint.js';
import { findProjectPath } from './builder/parse-scratch.js';
import { createConsola } from 'consola';

let consolaInstance;

yargs(hideBin(process.argv))
  .middleware(argv => {
    consolaInstance = createConsola({ level: argv.verbose ? 999 : 3 });
  })

  .command('build', 'Build based off the closest scratch.yaml file.', (yargs) => {
    return yargs
      .option('minify', {
        alias: 'M',
        type: 'boolean',
        describe: 'Minify to reduce storage at the cost of making the final output unreadable, which may make it hard to get your extension reviewed for galleries.'
      })
      .option('mod', {
        alias: 'm',
        type: 'string',
        default: 'tw',
        describe: 'The mod to target.'
      })
      .option('target', {
        alias: 't',
        type: 'string',
        describe: 'ESBuild target.',
        default: 'es2018'
      })
      .option('out', {
        alias: 'o',
        type: 'string',
        describe: 'Output file path',
        default: 'dist/extension.js'
      });
  }, async (argv) => {
    const context = await createContext({ verbose: argv.verbose, minify: argv.minify, target: argv.target, consolaInstance, mod: argv.mod });
    if (!context) return process.exit(1);

    try {
      const result = await context.rebuild();
      const js = result?.outputFiles?.[0]?.text;
      if (js) {
        const outPath = path.resolve(path.join(findProjectPath(), argv.out));
        const outDir = path.dirname(outPath);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outPath, js, "utf-8");
        consolaInstance.success(`Build written to ${outPath}`);
      } else {
        consolaInstance.error("Build failed, no file written.");
      }
    } finally {
      await context.dispose();
    }
  })

  .command('init', 'Init an extension.', (yargs) => yargs, async (argv) => {
    init();
  })

  .command('lint', 'Lint this extension using eslint.', (yargs) => yargs.option('fix', {type: 'boolean', describe: 'Auto-fix issues if possible.'}), async (argv) => {
    await lintExtensionFiles({fix: argv.fix});
  })

  .command('dev', 'Build and watch for changes. Serves the extension on localhost:8000.', (yargs) => {
    return yargs.option('target', {
      alias: 't',
      type: 'string',
      describe: 'ESBuild target.',
      default: 'esnext'
    })
  .option('mod', {
    alias: 'm',
    type: 'string',
    default: 'tw',
    describe: 'The mod to target.'
  })
  }, async (argv) => {
    await startDevServer({ port: 8000, verbose: argv.verbose, mod: argv.mod, consolaInstance });
  })

  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
    global: true
  })

  .parse();
