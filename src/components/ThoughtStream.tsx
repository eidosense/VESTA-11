import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { 
  Send, 
  Brain, 
  Sparkles, 
  Zap, 
  Star, 
  Orbit, 
  Loader2,
  X,
  Maximize2,
  Minimize2,
  MessageSquare,
  Activity,
  Navigation
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  limit,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { analyzeThoughtStream } from '../lib/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Thought {
  id: string;
  content: string;
  senderId: string;
  senderRole: string;
  timestamp: any;
  topic?: string;
  keywords?: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

const TOPIC_COLORS: Record<string, string> = {
  'Mission': '#f43f5e', // rose
  'Technical': '#6366f1', // indigo
  'Emotional': '#d946ef', // fuchsia
  'Philosophical': '#10b981', // emerald
  'Random': '#f59e0b', // amber
  'Default': '#94a3b8' // slate
};

export default function ThoughtStream({ vesselId, userId, userRole }: { vesselId: string, userId: string, userRole: string }) {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedThought, setSelectedThought] = useState<Thought | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  // Physics constants
  const DAMPING = 0.98;
  const ATTRACTION = 0.005;
  const REPULSION = 1500;
  const CENTER_FORCE = 0.001;

  useEffect(() => {
    if (!vesselId) return;

    const q = query(
      collection(db, 'messages'),
      where('vesselId', '==', vesselId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newThoughts: Thought[] = snapshot.docs.map(doc => {
        const data = doc.data();
        // Check if we already have this thought to preserve physics state
        const existing = thoughts.find(t => t.id === doc.id);
        
        if (existing) return existing;

        // Initialize new thought with random position
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        
        return {
          id: doc.id,
          content: data.content,
          senderId: data.senderId,
          senderRole: data.senderRole,
          timestamp: data.timestamp,
          topic: data.topic || 'Default',
          keywords: data.keywords || [],
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.max(80, Math.min(200, data.content.length * 0.8)),
          color: TOPIC_COLORS[data.topic] || TOPIC_COLORS['Default']
        };
      });

      setThoughts(newThoughts);
    });

    return () => unsubscribe();
  }, [vesselId]);

  // Physics Loop
  const animate = () => {
    setThoughts(prevThoughts => {
      if (prevThoughts.length === 0) return prevThoughts;
      
      const width = containerRef.current?.clientWidth || 800;
      const height = containerRef.current?.clientHeight || 600;
      const centerX = width / 2;
      const centerY = height / 2;

      return prevThoughts.map((t, i) => {
        let fx = 0;
        let fy = 0;

        // 1. Center force
        fx += (centerX - t.x) * CENTER_FORCE;
        fy += (centerY - t.y) * CENTER_FORCE;

        // 2. Interaction with other thoughts
        prevThoughts.forEach((other, j) => {
          if (i === j) return;

          const dx = other.x - t.x;
          const dy = other.y - t.y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq) || 1;

          // Repulsion (prevent overlap)
          const minSafeDist = (t.size + other.size) / 2 + 20;
          if (dist < minSafeDist) {
            const force = (minSafeDist - dist) * 0.05;
            fx -= (dx / dist) * force;
            fy -= (dy / dist) * force;
          }

          // Attraction (same topic)
          if (t.topic === other.topic && t.topic !== 'Default') {
            fx += dx * ATTRACTION;
            fy += dy * ATTRACTION;
          }
        });

        // Update velocity and position
        const nvx = (t.vx + fx) * DAMPING;
        const nvy = (t.vy + fy) * DAMPING;
        let nx = t.x + nvx;
        let ny = t.y + nvy;

        // Boundary check
        if (nx < 0 || nx > width) {
          nx = nx < 0 ? 0 : width;
        }
        if (ny < 0 || ny > height) {
          ny = ny < 0 ? 0 : height;
        }

        return { ...t, x: nx, y: ny, vx: nvx, vy: nvy };
      });
    });

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    setIsSending(true);

    try {
      // Analyze thought for topic and keywords
      const analysis = await analyzeThoughtStream(input);
      
      await addDoc(collection(db, 'messages'), {
        vesselId,
        senderId: userId,
        senderRole: userRole,
        content: input,
        timestamp: serverTimestamp(),
        type: 'brain-dump',
        topic: analysis.topic,
        keywords: analysis.keywords
      });

      setInput('');
    } catch (error) {
      console.error("Failed to send thought:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode === 'list') return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || viewMode === 'list') return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetPan = () => {
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050505] flex flex-col">
      {/* Background Stars */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {[...Array(50)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 p-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="space-y-1">
          <h3 className="text-xl font-bold italic uppercase tracking-tighter flex items-center gap-3 text-rose-50">
            <Brain className="w-6 h-6 text-rose-400" />
            Neural Constellation Map
          </h3>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-200/40">Visualized Thought Field // Floating nodes of shared consciousness</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
            <button 
              onClick={() => setViewMode('map')}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] uppercase font-mono transition-all",
                viewMode === 'map' ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-white/40 hover:text-white/60"
              )}
            >
              Map
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] uppercase font-mono transition-all",
                viewMode === 'list' ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-white/40 hover:text-white/60"
              )}
            >
              List
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
            <Activity className="w-3 h-3 text-rose-400 animate-pulse" />
            <span className="text-[10px] font-mono text-rose-300 uppercase">Neural Sync Active</span>
          </div>
        </div>
      </div>

      {/* Thought Stream Area */}
      {viewMode === 'map' ? (
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            "flex-1 relative overflow-hidden",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <div 
            className="absolute inset-0 transition-transform duration-75 ease-out"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            {/* Constellation Lines */}
            <svg className="absolute inset-0 pointer-events-none w-full h-full">
              {thoughts.map((t, i) => {
                return thoughts.slice(i + 1).map(other => {
                  if (t.topic === other.topic && t.topic !== 'Default') {
                    const dist = Math.sqrt(Math.pow(t.x - other.x, 2) + Math.pow(t.y - other.y, 2));
                    if (dist < 300) {
                      return (
                        <line 
                          key={`${t.id}-${other.id}`}
                          x1={t.x} y1={t.y}
                          x2={other.x} y2={other.y}
                          stroke={t.color}
                          strokeWidth="1"
                          strokeOpacity={Math.max(0, 1 - dist / 300) * 0.3}
                          strokeDasharray="4 4"
                        />
                      );
                    }
                  }
                  return null;
                });
              })}
            </svg>

            {/* Thoughts */}
            <AnimatePresence>
              {thoughts.map((thought) => (
                <motion.div
                  key={thought.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: 1, 
                    opacity: 1,
                    x: thought.x - thought.size / 2,
                    y: thought.y - thought.size / 2
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                  onClick={() => setSelectedThought(thought)}
                  className={cn(
                    "absolute rounded-full flex items-center justify-center p-4 cursor-pointer group",
                    "border border-white/10 backdrop-blur-sm shadow-lg transition-colors",
                    selectedThought?.id === thought.id ? "z-50 bg-white/10 border-white/30" : "z-10 bg-black/40 hover:bg-white/5"
                  )}
                  style={{
                    width: thought.size,
                    height: thought.size,
                    boxShadow: `0 0 20px ${thought.color}20`
                  }}
                >
                  {/* Glow Effect */}
                  <div 
                    className="absolute inset-0 rounded-full opacity-20 blur-xl group-hover:opacity-40 transition-opacity"
                    style={{ backgroundColor: thought.color }}
                  />

                  <div className="relative z-10 text-center space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-widest opacity-40 mb-1">
                      {thought.senderRole === 'Commander' ? 'CMD' : 'ENG'}
                    </p>
                    <p className="text-[11px] leading-tight line-clamp-3 text-rose-50/80 font-medium">
                      {thought.content}
                    </p>
                    <div 
                      className="w-1.5 h-1.5 rounded-full mx-auto mt-2"
                      style={{ backgroundColor: thought.color }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Map Controls */}
          <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-20">
            <button 
              onClick={resetPan}
              className="p-2 bg-black/40 hover:bg-black/60 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all backdrop-blur-md"
              title="Reset View"
            >
              <Navigation className="w-4 h-4 rotate-45" />
            </button>
            <div className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg backdrop-blur-md">
              <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Drag to Pan</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/20">
          {thoughts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
              <Activity className="w-12 h-12 animate-pulse" />
              <p className="font-mono text-xs uppercase tracking-widest">No thoughts detected in current sector</p>
            </div>
          ) : (
            thoughts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedThought(t)}
                className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-rose-500/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">{t.topic}</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/20">{t.timestamp?.toDate().toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-rose-50 group-hover:text-white transition-colors">{t.content}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.keywords?.map(kw => (
                    <span key={kw} className="text-[9px] font-mono text-rose-400/60">#{kw}</span>
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Thought Details Modal */}
      <AnimatePresence>
        {selectedThought && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedThought(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: selectedThought.color }} />
              
              <button 
                onClick={() => setSelectedThought(null)}
                className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5"
                    style={{ color: selectedThought.color }}
                  >
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-white/40">
                      {selectedThought.topic} // {selectedThought.senderRole}
                    </p>
                    <p className="text-sm text-white/60">
                      {selectedThought.timestamp?.toDate().toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  <p className="text-base leading-relaxed text-rose-50 font-light">
                    {selectedThought.content}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                  {selectedThought.keywords?.map(kw => (
                    <span key={kw} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-white/40 uppercase tracking-widest">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="relative z-10 p-6 border-t border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto flex items-end gap-4">
          <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Broadcast a thought to the constellation..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-rose-500/50 transition-all resize-none min-h-[60px] max-h-[120px]"
              />
          </div>
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50",
              "bg-gradient-to-br from-rose-500 to-indigo-600 text-white shadow-lg shadow-rose-500/20"
            )}
          >
            {isSending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}
