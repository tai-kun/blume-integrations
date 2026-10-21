import { copyFile, mkdir } from "node:fs/promises";

const source = new URL("../src/route-by-browser-language/redirect.astro", import.meta.url);
const destination = new URL(
  "../dist/src/route-by-browser-language/redirect.astro",
  import.meta.url,
);

await mkdir(new URL(".", destination), { recursive: true });
await copyFile(source, destination);
