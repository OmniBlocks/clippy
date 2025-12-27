export function wrapIIFEPlugin(argName = "Scratch") {
  return {
    name: "rewrite-esbuild-iife",
    setup(build) {
      build.onEnd(result => {
        if (!result.outputFiles) return;

        for (const file of result.outputFiles) {
          if (!file.path.endsWith(".js")) continue;

          let text = file.text;

          const iifeRegex =
            /^\(\s*(?:function\s*\(\)|\(\s*\)\s*=>)\s*\{([\s\S]*)\}\s*\)\s*\(\s*\)\s*;?\s*$/;

          const match = text.match(iifeRegex);
          if (!match) continue;

          const body = match[1];

          file.text =
            `(function(${argName}) {\n` +
            body +
            `\n})(${argName});`;
        }
      });
    }
  };
}
