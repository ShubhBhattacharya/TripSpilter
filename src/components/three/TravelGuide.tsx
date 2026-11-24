'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useFBX, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useTrip3DStore, GuideAnimation } from '@/store/useTrip3DStore';

interface TravelGuideProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export function TravelGuide({ position = [1.2, 0, 1.5], rotation = [0, -0.3, 0] }: TravelGuideProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(...position));
  const targetRotY = useRef(rotation[1]);

  const { stage, guideAnimation } = useTrip3DStore();

  // Load base skinned mesh & idle animation
  const idleFbx = useFBX('/models/character/idle.fbx');
  const wavingFbx = useFBX('/models/character/waving.fbx');
  const walkingFbx = useFBX('/models/character/walking.fbx');
  const pointingFbx = useFBX('/models/character/pointing.fbx');
  const thankfulFbx = useFBX('/models/character/thankful.fbx');

  // Clone animations and give them explicit readable names
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

  const { actions, mixer } = useAnimations(animations, groupRef);

  // Setup shadows and materials on the base model
  useEffect(() => {
    idleFbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.roughness = 0.45;
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

  // Guide movement between stages
  useEffect(() => {
    if (stage === 'entrance') {
      targetPos.current.set(1.2, 0, 1.5);
      targetRotY.current = -0.3;
    } else if (stage === 'walking' || stage === 'desk') {
      targetPos.current.set(0.65, 0, -0.6);
      targetRotY.current = -0.4;
    } else if (stage === 'bill') {
      targetPos.current.set(0, 0, 0.4);
      targetRotY.current = 0;
    }
  }, [stage]);

  // Smooth lerping to position and rotation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.lerp(targetPos.current, Math.min(1, delta * 3.5));
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotY.current,
        Math.min(1, delta * 3.5)
      );
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Mixamo character scale is normalized to human ~1.75m height */}
      <primitive object={idleFbx} scale={0.01} dispose={null} />

      {/* Guide Warm Key Spotlight */}
      <spotLight
        position={[1.2, 3.5, 2.5]}
        angle={0.65}
        penumbra={0.8}
        intensity={2.0}
        color="#fef08a"
        target={groupRef.current || undefined}
      />
    </group>
  );
}
