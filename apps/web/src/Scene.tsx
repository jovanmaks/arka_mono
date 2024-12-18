// apps/web/src/Scene.tsx

// deno-lint-ignore no-unused-vars
import React, { useRef } from "https://esm.sh/react@18.2.0";
import { Canvas, MeshProps, useFrame } from "https://esm.sh/@react-three/fiber@8.13.5";
import * as THREE from "https://esm.sh/three@0.154.0";
import { calculateBoxVolume } from "../../../packages/lib/mod.ts";

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
    <Canvas>
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <SpinningBox position={[0, 0, 0]} />
    </Canvas>
  );
}

