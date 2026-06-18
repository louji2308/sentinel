"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/* ---------------- The faceted gold shard ---------------- */
function Shard() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.35;
    }
    if (core.current) {
      const t = state.clock.elapsedTime;
      const m = core.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 2.6 + Math.sin(t * 2.2) * 1.1;
    }
  });

  return (
    <group ref={group} scale={1.15}>
      {/* Outer crystal body — elongated octahedron, flat-shaded facets */}
      <mesh scale={[1, 1.9, 1]}>
        <octahedronGeometry args={[1.25, 0]} />
        <meshStandardMaterial
          color="#caa14a"
          metalness={1}
          roughness={0.18}
          emissive="#ffb627"
          emissiveIntensity={0.5}
          flatShading
        />
      </mesh>

      {/* Glowing wireframe edges */}
      <mesh scale={[1.012, 1.92, 1.012]}>
        <octahedronGeometry args={[1.25, 0]} />
        <meshBasicMaterial color="#ffe7a3" wireframe transparent opacity={0.55} />
      </mesh>

      {/* Inner molten core that drives the bloom */}
      <mesh ref={core} scale={[0.55, 1.1, 0.55]}>
        <octahedronGeometry args={[1.25, 0]} />
        <meshStandardMaterial
          color="#fff2cc"
          emissive="#ffcf57"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ---------------- Drifting ember particles ---------------- */
function Embers({ count = 320 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      speeds[i] = 0.15 + Math.random() * 0.5;
    }
    return { positions, speeds };
  }, [count]);

  useFrame((_, delta) => {
    if (!points.current) return;
    const arr = points.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * delta;
      if (arr[i * 3 + 1] > 6) arr[i * 3 + 1] = -6;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    points.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffc24d"
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function CrystalScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6.5], fov: 42 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 5, 4]} intensity={45} color="#ffd27a" />
      <pointLight position={[-5, -2, 3]} intensity={25} color="#ff8a2b" />
      <pointLight position={[0, 0, 4]} intensity={18} color="#fff0c4" />

      <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.9}>
        <Shard />
      </Float>

      <Embers />

      <Environment preset="sunset" />

      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.15} luminanceSmoothing={0.4} intensity={1.5} />
        <Vignette eskil={false} offset={0.25} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
