export const mods = {
  tw: {
    name: 'TurboWarp',
    url: (p) => `https://turbowarp.org/editor?extension=http://localhost:${p}/clippy.js`,
  },
  amp: {
    name: 'AmpMod',
    url: (p) => `https://ampmod.codeberg.page/editor?extension=http://localhost:${p}/clippy.js`,
  },
  pm: {
    name: 'PenguinMod',
    url: (p) =>
      `https://studio.penguinmod.com/editor.html?extension=http://localhost:${p}/clippy.js`,
  },
  pm_port: {
    name: 'PenguinMod Port',
    url: (p) =>
      `https://dev-studio.penguinmod.com/editor.html?extension=http://localhost:${p}/clippy.js`,
  },
  ob: {
    name: 'OmniBlocks',
    url: (p) =>
      `https://omniblocks.github.io/editor.html?extension=http://localhost:${p}/clippy.js`,
  },
  mw: {
    name: 'MistWarp',
    url: (p) =>
      `https://editor.mistwarp.org/?extension=http://localhost:${p}/clippy.js`,
  },
  nb: {
    name: 'NitroBolt',
    url: (p) =>
      `https://nitrobolt.org/editor.html?extension=http://localhost:${p}/clippy.js`,
  },
  lk: {
    name: 'LibreKitten',
    url: (p) =>
      `https://librekitten.org/editor.html?extension=http://localhost:${p}/clippy.js`,
  },
}
