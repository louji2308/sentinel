"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import * as THREE from "three";

/* ---------------- The faceted gold shard ---------------- */
function Shard() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.35;
    }
    const t = state.clock.elapsedTime;
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
    if (core.current) {
      const m = core.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 2.4 + pulse * 1.6;
    }
    if (halo.current) {
      const m = halo.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.12 + pulse * 0.12;
      const s = 1.25 + pulse * 0.06;
      halo.current.scale.set(s, s * 1.55, s);
    }
  });

  return (
    <group ref={group} scale={1.1}>
      {/* Soft additive halo that fakes bloom (keeps canvas transparent) */}
      <mesh ref={halo}>
        <octahedronGeometry args={[1.25, 0]} />
        <meshBasicMaterial
          color="#ffcf6b"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Outer crystal body — elongated octahedron, flat-shaded facets */}
      <mesh scale={[1, 1.55, 1]}>
        <octahedronGeometry args={[1.25, 0]} />
        <meshStandardMaterial
          color="#caa14a"
          metalness={1}
          roughness={0.16}
          emissive="#ffb627"
          emissiveIntensity={0.5}
          flatShading
        />
      </mesh>

      {/* Glowing wireframe edges */}
      <mesh scale={[1.012, 1.57, 1.012]}>
        <octahedronGeometry args={[1.25, 0]} />
        <meshBasicMaterial color="#ffe7a3" wireframe transparent opacity={0.5} toneMapped={false} />
      </mesh>

      {/* Inner molten core that drives the glow */}
      <mesh ref={core} scale={[0.5, 0.85, 0.5]}>
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
function Embers({ count = 260 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 11;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 11;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
      speeds[i] = 0.15 + Math.random() * 0.5;
    }
    return { positions, speeds };
  }, [count]);

  useFrame((_, delta) => {
    if (!points.current) return;
    const arr = points.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * delta;
      if (arr[i * 3 + 1] > 5.5) arr[i * 3 + 1] = -5.5;
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
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.75}
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
      <ambientLight intensity={0.4} />
      <pointLight position={[4, 5, 4]} intensity={45} color="#ffd27a" />
      <pointLight position={[-5, -2, 3]} intensity={25} color="#ff8a2b" />
      <pointLight position={[0, 0, 4]} intensity={18} color="#fff0c4" />

      <Float speed={1.4} rotationIntensity={0.18} floatIntensity={0.4}>
        <Shard />
      </Float>

      <Embers />

      <Environment preset="sunset" />
    </Canvas>
  );
}
