/**
 * Build script for the floorplan-processor-o1 library
 * 
 * This script bundles the library for browser use.
 */

// Define paths
const outputDir = "../../apps/web/public/floorplan-processor-o1";

// Ensure output directory exists
try {
  await Deno.mkdir(outputDir, { recursive: true });
  console.log(`Ensured output directory: ${outputDir}`);
} catch (err) {
  console.error(`Error creating directory: ${err.message}`);
}

try {
  // Bundle the library using Deno's built-in bundler
  const { files } = await Deno.emit("./mod.ts", {
    bundle: "module",
    compilerOptions: {
      lib: ["dom", "esnext"],
    },
  });

  // Write the bundled code to the output directory
  await Deno.writeTextFile(`${outputDir}/mod.js`, files["deno:///bundle.js"]);
  console.log(`✅ Built floorplan-processor-o1 library to ${outputDir}/mod.js`);
} catch (err) {
  console.error(`Error bundling: ${err.message}`);
}