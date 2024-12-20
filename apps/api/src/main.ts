// apps/api/src/main.ts
import { Hono } from "hono/mod.ts";
import { greet } from "@lib/mod.ts";

const app = new Hono();

// Define routes
app.get("/", (c) => c.text("Home page"));

app.get("/hello", (c) => c.text(greet("API User")));

app.get("/users/:id", (c) => {
  const id = c.req.param("id");
  if (id) {
    return c.text(`User ID: ${id}`);
  }
  return c.json({ error: "User ID is required" }, 400);
});

// Middleware for error handling
app.onError((err, c) => {
  console.error("Unhandled Error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Static file serving
app.get("/static/*", async (c) => {
  const path = c.req.param("*") || "index.html";
  try {
    const file = await Deno.readFile(`./public/${path}`);
    const ext = path.split(".").pop() || "txt";
    const contentType = getContentType(ext);
    return new Response(file, { headers: { "Content-Type": contentType } });
  } catch {
    return c.text("Static file not found.", 404);
  }
});

// Helper function to determine Content-Type
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    png: "image/png",
    jpg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    json: "application/json",
    txt: "text/plain",
    // Add more types as needed
  };
  return types[ext] || "application/octet-stream";
}

// Listen on port 8000
const PORT = 8000;
Deno.serve({ port: PORT }, app.fetch);
console.log(`API running on http://localhost:${PORT}`);
