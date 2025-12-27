import blockDefinitions from '$/blocks';
import menuDefinitions from '$/menus';
import config from '$/config';
import { isDevelop, target } from '$/info';

if (!Scratch.extensions.unsandboxed && !config.sandboxAllowed) {
  throw new Error(`${config.name} must run unsandboxed`);
}

if (typeof amp === 'undefined' && target === 'amp') {
  throw new Error(`${config.name} must run in AmpMod, versions 0.3 or later`);
}
if (!Scratch.extensions?.isPenguinMod?.() && target === 'pm') {
  throw new Error(`${config.name} must run in PenguinMod`);
}

class Extension {
  getInfo() {
    let blocks = blockDefinitions.map(b => ({
      opcode: b.opcode,
      ...Object.fromEntries(
        Object.entries(b.module).filter(([k]) => k !== 'def')
      )
    }));

    const hasOrdering = blocks.some(b => b.paletteOrder !== undefined);
    if (hasOrdering) {
      blocks.sort((a, b) => (a.paletteOrder || 0) - (b.paletteOrder || 0));
    }

    const blocksWithGaps = [];
    for (const block of blocks) {
      blocksWithGaps.push(block);
      if (block.gap) {
        blocksWithGaps.push("---");
      }
    }

    if (isDevelop) {
      blocksWithGaps.unshift({
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
      blocks: blocksWithGaps,
      menus: Object.fromEntries(
        menuDefinitions.map(m => [m.opcode, m.module])
      )
    };
  }

  viewLintResults() {
    window.open("http://localhost:8000/lint-results");
  }
}

// ... (Rest of the prototype assignment and registration remains the same)
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