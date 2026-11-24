'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useFBX, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useTrip3DStore } from '@/store/useTrip3DStore';

interface TravelGuideProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export function TravelGuide({ position = [1.1, 0, 1.2], rotation = [0, -0.35, 0] }: TravelGuideProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(...position));
  const targetRotY = useRef(rotation[1]);
  const targetScale = useRef(0.01);

  const { stage, guideAnimation } = useTrip3DStore();

  // Load base skinned mesh & animation clips
  const idleFbx = useFBX('/models/character/idle.fbx');
  const wavingFbx = useFBX('/models/character/waving.fbx');
  const walkingFbx = useFBX('/models/character/walking.fbx');
  const pointingFbx = useFBX('/models/character/pointing.fbx');
  const thankfulFbx = useFBX('/models/character/thankful.fbx');

  // Clone animations with explicit readable names
  const animations = useMemo(() => {
    const clips: THREE.AnimationClip[] = [];

    if (idleFbx.animations[0]) {
      const c = idleFbx.animations[0].clone();
      c.name = 'Idle';
      clips.push(c);
    }
    if (wavingFbx.animations[0]) {
      const c = wavingFbx.animations[0].clone();
      c.name = 'Waving';
      clips.push(c);
    }
    if (walkingFbx.animations[0]) {
      const c = walkingFbx.animations[0].clone();
      c.name = 'Walking';
      clips.push(c);
    }
    if (pointingFbx.animations[0]) {
      const c = pointingFbx.animations[0].clone();
      c.name = 'Pointing';
      clips.push(c);
    }
    if (thankfulFbx.animations[0]) {
      const c = thankfulFbx.animations[0].clone();
      c.name = 'Thankful';
      clips.push(c);
    }

    return clips;
  }, [idleFbx, wavingFbx, walkingFbx, pointingFbx, thankfulFbx]);

  const { actions } = useAnimations(animations, groupRef);

  // Setup shadows and vibrant materials on character mesh
  useEffect(() => {
    idleFbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.roughness = 0.4;
          mat.metalness = 0.05;
        }
      }
    });
  }, [idleFbx]);

  // Handle smooth animation crossfades
  useEffect(() => {
    const currentAction = actions[guideAnimation] || actions['Idle'];
    if (currentAction) {
      currentAction.reset().fadeIn(0.35).play();
      return () => {
        currentAction.fadeOut(0.35);
      };
    }
  }, [guideAnimation, actions]);

  // Guide movement & scale per stage
  useEffect(() => {
    if (stage === 'entrance') {
      // Stage 1: Right half of screen facing camera waving
      targetPos.current.set(1.1, 0, 1.2);
      targetRotY.current = -0.35;
      targetScale.current = 0.01;
    } else if (stage === 'walking' || stage === 'desk') {
      // Stage 2: Beside executive desk
      targetPos.current.set(0.75, 0, -0.5);
      targetRotY.current = -0.4;
      targetScale.current = 0.01;
    } else if (stage === 'virtual-tour') {
      // Stage 3: Framed neatly in bottom-right corner over 360 photo pointing at the scene
      targetPos.current.set(1.45, -1.15, 2.5);
      targetRotY.current = -0.45;
      targetScale.current = 0.0085;
    } else if (stage === 'bill') {
      // Stage 4: Standing proudly on right side of office desk celebrating
      targetPos.current.set(0.85, 0, 0.1);
      targetRotY.current = -0.25;
      targetScale.current = 0.01;
    }
  }, [stage]);

  // Smooth lerping to position, rotation and scale
  useFrame((_, delta) => {
    if (groupRef.current) {
      const factor = Math.min(1, delta * 4.0);
      groupRef.current.position.lerp(targetPos.current, factor);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotY.current,
        factor
      );
      const s = THREE.MathUtils.lerp(
        groupRef.current.scale.x,
        targetScale.current,
        factor
      );
      groupRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={0.01}>
      <primitive object={idleFbx} scale={1} dispose={null} />

      {/* Guide Warm Key Spotlight */}
      <spotLight
        position={[0.5, 3.5, 1.5]}
        angle={0.7}
        penumbra={0.8}
        intensity={2.2}
        color="#fffbeb"
        target={groupRef.current || undefined}
      />
    </group>
  );
}
