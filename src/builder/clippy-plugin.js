import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const clippyPlugin = (config, blockFiles, menuFiles, hiddenBlocks, develop, target) => ({
  name: 'clippy-plugin',

  resolveId(id, importer) {
    if (id.startsWith('$/')) return id

    // Handle relative imports from virtual modules
    if (
      importer &&
      (importer.startsWith('$/clippybuilder/') || importer === '$/config') &&
      id.startsWith('./')
    ) {
      return path.resolve(__dirname, id)
    }
    return null
  },

  load(id) {
    if (!id.startsWith('$/')) return null
    const subPath = id.slice(2)

    // --- CONFIG & GLOBALS ---
    if (subPath === 'config') {
      return `
        export default ${JSON.stringify(config)};
        export const isDevelop = ${Boolean(develop)};
        export const target = ${JSON.stringify(target)};
      `
    }

    // --- REGISTRIES ---
    if (subPath === 'blocks' || subPath === 'menus' || subPath === 'blocks/hidden') {
      const files =
        subPath === 'blocks' ? blockFiles : subPath === 'blocks/hidden' ? hiddenBlocks : menuFiles
      const isHidden = subPath === 'blocks/hidden'
      if (files.length === 0) return `/* No ${subPath} found. */\nexport default [];`

      const imports = files
        .map((file, i) => `import _m${i} from ${JSON.stringify(file)};`)
        .join('\n')
      const registry = files
        .map((file, i) => {
          const opcode = path.basename(file, path.extname(file))
          return `{ opcode: ${JSON.stringify(opcode)}, hiddenBlock: ${isHidden}, module: _m${i} }`
        })
        .join(',\n  ')

      return `${imports}\n\nexport default [\n  ${registry}\n];`
    }

    // --- CLIPPY BUILDER INTERNAL MODULES ---
    if (subPath.startsWith('clippybuilder/')) {
      const internalFile = subPath.replace('clippybuilder/', '')
      const filePath = path.resolve(__dirname, `./${internalFile}`)

      const finalPath = fs.existsSync(filePath) ? filePath : `${filePath}.js`
      if (!fs.existsSync(finalPath)) return `export default {};`

      return fs.readFileSync(finalPath, 'utf8')
    }

    // runtime
    if (subPath === 'runtime') {
      const filePath = path.resolve(process.cwd(), `./src/runtime.js`)
      return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : `export default {};`
    }

    return null
  },
})
