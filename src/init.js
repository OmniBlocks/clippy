import fs from "node:fs";
import path from "node:path";
import { execSync } from "child_process";
import readline from "node:readline";

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

function ask(question, defaultValue) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
    rl.question(prompt, (answer) => {
      rl.close();
      if (!answer && defaultValue !== undefined) resolve(defaultValue);
      else resolve(answer.trim());
    });
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
  let format = await ask("Which format do you want to use for your configuration? [json/yaml]", "json");
  format = format.toLowerCase();
  if (!["json", "yaml"].includes(format)) format = "json";

  const name = await ask("Enter your extension's name", "My Extension");

  const id = await ask("Enter your extension's ID", toCamelCase(name));

  let packageManager = null;
  const missingPackageFiles = !fs.existsSync("package.json") || !fs.existsSync("node_modules");
  if (missingPackageFiles) {
    let availableManagers = detectPackageManagers();
    if (availableManagers.length === 0) availableManagers.push("None");
    else availableManagers.push("None");

    console.log("No package.json or node_modules detected.");
    console.log("Available package managers: ", availableManagers.join(", "));
    while (!packageManager) {
      const pm = await ask("Which package manager do you want to use?", "None");
      if (availableManagers.includes(pm)) packageManager = pm;
      else console.log("Invalid choice, please pick one from the list.");
    }
  }

  const srcDir = path.join(process.cwd(), "src");
  const blocksDir = path.join(srcDir, "blocks");
  const menusDir = path.join(srcDir, "menus");
  [srcDir, blocksDir, menusDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const configFile = path.join(process.cwd(), `scratch.${format}`);
  if (format === "json") {
    fs.writeFileSync(configFile, JSON.stringify({ id, name, galleryData: {} }, null, 2));
  } else {
    fs.writeFileSync(configFile, `id: ${id}\nname: ${name}\ngalleryData: {}\n`);
  }

  console.log("\n✅ Extension scaffold created successfully!");
  console.log(`- Config file: ${configFile}`);
  console.log(`- Source directories: ${srcDir}/blocks and ${srcDir}/menus`);
  if (packageManager && packageManager !== "None") {
    console.log(`You can now install dependencies using: ${packageManager}`);
  }
}
