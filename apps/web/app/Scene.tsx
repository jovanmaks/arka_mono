// File: apps/web/src/Scene.tsx
import React, { useRef } from "react";
import { Canvas as ThreeCanvas, MeshProps, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A simple spinning box
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
  return (
    <ThreeCanvas>
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <SpinningBox position={[0, 0, 0]} />
    </ThreeCanvas>
  );
}
