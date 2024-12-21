// apps/web/build.ts
import * as esbuild from "esbuild";
import * as path from "std/path/mod.ts";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

// Create dist directory if it doesn't exist
await Deno.mkdir(path.join(__dirname, "dist"), { recursive: true });

// Build the JS bundle
await esbuild.build({
  entryPoints: [path.resolve(__dirname, "./src/main.tsx")],
  bundle: true,
  outfile: path.resolve(__dirname, "dist/main.js"),
  format: "esm",
  platform: "browser",
  external: ["react", "react-dom", "react-dom/client"],
});

// Create index.html
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Arka Web</title>
  <script crossorigin src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
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
