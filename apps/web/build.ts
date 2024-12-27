/// <reference lib="deno.ns" />
import * as esbuild from "esbuild";
import * as path from "https://deno.land/std/path/mod.ts";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

// Create dist directory if it doesn't exist
await Deno.mkdir(path.join(__dirname, "dist"), { recursive: true });

// Build the JS bundle
await esbuild.build({
  entryPoints: [path.resolve(__dirname, "./app/main.tsx")], // Corrected path
  bundle: true,
  outfile: path.resolve(__dirname, "dist/main.js"),
  format: "esm",
  platform: "browser",
  minify: true,
  sourcemap: true,
  alias: {
    "@lib": path.resolve(projectRoot, "packages/lib"),
  },
});

// Create index.html without external script tags for React
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Arka Web</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>`;

await Deno.writeTextFile(
  path.resolve(__dirname, "dist/index.html"),
  html,
);

console.log("Build completed");
