import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Sphere, Line, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Montenegro coordinates: 42.7087° N, 19.3744° E
const lat = 42.7087;
const lon = 19.3744;
const radius = 2;

// Convert lat/lon to 3D position on sphere
const phi = (90 - lat) * (Math.PI / 180);
const theta = (lon + 180) * (Math.PI / 180);

const montenegroPos = new THREE.Vector3(
  -(radius * Math.sin(phi) * Math.cos(theta)),
  radius * Math.cos(phi),
  radius * Math.sin(phi) * Math.sin(theta)
);

function StylizedEarth() {
  const earthRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (earthRef.current) {
      earthRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <group ref={earthRef}>
      {/* Core Earth */}
      <Sphere args={[radius, 64, 64]}>
        <meshStandardMaterial 
          color="#0a0a1a" 
          emissive="#000022"
          wireframe={true} 
          transparent 
          opacity={0.3} 
        />
      </Sphere>
      
      {/* Atmosphere Glow */}
      <Sphere args={[radius * 1.05, 32, 32]}>
        <meshBasicMaterial color="#4a4a8a" transparent opacity={0.1} side={THREE.BackSide} />
      </Sphere>

      {/* Montenegro Beacon */}
      <group position={montenegroPos}>
        <Sphere args={[0.05, 16, 16]}>
          <meshBasicMaterial color="#c0c0c0" />
        </Sphere>
        {/* Beacon Glow */}
        <Sphere args={[0.15, 16, 16]}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
        </Sphere>
        
        {/* Silver Olive Tree growing from Montenegro */}
        <group position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
          <OliveTree />
        </group>
      </group>
    </group>
  );
}

function FloatingAstronaut({ color, offset, speed }: { color: string, offset: [number, number, number], speed: number }) {
  const ref = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime * speed;
      ref.current.position.y = offset[1] + Math.sin(t) * 0.1;
      ref.current.position.x = offset[0] + Math.cos(t * 0.8) * 0.1;
      ref.current.rotation.z = Math.sin(t * 0.5) * 0.1;
    }
  });

  return (
    <group ref={ref} position={offset}>
      {/* Head */}
      <Sphere args={[0.04, 16, 16]} position={[0, 0.1, 0]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </Sphere>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.15, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function OliveTree() {
  // A stylized, glowing silver tree
  return (
    <group>
      {/* Trunk */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.05, 1, 8]} />
        <meshStandardMaterial color="#c0c0c0" emissive="#808080" emissiveIntensity={0.5} />
      </mesh>
      {/* Branches */}
      <mesh position={[0.2, 1, 0]} rotation={[0, 0, -Math.PI/4]}>
        <cylinderGeometry args={[0.01, 0.02, 0.6, 8]} />
        <meshStandardMaterial color="#c0c0c0" emissive="#808080" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.2, 1.2, 0]} rotation={[0, 0, Math.PI/4]}>
        <cylinderGeometry args={[0.01, 0.02, 0.5, 8]} />
        <meshStandardMaterial color="#c0c0c0" emissive="#808080" emissiveIntensity={0.5} />
      </mesh>
      {/* Leaves/Energy */}
      <Sphere args={[0.4, 16, 16]} position={[0, 1.4, 0]}>
        <MeshDistortMaterial color="#e0e0e0" emissive="#ffffff" emissiveIntensity={0.8} transparent opacity={0.6} distort={0.4} speed={2} />
      </Sphere>
      <Sphere args={[0.3, 16, 16]} position={[0.3, 1.2, 0]}>
        <MeshDistortMaterial color="#e0e0e0" emissive="#ffffff" emissiveIntensity={0.8} transparent opacity={0.6} distort={0.4} speed={2} />
      </Sphere>
      <Sphere args={[0.25, 16, 16]} position={[-0.3, 1.4, 0]}>
        <MeshDistortMaterial color="#e0e0e0" emissive="#ffffff" emissiveIntensity={0.8} transparent opacity={0.6} distort={0.4} speed={2} />
      </Sphere>
      
      {/* Floating Astronauts */}
      <FloatingAstronaut color="#c0c0c0" offset={[-0.5, 1.0, 0.2]} speed={1.2} /> {/* Arya / Silver */}
      <FloatingAstronaut color="#ff8c00" offset={[0.5, 0.8, -0.2]} speed={1.5} /> {/* Hayden / Orange */}
    </group>
  );
}

export default function EarthBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-auto bg-black">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#ff8c00" /> {/* Nuclear Orange Light */}
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#c0c0c0" /> {/* Moonlight Silver Light */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <StylizedEarth />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
      </Canvas>
    </div>
  );
}
