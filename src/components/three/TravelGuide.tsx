'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useFBX, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useTrip3DStore } from '@/store/useTrip3DStore';

// Preload character assets so conditional stage transitions back to 3D are instantaneous
useFBX.preload('/models/character/idle.fbx');
useFBX.preload('/models/character/waving.fbx');
useFBX.preload('/models/character/walking.fbx');
useFBX.preload('/models/character/pointing.fbx');
useFBX.preload('/models/character/thankful.fbx');

interface TravelGuideProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export function TravelGuide({ position = [1.1, 0, 1.2], rotation = [0, -0.35, 0] }: TravelGuideProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(...position));
  const targetRotY = useRef(rotation[1]);
  const targetScale = useRef(0.01);

  const headBoneRef = useRef<THREE.Bone | null>(null);
  const neckBoneRef = useRef<THREE.Bone | null>(null);
  const jawBoneRef = useRef<THREE.Bone | null>(null);
  const spineBoneRef = useRef<THREE.Bone | null>(null);
  const morphMeshesRef = useRef<THREE.Mesh[]>([]);
  const speechClockRef = useRef(0);

  const { stage, guideAnimation, isSpeaking } = useTrip3DStore();

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

  // Setup shadows, materials, and collect speaking bones / morph targets
  useEffect(() => {
    headBoneRef.current = null;
    neckBoneRef.current = null;
    jawBoneRef.current = null;
    spineBoneRef.current = null;
    morphMeshesRef.current = [];

    idleFbx.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const bone = child as THREE.Bone;
        const n = bone.name.toLowerCase();
        if (n.includes('head') && !n.includes('top') && !headBoneRef.current) {
          headBoneRef.current = bone;
        } else if (n.includes('neck') && !neckBoneRef.current) {
          neckBoneRef.current = bone;
        } else if (n.includes('jaw') && !jawBoneRef.current) {
          jawBoneRef.current = bone;
        } else if ((n.includes('spine2') || n.includes('chest')) && !spineBoneRef.current) {
          spineBoneRef.current = bone;
        }
      }

      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mesh = child as THREE.Mesh;
        if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
          morphMeshesRef.current.push(mesh);
        }
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
      targetPos.current.set(1.1, 0, 1.2);
      targetRotY.current = -0.35;
      targetScale.current = 0.01;
    } else if (stage === 'walking' || stage === 'desk') {
      targetPos.current.set(0.75, 0, -0.5);
      targetRotY.current = -0.4;
      targetScale.current = 0.01;
    } else if (stage === 'virtual-tour') {
      targetPos.current.set(1.45, -1.15, 2.5);
      targetRotY.current = -0.45;
      targetScale.current = 0.0085;
    } else if (stage === 'bill') {
      targetPos.current.set(0.85, 0, 0.1);
      targetRotY.current = -0.25;
      targetScale.current = 0.01;
    }
  }, [stage]);

  // Smooth lerping + synchronized speaking motion (head nod, subtle body emphasis, jaw/morph sync)
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const factor = Math.min(1, delta * 4.0);
    groupRef.current.position.lerp(targetPos.current, factor);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotY.current,
      factor
    );
    const s = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale.current, factor);
    groupRef.current.scale.set(s, s, s);

    if (isSpeaking) {
      speechClockRef.current += delta;
      const t = speechClockRef.current;

      // Expressive conversational head & torso emphasis synced strictly to audio playback
      if (headBoneRef.current) {
        headBoneRef.current.rotation.x += Math.sin(t * 7.5) * 0.045;
        headBoneRef.current.rotation.y += Math.sin(t * 3.1) * 0.06;
        headBoneRef.current.rotation.z += Math.cos(t * 4.2) * 0.03;
      }
      if (neckBoneRef.current) {
        neckBoneRef.current.rotation.x += Math.sin(t * 5.0) * 0.02;
      }
      if (spineBoneRef.current) {
        spineBoneRef.current.rotation.x += Math.sin(t * 3.4) * 0.025;
      }
      if (jawBoneRef.current) {
        jawBoneRef.current.rotation.x += (Math.sin(t * 14) * 0.5 + 0.5) * 0.12;
      }
      for (const mesh of morphMeshesRef.current) {
        if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
          mesh.morphTargetInfluences[0] = (Math.sin(t * 13) * 0.5 + 0.5) * 0.65;
        }
      }
      // Subtle animated body lift on the whole group while actively speaking
      groupRef.current.position.y += Math.sin(t * 6.0) * 0.0025;
    } else {
      speechClockRef.current = 0;
      for (const mesh of morphMeshesRef.current) {
        if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
          mesh.morphTargetInfluences[0] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[0],
            0,
            Math.min(1, delta * 10)
          );
        }
      }
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
