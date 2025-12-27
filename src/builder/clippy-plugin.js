import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const clippyPlugin = (config, blockFiles, menuFiles, develop) => ({
  name: 'clippy-plugin',
  setup(build) {
    build.onResolve({ filter: /^\$\// }, args => ({
      path: args.path.slice(2),
      namespace: '__clippy_internal__',
    }));

    build.onLoad({ filter: /.*/, namespace: '__clippy_internal__' }, (args) => {
      const subPath = args.path;

      if (subPath === 'scratch') {
        const templatePath = path.resolve(__dirname, './extension-template.js');
        const devtoolsPath = path.resolve(__dirname, './devtools.js');

        return {
          contents: `"use strict";
        ${develop ? `import "./${path.basename(devtoolsPath)}"` : ''};
        export * from ${JSON.stringify(templatePath)};`,
          loader: 'js',
          resolveDir: path.dirname(templatePath),
        };
      }

      if (subPath === 'info') {
        return {
          contents: `"use strict";\nexport const isDevelop = ${Boolean(develop)};`,
          loader: 'js',
        };
      }

      if (subPath === 'config') {
        return {
          contents: `"use strict";\nexport default JSON.parse(${JSON.stringify(JSON.stringify(config))});`,
          loader: 'js',
        };
      }

      if (subPath === 'blocks' || subPath === 'menus') {
        const files = subPath === 'blocks' ? blockFiles : menuFiles;

        const imports = files.map((file, i) =>
          `import * as item${i} from ${JSON.stringify(file)};`
        ).join('\n');

        const exportsArray = files.map((file, i) => {
          const opcode = path.basename(file, path.extname(file));
          return `{ opcode: ${JSON.stringify(opcode)}, module: item${i}.default || item${i} }`;
        }).join(',\n  ');

        return {
          contents: `"use strict";\n${imports}\n\nexport default [\n  ${exportsArray}\n];`,
          loader: 'js',
          resolveDir: process.cwd(),
        };
      }

      return null;
    });
  },
});
