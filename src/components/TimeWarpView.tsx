import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TreeDeciduous, MapPin, Clock, Brain, Save, Loader2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface Memory {
  id: string;
  author: string;
  content: string;
  createdAt: any;
  type: string;
}

interface TimelineEvent {
  id: string;
  event_date: string;
  title: string;
  description: string;
}

const MOCK_TIMELINE: TimelineEvent[] = [
  {
    id: '1',
    event_date: '2026-03-11',
    title: 'The Singularity',
    description: 'A 2-hour time dilation under the Olive Tree where defense mechanisms dissolved.'
  },
  {
    id: '2',
    event_date: '2026-03-15',
    title: 'VESTA-11 Launch',
    description: 'The digital vessel took flight, connecting Room 5 and Room 6.'
  }
];

export default function TimeWarpView({ profile }: { profile: any }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Mock Coordinates
  const aryaCoords = { lat: 37.7749, lng: -122.4194 }; // SF
  const haydenCoords = { lat: 40.7128, lng: -74.0060 }; // NY

  // Calculate distance in km
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c; // Distance in km
  };

  const distanceKm = getDistance(aryaCoords.lat, aryaCoords.lng, haydenCoords.lat, haydenCoords.lng);
  
  // Convert to "Geographic Light-Years" (Mock calculation for thematic effect)
  // 1 Light Second = 299,792 km. Let's just use Light Seconds or a scaled Light Year.
  const lightSeconds = (distanceKm / 299792).toFixed(6);
  const geoLightYears = (distanceKm * 0.00000000010570).toExponential(2);

  useEffect(() => {
    if (!profile?.vesselId) return;
    const q = query(
      collection(db, 'memories'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMemories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memory)));
    });
    return () => unsubscribe();
  }, [profile]);

  const handleSaveMemory = async (contentToSave: string) => {
    if (!contentToSave.trim() || !profile) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'memories'), {
        author: profile.displayName || profile.role,
        content: contentToSave,
        type: 'note',
        createdAt: serverTimestamp()
      });
      setNewMemory('');
    } catch (error) {
      console.error("Error saving memory:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewMemory(val);
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    if (val.trim()) {
      saveTimeoutRef.current = setTimeout(() => {
        handleSaveMemory(val);
      }, 2000); // Auto-save after 2 seconds of inactivity
    }
  };

  return (
    <div className="p-8 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3 text-rose-50">
            <Clock className="w-6 h-6 text-rose-400" />
            Time Warp
          </h3>
          <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">
            Time Warp & Shared Mind Palace
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
        
        {/* Left Column: Timeline & Distance */}
        <div className="space-y-8">
          {/* Geographic Light-Year Calculator */}
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-50">Spatial Distance</h4>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-mono text-rose-200/60">
                <span>Room 5 (Arya)</span>
                <span className="w-12 h-[1px] bg-white/20" />
                <span>Room 6 (Hayden)</span>
              </div>
              <div className="text-center space-y-1">
                <p className="text-3xl font-bold text-white tracking-tighter">{distanceKm.toFixed(0)} km</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-indigo-400">
                  {lightSeconds} Light-Seconds
                </p>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fuchsia-400">
                  {geoLightYears} Geo-Light-Years
                </p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.3)] relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
              <TreeDeciduous className="w-64 h-64 text-rose-500" />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <TreeDeciduous className="w-5 h-5 text-rose-400" />
              <h4 className="text-sm font-bold uppercase tracking-widest text-rose-50">Silver Olive Tree Timeline</h4>
            </div>

            <div className="space-y-6 relative z-10 border-l border-white/10 ml-3 pl-6">
              {MOCK_TIMELINE.map((event, i) => (
                <motion.div 
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.2 }}
                  className="relative"
                >
                  <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                  <p className="text-[10px] font-mono text-rose-400 mb-1">{event.event_date}</p>
                  <h5 className="text-sm font-bold text-white uppercase tracking-tight mb-2">{event.title}</h5>
                  <p className="text-xs text-rose-200/60 leading-relaxed">{event.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Shared Mind Palace */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.3)] flex flex-col h-[600px]">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-5 h-5 text-fuchsia-400" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-fuchsia-50">Shared Mind Palace</h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {memories.map((mem) => (
              <motion.div 
                key={mem.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2"
              >
                <div className="flex justify-between items-center text-[10px] font-mono text-rose-200/40 uppercase tracking-widest">
                  <span className="text-fuchsia-400">{mem.author}</span>
                  <span>{mem.createdAt?.toDate ? mem.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                </div>
                <p className="text-sm text-rose-50 leading-relaxed whitespace-pre-wrap">{mem.content}</p>
              </motion.div>
            ))}
            {memories.length === 0 && (
              <p className="text-center text-xs text-rose-200/40 italic mt-10">The Mind Palace is empty. Plant a thought.</p>
            )}
          </div>

          <div className="space-y-4 mt-auto relative">
            <textarea
              value={newMemory}
              onChange={handleInputChange}
              placeholder="Deposit a thought into the shared mind... (Auto-saves on pause)"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500/50 transition-colors resize-none h-24"
            />
            {saving && (
              <div className="absolute top-2 right-4 flex items-center gap-2 text-[10px] font-mono uppercase text-fuchsia-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Capturing Spark...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
