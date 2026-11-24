'use client';

import React, { useMemo } from 'react';
import { useFBX, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useTrip3DStore } from '@/store/useTrip3DStore';

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
  const stage = useTrip3DStore((s) => s.stage);

  // In Stage 3, hide office completely so the real 360 photo panorama is fully visible
  if (stage === 'virtual-tour') {
    return null;
  }

  return (
    <group position={[0, 0, 0]}>
      {/* 1. ROOM SHELL & ARCHITECTURE - Warm, Bright Cozy Interior (#f5efe6) */}
      {/* Warm Light Parquet / Tile Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#f5efe6" roughness={0.3} metalness={0.05} />
      </mesh>

      {/* Decorative Circular Woven Rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0.005, -0.4]} receiveShadow>
        <circleGeometry args={[2.4, 64]} />
        <meshStandardMaterial color="#e2d9cc" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0.006, -0.4]}>
        <ringGeometry args={[2.2, 2.35, 64]} />
        <meshBasicMaterial color="#d4a373" transparent opacity={0.5} />
      </mesh>

      {/* Back Wall - Warm Cream with Architectural Trim */}
      <mesh position={[0, 3, -4.5]} receiveShadow>
        <planeGeometry args={[16, 6]} />
        <meshStandardMaterial color="#faf6f0" roughness={0.7} />
      </mesh>

      {/* TripSplit Glowing Logo Signboard on Wall */}
      <group position={[0, 3.8, -4.45]}>
        <mesh>
          <planeGeometry args={[4.4, 1.1]} />
          <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[4.3, 1.0]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>
        <pointLight position={[0, 0, 0.5]} intensity={1.5} distance={6} color="#7dd3fc" />
      </group>

      {/* Left Wall & Large Sunlit Window */}
      <mesh position={[-6, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#f8f4ee" roughness={0.7} />
      </mesh>

      {/* Sunlit Mountain Vista Window */}
      <group position={[-5.95, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[6.5, 3.8]} />
          <meshBasicMaterial color="#e0f2fe" />
        </mesh>
        <pointLight position={[0, 0, 0.8]} intensity={2.0} distance={8} color="#bae6fd" />
      </group>

      {/* Right Wall */}
      <mesh position={[6, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#f8f4ee" roughness={0.7} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </mesh>

      {/* 2. REAL OFFICE FBX PROPS (Desk, Chairs, Couch, Plants) */}
      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Desk/Desk.fbx"
          position={[0.5, 0, -1.0]}
          rotation={[0, 0, 0]}
          scale={0.009}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Office Chair/OfficeChair.fbx"
          position={[0.5, 0, -1.8]}
          rotation={[0, 0, 0]}
          scale={0.009}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Couch Medium/Couch_Medium1.fbx"
          position={[-3.2, 0, 0.5]}
          rotation={[0, Math.PI / 2, 0]}
          scale={0.009}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Houseplant/Houseplant_2.fbx"
          position={[4.2, 0, -3.2]}
          rotation={[0, -0.4, 0]}
          scale={0.009}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <FBXModel
          path="/models/office/Houseplant/Houseplant_2.fbx"
          position={[-4.5, 0, 3.5]}
          rotation={[0, 0.8, 0]}
          scale={0.007}
        />
      </React.Suspense>

      {/* 3. DESK TECH ACCESSORIES & GLOWING SCREEN */}
      <group position={[0.4, 0.76, -0.9]} rotation={[0, 0.15, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.38, 0.015, 0.26]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.2} />
        </mesh>
        <group position={[0, 0.008, -0.13]} rotation={[-0.3, 0, 0]}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.38, 0.24, 0.012]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0.12, 0.007]}>
            <planeGeometry args={[0.36, 0.22]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
          <pointLight position={[0, 0.14, 0.15]} intensity={1.2} distance={1.5} color="#7dd3fc" />
        </group>
      </group>

      {/* Coffee Mug on Desk */}
      <mesh position={[0.85, 0.82, -0.85]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} />
      </mesh>

      {/* 4. BRIGHT COZY WARM LIGHTING & ENVIRONMENT (User Spec) */}
      <ambientLight intensity={1.6} color="#fffbeb" />

      {/* Front Key Directional Light for Guide Character & Furniture */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={2.2}
        color="#fff7ed"
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

      {/* Soft Skylight Fill */}
      <directionalLight position={[-3, 6, 2]} intensity={0.9} color="#e0f2fe" />

      {/* Warm Ambient Environment Map Preset */}
      <Environment preset="apartment" />

      {/* Cozy Floor Accent Lamps */}
      <pointLight position={[-3.2, 1.8, 1.6]} intensity={1.5} distance={6} color="#f59e0b" />
      <pointLight position={[2.0, 2.0, 2.2]} intensity={1.2} distance={5} color="#fed7aa" />
    </group>
  );
}
