import { findProjectPath, parseScratch } from "./builder/parse-scratch.js";
import path from "node:path";
import fg from "fast-glob";
import { ESLint } from "eslint";
import { createConsola } from "consola";

export async function lintExtensionFiles({ develop = false, verbose = false, fix = false } = {}) {
  const consola = createConsola({ level: verbose ? 999 : 3 });

  try {
    const projectPath = path.resolve(findProjectPath());
    parseScratch();

    const filesToLint = await fg(
      [path.join(projectPath, "src/blocks/*.js"), path.join(projectPath, "src/menus/*.js")],
      { absolute: true }
    );

    if (filesToLint.length === 0 && !develop) {
      consola.error("No JavaScript files found to lint.");
      process.exit(1);
    }

    const eslint = new ESLint({
      cwd: projectPath,
      fix,
      overrideConfigFile: true,
      overrideConfig: [
        {
          plugins: {
            import: (await import("eslint-plugin-import")).default,
            clippy: {
              rules: {
                "opcode": {
                  meta: { type: "problem" },
                  create(context) {
                    function checkObject(node, obj) {
                      if (!obj || obj.type !== "ObjectExpression") return;
                      const hasOpcode = obj.properties.some(p => p.key?.name === "opcode");
                      if (hasOpcode) {
                        context.report({
                          node,
                          message: 'Do not define opcode; instead, set the opcode using the block\'s filename.',
                        });
                      }
                    }
                    return {
                      ExportNamedDeclaration(node) {
                        const decl = node.declaration?.declarations?.[0]?.init;
                        checkObject(node, decl);
                      },
                      ExportDefaultDeclaration(node) {
                        checkObject(node, node.declaration);
                      },
                    };
                  },
                },

                "no-def": {
                  meta: { type: "problem" },
                  create(context) {
                    function checkObject(node, obj) {
                      if (!obj || obj.type !== "ObjectExpression") return;
                      const hasDef = obj.properties.some(p => p.key?.name === "def");
                      if (!hasDef) {
                        context.report({
                          node,
                          message: 'Block definition is missing.',
                        });
                      }
                    }
                    return {
                      ExportNamedDeclaration(node) {
                        const decl = node.declaration?.declarations?.[0]?.init;
                        checkObject(node, decl);
                      },
                      ExportDefaultDeclaration(node) {
                        checkObject(node, node.declaration);
                      },
                    };
                  },
                },
              },
            },
          },
          languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
              Scratch: "readonly",
              window: "readonly",
              console: "readonly",
              globalThis: "readonly",
            },
          },
          rules: {
            "no-restricted-imports": ["error", {
              patterns: [{
                group: ["clippy:*", "!clippy:config"],
                message: "Internal modules should never be imported in userland"
              }]
            }],
            "no-undef": "off",
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-debugger": develop ? "warn" : "error",
            "indent": "off",
            "quotes": "off",
            "semi": "off",
            "import/no-commonjs": "error",
            "import/no-amd": "error",
            "import/no-duplicates": "error",
            "import/order": ["warn", {
              groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
              "newlines-between": "always",
            }],
            "import/named": "error",
            "import/namespace": "error",
            "import/no-unresolved": "error",
            "no-unsafe-finally": "error",
            "no-unsafe-negation": "error",
            "no-ex-assign": "error",
            "no-cond-assign": ["error", "except-parens"],
            "no-compare-neg-zero": "error",
            "no-loss-of-precision": "error",
            "no-async-promise-executor": "error",
            "no-await-in-loop": "warn",
            "require-atomic-updates": "warn",
            "no-implicit-coercion": ["warn", { boolean: false, string: true, number: true }],
            "radix": "error",
            "no-mixed-operators": ["warn", {
              groups: [
                ["&&", "||"],
                ["&", "|", "^"],
                ["==", "!=", "===", "!=="],
                ["+", "-", "*", "/", "%", "**"],
              ],
            }],
            "no-loop-func": "error",
            "no-caller": "warn",
            "no-new-func": "warn",
            "no-proto": "error",
            "guard-for-in": "error",
            "no-eval": "warn",
            "no-implied-eval": "error",
            "no-script-url": "warn",
            "default-case": "warn",
            "no-self-compare": "error",
            "no-unmodified-loop-condition": "error",
            "no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],

            "clippy/opcode": "error",
            "clippy/no-def": "error",
          },
        },
        {
          files: ["src/blocks/*.js", "src/menus/*.js"],
          rules: {
            "import/no-unused-modules": ["error", { missingExports: true }],
          },
        }
      ],
    });

    const results = await eslint.lintFiles(filesToLint);

    const formatter = await eslint.loadFormatter(develop ? "html" : "stylish");
    const resultText = await formatter.format(results);

    if (resultText) {
      if (develop) return resultText;
      process.stdout.write(resultText);
    }

    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);

    if (!develop && totalErrors > 0) {
      process.exit(1);
    }
  } catch (err) {
    consola.fatal(err);
    if (!develop) process.exit(1);
  }
}
