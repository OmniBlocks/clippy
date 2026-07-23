export const mods = {
  tw: {
    name: "TurboWarp",
    url: (p) =>
      `https://turbowarp.org/editor?extension=http://localhost:${p}/clippy.js`,
  },
  amp: {
    name: "AmpMod",
    url: (p) =>
      `https://ampmod.codeberg.page/editor?extension=http://localhost:${p}/clippy.js`,
  },
  pm: {
    name: "PenguinMod",
    url: (p) =>
      `https://studio.penguinmod.com/editor.html?extension=http://localhost:${p}/clippy.js`,
  },
};
