import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Palette, Save, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface ArtMemory {
  id: string;
  author: string;
  imageUrl: string;
  createdAt: any;
  type: string;
}

export default function ArtView({ profile }: { profile: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#fb7185'); // rose-400
  const [brushSize, setBrushSize] = useState(2);
  const [saving, setSaving] = useState(false);
  const [artworks, setArtworks] = useState<ArtMemory[]>([]);

  useEffect(() => {
    if (!profile?.vesselId) return;
    const q = query(
      collection(db, 'memories'),
      where('type', '==', 'art'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setArtworks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ArtMemory)));
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Fill with black background initially
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

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
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
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

  return (
    <div className="p-8 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3 text-rose-50">
            <Palette className="w-6 h-6 text-rose-400" />
            Olive Grove Archive
          </h3>
          <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">
            Shared Canvas & Gallery
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
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

      </div>
    </div>
  );
}
