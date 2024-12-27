// apps/web/src/App.tsxyy

// deno-lint-ignore no-unused-vars
// import React from "https://esm.sh/react@18.2.0"; // Add this line
import React from "react";
import Scene from "./Scene.tsx";

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <h1>Hello from Deno + React + R3F</h1>
      <Scene />
    </div>
  );
}
