import { ZodError } from "zod";

/**
 * @param {import("consola").Consola} consola
 * @param {unknown} err
 * @param {{ verbose?: boolean }} [options]
 */
export function logZodError(consola, err, { verbose } = {}) {
  if (!(err instanceof ZodError)) {
    consola.error(err);
    return;
  }

  consola.error("Invalid Clippy configuration.");

  for (const issue of err.issues) {
    const path =
      issue.path.length > 0
        ? issue.path
            .map(p => (typeof p === "number" ? `[${p}]` : p))
            .join(".")
            .replace(".[", "[")
        : "(root)";

    consola.log(`* ${path}: ${issue.message}`);
  }

  if (verbose) {
    consola.debug(err.stack);
  }
}
