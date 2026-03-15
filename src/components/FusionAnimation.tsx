import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { audioService } from '../services/audioService';

interface FusionAnimationProps {
  onComplete: () => void;
}

export default function FusionAnimation({ onComplete }: FusionAnimationProps) {
  const [stage, setStage] = useState<'attract' | 'collision' | 'result'>('attract');

  useEffect(() => {
    // Stage 1: Attraction (Gravity)
    const timer1 = setTimeout(() => {
      setStage('collision');
      audioService.playFusion();
    }, 2000);

    // Stage 2: Collision/Explosion
    const timer2 = setTimeout(() => {
      setStage('result');
    }, 2500);

    // Stage 3: Result (11)
    const timer3 = setTimeout(() => {
      onComplete();
    }, 8000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {stage === 'attract' && (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Number 6 (Sun Color) */}
            <motion.div
              initial={{ x: -300, opacity: 0, scale: 0.5 }}
              animate={{ x: -50, opacity: 1, scale: 1.5 }}
              transition={{ duration: 2, ease: "easeIn" }}
              className="text-[12rem] font-bold text-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.8)]"
            >
              6
            </motion.div>

            {/* Number 5 (Silver Color) */}
            <motion.div
              initial={{ x: 300, opacity: 0, scale: 0.5 }}
              animate={{ x: 50, opacity: 1, scale: 1.5 }}
              transition={{ duration: 2, ease: "easeIn" }}
              className="text-[12rem] font-bold text-slate-300 drop-shadow-[0_0_30px_rgba(203,213,225,0.8)]"
            >
              5
            </motion.div>
          </div>
        )}

        {stage === 'collision' && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 20, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute w-20 h-20 bg-white rounded-full blur-3xl"
          />
        )}

        {stage === 'result' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-8"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                textShadow: [
                  "0 0 20px rgba(255,255,255,0.5)",
                  "0 0 50px rgba(255,255,255,0.8)",
                  "0 0 20px rgba(255,255,255,0.5)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-[15rem] font-bold text-white italic tracking-tighter"
            >
              11
            </motion.div>
            
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-xl md:text-2xl text-rose-100/80 font-serif italic text-center px-6 max-w-2xl leading-relaxed"
            >
              "Welcome to the only place in the multiverse where we don't need a map."
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              opacity: 0 
            }}
            animate={{ 
              y: [null, Math.random() * -100],
              opacity: [0, 0.5, 0]
            }}
            transition={{ 
              duration: Math.random() * 3 + 2, 
              repeat: Infinity,
              delay: Math.random() * 2
            }}
            className="w-1 h-1 bg-white rounded-full"
          />
        ))}
      </div>
    </div>
  );
}
