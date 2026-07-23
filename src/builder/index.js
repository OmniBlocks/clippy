import { rolldown } from 'rolldown'
import { findProjectPath, parseScratch } from './parse-scratch.js'
import { logZodError } from './format-zod-error.js'
import path from 'node:path'
import fg from 'fast-glob'
import { clippyPlugin } from './clippy-plugin.js'

/**
 * Main Build Function
 */
export const build = async ({
  minify,
  target,
  mod,
  verbose,
  develop,
  rolldownOptions,
  consolaInstance,
}) => {
  const consola = consolaInstance

  try {
    const projectPath = findProjectPath()
    consola.debug(`Found project at ${projectPath}`)

    let config
    try {
      config = parseScratch()
    } catch (err) {
      if (err.name === 'ZodError') {
        logZodError(consola, err, { verbose })
        process.exit(1)
      }
      throw err
    }

    // Resolve block and menu files
    const resolveFiles = (dir) =>
      fg('*.js', {
        cwd: path.join(projectPath, dir),
        absolute: true,
      })

    const [blockFiles, menuFiles, hiddenBlocks] = await Promise.all([
      resolveFiles('src/blocks'),
      resolveFiles('src/menus'),
      resolveFiles('src/blocks/hidden'),
    ])

    if (blockFiles.length === 0) {
      consola.warn('No blocks found in src/blocks!')
    }

    // 1. Input Options
    const inputOptions = {
      input: '$/clippybuilder/extension-template.js',
      platform: 'browser',
      // 'define' performs global text replacement
      plugins: [clippyPlugin(config, blockFiles, menuFiles, hiddenBlocks, develop, mod)],
      // Standard Rolldown/Rollup behavior
      treeshake: !develop,
      ...rolldownOptions,
    }

    // 2. Initial Bundle Creation
    const bundle = await rolldown(inputOptions)

    /**
     * Rebuild Logic
     * Generates a fresh bundle output in memory.
     */
    const generateOutput = async () => {
      return await bundle.generate({
        format: 'iife',
        name: 'Clippy', // The global variable for the extension
        codeSplitting: false, // Forces devtools into the main bundle
        minify: minify,
        sourcemap: develop ? 'inline' : false,
        // Keeps function names readable for the "human" look
        keepNames: true,
      })
    }

    // Return the control object to the dev server
    return {
      rebuild: generateOutput,
      dispose: async () => await bundle.close(),
    }
  } catch (err) {
    logZodError(consola, err, { verbose })
    process.exitCode = 1
    return null
  }
}
