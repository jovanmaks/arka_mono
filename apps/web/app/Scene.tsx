// apps/web/src/Scene.tsx

import React, { useRef } from "react";
import { Canvas as ThreeCanvas, MeshProps, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { calculateBoxVolume } from "@lib/mod.ts"; // Adjusted import based on import map

function SpinningBox(props: MeshProps) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x += 0.01;
      ref.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={ref} {...props}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}

export default function Scene() {
  console.log("Volume of a 1x2x3 box:", calculateBoxVolume(1, 2, 3));
  return (
    <ThreeCanvas>
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <SpinningBox position={[0, 0, 0]} />
    </ThreeCanvas>
  );
}
