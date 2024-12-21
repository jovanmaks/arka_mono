// apps/web/src/main.tsx
import React3 from "react";
import { createRoot } from "react-dom/client";

// apps/web/src/App.tsx
import React2 from "https://esm.sh/react@18.2.0";

// apps/web/src/Scene.tsx
import React, { useRef } from "https://esm.sh/react@18.2.0";
import { Canvas, useFrame } from "https://esm.sh/@react-three/fiber@8.13.5";

// packages/lib/mod.ts
function calculateBoxVolume(width, height, depth) {
  return width * height * depth;
}

// apps/web/src/Scene.tsx
function SpinningBox(props) {
  const ref = useRef(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x += 0.01;
      ref.current.rotation.y += 0.01;
    }
  });
  return /* @__PURE__ */ React.createElement("mesh", { ref, ...props }, /* @__PURE__ */ React.createElement("boxGeometry", { args: [1, 1, 1] }), /* @__PURE__ */ React.createElement("meshStandardMaterial", { color: "hotpink" }));
}
function Scene() {
  console.log("Volume of a 1x2x3 box:", calculateBoxVolume(1, 2, 3));
  return /* @__PURE__ */ React.createElement(Canvas, null, /* @__PURE__ */ React.createElement("ambientLight", null), /* @__PURE__ */ React.createElement("pointLight", { position: [10, 10, 10] }), /* @__PURE__ */ React.createElement(SpinningBox, { position: [0, 0, 0] }));
}

// apps/web/src/App.tsx
function App() {
  return /* @__PURE__ */ React2.createElement("div", { style: { width: "100vw", height: "100vh" } }, /* @__PURE__ */ React2.createElement("h1", null, "Hello from Deno + React + R3F"), /* @__PURE__ */ React2.createElement(Scene, null));
}

// apps/web/src/main.tsx
var rootElement = document.getElementById("root");
if (!rootElement)
  throw new Error("Root element not found");
var root = createRoot(rootElement);
root.render(React3.createElement(App));
