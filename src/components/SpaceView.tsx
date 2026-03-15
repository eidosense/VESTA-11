import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Sphere, OrbitControls, Text } from '@react-three/drei';
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

function Astronaut({ position, color, targetPosition, isForming11 }: { position: [number, number, number], color: string, targetPosition: [number, number, number], isForming11: boolean }) {
  const astroRef = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(...position));
  
  useFrame((state) => {
    if (astroRef.current) {
      const target = new THREE.Vector3(...(isForming11 ? targetPosition : position));
      currentPos.current.lerp(target, 0.02);
      
      astroRef.current.position.copy(currentPos.current);
      
      if (!isForming11) {
        astroRef.current.position.y += Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.2;
        astroRef.current.rotation.y += 0.01;
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
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isForming11 ? 0.5 : 0} />
      </mesh>
      {/* Head/Helmet */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.2} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export default function SpaceView() {
  const [forming11, setForming11] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setForming11(prev => !prev);
    }, 10000); // Toggle every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full relative bg-black rounded-2xl overflow-hidden">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
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
        <OrbitControls enableZoom={true} enablePan={false} autoRotate={!forming11} autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
