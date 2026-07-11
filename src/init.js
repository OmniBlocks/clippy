import fs from "node:fs";
import path from "node:path";
import { execSync } from "child_process";
import { input, select } from "@inquirer/prompts";
import JSON5 from "json5";

function detectPackageManagers() {
  const managers = ["npm", "yarn", "pnpm", "bun"];
  return managers.filter((m) => {
    try {
      execSync(`${m} --version`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
}

function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("");
}

export async function init() {
  // 1. Language Select
  const language = await select({
    message: "Choose a programming language. TypeScript is coming soon...",
    choices: [
      { name: "JavaScript", value: "js" },
    ],
  });

  // 2. Format Select (Defaulting to YAML)
  const format = await select({
    message: "Which format do you want to use for your configuration?",
    choices: ["yaml", "json", "json5"],
    default: "yaml",
  });

  // 3. Inputs
  const name = await input({ message: "Enter your extension's name:", default: "My Extension" });
  const id = await input({ message: "Enter your extension's ID:", default: toCamelCase(name) });

  // 4. Package Manager
  let packageManager = "None";
  if (!fs.existsSync("package.json") || !fs.existsSync("node_modules")) {
    const managers = detectPackageManagers();
    packageManager = await select({
      message: "No package manager files detected. Choose one:",
      choices: [...managers, "None"],
    });
  }

  // 5. File System Setup
  const srcDir = path.join(process.cwd(), "src");
  const blocksDir = path.join(srcDir, "blocks");
  const menusDir = path.join(srcDir, "menus");
  [srcDir, blocksDir, menusDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 6. Write Config (using selected format)
  const configFile = path.join(process.cwd(), `scratch.${format}`);
  const configObj = { id, name };
  
  if (format === "json") {
    fs.writeFileSync(configFile, JSON.stringify(configObj, null, 2));
  } else if (format === "json5") {
    fs.writeFileSync(configFile, JSON5.stringify(configObj, null, 2));
  } else {
    fs.writeFileSync(configFile, `id: ${id}\nname: ${name}\n`);
  }

  // 7. Write Hello Sample Block
  const sampleBlock = `export default {
    title: "Hello!",
    blockType: Scratch.BlockType.REPORTER,
    def() {
        return "World!";
    }
}`;
  fs.writeFileSync(path.join(blocksDir, `hello.${language}`), sampleBlock);

  // make a readme
  const readmetext = `# Clippy
A sample clippy extension.

Check the [docs](https://ampelc.codeberg.page/clippy) to learn more. Get help on our [discussions page](https://github.com/OmniBlocks/clippy/discussions).

To contribute, you need to install Clippy. To do this, see https://ampelc.codeberg.page/clippy/tutorial/`
  fs.writeFileSync(path.join(process.cwd(), "README.md"), readmetext);

  // make placeholder runtime.js file
  const runtimejs = `export default {
  // This is where you add pre and post functions.
  // Simple extensions may not need pre and post, but for more complex extensions,
  // it allows you to interact with the Scratch VM to add events, etc.
  // Check docs for more info: https://ampelc.codeberg.page/clippy/
  pre(Scratch) {
    // Pre runs before your extension is registered to the VM.
  },
  post(Scratch) {
    // Post runs after your extension is registered to the VM.
  },
};`
  fs.writeFileSync(path.join(srcDir, "runtime.js"), runtimejs);

  console.log("\n✅ Extension scaffold created successfully!");
  console.log(`- Config file: ${configFile}`);
  console.log(`- Sample block: ${blocksDir}/hello.${language}`);
}