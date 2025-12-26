#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { build } from './builder/index.js';
import { startDevServer } from './builder/develop.js';
import { init } from './init.js';
import path from 'path';
import fs from 'fs';
import { lintExtensionFiles } from './lint.js';

yargs(hideBin(process.argv))
  .command('build', 'Build based off the closest scratch.yaml file.', (yargs) => {
    return yargs
      .option('minify', {
        alias: 'M',
        type: 'boolean',
        describe: 'Minify to reduce storage at the cost of making the finaly output unreadable, which may make it hard to get your extension reviewed for availability on galleries.'
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
      })
  }, async (argv) => {
    const js = await build({ verbose: argv.verbose, minify: argv.minify, target: argv.target });
      if (js) {
        const outPath = path.resolve(argv.out);
        const outDir = path.dirname(outPath);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outPath, js, "utf-8");
      } else {
        console.error("Build failed, no file written.");
      }
    })
  .command('init', 'Init an extension.', (yargs) => {return yargs}, async (argv) => {
      init();
    })
  .command('lint', 'Lint this extension.', (yargs) => {return yargs}, async (argv) => {
      lintExtensionFiles();
    })
  .command('dev', 'Build based off the closest scratch.yaml file and watch for changes. The extension will be served on localhost:8000.', (yargs) => {
    return yargs
      .option('target', {
        alias: 't',
        type: 'string',
        describe: 'ESBuild target.',
        default: 'esnext'
      })
  }, (argv) => {
    startDevServer()
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
    global: true
  })
  .parse()