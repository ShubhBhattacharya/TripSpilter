'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTrip3DStore } from '@/store/useTrip3DStore';

export function CameraRig() {
  const { stage } = useTrip3DStore();
  const { camera } = useThree();

  const targetPosition = useRef(new THREE.Vector3(0.3, 1.45, 4.5));
  const targetLookAt = useRef(new THREE.Vector3(0.4, 1.05, 0));
  const currentLookAt = useRef(new THREE.Vector3(0.4, 1.05, 0));

  useEffect(() => {
    if (stage === 'entrance') {
      // Stage 1: Framing character on the right side from head to toe
      targetPosition.current.set(0.3, 1.45, 4.5);
      targetLookAt.current.set(0.4, 1.05, 0);
    } else if (stage === 'walking') {
      targetPosition.current.set(0.4, 1.4, 2.6);
      targetLookAt.current.set(0.4, 1.0, -0.6);
    } else if (stage === 'desk') {
      // Stage 2: Beside desk
      targetPosition.current.set(0.35, 1.4, 2.3);
      targetLookAt.current.set(0.4, 1.0, -0.6);
    } else if (stage === 'virtual-tour') {
      // Stage 3: Camera for transparent canvas viewing 3D guide in bottom right
      targetPosition.current.set(0, 0, 3.0);
      targetLookAt.current.set(0, 0, 0);
    } else if (stage === 'bill') {
      // Stage 4: Framing celebratory guide on right side of office
      targetPosition.current.set(0.3, 1.45, 3.2);
      targetLookAt.current.set(0.4, 1.05, 0);
    }
  }, [stage]);

  useFrame((_, delta) => {
    const t = Math.min(1, delta * 3.5);
    camera.position.lerp(targetPosition.current, t);
    currentLookAt.current.lerp(targetLookAt.current, t);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
