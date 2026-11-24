'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTrip3DStore } from '@/store/useTrip3DStore';

export function CameraRig() {
  const { stage } = useTrip3DStore();
  const { camera } = useThree();

  const targetPosition = useRef(new THREE.Vector3(0.4, 1.5, 4.8));
  const targetLookAt = useRef(new THREE.Vector3(0.5, 1.1, 0));
  const currentLookAt = useRef(new THREE.Vector3(0.5, 1.1, 0));

  useEffect(() => {
    if (stage === 'entrance') {
      targetPosition.current.set(0.4, 1.5, 4.8);
      targetLookAt.current.set(0.5, 1.1, 0);
    } else if (stage === 'walking') {
      targetPosition.current.set(1.1, 1.55, 2.0);
      targetLookAt.current.set(0.6, 1.1, -0.6);
    } else if (stage === 'desk') {
      targetPosition.current.set(0.85, 1.48, 1.35);
      targetLookAt.current.set(0.4, 1.05, -0.7);
    } else if (stage === 'bill') {
      targetPosition.current.set(0, 1.45, 2.4);
      targetLookAt.current.set(0, 1.0, 0);
    }
  }, [stage]);

  useFrame((_, delta) => {
    // When in virtual-tour mode, OrbitControls in PanoramaSphere controls the camera orientation
    if (stage === 'virtual-tour') {
      return;
    }

    const t = Math.min(1, delta * 3.0);
    camera.position.lerp(targetPosition.current, t);
    currentLookAt.current.lerp(targetLookAt.current, t);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
