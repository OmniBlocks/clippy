/** @type {import("prettier").Config} */
export const tabWidth = 2;
export const useTabs = false;
export const semi = false;
export const singleQuote = true;
export const quoteProps = "as-needed";
export const trailingComma = "all";
export const bracketSpacing = true;
export const arrowParens = "always";
export const endOfLine = "lf";
export const printWidth = 100;
export const overrides = [
  {
    files: "*.md",
    options: {
      proseWrap: "always",
    },
  },
  {
    files: "*.json",
    options: {
      tabWidth: 2,
      printWidth: 120,
    },
  },
  {
    files: ["*.html", "*.css", "*.scss"],
    options: {
      tabWidth: 2,
      printWidth: 120,
    },
  },
];
