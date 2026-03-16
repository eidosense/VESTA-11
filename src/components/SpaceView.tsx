import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Sphere, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

import { audioService } from '../services/audioService';

function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.001;
    }
  });

  return (
    <Sphere ref={earthRef} args={[2, 64, 64]}>
      <meshStandardMaterial 
        color="#1e3a8a" 
        roughness={0.6} 
        metalness={0.1}
        wireframe={true}
      />
    </Sphere>
  );
}

function Astronaut({ position, color, targetPosition, isForming11 }: { position: [number, number, number], color: string, targetPosition: [number, number, number], isForming11: boolean }) {
  const astroRef = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(...position));
  
  useFrame((state) => {
    if (astroRef.current) {
      const target = new THREE.Vector3(...(isForming11 ? targetPosition : position));
      currentPos.current.lerp(target, 0.03);
      
      astroRef.current.position.copy(currentPos.current);
      
      if (!isForming11) {
        astroRef.current.position.y += Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.2;
        astroRef.current.rotation.y += 0.01;
        astroRef.current.rotation.z = Math.sin(state.clock.elapsedTime) * 0.1;
      } else {
        // Stand straight for the 11
        astroRef.current.rotation.set(0, 0, 0);
      }
    }
  });

  return (
    <group ref={astroRef}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.15, 0.8, 4, 8]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={isForming11 ? 2 : 0.2} 
        />
      </mesh>
      {/* Head/Helmet */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.2} transparent opacity={0.8} />
      </mesh>
      {isForming11 && (
        <pointLight color={color} intensity={2} distance={2} />
      )}
    </group>
  );
}

function FusionParticles({ active }: { active: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 500;
  const positions = useRef(new Float32Array(count * 3));
  const velocities = useRef(new Float32Array(count * 3));

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      positions.current[i * 3] = (Math.random() - 0.5) * 10;
      positions.current[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions.current[i * 3 + 2] = (Math.random() - 0.5) * 10;
      
      velocities.current[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities.current[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities.current[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      if (active) {
        // Pull towards center
        pos[i * 3] *= 0.95;
        pos[i * 3 + 1] *= 0.95;
        pos[i * 3 + 2] *= 0.95;
      } else {
        // Drift
        pos[i * 3] += velocities.current[i * 3];
        pos[i * 3 + 1] += velocities.current[i * 3 + 1];
        pos[i * 3 + 2] += velocities.current[i * 3 + 2];
        
        // Wrap around
        if (Math.abs(pos[i * 3]) > 5) pos[i * 3] *= -0.9;
        if (Math.abs(pos[i * 3 + 1]) > 5) pos[i * 3 + 1] *= -0.9;
        if (Math.abs(pos[i * 3 + 2]) > 5) pos[i * 3 + 2] *= -0.9;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions.current}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color={active ? "#ffffff" : "#444444"}
        transparent
        opacity={active ? 0.8 : 0.3}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function SpaceView() {
  const [forming11, setForming11] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setForming11(prev => {
        const next = !prev;
        if (next) audioService.playFusion();
        return next;
      });
    }, 10000); // Toggle every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-2xl font-bold italic uppercase tracking-tight text-rose-50 drop-shadow-md">
          Orbital Space
        </h3>
        <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest drop-shadow-md">
          {forming11 ? "Master Number 11 Alignment" : "Hayden & Arya in Zero-G"}
        </p>
      </div>
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Earth />
        <FusionParticles active={forming11} />
        <Astronaut 
          position={[-4, 2, 0]} 
          targetPosition={[-0.4, 0, 3]} 
          color="#fb7185" 
          isForming11={forming11} 
        />
        <Astronaut 
          position={[4, -2, 0]} 
          targetPosition={[0.4, 0, 3]} 
          color="#818cf8" 
          isForming11={forming11} 
        />
        {forming11 && (
          <pointLight position={[0, 0, 3]} intensity={5} color="#ffffff" distance={5} />
        )}
        <OrbitControls enableZoom={true} enablePan={false} autoRotate={!forming11} autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
