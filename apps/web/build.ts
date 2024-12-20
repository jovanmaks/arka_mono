// apps/web/build.ts
import { build } from "https://deno.land/x/esbuild@v0.17.19/mod.js";

await build({
  entryPoints: ["./app/main.tsx"],
  outfile: "./dist/bundle.js",
  bundle: true,
  minify: true,
  sourcemap: true,
  format: "esm",
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
    ".jsx": "jsx",
    ".js": "js",
    ".css": "css",
    ".json": "json"
  },
  external: [
    "react",
    "@react-three/fiber",
    "three",
    // any other npm dependencies
  ],
  alias: {
    "@lib/*": "../lib/*"  // Adjust if needed; consider placing lib inside app or a known location
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

console.log("Build completed");
