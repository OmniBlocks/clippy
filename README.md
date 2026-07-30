# Clippy

> _"The vite of custom blocks"_ -Office Assistant

Clippy is a tool for building TurboWarp extensions.

Clippy is very easy to use. All you have to do is run `clippy init`, and you're ready to start
coding your blocks in JavaScript or TypeScript!

If you are more experienced with TurboWarp extensions, you can use `src/runtime.js` /
`src/runtime.ts` to add custom code that runs before and after registering your extension, this lets
you add event handlers to the Scratch VM.

For more info, visit: https://omniblocks.github.io/clippy

## Etymology

The name comes from an inside joke in the AmpMod community, where on April Fools, Clippy would show
at the bottom right of the editor, suggesting completely random features or saying outright weird
things.

The joke began in April 2025, and has returned every year since.

We won't get much into that, but there is
[an article](https://ampmod.miraheze.org/wiki/April_Fools#Clippy) about it on their wiki.

## How Clippy works

Clippy has 2 modes:

- Dev mode: This mode gives you a dev server that hot-reloads your extension's blocks and menus in
  place when you make changes, without reloading the page. It also adds some dev extras. This is not
  intended for distributing your extension to galleries.
- Build mode: This mode creates a JavaScript file that you can share on extension galleries or add
  to your project.

## FAQ

### Is Clippy an "assistive" tool?

We do not consider Clippy to be an assistive tool in the way things such as TurboBuilder or ExtForge
are (and definitely not something like Cursor or Copilot.)

Clippy is merely an abstraction for manually writing extensions. It is not a programming
language; extensions are still written in JavaScript or a language that compiles to it.

### Can I use Clippy on extension galleries?

Clippy is currently unsuitable for publishing your extension to TurboWarp due to their strict
guidelines that prohibit the code style Clippy outputs.

The galleries for AmpMod, OmniBlocks and many others are generally more lenient when it comes to
Clippy, but it's best to contact the maintainers about it.

## License

Clippy is licenced under the Mozilla Public Licence version 2.0.
