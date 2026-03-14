import { useState, useEffect, useRef } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import { 
  collection, 
  where,
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  limit,
  increment
} from 'firebase/firestore';
import { 
  Atom, 
  Zap, 
  Brain, 
  ClipboardList, 
  Archive, 
  LogOut, 
  Send, 
  Loader2,
  TreeDeciduous,
  Clock,
  Radio,
  Navigation,
  Rocket,
  Lock,
  Wind,
  MapPin,
  Volume2,
  Settings,
  User,
  Check,
  AlertCircle,
  UserPlus,
  Copy,
  Link
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, addHours, isAfter } from 'date-fns';
import Markdown from 'react-markdown';
import { analyzeBrainDump, generateFusionPoem, generateFocusMessage } from './lib/gemini';
import { getMoonData, getEmotionalDistance, SINGULARITY_SKY, getSkyContext } from './services/astronomyService';
import { Moon, Sun, Compass, Star } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface UserProfile {
  uid: string;
  email: string;
  role: 'Commander' | 'Lead Engineer';
  displayName: string;
  vesselId?: string;
  preferences?: {
    notifications: boolean;
    theme: 'emerald' | 'amber' | 'violet';
  };
}

interface Vessel {
  id: string;
  members: string[];
  createdAt: any;
  sr: number;
  streakDays?: number;
  lastSyncDate?: string;
}

interface Invitation {
  token: string;
  vesselId: string;
  used: boolean;
  expiresAt?: any;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: any;
  type: 'brain-dump' | 'poem' | 'alert';
  analysis?: string;
  senderRole?: string;
}

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  assignedTo?: string;
  category: 'Life Support' | 'Navigation' | 'Nuclear Heart' | 'Olive Grove';
  createdAt: any;
}

interface FusionPulse {
  id: string;
  participants: string[];
  timestamp: any;
  poem: string;
}

interface Presence {
  uid: string;
  lastSeen: any;
  location?: { lat: number, lng: number };
  breathing?: boolean;
}

interface FocusSession {
  id: string;
  active: boolean;
  startTime: any;
  participants: string[];
  topic: string;
}

interface Secret {
  id: string;
  senderId: string;
  content: string;
  createdAt: any;
  halfLifeHours: number;
  status: 'active' | 'decayed' | 'unlocked';
}

interface ArchiveEntry {
  id: string;
  vesselId: string;
  authorId: string;
  authorRole: string;
  content: string;
  title: string;
  createdAt: any;
  coordinates: string;
  isEncrypted: boolean;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the app, but we log it as requested
}

function SettingsView({ profile, setProfile }: { profile: UserProfile | null, setProfile: (p: UserProfile) => void }) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [role, setRole] = useState(profile?.role || 'Lead Engineer');
  const [notifications, setNotifications] = useState(profile?.preferences?.notifications ?? true);
  const [theme, setTheme] = useState(profile?.preferences?.theme || 'emerald');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const generateInvite = async () => {
    if (!profile?.vesselId) return;
    setGeneratingInvite(true);
    try {
      const token = Math.random().toString(36).slice(2, 15);
      await setDoc(doc(db, 'invitations', token), {
        token,
        vesselId: profile.vesselId,
        used: false,
        expiresAt: serverTimestamp()
      });
      const link = `${window.location.origin}${window.location.pathname}?invite=${token}`;
      setInviteLink(link);
    } catch (error) {
      console.error("Failed to generate invite:", error);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const [copySuccess, setCopySuccess] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setSuccess(false);

    const updatedProfile: UserProfile = {
      ...profile,
      displayName,
      role: role as 'Commander' | 'Lead Engineer',
      preferences: {
        notifications,
        theme: theme as 'emerald' | 'amber' | 'violet'
      }
    };

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName,
        role,
        preferences: updatedProfile.preferences
      });
      setProfile(updatedProfile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-8 flex flex-col h-full space-y-8 overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3">
            <Settings className="w-6 h-6 text-emerald-500" />
            User Settings
          </h3>
          <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Neural Link Configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Section */}
        <div className="space-y-6 bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-50">Profile Identity</h4>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Display Name</label>
              <input 
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                placeholder="Enter your name..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Mission Role</label>
              <select 
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
              >
                <option value="Commander">Commander</option>
                <option value="Lead Engineer">Lead Engineer</option>
              </select>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="space-y-6 bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-5 h-5 text-amber-400" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-amber-50">Preferences</h4>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-200">Neural Notifications</p>
                <p className="text-[10px] text-zinc-500">Receive alerts for cosmic resonance</p>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  notifications ? "bg-emerald-500" : "bg-zinc-800"
                )}
              >
                <motion.div 
                  animate={{ x: notifications ? 26 : 2 }}
                  className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-zinc-200">Interface Theme</p>
              <div className="flex gap-3">
                {['emerald', 'amber', 'violet'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t as any)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      theme === t ? "border-white scale-110" : "border-transparent opacity-50",
                      t === 'emerald' ? "bg-emerald-500" : t === 'amber' ? "bg-amber-500" : "bg-violet-500"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Invite Partner Section */}
        <div className="space-y-6 bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <UserPlus className="w-5 h-5 text-blue-400" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-blue-50">Invite Partner</h4>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-zinc-400 max-w-2xl">
              VESTA-11 is designed for exactly two souls. Generate a one-time invitation link to bring your partner into this shared vessel. Once they join, the link will expire.
            </p>

            {!inviteLink ? (
              <button 
                onClick={generateInvite}
                disabled={generatingInvite}
                className="px-6 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-500/20 transition-all flex items-center gap-2"
              >
                {generatingInvite ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
                Generate Invitation Link
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-[10px] font-mono text-zinc-400 truncate">
                  {inviteLink}
                </div>
                <button 
                  onClick={() => copyToClipboard(inviteLink)}
                  className={cn(
                    "p-2 rounded-lg transition-all flex items-center gap-2",
                    copySuccess ? "bg-emerald-500 text-black" : "bg-blue-500 text-black hover:bg-blue-400"
                  )}
                  title="Copy Link"
                >
                  {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copySuccess && <span className="text-[10px] font-bold uppercase">Copied</span>}
                </button>
                <button 
                  onClick={() => setInviteLink(null)}
                  className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-all"
                  title="Clear"
                >
                  <AlertCircle className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-8 flex items-center gap-4">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Syncing...' : 'Save Configuration'}
        </button>

        {success && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-widest"
          >
            <Check className="w-4 h-4" />
            Neural Link Updated
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

interface ToastMessage {
  id: string;
  message: string;
  amount: number;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'brain-dump' | 'mission-control' | 'archive' | 'parallax' | 'rocket' | 'secrets' | 'breath' | 'settings'>('brain-dump');
  const [otherPresence, setOtherPresence] = useState<Presence | null>(null);
  const [moonData, setMoonData] = useState(getMoonData());
  const [skyContext, setSkyContextState] = useState<any>(null);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addSR = async (amount: number, reason: string) => {
    if (!profile?.vesselId) return;
    
    // Show toast
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message: reason, amount }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);

    // Update DB
    await updateDoc(doc(db, 'vessels', profile.vesselId), {
      sr: increment(amount)
    });
  };

  const updateStreak = async () => {
    if (!vessel || !profile?.vesselId) return;
    
    const today = new Date().toISOString().split('T')[0];
    const lastSync = vessel.lastSyncDate;
    
    if (lastSync === today) return; // Already synced today
    
    let newStreak = 1;
    if (lastSync) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastSync === yesterdayStr) {
        newStreak = (vessel.streakDays || 0) + 1;
      }
    }
    
    await updateDoc(doc(db, 'vessels', profile.vesselId), {
      streakDays: newStreak,
      lastSyncDate: today
    });
    
    if (newStreak === 3) {
      addSR(500, "SUPERNOVA EVENT: 3-Day Entanglement Streak!");
      setLaunchMessage("SUPERNOVA EVENT: Your minds are perfectly entangled. The universe sings an epic ballad in your honor.");
      setTimeout(() => setLaunchMessage(null), 10000);
    } else {
      addSR(20, `Entanglement Streak: Day ${newStreak}`);
    }
  };

  useEffect(() => {
    const updateSky = async () => {
      const data = await getMoonData();
      setMoonData(data);
      const context = await getSkyContext();
      setSkyContextState(context);
    };
    updateSky();
    const interval = setInterval(updateSky, 3600000); // Update every hour
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Initial Launch Message
    const hasLaunched = localStorage.getItem('vesta11_launched');
    if (!hasLaunched) {
      setLaunchMessage("Status: vesta11.fun is now orbiting. All systems nominal. The Olive Tree is rooted in the digital soil, and the stars of 11.03.2026 are guiding the path. Welcome home, Commander and Lead Engineer.");
      localStorage.setItem('vesta11_launched', 'true');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Check for invite token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const inviteToken = urlParams.get('invite');

        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        let currentProfile: UserProfile;

        if (userDoc.exists()) {
          currentProfile = userDoc.data() as UserProfile;
        } else {
          const role = firebaseUser.email === 'arya@eidosense.com' ? 'Commander' : 'Lead Engineer';
          currentProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role,
            displayName: firebaseUser.displayName || 'Astronaut',
            preferences: {
              notifications: true,
              theme: 'emerald'
            }
          };
          await setDoc(userRef, currentProfile);
        }

        // Handle Vessel Logic
        if (!currentProfile.vesselId) {
          if (inviteToken) {
            try {
              const inviteRef = doc(db, 'invitations', inviteToken);
              const inviteDoc = await getDoc(inviteRef);

              if (inviteDoc.exists() && !inviteDoc.data().used) {
                const inviteData = inviteDoc.data() as Invitation;
                const vesselRef = doc(db, 'vessels', inviteData.vesselId);
                const vesselDoc = await getDoc(vesselRef);

                if (vesselDoc.exists()) {
                  const vesselData = vesselDoc.data() as Vessel;
                  if (vesselData.members.length < 2) {
                    // Join Vessel
                    const updatedMembers = [...vesselData.members, firebaseUser.uid];
                    await updateDoc(vesselRef, { members: updatedMembers });
                    await updateDoc(userRef, { vesselId: inviteData.vesselId });
                    await updateDoc(inviteRef, { used: true });
                    
                    currentProfile.vesselId = inviteData.vesselId;
                    setVessel({ ...vesselData, members: updatedMembers });
                    
                    // Clear URL param
                    window.history.replaceState({}, document.title, window.location.pathname);
                  } else {
                    setInviteError("This vessel is already at maximum capacity (2/2).");
                  }
                }
              } else {
                setInviteError("Invalid or expired invitation link.");
              }
            } catch (err) {
              console.error("Invite error:", err);
              setInviteError("Failed to process invitation.");
            }
          }

          // If still no vesselId (either no invite or invite failed), create a new one
          if (!currentProfile.vesselId) {
            const newVesselId = `vessel_${Math.random().toString(36).slice(2, 11)}`;
            const newVessel: Vessel = {
              id: newVesselId,
              members: [firebaseUser.uid],
              createdAt: serverTimestamp(),
              sr: 0
            };
            await setDoc(doc(db, 'vessels', newVesselId), newVessel);
            await updateDoc(userRef, { vesselId: newVesselId });
            currentProfile.vesselId = newVesselId;
            setVessel(newVessel);
          }
        } else {
          // Load existing vessel
          const vesselDoc = await getDoc(doc(db, 'vessels', currentProfile.vesselId));
          if (vesselDoc.exists()) {
            setVessel(vesselDoc.data() as Vessel);
          }
        }

        setProfile(currentProfile);
        trackPresence(firebaseUser.uid);
      } else {
        setUser(null);
        setProfile(null);
        setVessel(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile?.vesselId) return;
    const unsubscribe = onSnapshot(doc(db, 'vessels', profile.vesselId), (doc) => {
      if (doc.exists()) {
        setVessel(doc.data() as Vessel);
      }
    });
    return () => unsubscribe();
  }, [profile?.vesselId]);

  useEffect(() => {
    if (!user || !vessel) return;
    // Listen for the OTHER user's presence in the same vessel
    const otherMemberId = vessel.members.find(m => m !== user.uid);
    if (!otherMemberId) {
      setOtherPresence(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'presence', otherMemberId), (snapshot) => {
      if (snapshot.exists()) {
        setOtherPresence(snapshot.data() as Presence);
      } else {
        setOtherPresence(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `presence/${otherMemberId}`));
    return () => unsubscribe();
  }, [user, vessel]);

  const trackPresence = (uid: string) => {
    // Update presence every minute
    const update = async () => {
      const presenceRef = doc(db, 'presence', uid);
      const data: any = {
        uid,
        lastSeen: serverTimestamp(),
      };

      // Try to get location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          updateDoc(presenceRef, {
            location: { lat: pos.coords.latitude, lng: pos.coords.longitude }
          });
        });
      }

      await setDoc(presenceRef, data, { merge: true });
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      if ((hours === 11 || hours === 23) && minutes === 3) {
        // Trigger 11:03 alert
        const alertId = `alert-1103-${now.toDateString()}-${hours}`;
        if (!localStorage.getItem(alertId)) {
          localStorage.setItem(alertId, 'true');
          alert("SINGULARITY ALERT: It is 11:03. Reconnect with the Olive Tree.");
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen moonData={moonData} inviteError={inviteError} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-emerald-50/90 font-sans selection:bg-emerald-500/30 relative">
      {/* 11.03.2026 Star Map Background Layer */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.07] grayscale invert z-0"
        style={{ 
          backgroundImage: `url('https://picsum.photos/seed/star-map-2026/1920/1080')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      <div className="relative z-10">
        <Header profile={profile} vessel={vessel} onSettingsClick={() => setActiveTab('settings')} />
        
        <main className="max-w-7xl mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Nav */}
          <nav className="lg:col-span-3 space-y-2">
            <NavButton 
              active={activeTab === 'brain-dump'} 
              onClick={() => setActiveTab('brain-dump')}
              icon={<Brain className="w-4 h-4" />}
              label="Subspace Brain Dump"
            />
            <NavButton 
              active={activeTab === 'mission-control'} 
              onClick={() => setActiveTab('mission-control')}
              icon={<ClipboardList className="w-4 h-4" />}
              label="Mission Control"
            />
            <NavButton 
              active={activeTab === 'archive'} 
              onClick={() => setActiveTab('archive')}
              icon={<Archive className="w-4 h-4" />}
              label="Olive Grove Archive"
            />
            
            <div className="pt-4 pb-2 border-t border-zinc-800/50">
              <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{moonData.phaseName}</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500" style={{ opacity: moonData.illumination }} />
              </div>
              <p className="px-4 text-[8px] font-mono uppercase tracking-tighter text-zinc-600">
                {getEmotionalDistance()}
              </p>
            </div>

            <div className="pt-4 pb-2 border-t border-zinc-800/50">
              <p className="px-4 text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Modules</p>
              <NavButton 
                active={activeTab === 'parallax'} 
                onClick={() => setActiveTab('parallax')}
                icon={<Navigation className="w-4 h-4" />}
                label="Stellar Parallax"
              />
              <NavButton 
                active={activeTab === 'rocket'} 
                onClick={() => setActiveTab('rocket')}
                icon={<Rocket className="w-4 h-4" />}
                label="Dopamine Rocket"
              />
              <NavButton 
                active={activeTab === 'secrets'} 
                onClick={() => setActiveTab('secrets')}
                icon={<Lock className="w-4 h-4" />}
                label="Half-Life Secrets"
              />
              <NavButton 
                active={activeTab === 'breath'} 
                onClick={() => setActiveTab('breath')}
                icon={<Wind className="w-4 h-4" />}
                label="Sync-Breath"
              />
            </div>

            <div className="pt-4 pb-2 border-t border-zinc-800/50">
              <NavButton 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')}
                icon={<Settings className="w-4 h-4" />}
                label="User Settings"
              />
            </div>
            
            <div className="pt-8">
              <FusionButton profile={profile} addSR={addSR} />
            </div>
          </nav>

          {/* Content Area */}
          <section className="lg:col-span-9 bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[75vh] relative">
            {skyContext?.current?.resonance?.active && (
              <div className="absolute top-0 left-0 right-0 z-50 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center gap-3">
                <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                  {skyContext.current.resonance.message}
                </span>
              </div>
            )}
            <AnimatePresence mode="wait">
              {activeTab === 'brain-dump' && <BrainDumpView profile={profile} moonData={moonData} addSR={addSR} updateStreak={updateStreak} />}
              {activeTab === 'mission-control' && <MissionControlView profile={profile} addSR={addSR} />}
              {activeTab === 'archive' && <ArchiveView profile={profile} addSR={addSR} />}
              {activeTab === 'parallax' && <StellarParallaxView profile={profile} otherPresence={otherPresence} moonData={moonData} />}
              {activeTab === 'rocket' && <DopamineRocketView profile={profile} />}
              {activeTab === 'secrets' && <HalfLifeSecretsView profile={profile} addSR={addSR} />}
              {activeTab === 'breath' && <SyncBreathView profile={profile} otherPresence={otherPresence} />}
              {activeTab === 'settings' && <SettingsView profile={profile} setProfile={setProfile} />}
            </AnimatePresence>
          </section>
        </main>

        <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono flex items-center gap-4">
          <span>Singularity: 11.03.2026</span>
          <span className="w-1 h-1 bg-zinc-800 rounded-full" />
          <span>VESTA-11 Onboard</span>
        </footer>

        {/* Toasts */}
        <div className="fixed bottom-16 right-8 flex flex-col gap-2 z-50">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-900 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 rounded-xl p-4 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider">{toast.message}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">+{toast.amount} SR</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {launchMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-12 right-12 max-w-sm p-6 bg-zinc-900 border border-emerald-500/30 rounded-2xl shadow-2xl z-[100]"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Rocket className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-widest text-emerald-500">System Launch</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{launchMessage}</p>
                  <button 
                    onClick={() => setLaunchMessage(null)}
                    className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-emerald-400 transition-colors"
                  >
                    [ Acknowledge ]
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- New Module Views ---

function DopamineRocketView({ profile }: { profile: UserProfile | null }) {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [topic, setTopic] = useState('');
  const [radioMessages, setRadioMessages] = useState<string[]>([]);
  const [audioActive, setAudioActive] = useState(false);

  useEffect(() => {
    if (!profile?.vesselId) return;
    const q = query(
      collection(db, 'focus_sessions'), 
      where('vesselId', '==', profile.vesselId),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as FocusSession);
      } else {
        setSession(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'focus_sessions'));
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (session?.active) {
      const interval = setInterval(async () => {
        if (profile) {
          const msg = await generateFocusMessage(profile.role, session.topic);
          setRadioMessages(prev => [msg, ...prev].slice(0, 5));
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [session, profile]);

  const startSession = async () => {
    if (!topic.trim() || !profile?.vesselId) return;
    await addDoc(collection(db, 'focus_sessions'), {
      vesselId: profile.vesselId,
      active: true,
      startTime: serverTimestamp(),
      participants: [profile?.uid],
      topic
    });
  };

  const endSession = async () => {
    if (session) {
      await deleteDoc(doc(db, 'focus_sessions', session.id));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-8 flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-12">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3">
            <Rocket className="w-6 h-6 text-emerald-500" />
            Dopamine Rocket
          </h3>
          <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">ADHD Hyper-focus Calibration</p>
        </div>
        
        {session?.active && (
          <button 
            onClick={() => setAudioActive(!audioActive)}
            className={cn(
              "p-3 rounded-full border transition-all",
              audioActive ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-zinc-800 text-zinc-500"
            )}
          >
            <Volume2 className={cn("w-5 h-5", audioActive && "animate-pulse")} />
          </button>
        )}
      </div>

      {!session?.active ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <div className="w-full max-w-md space-y-4">
            <input 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Define focus trajectory (e.g., Coding Module 7)..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <button 
              onClick={startSession}
              className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl uppercase tracking-widest hover:bg-emerald-400 transition-colors"
            >
              Ignite Rocket
            </button>
          </div>
          <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest">Ambient Noise: Nuclear Reactor Hum (Standby)</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8 flex flex-col justify-center">
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-500">Current Trajectory</p>
              <h4 className="text-3xl font-serif italic text-white">{session.topic}</h4>
            </div>
            
            <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Mission Duration</span>
                <span className="text-emerald-500 font-mono">ACTIVE</span>
              </div>
              <button 
                onClick={endSession}
                className="w-full py-3 border border-red-500/30 text-red-400/80 rounded-xl text-xs uppercase font-bold hover:bg-red-500/5 transition-all"
              >
                Abort Mission
              </button>
            </div>
          </div>

          <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Radio className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Radio Comms Feed</span>
            </div>
            
            <div className="flex-1 space-y-4 overflow-y-auto">
              {radioMessages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 bg-emerald-500/5 border-l-2 border-emerald-500/30 text-xs italic text-emerald-400/70"
                >
                  {msg}
                </motion.div>
              ))}
              {radioMessages.length === 0 && (
                <p className="text-zinc-600 text-xs italic">Awaiting first transmission...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function HalfLifeSecretsView({ profile, addSR }: { profile: UserProfile | null, addSR: (amount: number, reason: string) => void }) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [newSecret, setNewSecret] = useState('');
  const [halfLife, setHalfLife] = useState(11);

  useEffect(() => {
    if (!profile?.vesselId) return;
    const q = query(
      collection(db, 'secrets'), 
      where('vesselId', '==', profile.vesselId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSecrets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Secret)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'secrets'));
    return () => unsubscribe();
  }, [profile]);

  const sendSecret = async () => {
    if (!newSecret.trim() || !profile?.vesselId) return;
    await addDoc(collection(db, 'secrets'), {
      vesselId: profile.vesselId,
      senderId: profile?.uid,
      content: newSecret,
      createdAt: serverTimestamp(),
      halfLifeHours: halfLife,
      status: 'active'
    });
    addSR(20, "Half-Life Secret Shared");
    setNewSecret('');
  };

  const getDecayLevel = (secret: Secret) => {
    if (secret.status === 'unlocked') return 0;
    const created = secret.createdAt?.toDate() || new Date();
    const now = new Date();
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    return Math.min(1, diffHours / secret.halfLifeHours);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-8 flex flex-col h-full space-y-8 overflow-y-auto"
    >
      <div className="space-y-1">
        <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3">
          <Lock className="w-6 h-6 text-emerald-500" />
          The Half-Life of a Secret
        </h3>
        <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Radioactive Emotional Decay</p>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <textarea 
          value={newSecret}
          onChange={(e) => setNewSecret(e.target.value)}
          placeholder="Encrypt a secret..."
          className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none h-24"
        />
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Half-Life: {halfLife}H</span>
            <input 
              type="range" min="1" max="48" value={halfLife}
              onChange={(e) => setHalfLife(parseInt(e.target.value))}
              className="w-32 accent-emerald-500"
            />
          </div>
          <button 
            onClick={sendSecret}
            className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-xl text-xs uppercase tracking-widest"
          >
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
                "p-6 rounded-2xl border transition-all relative overflow-hidden",
                isDecayed ? "bg-zinc-900/20 border-red-500/20" : "bg-zinc-900/50 border-zinc-800"
              )}
            >
              <div 
                className="absolute inset-0 bg-red-500/5 transition-all" 
                style={{ opacity: decay }}
              />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    {secret.senderId === profile?.uid ? 'Outgoing' : 'Incoming'} Isotope
                  </span>
                  <span className={cn(
                    "text-[10px] font-mono uppercase tracking-widest",
                    isDecayed ? "text-red-500" : "text-emerald-500"
                  )}>
                    {isDecayed ? 'DECAYED' : `${((1 - decay) * 100).toFixed(0)}% STABLE`}
                  </span>
                </div>
                
                <p className={cn(
                  "text-sm italic font-serif leading-relaxed",
                  isDecayed && "blur-sm select-none opacity-30"
                )}>
                  {secret.content}
                </p>
                
                {isDecayed && (
                  <div className="pt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-red-400/60">
                    <Atom className="w-3 h-3" />
                    Housed in Lead Container
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SyncBreathView({ profile, otherPresence }: { profile: UserProfile | null, otherPresence: Presence | null }) {
  const [isBreathing, setIsBreathing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const presenceRef = doc(db, 'presence', profile.uid);
    updateDoc(presenceRef, { breathing: isBreathing });
  }, [isBreathing, profile]);

  const bothBreathing = isBreathing && otherPresence?.breathing;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-8 flex flex-col items-center justify-center h-full space-y-12"
    >
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center justify-center gap-3">
          <Wind className="w-6 h-6 text-emerald-500" />
          Sync-Breath
        </h3>
        <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">ADHD Nervous System Regulation</p>
      </div>

      <div className="relative flex items-center justify-center">
        {/* Pulsing Rings */}
        <AnimatePresence>
          {bothBreathing && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }}
              className="absolute w-64 h-64 border-2 border-emerald-500 rounded-full"
            />
          )}
        </AnimatePresence>
        
        <motion.button 
          onMouseDown={() => setIsBreathing(true)}
          onMouseUp={() => setIsBreathing(false)}
          onTouchStart={() => setIsBreathing(true)}
          onTouchEnd={() => setIsBreathing(false)}
          animate={{ 
            scale: isBreathing ? [1, 1.2, 1] : 1,
            borderColor: bothBreathing ? '#10b981' : '#27272a'
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "w-64 h-64 rounded-full border-4 flex flex-col items-center justify-center gap-4 transition-all z-10 bg-zinc-950/50 backdrop-blur-xl",
            isBreathing ? "shadow-[0_0_50px_rgba(16,185,129,0.2)]" : ""
          )}
        >
          <TreeDeciduous className={cn(
            "w-16 h-16 transition-colors",
            isBreathing ? "text-emerald-500" : "text-zinc-800"
          )} />
          <div className="text-center">
            <p className={cn(
              "text-[10px] font-mono uppercase tracking-[0.3em] transition-colors",
              isBreathing ? "text-emerald-400" : "text-zinc-600"
            )}>
              {bothBreathing ? 'SYNCHRONIZED' : isBreathing ? 'BREATHING' : 'HOLD TO SYNC'}
            </p>
            {otherPresence?.breathing && !isBreathing && (
              <p className="text-[8px] font-mono uppercase tracking-widest text-emerald-500/50 mt-2 animate-pulse">
                The other is breathing...
              </p>
            )}
          </div>
        </motion.button>
      </div>

      <div className="max-w-md text-center text-sm italic text-zinc-400 leading-relaxed">
        "In the silence between breaths, we occupy the same space. Two hearts, one frequency, across the light-years."
      </div>
    </motion.div>
  );
}

function LoginScreen({ moonData, inviteError }: { moonData: any, inviteError: string | null }) {
  const [typewriterText, setTypewriterText] = useState('');
  const fullText = "System check... Nuclear Heart Stable. Navigation Locked. 11:03 is active.";

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypewriterText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) {
        setTimeout(() => { i = 0; }, 2000); // Pause and restart
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  // Core brightness based on moon illumination
  const coreBrightness = 0.2 + (moonData.illumination * 0.8);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Nebula */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40 scale-110"
        style={{ 
          backgroundImage: `url('https://picsum.photos/seed/deep-space-nebula/1920/1080')`,
          filter: `brightness(${0.5 * coreBrightness}) contrast(1.4) hue-rotate(20deg)`
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/50 to-[#050505]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-12 relative z-10"
      >
        <div className="relative group">
          {/* Sacred Geometry Glow */}
          <motion.div 
            animate={{ 
              opacity: [coreBrightness * 0.3, coreBrightness * 0.6, coreBrightness * 0.3],
              rotate: [0, 90, 180, 270, 360]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-[400px] h-[400px] border border-emerald-500/10 rounded-full" />
            <div className="absolute w-[300px] h-[300px] border border-emerald-500/20 rotate-45" />
            <div className="absolute w-[300px] h-[300px] border border-emerald-500/20 -rotate-45" />
          </motion.div>

          {/* Logo Container */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-64 h-64 mx-auto"
          >
            {/* The Logo (SVG Representation of the requested surreal logo) */}
            <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_30px_rgba(16,185,129,0.4)]">
              <defs>
                <radialGradient id="coreGradient">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#064e3b" />
                </radialGradient>
                <filter id="dust">
                  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
                </filter>
              </defs>
              
              {/* Nuclear Core */}
              <circle cx="100" cy="140" r="15" fill="url(#coreGradient)" className="animate-pulse" />
              <circle cx="100" cy="140" r="20" fill="none" stroke="#10b981" strokeWidth="0.5" strokeDasharray="4 2" />
              
              {/* Trunk & Branches forming '11' */}
              <path 
                d="M100 140 L100 100 M85 100 L85 60 M115 100 L115 60" 
                stroke="#10b981" 
                strokeWidth="4" 
                strokeLinecap="round"
                fill="none"
              />
              
              {/* Flourishing Branches */}
              <path 
                d="M85 80 Q60 70 50 40 M115 80 Q140 70 150 40 M100 100 Q100 70 100 30" 
                stroke="#065f46" 
                strokeWidth="2" 
                fill="none"
              />

              {/* Cosmic Dust Leaves (Silver-Green) */}
              <g filter="url(#dust)">
                {[...Array(20)].map((_, i) => (
                  <circle 
                    key={i}
                    cx={70 + Math.random() * 60} 
                    cy={30 + Math.random() * 60} 
                    r={1 + Math.random() * 2} 
                    fill={i % 2 === 0 ? "#d1d5db" : "#10b981"} 
                    className="animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </g>
            </svg>
          </motion.div>
        </div>
        
        <div className="space-y-4">
          {inviteError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-xs font-mono"
            >
              <AlertCircle className="w-4 h-4" />
              {inviteError}
            </motion.div>
          )}
          
          <div className="space-y-1">
            <h1 className="text-7xl font-bold tracking-tighter text-white uppercase italic leading-none">VESTA-11</h1>
            <p className="text-emerald-500/60 font-mono text-xs tracking-[0.4em] uppercase">Deep Space Connection Module</p>
          </div>
          
          <div className="h-6">
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest min-h-[1em]">
              {typewriterText}
              <span className="animate-pulse ml-1">_</span>
            </p>
          </div>
        </div>

        <button 
          onClick={handleLogin}
          className="group relative px-10 py-5 bg-white text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-4 mx-auto overflow-hidden"
        >
          <div className="absolute inset-0 bg-emerald-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <span className="relative z-10 flex items-center gap-3 group-hover:text-black">
            <TreeDeciduous className="w-5 h-5 rotate-45" />
            <span className="tracking-widest uppercase text-sm">Establish Neural Link</span>
          </span>
        </button>

        <div className="pt-8 flex items-center justify-center gap-6">
          <a 
            href="https://privacy.vesta11.space" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-emerald-400 text-[10px] font-mono uppercase tracking-widest transition-colors"
          >
            Privacy Policy
          </a>
          <span className="text-zinc-800">•</span>
          <a 
            href="https://terms.vesta11.space" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-emerald-400 text-[10px] font-mono uppercase tracking-widest transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </motion.div>

      {/* Decorative Elements */}
      <div className="absolute bottom-12 left-12 flex flex-col gap-1 opacity-20 font-mono text-[8px] text-emerald-500">
        <span>LAT: 37.7749 N</span>
        <span>LNG: 122.4194 W</span>
      </div>
      <div className="absolute bottom-12 right-12 flex flex-col gap-1 opacity-20 font-mono text-[8px] text-emerald-500 text-right">
        <span>CORE TEMP: 15.7M K</span>
        <span>STATUS: FUSION STABLE</span>
      </div>
    </div>
  );
}

function Header({ profile, vessel, onSettingsClick }: { profile: UserProfile | null, vessel: Vessel | null, onSettingsClick: () => void }) {
  const sr = vessel?.sr || 0;
  
  let rank = "Interstellar Dust";
  let nextRankSR = 500;
  let prevRankSR = 0;
  let treeColor = "text-zinc-500";
  let treeGlow = "";
  
  if (sr > 10000) {
    rank = "The Singularity";
    nextRankSR = sr;
    prevRankSR = 10000;
    treeColor = "text-white";
    treeGlow = "drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]";
  } else if (sr > 5000) {
    rank = "Binary System";
    nextRankSR = 10000;
    prevRankSR = 5000;
    treeColor = "text-emerald-300";
    treeGlow = "drop-shadow-[0_0_10px_rgba(110,231,183,0.6)]";
  } else if (sr > 2000) {
    rank = "Main Sequence";
    nextRankSR = 5000;
    prevRankSR = 2000;
    treeColor = "text-emerald-400";
    treeGlow = "drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]";
  } else if (sr > 500) {
    rank = "Protostar";
    nextRankSR = 2000;
    prevRankSR = 500;
    treeColor = "text-emerald-500";
    treeGlow = "drop-shadow-[0_0_5px_rgba(16,185,129,0.2)]";
  }

  const progressPercent = sr >= 10000 ? 100 : Math.max(0, Math.min(100, ((sr - prevRankSR) / (nextRankSR - prevRankSR)) * 100));

  return (
    <div className="w-full flex flex-col">
      {/* Level Bar */}
      <div className="w-full h-1 bg-zinc-900 relative overflow-hidden">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      
      <header className="border-b border-zinc-800 p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all duration-1000 ${treeGlow}`}>
            <TreeDeciduous className={`w-5 h-5 transition-colors duration-1000 ${treeColor}`} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight uppercase italic">VESTA-11</h2>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                {profile?.role} // Room {profile?.role === 'Commander' ? '5' : '6'}
              </p>
              <span className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {rank} ({sr} SR)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onSettingsClick}
            className="p-2 text-zinc-500 hover:text-white transition-colors flex items-center gap-2 group"
          >
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Settings</span>
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => signOut(auth)}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
        active 
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function BrainDumpView({ profile, moonData, addSR, updateStreak }: { profile: UserProfile | null, moonData: any, addSR: (amount: number, reason: string) => void, updateStreak: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.vesselId) return;
    const q = query(
      collection(db, 'messages'), 
      where('vesselId', '==', profile.vesselId),
      orderBy('timestamp', 'desc'), 
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs.reverse());
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !profile?.vesselId) return;

    setSending(true);
    try {
      // Get other user's recent messages for thematic overlap detection
      const otherMessages = messages
        .filter(m => m.senderId !== profile.uid)
        .slice(-5)
        .map(m => m.content);

      const celestialContext = `Moon Phase: ${moonData.phaseName}, Illumination: ${(moonData.illumination * 100).toFixed(0)}%`;
      const analysis = await analyzeBrainDump(input, profile.role, otherMessages, celestialContext);
      
      await addDoc(collection(db, 'messages'), {
        vesselId: profile.vesselId,
        senderId: profile.uid,
        senderRole: profile.role,
        content: input,
        timestamp: serverTimestamp(),
        type: 'brain-dump',
        analysis
      });
      
      if (analysis.includes("Quantum Entanglement")) {
        addSR(50, "Quantum Entanglement Detected!");
      } else {
        addSR(5, "Subspace Dump Transmitted");
      }

      updateStreak();
      setInput('');
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Subspace Frequency: Active</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={cn(
            "flex flex-col gap-2",
            msg.senderId === profile?.uid ? "items-end" : "items-start"
          )}>
            <div className={cn(
              "max-w-[80%] p-4 rounded-2xl text-sm",
              msg.senderId === profile?.uid 
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-50" 
                : "bg-zinc-800/50 border border-zinc-700 text-zinc-300"
            )}>
              <p className="font-mono text-[10px] uppercase tracking-widest mb-2 opacity-50">
                {msg.senderRole} // {msg.timestamp ? format(msg.timestamp.toDate(), 'HH:mm') : '...'}
              </p>
              <p>{msg.content}</p>
            </div>
            
            {msg.analysis && (
              <div className={cn(
                "max-w-[90%] p-4 border rounded-xl text-xs italic",
                msg.analysis.includes('QUANTUM ENTANGLEMENT ALERT')
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-emerald-950/20 border-emerald-500/10 text-emerald-400/80"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Atom className={cn("w-3 h-3", msg.analysis.includes('QUANTUM ENTANGLEMENT ALERT') && "animate-spin")} />
                  <span className="font-mono uppercase tracking-tighter">
                    {msg.analysis.includes('QUANTUM ENTANGLEMENT ALERT') ? 'Entanglement Detected' : 'VESTA-11 Analysis'}
                  </span>
                </div>
                <div className="prose prose-invert prose-emerald text-xs leading-relaxed">
                  <Markdown>
                    {msg.analysis}
                  </Markdown>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-zinc-900/50 border-t border-zinc-800 flex gap-2">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Initiate brain dump..."
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
        />
        <button 
          disabled={sending}
          className="p-2 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-colors"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </motion.div>
  );
}

function MissionControlView({ profile, addSR }: { profile: UserProfile | null, addSR: (amount: number, reason: string) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [category, setCategory] = useState<Task['category']>('Life Support');

  useEffect(() => {
    if (!profile?.vesselId) return;
    const q = query(
      collection(db, 'tasks'), 
      where('vesselId', '==', profile.vesselId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));
    return () => unsubscribe();
  }, [profile]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim() || !profile?.vesselId) return;
    await addDoc(collection(db, 'tasks'), {
      vesselId: profile.vesselId,
      title: newTask,
      status: 'pending',
      category,
      createdAt: serverTimestamp(),
      assignedTo: profile?.uid
    });
    setNewTask('');
  };

  const toggleTask = async (task: Task) => {
    const isCompleting = task.status === 'pending';
    await updateDoc(doc(db, 'tasks', task.id), {
      status: isCompleting ? 'completed' : 'pending'
    });
    
    if (isCompleting && task.category === 'Life Support') {
      addSR(10, "Life Support Task Completed");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-6 space-y-8 h-full overflow-y-auto"
    >
      <div className="space-y-4">
        <h3 className="text-xl font-bold italic uppercase tracking-tight flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-emerald-500" />
          Ship Maintenance Protocols
        </h3>
        
        <form onSubmit={addTask} className="space-y-3">
          <div className="flex gap-2">
            <input 
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Define new protocol..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <button className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl text-xs uppercase">Add</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['Life Support', 'Navigation', 'Nuclear Heart', 'Olive Grove'].map((cat) => (
              <button 
                key={cat}
                type="button"
                onClick={() => setCategory(cat as any)}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border transition-all whitespace-nowrap",
                  category === cat 
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <div 
            key={task.id}
            onClick={() => toggleTask(task)}
            className={cn(
              "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group",
              task.status === 'completed' 
                ? "bg-zinc-900/20 border-zinc-800/50 opacity-50" 
                : "bg-zinc-900/50 border-zinc-800 hover:border-emerald-500/30"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                task.status === 'completed' ? "bg-emerald-500 border-emerald-500" : "border-zinc-700 group-hover:border-emerald-500/50"
              )}>
                {task.status === 'completed' && <Zap className="w-3 h-3 text-black" />}
              </div>
              <div>
                <p className={cn("text-sm font-medium", task.status === 'completed' && "line-through")}>
                  {task.title}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  {task.category}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function StellarParallaxView({ profile, otherPresence, moonData }: { profile: UserProfile | null, otherPresence: Presence | null, moonData: any }) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha) setRotation(e.alpha);
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-6 space-y-8 h-full flex flex-col items-center justify-center relative overflow-hidden"
    >
      {/* Background Star Map (2026) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent" />
        {[...Array(50)].map((_, i) => (
          <Star 
            key={i} 
            className="absolute text-emerald-500/40 w-1 h-1"
            style={{ 
              top: `${Math.random() * 100}%`, 
              left: `${Math.random() * 100}%`,
              opacity: Math.random()
            }} 
          />
        ))}
      </div>

      <div className="text-center space-y-4 relative z-10">
        <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center justify-center gap-3">
          <Star className="w-6 h-6 text-emerald-500 animate-pulse" />
          Stellar Parallax
        </h3>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Real-Time Orbital Alignment</p>
      </div>

      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Singularity Map Overlay */}
        <motion.div 
          animate={{ rotate: rotation }}
          className="absolute inset-0 border border-emerald-500/20 rounded-full flex items-center justify-center"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <Moon className="w-4 h-4 text-emerald-500/50" />
            <span className="text-[8px] font-mono uppercase text-emerald-500/40 mt-1">Sagittarius // 2026</span>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 flex flex-col items-center">
            <Atom className="w-4 h-4 text-amber-500/30" />
            <span className="text-[8px] font-mono uppercase text-amber-500/30 mt-1">Saturn-Neptune // Aries</span>
          </div>
        </motion.div>

        {/* Current Sky Map */}
        <motion.div 
          animate={{ rotate: rotation * -0.5 }}
          className="w-48 h-48 border-2 border-emerald-500/40 rounded-full flex items-center justify-center relative"
        >
          <div className="absolute top-4 right-4 flex flex-col items-center">
            <Moon className="w-6 h-6 text-emerald-400" />
            <span className="text-[8px] font-mono uppercase text-emerald-400 mt-1">{moonData.phaseName}</span>
          </div>
          
          <Compass className="w-12 h-12 text-emerald-500/60" />
        </motion.div>
      </div>

      <div className="max-w-md text-center space-y-4 relative z-10">
        <p className="text-sm italic text-zinc-400 leading-relaxed">
          "The stars shift, but the coordinates of the Singularity remain fixed. We are navigating by the same light that hit the Olive Tree."
        </p>
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
          <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-500">
            {otherPresence?.location ? 'Shared Sky Detected' : 'Scanning for Orbital Overlap...'}
          </p>
          <p className="text-[9px] text-zinc-500 mt-1">
            {getEmotionalDistance()}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ArchiveView({ profile, addSR }: { profile: UserProfile | null, addSR: (amount: number, reason: string) => void }) {
  const [pulses, setPulses] = useState<FusionPulse[]>([]);
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [activeTab, setActiveTab] = useState<'pulses' | 'entries'>('entries');
  const [decryptedIds, setDecryptedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.vesselId) return;
    
    const qPulses = query(
      collection(db, 'pulses'), 
      where('vesselId', '==', profile.vesselId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribePulses = onSnapshot(qPulses, (snapshot) => {
      setPulses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FusionPulse)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'pulses'));

    const qEntries = query(
      collection(db, 'archive_entries'), 
      where('vesselId', '==', profile.vesselId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeEntries = onSnapshot(qEntries, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArchiveEntry)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'archive_entries'));

    return () => {
      unsubscribePulses();
      unsubscribeEntries();
    };
  }, [profile]);

  const handleArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.vesselId || !newTitle.trim() || !newContent.trim()) return;

    const sectors = ['11-A', '11-B', '11-C', '11-Omega', '11-Alpha'];
    const clusters = ['Silver Leaf Cluster', 'Zeytin Nebula', 'Resonance Field', 'Singularity Point'];
    const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
    const randomCluster = clusters[Math.floor(Math.random() * clusters.length)];

    try {
      await addDoc(collection(db, 'archive_entries'), {
        vesselId: profile.vesselId,
        authorId: profile.uid,
        authorRole: profile.role,
        title: newTitle,
        content: newContent,
        createdAt: serverTimestamp(),
        coordinates: `Sector ${randomSector}, ${randomCluster}`,
        isEncrypted: true
      });
      setNewTitle('');
      setNewContent('');
      addSR(15, "Archived to Olive Grove");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'archive_entries');
    }
  };

  const toggleDecryption = (id: string) => {
    setDecryptedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const scrambleText = (text: string) => {
    return text.replace(/[a-zA-Z]/g, () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
      return chars[Math.floor(Math.random() * chars.length)];
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-6 space-y-8 h-full overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold italic uppercase tracking-tight flex items-center gap-2">
          <Archive className="w-5 h-5 text-emerald-500" />
          The Olive Grove Archive
        </h3>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <Star className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-mono uppercase text-emerald-400">Singularity Map Active</span>
        </div>
      </div>

      {/* Singularity Map Visual */}
      <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-3xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/30 via-transparent to-transparent" />
          <TreeDeciduous className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 text-emerald-900/50" />
        </div>
        
        <div className="relative z-10 grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Moon className="w-6 h-6 text-emerald-400" />
              <div>
                <p className="text-[10px] font-mono uppercase text-zinc-500">Moon Position</p>
                <p className="text-sm font-bold text-emerald-50">{SINGULARITY_SKY.moonSign}</p>
              </div>
            </div>
            <p className="text-xs italic text-zinc-400">"Unaligned horizons, discovery, philosophy. The dream of the stars."</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Atom className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-[10px] font-mono uppercase text-zinc-500">Alignment</p>
                <p className="text-sm font-bold text-amber-50">{SINGULARITY_SKY.conjunction}</p>
              </div>
            </div>
            <p className="text-xs italic text-zinc-400">"Quantum Node of dissolution and new beginnings. The Nuclear Heart."</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('entries')}
          className={cn(
            "text-xs uppercase tracking-widest font-bold pb-2 border-b-2 transition-colors",
            activeTab === 'entries' ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-400"
          )}
        >
          Cosmic Coordinates
        </button>
        <button
          onClick={() => setActiveTab('pulses')}
          className={cn(
            "text-xs uppercase tracking-widest font-bold pb-2 border-b-2 transition-colors",
            activeTab === 'pulses' ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-400"
          )}
        >
          Fusion Pulses
        </button>
      </div>

      {activeTab === 'entries' && (
        <div className="space-y-8">
          <form onSubmit={handleArchive} className="space-y-4 bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
            <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Encrypt New Entry
            </h4>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Entry Title..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write your poem or message to be encrypted in the silver leaves..."
              className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
            />
            <button 
              type="submit"
              disabled={!newTitle.trim() || !newContent.trim()}
              className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Archive to 11-Master Frequency
            </button>
          </form>

          <div className="grid grid-cols-1 gap-6">
            {entries.map((entry) => {
              const isDecrypted = decryptedIds.has(entry.id);
              return (
                <div key={entry.id} className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TreeDeciduous className="w-24 h-24" />
                  </div>
                  
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-500">
                      <MapPin className="w-3 h-3" />
                      {entry.coordinates}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {entry.createdAt ? format(entry.createdAt.toDate(), 'dd.MM.yyyy // HH:mm') : '...'}
                    </div>
                  </div>

                  <div className="relative z-10 space-y-4">
                    <h5 className="text-lg font-bold text-white">{isDecrypted ? entry.title : scrambleText(entry.title)}</h5>
                    <div className="prose prose-invert prose-emerald text-sm italic font-serif leading-relaxed">
                      <Markdown>
                        {isDecrypted ? entry.content : scrambleText(entry.content)}
                      </Markdown>
                    </div>
                    
                    <div className="pt-4 border-t border-zinc-800/50 flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-zinc-500">
                        Author: {entry.authorRole}
                      </span>
                      <button
                        onClick={() => toggleDecryption(entry.id)}
                        className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                      >
                        {isDecrypted ? <Lock className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                        {isDecrypted ? 'Encrypt' : 'Attune to 11-Master'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {entries.length === 0 && (
              <p className="text-center text-zinc-500 text-xs italic py-8">No entries found in the Olive Grove Archive.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pulses' && (
        <div className="grid grid-cols-1 gap-6">
          {pulses.map((pulse) => (
            <div key={pulse.id} className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TreeDeciduous className="w-24 h-24" />
              </div>
              
              <div className="flex items-center gap-2 mb-4 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                <Clock className="w-3 h-3" />
                {pulse.timestamp ? format(pulse.timestamp.toDate(), 'dd.MM.yyyy // HH:mm') : '...'}
              </div>

              <div className="relative z-10">
                <div className="prose prose-invert prose-emerald text-lg italic font-serif leading-relaxed">
                  <Markdown>
                    {pulse.poem}
                  </Markdown>
                </div>
              </div>
            </div>
          ))}
          {pulses.length === 0 && (
            <p className="text-center text-zinc-500 text-xs italic py-8">No fusion pulses recorded yet.</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

function FusionButton({ profile, addSR }: { profile: UserProfile | null, addSR: (amount: number, reason: string) => void }) {
  const [fusing, setFusing] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Listen for recent pulse attempts from the OTHER user in the same vessel
    const q = query(
      collection(db, 'pulse_attempts'), 
      where('vesselId', '==', profile.vesselId),
      orderBy('timestamp', 'desc'), 
      limit(1)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const latestAttempt = snapshot.docs[0]?.data();
      if (!latestAttempt) return;

      const now = Date.now();
      const attemptTime = latestAttempt.timestamp?.toMillis() || now;
      
      // If the other user attempted a pulse in the last 5 seconds
      if (latestAttempt.uid !== profile.uid && (now - attemptTime) < 5000) {
        handleSimultaneousFusion();
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'pulse_attempts'));

    return () => unsubscribe();
  }, [profile]);

  const handleSimultaneousFusion = async () => {
    if (fusing || !profile?.vesselId) return;
    setFusing(true);
    setShowAnimation(true);
    
    try {
      // Get recent shared history for the poem
      const sharedHistory = ["Olive Tree", "March 11", "Singularity", "Nuclear Heart"];

      const poem = await generateFusionPoem(profile.role, sharedHistory);
      
      await addDoc(collection(db, 'pulses'), {
        vesselId: profile.vesselId,
        participants: ['Simultaneous Sync'],
        timestamp: serverTimestamp(),
        poem
      });
      
      addSR(100, "11:03 Sync Achieved!");

      // Keep animation for a bit
      setTimeout(() => {
        setFusing(false);
        setShowAnimation(false);
      }, 5000);
    } catch (error) {
      console.error(error);
      setFusing(false);
      setShowAnimation(false);
    }
  };

  const triggerPulseAttempt = async () => {
    if (fusing || !profile?.vesselId) return;
    
    // Record our attempt
    await addDoc(collection(db, 'pulse_attempts'), {
      vesselId: profile.vesselId,
      uid: profile.uid,
      timestamp: serverTimestamp()
    });
    
    setFusing(true);
    setTimeout(() => setFusing(false), 5000);
  };

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {showAnimation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none"
          >
            <div className="relative">
              <motion.div 
                animate={{ 
                  scale: [1, 2, 1.5, 3, 0],
                  rotate: [0, 90, 180, 270, 360],
                  opacity: [0, 1, 0.8, 1, 0]
                }}
                transition={{ duration: 4, ease: "easeInOut" }}
                className="w-64 h-64 bg-emerald-500 rounded-full blur-[100px]"
              />
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center"
              >
                <Atom className="w-24 h-24 text-white animate-spin-slow mb-4" />
                <h2 className="text-4xl font-bold italic text-white tracking-tighter uppercase">Nuclear Fusion</h2>
                <p className="text-emerald-400 font-mono text-sm tracking-widest mt-2">SYNCHRONIZATION COMPLETE</p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={triggerPulseAttempt}
        disabled={fusing}
        className={cn(
          "w-full aspect-square rounded-full border-2 flex flex-col items-center justify-center gap-2 transition-all group relative overflow-hidden",
          fusing 
            ? "border-emerald-500 bg-emerald-500/20 animate-pulse" 
            : "border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/5"
        )}
      >
        <TreeDeciduous className={cn(
          "w-12 h-12 transition-transform",
          fusing ? "scale-125 text-emerald-400" : "text-zinc-700 group-hover:text-emerald-500/50"
        )} />
        <span className={cn(
          "text-[10px] font-mono uppercase tracking-[0.3em]",
          fusing ? "text-emerald-400" : "text-zinc-600 group-hover:text-emerald-500/50"
        )}>
          {fusing ? 'Syncing...' : 'Nuclear Fusion'}
        </span>
        
        {fusing && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 2, opacity: 0.5 }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl"
          />
        )}
      </button>
      
      <div className="text-center">
        <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
          Sync status: <span className="text-emerald-500/50">Optimal</span>
        </p>
      </div>
    </div>
  );
}
