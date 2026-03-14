import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface EntryAnimationProps {
  onComplete: () => void;
}

export default function EntryAnimation({ onComplete }: EntryAnimationProps) {
  const [phase, setPhase] = useState<'approaching' | 'colliding' | 'expanding'>('approaching');

  useEffect(() => {
    // Phase 1: Approaching (0-2s)
    const t1 = setTimeout(() => setPhase('colliding'), 2000);
    // Phase 2: Colliding/Transforming (2-4s)
    const t2 = setTimeout(() => setPhase('expanding'), 4000);
    // Phase 3: Expanding/Complete (4-5.5s)
    const t3 = setTimeout(() => onComplete(), 5500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">
      <AnimatePresence>
        {phase === 'approaching' && (
          <>
            {/* Astronaut 5 (Arya/Left) - Moonlight Silver */}
            <motion.div
              key="astro5"
              initial={{ x: '-100vw', opacity: 0, scale: 0.5 }}
              animate={{ x: '-10vw', opacity: 1, scale: 1 }}
              exit={{ x: 0, opacity: 0, scale: 1.5 }}
              transition={{ duration: 2, ease: "easeIn" }}
              className="absolute text-6xl font-bold text-gray-300 drop-shadow-[0_0_15px_rgba(192,192,192,0.8)]"
            >
              5
            </motion.div>
            
            {/* Astronaut 6 (Hayden/Right) - Nuclear Orange */}
            <motion.div
              key="astro6"
              initial={{ x: '100vw', opacity: 0, scale: 0.5 }}
              animate={{ x: '10vw', opacity: 1, scale: 1 }}
              exit={{ x: 0, opacity: 0, scale: 1.5 }}
              transition={{ duration: 2, ease: "easeIn" }}
              className="absolute text-6xl font-bold text-orange-500 drop-shadow-[0_0_15px_rgba(255,140,0,0.8)]"
            >
              6
            </motion.div>
          </>
        )}

        {(phase === 'colliding' || phase === 'expanding') && (
          <motion.div
            key="singularity11"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={
              phase === 'colliding' 
                ? { scale: [0.5, 1.2, 1], opacity: 1, textShadow: ["0 0 20px #fff", "0 0 60px #fff", "0 0 30px #fff"] }
                : { scale: 50, opacity: 0 }
            }
            transition={
              phase === 'colliding'
                ? { duration: 2, ease: "easeInOut" }
                : { duration: 1.5, ease: "easeIn" }
            }
            className="absolute text-9xl font-black text-white mix-blend-screen"
            style={{
              background: "linear-gradient(90deg, #c0c0c0, #ff8c00)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            11
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
