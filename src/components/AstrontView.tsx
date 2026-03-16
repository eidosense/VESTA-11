import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles, BookOpen, Brain, Send, Radio, Zap, Rocket, Link } from 'lucide-react';
import { generateAstronautFacts } from '../lib/gemini';
import { db } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  limit
} from 'firebase/firestore';

interface Fact {
  title: string;
  fact: string;
  lifeSkill: string;
  motivation: string;
  source: string;
}

interface SharedDiscovery {
  id: string;
  fact: Fact;
  senderRole: string;
  timestamp: any;
}

export default function AstrontView({ profile }: { profile: any }) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [sharedDiscoveries, setSharedDiscoveries] = useState<SharedDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState<string | null>(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    if (facts.length > 0) {
      const interval = setInterval(() => {
        setFeaturedIndex((prev) => (prev + 1) % facts.length);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [facts.length]);

  useEffect(() => {
    if (!profile?.vesselId) return;

    const fetchDailyFacts = async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const briefingRef = doc(db, 'daily_briefings', `${profile.vesselId}_${today}`);
        const briefingSnap = await getDoc(briefingRef);

        if (briefingSnap.exists()) {
          setFacts(briefingSnap.data().facts);
        } else {
          const newFacts = await generateAstronautFacts();
          await setDoc(briefingRef, {
            vesselId: profile.vesselId,
            date: today,
            facts: newFacts,
            createdAt: serverTimestamp()
          });
          setFacts(newFacts);
        }
      } catch (err) {
        console.error("Detailed error in fetchDailyFacts:", err);
        if (err instanceof Error) {
          console.error("Error message:", err.message);
          console.error("Error stack:", err.stack);
        }
        setError("Failed to establish uplink with VESTA-11 for daily briefing.");
      } finally {
        setLoading(false);
      }
    };

    fetchDailyFacts();

    // Listen for shared discoveries
    const discoveriesQuery = query(
      collection(db, 'shared_discoveries'),
      where('vesselId', '==', profile.vesselId),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(discoveriesQuery, (snapshot) => {
      setSharedDiscoveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SharedDiscovery)));
    });

    return () => unsubscribe();
  }, [profile?.vesselId]);

  const broadcastFact = async (fact: Fact) => {
    if (!profile?.vesselId) return;
    setBroadcasting(fact.title);
    try {
      await addDoc(collection(db, 'shared_discoveries'), {
        vesselId: profile.vesselId,
        senderId: profile.uid,
        senderRole: profile.role,
        fact,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Broadcast failed:", err);
    } finally {
      setTimeout(() => setBroadcasting(null), 2000);
    }
  };

  return (
    <div className="p-8 flex flex-col h-full overflow-y-auto space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3 text-rose-50">
            <Sparkles className="w-6 h-6 text-rose-400" />
            Astront Briefing
          </h3>
          <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">
            30 Daily Protocols for Astronaut Candidates
          </p>
        </div>
      </div>

      {/* Featured Fact Banner */}
      <AnimatePresence mode="wait">
        {facts.length > 0 && (
          <motion.div
            key={featuredIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/10 to-indigo-500/10 blur-xl opacity-50" />
            <div className="relative bg-black/60 border border-rose-500/30 rounded-2xl p-8 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="px-2 py-1 bg-rose-500 text-white text-[8px] font-mono uppercase tracking-widest rounded">Featured Protocol</div>
                <div className="text-[10px] font-mono text-rose-400/60 uppercase tracking-widest">Auto-Rotating every 10s</div>
              </div>
              <h4 className="text-xl font-bold text-white uppercase mb-4 tracking-tight leading-none">
                {facts[featuredIndex].title}
              </h4>
              <p className="text-rose-100/70 text-sm italic leading-relaxed mb-6">
                "{facts[featuredIndex].fact}"
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-fuchsia-400" />
                    <span className="text-xs text-fuchsia-300/80 font-medium">{facts[featuredIndex].lifeSkill}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-300/80 font-medium">{facts[featuredIndex].motivation}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <a 
                    href={facts[featuredIndex].source} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Link className="w-3 h-3" />
                    Source
                  </a>
                  <button 
                    onClick={() => broadcastFact(facts[featuredIndex])}
                    className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 rounded-lg text-[10px] font-mono uppercase tracking-widest text-rose-100 transition-all"
                  >
                    <Send className="w-3 h-3" />
                    Broadcast
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared Discoveries Feed */}
      <AnimatePresence>
        {sharedDiscoveries.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-rose-400/60">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Vessel-Wide Broadcasts</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {sharedDiscoveries.map((discovery) => (
                <motion.div
                  key={discovery.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex-shrink-0 w-64 p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-mono uppercase text-rose-400">{discovery.senderRole} shared:</span>
                    <Zap className="w-3 h-3 text-rose-400" />
                  </div>
                  <h5 className="text-xs font-bold text-white uppercase">{discovery.fact.title}</h5>
                  <p className="text-[10px] text-rose-100/60 line-clamp-2 italic">"{discovery.fact.fact}"</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
          <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">
            Synthesizing Daily Briefing...
          </p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-24">
          {facts.map((fact, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:border-rose-500/30 transition-all group relative overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/5 blur-3xl rounded-full group-hover:bg-rose-500/10 transition-all" />

              <div className="flex items-start gap-4 relative z-10">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold italic text-lg shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                  {i + 1}
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <h4 className="text-lg font-bold text-white uppercase tracking-tight group-hover:text-rose-400 transition-colors">
                      {fact.title}
                    </h4>
                    <button 
                      onClick={() => broadcastFact(fact)}
                      disabled={broadcasting === fact.title}
                      className={cn(
                        "p-2 rounded-lg border transition-all",
                        broadcasting === fact.title 
                          ? "bg-rose-500 border-rose-500 text-white scale-90" 
                          : "border-white/10 text-rose-200/40 hover:border-rose-500/50 hover:text-rose-400"
                      )}
                      title="Broadcast to Vessel"
                    >
                      {broadcasting === fact.title ? <Zap className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-indigo-400">
                      <BookOpen className="w-3 h-3" />
                      <span>Scientific Protocol</span>
                    </div>
                    <p className="text-sm text-rose-100/80 leading-relaxed">
                      {fact.fact}
                    </p>
                    <a 
                      href={fact.source} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:underline"
                    >
                      <Link className="w-3 h-3" />
                      View Source
                    </a>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                      <Rocket className="w-3 h-3" />
                      <span>Mission Motivation</span>
                    </div>
                    <p className="text-sm text-emerald-100/80 leading-relaxed italic">
                      {fact.motivation}
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-fuchsia-400">
                      <Brain className="w-3 h-3" />
                      <span>Neuro-Calibration</span>
                    </div>
                    <p className="text-sm text-fuchsia-100/80 leading-relaxed italic">
                      {fact.lifeSkill}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
