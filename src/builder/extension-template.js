import blockDefinitions from '$/blocks';
import menuDefinitions from '$/menus';
import config from '$/config';
import { isDevelop } from '$/info';

if (!Scratch.extensions.unsandboxed && !config.sandboxAllowed) {
  throw new Error(`${config.name} must run unsandboxed`);
}

class Extension {
  getInfo() {
    const blocks = blockDefinitions.map(b => ({
      opcode: b.opcode,
      ...Object.fromEntries(
        Object.entries(b.module).filter(([k]) => k !== 'def')
      )
    }));

    if (isDevelop) {
      blocks.unshift({
        func: 'viewLintResults',
        blockType: Scratch.BlockType.BUTTON,
        text: 'Open lint results (developer)'
      });
    }

    return {
      id: config.id,
      name: config.name,
      docsURI: config?.docsURI ?? undefined,
      color1: config?.colors?.[0] ?? undefined,
      color2: config?.colors?.[1] ?? undefined,
      color3: config?.colors?.[2] ?? undefined,
      blocks: blocks,
      menus: Object.fromEntries(
        menuDefinitions.map(m => [m.opcode, m.module])
      )
    };
  }

  viewLintResults() {
    /* @__PURE__ */ window.open("http://localhost:8000/lint-results");
  }
}

for (const b of blockDefinitions) {
  Extension.prototype[b.opcode] = function(args) {
    if (typeof b.module.def === 'function') {
      return b.module.def(args);
    }
    return undefined;
  };
}

const extension = new Extension();
if (config.expose) Scratch.vm.runtime[`ext_${config.id}`] = extension;
Scratch.extensions.register(extension);
