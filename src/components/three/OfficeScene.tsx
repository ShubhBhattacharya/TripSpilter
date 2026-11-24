'use client';

import React, { useMemo } from 'react';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';

// Safe Sub-component for FBX Prop
function FBXModel({
  path,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color,
}: {
  path: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  color?: string;
}) {
  try {
    const fbx = useFBX(path);
    const cloned = useMemo(() => {
      const c = fbx.clone(true);
      c.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (color) {
            const mesh = child as THREE.Mesh;
            mesh.material = new THREE.MeshStandardMaterial({
              color,
              roughness: 0.6,
              metalness: 0.2,
            });
          }
        }
      });
      return c;
    }, [fbx, color]);

    return (
      <primitive
        object={cloned}
        position={position}
        rotation={rotation}
        scale={typeof scale === 'number' ? [scale, scale, scale] : scale}
      />
    );
  } catch {
    return null;
  }
}

export function OfficeScene() {
  return (
    <group position={[0, 0, 0]}>
      {/* 1. ROOM SHELL & ARCHITECTURE */}
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.15} />
      </mesh>

      {/* Decorative Carpet / Rug Under Desk & Lounge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0.005, -0.5]} receiveShadow>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0.006, -0.5]}>
        <ringGeometry args={[2.0, 2.15, 48]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
      </mesh>

      {/* Back Wall with Brand Wall & Digital Display */}
      <mesh position={[0, 3, -4.5]} receiveShadow>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} />
      </mesh>

      {/* TripSplit Glowing Logo Signboard on Wall */}
      <group position={[0, 3.8, -4.45]}>
        <mesh>
          <planeGeometry args={[4.2, 1.1]} />
          <meshStandardMaterial color="#020617" roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[4.1, 1.0]} />
          <meshBasicMaterial color="#0369a1" />
        </mesh>
        <pointLight position={[0, 0, 0.4]} intensity={1.8} distance={6} color="#38bdf8" />
      </group>

      {/* Left Wall & Large Architectural Window */}
      <mesh position={[-6, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#0b1120" roughness={0.9} />
      </mesh>

      {/* Window Frame with Twilight City Glow */}
      <group position={[-5.9, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[6, 3.5]} />
          <meshBasicMaterial color="#1e1b4b" />
        </mesh>
        {/* Soft skyline glow from window */}
        <pointLight position={[0, 0, 0.5]} intensity={1.5} distance={7} color="#818cf8" />
      </group>

      {/* Right Wall */}
      <mesh position={[6, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#0b1120" roughness={0.9} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#050811" />
      </mesh>

      {/* 2. REAL OFFICE FBX PROPS (from Office Pack) */}
      {/* Executive Desk */}
      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Desk/Desk.fbx"
          position={[0.5, 0, -1.0]}
          rotation={[0, 0, 0]}
          scale={0.009}
        />
      </React.Suspense>

      {/* Ergonomic Office Chair Behind Desk */}
      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Office Chair/OfficeChair.fbx"
          position={[0.5, 0, -1.8]}
          rotation={[0, 0, 0]}
          scale={0.009}
        />
      </React.Suspense>

      {/* Lounge Couch for Guests */}
      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Couch Medium/Couch_Medium1.fbx"
          position={[-3.2, 0, 0.5]}
          rotation={[0, Math.PI / 2, 0]}
          scale={0.009}
        />
      </React.Suspense>

      {/* Large Potted Houseplant */}
      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Houseplant/Houseplant_2.fbx"
          position={[4.2, 0, -3.2]}
          rotation={[0, -0.4, 0]}
          scale={0.009}
        />
      </React.Suspense>

      {/* Second Houseplant by the Door */}
      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Houseplant/Houseplant_2.fbx"
          position={[-4.5, 0, 3.5]}
          rotation={[0, 0.8, 0]}
          scale={0.007}
        />
      </React.Suspense>

      {/* 3. DESK TECH ACCESSORIES & LAPTOP SCREEN */}
      {/* Laptop Base and Screen */}
      <group position={[0.4, 0.76, -0.9]} rotation={[0, 0.15, 0]}>
        {/* Laptop Body */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.38, 0.015, 0.26]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Laptop Display (Tilted Up) */}
        <group position={[0, 0.008, -0.13]} rotation={[-0.3, 0, 0]}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.38, 0.24, 0.012]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Glowing TripSplit Dashboard Screen */}
          <mesh position={[0, 0.12, 0.007]}>
            <planeGeometry args={[0.36, 0.22]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
          <pointLight position={[0, 0.14, 0.1]} intensity={0.8} distance={1.2} color="#38bdf8" />
        </group>
      </group>

      {/* Coffee Mug on Desk */}
      <mesh position={[0.85, 0.82, -0.85]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.2} />
      </mesh>

      {/* 4. WARM PIXAR-STYLE LIGHTING ATMOSPHERE */}
      <ambientLight intensity={1.4} color="#fef3c7" />

      {/* Front Key Directional Light for Guide Character & Furniture */}
      <directionalLight
        position={[3, 5, 5]}
        intensity={2.0}
        color="#fffbeb"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />

      {/* Soft Fill Directional Light */}
      <directionalLight
        position={[-3, 6, 2]}
        intensity={0.8}
        color="#e0f2fe"
      />

      {/* Warm Floor Accent Lamp */}
      <pointLight position={[-3.2, 1.8, 1.6]} intensity={1.5} distance={6} color="#f59e0b" />

      {/* Warm Character Rim/Chest Point Fill */}
      <pointLight position={[1.8, 1.8, 2.2]} intensity={1.0} distance={5} color="#fed7aa" />
    </group>
  );
}
