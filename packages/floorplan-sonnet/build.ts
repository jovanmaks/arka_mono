// Build script for floorplan-sonnet
import * as esbuild from "npm:esbuild";
import { join, dirname } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";

console.log("Starting floorplan-sonnet build...");

// Get the output directory path
const scriptDir = dirname(new URL(import.meta.url).pathname);
const outDir = join(scriptDir, "../../apps/web/public/floorplan-sonnet");

console.log(`Script directory: ${scriptDir}`);
console.log(`Output directory: ${outDir}`);

// Create output directory if it doesn't exist
try {
  await Deno.mkdir(outDir, { recursive: true });
  console.log(`Created output directory: ${outDir}`);
} catch (e) {
  console.log(`Output directory already exists or error: ${e.message}`);
}

try {
  console.log("Starting esbuild...");
  const result = await esbuild.build({
    entryPoints: [join(scriptDir, "mod.ts")],
    bundle: true,
    format: "esm",
    outdir: outDir,
    platform: "browser",
    target: ["es2020"],
    sourcemap: true,
    minify: true,
    banner: {
      js: "// Floorplan Sonnet Library - Built with esbuild",
    },
  });

  console.log("esbuild result:", result);
  console.log(`✅ Built floorplan-sonnet to ${outDir}`);
  
  // Verify files were created
  const files = [];
  for await (const entry of Deno.readDir(outDir)) {
    files.push(entry.name);
  }
  console.log(`Files in output directory: ${files.join(", ")}`);
  
} catch (error) {
  console.error("Build failed:", error);
}