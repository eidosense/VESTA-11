import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, Sparkles, BookOpen, Brain } from 'lucide-react';
import { generateAstronautFacts } from '../lib/gemini';

interface Fact {
  title: string;
  fact: string;
  lifeSkill: string;
}

export default function AstrontView({ profile }: { profile: any }) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFacts = async () => {
      try {
        setLoading(true);
        // Check local storage first for today's facts
        const today = new Date().toISOString().split('T')[0];
        const cached = localStorage.getItem(`astront_facts_${today}`);
        
        if (cached) {
          setFacts(JSON.parse(cached));
        } else {
          const newFacts = await generateAstronautFacts();
          setFacts(newFacts);
          localStorage.setItem(`astront_facts_${today}`, JSON.stringify(newFacts));
        }
      } catch (err) {
        console.error("Failed to fetch Astront facts:", err);
        setError("Failed to establish uplink with VESTA-11 for daily briefing.");
      } finally {
        setLoading(false);
      }
    };

    fetchFacts();
  }, []);

  return (
    <div className="p-8 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3 text-rose-50">
            <Sparkles className="w-6 h-6 text-rose-400" />
            Astront Briefing
          </h3>
          <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">
            11 Daily Protocols for Astronaut Candidates
          </p>
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          {facts.map((fact, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:border-rose-500/30 transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold italic text-lg shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                  {i + 1}
                </div>
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-white uppercase tracking-tight">
                    {fact.title}
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-indigo-400">
                      <BookOpen className="w-3 h-3" />
                      <span>Scientific Fact</span>
                    </div>
                    <p className="text-sm text-rose-100/80 leading-relaxed">
                      {fact.fact}
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-fuchsia-400">
                      <Brain className="w-3 h-3" />
                      <span>Life Skill / ADHD Protocol</span>
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
