import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const clippyPlugin = (config, blockFiles, menuFiles, develop) => ({
  name: 'clippy-plugin',
  setup(build) {
    build.onResolve({ filter: /^clippy:/ }, args => ({
      path: args.path,
      namespace: 'clippy-ns',
    }));

    build.onLoad({ filter: /.*/, namespace: 'clippy-ns' }, (args) => {
      if (args.path === 'clippy:scratch') {
        const templatePath = path.resolve(__dirname, './extension-template.js');
        return {
          contents: `export * from ${JSON.stringify(templatePath)};`,
          loader: 'js',
          resolveDir: path.dirname(templatePath),
        };
      }

      if (args.path === 'clippy:info') {
        return {
          contents: `export const isDevelop = ${Boolean(develop)};`,
          loader: 'js',
        };
      }

      if (args.path === 'clippy:config') {
        return {
          contents: `export default JSON.parse(${JSON.stringify(JSON.stringify(config))});`,
          loader: 'js',
        };
      }

      if (args.path === 'clippy:blocks' || args.path === 'clippy:menus') {
        const isBlocks = args.path === 'clippy:blocks';
        const files = isBlocks ? blockFiles : menuFiles;

        const imports = files.map((file, i) =>
          `import * as item${i} from ${JSON.stringify(file)};`
        ).join('\n');

        const exportsArray = files.map((file, i) => {
          const opcode = path.basename(file, path.extname(file));
          return `{ opcode: ${JSON.stringify(opcode)}, module: item${i}.default || item${i} }`;
        }).join(',\n  ');

        return {
          contents: `${imports}\n\nexport default [\n  ${exportsArray}\n];`,
          loader: 'js',
          resolveDir: process.cwd(),
        };
      }

      if (args.path === 'clippy:config') {
        return {
          contents: `export default JSON.parse(${JSON.stringify(JSON.stringify(config))});`,
          loader: 'js',
        };
      }

      return null;
    });
  },
});
