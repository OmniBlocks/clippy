// This is converted into a functioning extension when built using index.js
// it can NOT be ran raw due to it using the $ namespace

import config, { isDevelop, target } from "$/config";
import $$blockDefinitions from "$/blocks";
import $$hiddenBlocks from "$/blocks/hidden";
import $$menuDefinitions from "$/menus";
import $$runtime from "$/runtime";

if (!Scratch.extensions.unsandboxed && !config.sandboxAllowed) {
  throw new Error(`${config.name} must run unsandboxed`);
}

if (typeof amp === "undefined" && target === "amp") {
  throw new Error(`${config.name} must run in AmpMod, versions 0.3 or later`);
}

if (!Scratch.extensions?.isPenguinMod?.() && target === "pm") {
  throw new Error(`${config.name} must run in PenguinMod`);
}

$$runtime.pre(Scratch);

let viewLint = () => "not loaded?";
if (isDevelop) {
  import("$/clippybuilder/devtools.js").then((module) => {
    const { dev, showLintingModal } = module;
    console.log(module);
    if (typeof dev === "function") dev();
    viewLint = showLintingModal;
  });
}

/* @__PURE__ */
class Extension {
  getInfo() {
    let definedBlocks = [...$$blockDefinitions, ...$$hiddenBlocks].map((b) => ({
      opcode: b.opcode,
      hideFromPalette: b.hiddenBlock,
      ...Object.fromEntries(
        Object.entries(b.module).filter(([k]) => k !== "def"),
      ),
    }));

    const hasOrdering = definedBlocks.some((b) => b.paletteOrder !== undefined);
    if (hasOrdering) {
      definedBlocks.sort(
        (a, b) => (a.paletteOrder || 0) - (b.paletteOrder || 0),
      );
    }

    const blocks = [];
    for (const block of definedBlocks) {
      blocks.push(block);
      if (block.gap) {
        blocks.push("---");
      }
    }

    if (isDevelop) {
      blocks.unshift({
        func: "__CLIPPY_VIEW_LINT__",
        blockType: Scratch.BlockType.BUTTON,
        text: "Open lint results (developer)",
      });
    }

    return {
      id: config.id,
      name: isDevelop ? `${config.name} Dev` : config.name,
      docsURI: config?.docsURI ?? undefined,
      color1: config?.colors?.[0] ?? undefined,
      color2: config?.colors?.[1] ?? undefined,
      color3: config?.colors?.[2] ?? undefined,
      blocks,
      menus: Object.fromEntries(
        $$menuDefinitions.map((m) => [m.opcode, m.module]),
      ),
    };
  }

  __CLIPPY_VIEW_LINT__() {
    return viewLint();
  }
}

// Attach each block’s function to the Extension prototype
for (const b of [...$$blockDefinitions, ...$$hiddenBlocks]) {
  /* @__PURE__ */
  Extension.prototype[b.opcode] = function (args) {
    if (typeof b.module.def === "function") {
      // If we are in development mode, wrap the block in a try/catch
      if (isDevelop) {
        try {
          return b.module.def(args);
        } catch (err) {
          import("$/clippybuilder/devtools.js").then(
            ({ blockErrorModal, openInEditor }) => {
              // Pass the file information to the modal
              // Note: 'b.path' assumes your $$blockDefinitions include the source file path
              blockErrorModal(
                `Error in block: ${b.opcode}`,
                err.message,
                () => {
                  // This is the 'onOpenFile' logic triggered by a click
                  if (b.path) {
                    // Use regex or stack trace parser to find the exact line if desired
                    openInEditor(b.path, 1, 1);
                  }
                },
              );
            },
          );
          console.error(err);
          return undefined;
        }
      }

      // Standard production execution
      return b.module.def(args);
    }
    return undefined;
  };
}

$$runtime.post(Scratch);
/* @__PURE__ */
const extension = new Extension();
if (config.expose) Scratch.vm.$$runtime[`ext_${config.id}`] = extension;
Scratch.extensions.register(extension);
