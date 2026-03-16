import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Save, Loader2, Image as ImageIcon, Trash2, Lock, Atom, Heart, BookOpen } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { audioService } from '../services/audioService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ArtMemory {
  id: string;
  author: string;
  imageUrl?: string;
  content?: string;
  createdAt: any;
  type: string;
  halfLifeHours?: number;
  status?: string;
  senderId?: string;
}

export default function ArtView({ profile, addSR }: { profile: any, addSR?: (amount: number, reason: string) => void }) {
  const [activeTab, setActiveTab] = useState<'canvas' | 'secrets' | 'poems'>('canvas');
  
  // Canvas State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#fb7185'); // rose-400
  const [brushSize, setBrushSize] = useState(2);
  const [saving, setSaving] = useState(false);
  const [artworks, setArtworks] = useState<ArtMemory[]>([]);

  // Secrets State
  const [secrets, setSecrets] = useState<ArtMemory[]>([]);
  const [newSecret, setNewSecret] = useState('');
  const [halfLife, setHalfLife] = useState(11);

  // Poems State
  const [poems, setPoems] = useState<ArtMemory[]>([]);
  const [newPoem, setNewPoem] = useState('');
  const [readingPoemId, setReadingPoemId] = useState<string | null>(null);
  const pulseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!profile?.vesselId) return;
    const q = query(
      collection(db, 'memories'),
      where('type', 'in', ['art', 'secret', 'poem']),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ArtMemory));
      setArtworks(docs.filter(d => d.type === 'art'));
      setSecrets(docs.filter(d => d.type === 'secret'));
      setPoems(docs.filter(d => d.type === 'poem'));
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'canvas') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [activeTab]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x, y;

    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    ctx.lineWidth = brushSize;
    ctx.strokeStyle = color;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
      }
    }
  };

  const saveArtwork = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !profile) return;
    
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      
      await addDoc(collection(db, 'memories'), {
        author: profile.displayName || profile.role,
        imageUrl: dataUrl,
        type: 'art',
        createdAt: serverTimestamp()
      });
      
      clearCanvas();
    } catch (error) {
      console.error("Error saving artwork:", error);
    } finally {
      setSaving(false);
    }
  };

  const deleteArtwork = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'memories', id));
    } catch (error) {
      console.error("Error deleting artwork:", error);
    }
  };

  // Secrets Logic
  const sendSecret = async () => {
    if (!newSecret.trim() || !profile) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'memories'), {
        author: profile.displayName || profile.role,
        senderId: profile.uid,
        content: newSecret,
        type: 'secret',
        createdAt: serverTimestamp(),
        halfLifeHours: halfLife,
        status: 'active'
      });
      if (addSR) addSR(20, "Half-Life Secret Shared");
      setNewSecret('');
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const getDecayLevel = (secret: ArtMemory) => {
    if (secret.status === 'unlocked') return 0;
    const created = secret.createdAt?.toDate() || new Date();
    const now = new Date();
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    return Math.min(1, diffHours / (secret.halfLifeHours || 11));
  };

  // Poems Logic
  const savePoem = async () => {
    if (!newPoem.trim() || !profile) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'memories'), {
        author: profile.displayName || profile.role,
        content: newPoem,
        type: 'poem',
        createdAt: serverTimestamp()
      });
      setNewPoem('');
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const startReadingPoem = (id: string) => {
    setReadingPoemId(id);
    if (navigator.vibrate) {
      // Heartbeat pattern: bump-bump... bump-bump...
      pulseIntervalRef.current = setInterval(() => {
        navigator.vibrate([100, 100, 100]);
      }, 1000);
    }
  };

  const stopReadingPoem = () => {
    setReadingPoemId(null);
    if (pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current);
      pulseIntervalRef.current = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
  };

  useEffect(() => {
    return () => stopReadingPoem();
  }, []);

  return (
    <div className="p-8 flex flex-col">
      <div className="flex flex-col gap-6 mb-8">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3 text-rose-50">
            <Palette className="w-6 h-6 text-rose-400" />
            Olive Grove Archive
          </h3>
          <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">
            Shared Canvas, Secrets & Poetry
          </p>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/10 w-fit">
          <button 
            onClick={() => {
              audioService.playClick();
              setActiveTab('canvas');
            }}
            className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2", activeTab === 'canvas' ? "bg-rose-500/20 text-rose-400" : "text-white/50 hover:text-white")}
          >
            <ImageIcon className="w-4 h-4" /> Canvas
          </button>
          <button 
            onClick={() => {
              audioService.playClick();
              setActiveTab('secrets');
            }}
            className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2", activeTab === 'secrets' ? "bg-rose-500/20 text-rose-400" : "text-white/50 hover:text-white")}
          >
            <Lock className="w-4 h-4" /> Secrets
          </button>
          <button 
            onClick={() => {
              audioService.playClick();
              setActiveTab('poems');
            }}
            className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2", activeTab === 'poems' ? "bg-rose-500/20 text-rose-400" : "text-white/50 hover:text-white")}
          >
            <BookOpen className="w-4 h-4" /> Poems
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'canvas' && (
          <motion.div 
            key="canvas"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8"
          >
        {/* Left Column: Canvas */}
        <div className="space-y-6">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-rose-400" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-rose-50">Creation Canvas</h4>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={color} 
                  onChange={(e) => setColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                />
                <input 
                  type="range" 
                  min="1" max="20" 
                  value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-24 accent-rose-500"
                />
              </div>
            </div>
            
            <div className="border border-white/10 rounded-xl overflow-hidden bg-black touch-none">
              <canvas
                ref={canvasRef}
                width={400}
                height={400}
                className="w-full h-auto cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onMouseMove={draw}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
              />
            </div>
            
            <div className="flex gap-4 mt-4">
              <button
                onClick={clearCanvas}
                className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl uppercase tracking-widest hover:bg-white/10 transition-all text-xs"
              >
                Clear
              </button>
              <button
                onClick={saveArtwork}
                disabled={saving}
                className="flex-1 py-3 bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold rounded-xl uppercase tracking-widest hover:bg-rose-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save to Archive
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Gallery */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.3)] flex flex-col h-[600px]">
          <div className="flex items-center gap-3 mb-6">
            <ImageIcon className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-50">Shared Gallery</h4>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 gap-4 content-start">
            {artworks.map((art) => (
              <motion.div 
                key={art.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group rounded-xl overflow-hidden border border-white/10 bg-black aspect-square"
              >
                <img src={art.imageUrl} alt="Artwork" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-mono text-rose-400 uppercase tracking-widest">{art.author}</p>
                      <p className="text-[8px] font-mono text-white/50">
                        {art.createdAt?.toDate ? art.createdAt.toDate().toLocaleDateString() : 'Just now'}
                      </p>
                    </div>
                    {(profile?.displayName === art.author || profile?.role === art.author) && (
                      <button 
                        onClick={() => deleteArtwork(art.id)}
                        className="text-white/50 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {artworks.length === 0 && (
              <div className="col-span-2 text-center text-xs text-rose-200/40 italic mt-10">
                The gallery is empty. Create something together.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )}

        {activeTab === 'secrets' && (
          <motion.div 
            key="secrets"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-8 pb-8"
          >
            <div className="bg-black/50 border border-white/10 rounded-2xl p-6 space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
              <textarea 
                value={newSecret}
                onChange={(e) => {
                  setNewSecret(e.target.value);
                  audioService.playType();
                }}
                placeholder="Encrypt a secret..."
                className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none h-24 text-rose-50 outline-none"
              />
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-rose-200/40">Half-Life: {halfLife}H</span>
                  <input 
                    type="range" min="1" max="48" value={halfLife}
                    onChange={(e) => setHalfLife(parseInt(e.target.value))}
                    className="w-32 accent-rose-500"
                  />
                </div>
                <button 
                  onClick={sendSecret}
                  disabled={saving || !newSecret.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-rose-500 to-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(244,63,94,0.3)] disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Atom className="w-4 h-4" />}
                  Isotope Launch
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {secrets.map((secret) => {
                const decay = getDecayLevel(secret);
                const isDecayed = decay >= 1;
                
                return (
                  <div 
                    key={secret.id}
                    className={cn(
                      "p-6 rounded-2xl border transition-all relative overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.2)]",
                      isDecayed ? "bg-black/20 border-red-500/20" : "bg-black/40 border-white/10 hover:border-rose-500/30"
                    )}
                  >
                    <div 
                      className="absolute inset-0 bg-red-500/5 transition-all" 
                      style={{ opacity: decay }}
                    />
                    
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-rose-200/40">
                          {secret.senderId === profile?.uid ? 'Outgoing' : 'Incoming'} Isotope
                        </span>
                        <span className={cn(
                          "text-[10px] font-mono uppercase tracking-widest",
                          isDecayed ? "text-red-500" : "text-rose-400"
                        )}>
                          {isDecayed ? 'DECAYED' : `${((1 - decay) * 100).toFixed(0)}% STABLE`}
                        </span>
                      </div>
                      
                      <p className={cn(
                        "text-sm italic font-serif leading-relaxed text-rose-50",
                        isDecayed && "blur-sm select-none opacity-30"
                      )}>
                        {secret.content}
                      </p>
                      
                      {isDecayed && (
                        <div className="pt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-red-400/60">
                          <Lock className="w-3 h-3" />
                          Housed in Lead Container
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'poems' && (
          <motion.div 
            key="poems"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8"
          >
            <div className="bg-black/50 border border-white/10 rounded-2xl p-6 space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.3)] h-fit">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-50">Compose Poetry</h4>
              </div>
              <textarea 
                value={newPoem}
                onChange={(e) => {
                  setNewPoem(e.target.value);
                  audioService.playType();
                }}
                placeholder="Write a poem..."
                className="w-full bg-transparent border border-white/10 rounded-xl p-4 focus:border-indigo-500/50 text-sm resize-none h-48 text-rose-50 outline-none"
              />
              <button 
                onClick={savePoem}
                disabled={saving || !newPoem.trim()}
                className="w-full py-3 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold rounded-xl uppercase tracking-widest hover:bg-indigo-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Publish Poem
              </button>
            </div>

            <div className="space-y-4">
              {poems.map((poem) => {
                const isReading = readingPoemId === poem.id;
                return (
                  <div key={poem.id} className="bg-black/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                    {isReading && (
                      <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-rose-500/5 pointer-events-none"
                      />
                    )}
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <p className="text-[10px] font-mono text-rose-400 uppercase tracking-widest">{poem.author}</p>
                        <p className="text-[8px] font-mono text-white/50">
                          {poem.createdAt?.toDate ? poem.createdAt.toDate().toLocaleDateString() : 'Just now'}
                        </p>
                      </div>
                      <button
                        onClick={() => isReading ? stopReadingPoem() : startReadingPoem(poem.id)}
                        className={cn(
                          "p-2 rounded-full border transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                          isReading ? "bg-rose-500/20 border-rose-500/50 text-rose-400" : "border-white/10 text-white/50 hover:text-white hover:border-white/30"
                        )}
                      >
                        <Heart className={cn("w-4 h-4", isReading && "animate-pulse fill-rose-400")} />
                        {isReading ? 'Reading...' : 'Read'}
                      </button>
                    </div>
                    <p className="text-sm italic font-serif leading-relaxed text-rose-50 whitespace-pre-wrap relative z-10">
                      {poem.content}
                    </p>
                  </div>
                );
              })}
              {poems.length === 0 && (
                <div className="text-center text-xs text-rose-200/40 italic mt-10">
                  No poems shared yet.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
