// File: apps/web/src/Scene.tsx
import React from "react";

export default function Scene() {
  return (
    <div style={{ width: "100%", height: "100%", padding: "1rem" }}>
      <canvas 
        id="floorplanCanvas"
        style={{
          width: "100%",
          height: "100%",
          border: "1px solid #ccc",
          backgroundColor: "#fff"
        }}
      />
    </div>
  );
}
