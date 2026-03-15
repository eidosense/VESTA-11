import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Sphere, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

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

function Astronaut({ position, color, label }: { position: [number, number, number], color: string, label: string }) {
  const astroRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (astroRef.current) {
      astroRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.2;
      astroRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group ref={astroRef} position={position}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.2, 0.4, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head/Helmet */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.2} transparent opacity={0.8} />
      </mesh>
      {/* Backpack */}
      <mesh position={[0, 0, -0.2]}>
        <boxGeometry args={[0.3, 0.4, 0.15]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  );
}

export default function SpaceView() {
  return (
    <div className="w-full h-full relative bg-black rounded-2xl overflow-hidden">
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-2xl font-bold italic uppercase tracking-tight text-rose-50">
          Orbital Space
        </h3>
        <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">
          Hayden & Arya in Zero-G
        </p>
      </div>
      <Canvas camera={{ position: [0, 0, 6], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Earth />
        <Astronaut position={[-3, 1, 0]} color="#fb7185" label="Commander" />
        <Astronaut position={[3, -1, 0]} color="#818cf8" label="Lead Engineer" />
        <OrbitControls enableZoom={true} enablePan={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
