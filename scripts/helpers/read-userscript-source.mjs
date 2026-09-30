import { readFile } from "node:fs/promises";

const root = new URL("../../src/userscript/", import.meta.url);
const parts = ["entry-prefix.js", "download-workspace.js", "entry-suffix.js"];

export async function readUserscriptSource() {
  const sources = await Promise.all(parts.map((name) => readFile(new URL(name, root), "utf8")));
  return sources.join("");
}
