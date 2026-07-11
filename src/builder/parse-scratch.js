import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import JSON5 from "json5";
import { scratchSchema } from "./scratch-schema.js";
import { logZodError } from "./format-zod-error.js";

const SCRATCH_FILES = [
  "scratch.yaml",
  "scratch.yml",
  "scratch.json",
  "scratch.json5"
];

export function findClosestScratchFile(startDir = process.cwd()) {
  let dir = startDir;

  while (true) {
    const matches = SCRATCH_FILES
      .map(name => path.join(dir, name))
      .filter(file => fs.existsSync(file));

    if (matches.length > 1) {
      throw new Error(
        `Must have only one scratch config file, found:\n` +
        matches.map(f => `  - ${path.basename(f)}`).join("\n")
      );
    }

    if (matches.length === 1) {
      return matches[0];
    }

    const parentDir = path.dirname(dir);
    if (parentDir === dir) break;
    dir = parentDir;
  }

  throw new Error(
    "Could not find scratch config (scratch.yaml, scratch.yml, scratch.json, scratch.json5)"
  );
}

export function findProjectPath() {
  return path.dirname(findClosestScratchFile());
}

export function parseScratch() {
  const file = findClosestScratchFile();
  const ext = path.extname(file);
  const raw = fs.readFileSync(file, "utf-8");

  let data;
  switch (ext) {
    case ".yaml":
    case ".yml":
      data = yaml.load(raw);
      break;
    case ".json":
      data = JSON.parse(raw);
      break;
    case ".json5":
      data = JSON5.parse(raw);
      break;
    default:
      throw new Error(`Unsupported config format: ${ext}`);
  }

  return scratchSchema.parse(data);

}
