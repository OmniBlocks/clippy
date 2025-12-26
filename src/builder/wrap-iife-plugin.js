export function wrapIIFEPlugin(argName = "Scratch") {
  return {
    name: "wrap-iife",
    setup(build) {
      // onEnd is called after esbuild finishes bundling
      build.onEnd(result => {
        if (!result.outputFiles || result.outputFiles.length === 0) return;

        result.outputFiles.forEach(file => {
          if (!file.path.endsWith(".js")) return;

          const original = file.text;

          file.text = `(function(${argName}){\n${original}\n})(${argName});`;
        });
      });
    }
  };
}
