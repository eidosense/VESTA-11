import { useState, useEffect, useRef } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
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
  getDocs,
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
  Heart,
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
  Link,
  Users,
  X,
  BookOpen,
  Save,
  Sparkles,
  Palette,
  Leaf,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, addHours, isAfter } from 'date-fns';
import Markdown from 'react-markdown';
import { analyzeBrainDump, generateFusionPoem, generateFocusMessage, generatePredictiveAnalysis } from './lib/gemini';
import { getMoonData, getEmotionalDistance, SINGULARITY_SKY, getSkyContext } from './services/astronomyService';
import { Moon, Sun, Compass, Star } from 'lucide-react';

import AstronautView from './components/AstronautView';
import TimeWarpView from './components/TimeWarpView';
import SpaceView from './components/SpaceView';
import ArtView from './components/ArtView';
import FusionAnimation from './components/FusionAnimation';
import ThoughtStream from './components/ThoughtStream';

import { audioService } from './services/audioService';
import { generateBackground } from './services/imageService';

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
    theme: 'rose' | 'indigo' | 'fuchsia';
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

interface MissionLogEntry {
  id: string;
  vesselId: string;
  astronautId: string;
  astronautRole: string;
  content: string;
  type: 'activity' | 'observation' | 'thought';
  timestamp: any;
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
  typing?: boolean;
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

function SettingsView({ profile, setProfile, otherPresence }: { 
  profile: UserProfile | null, 
  setProfile: (p: UserProfile) => void,
  otherPresence: Presence | null
}) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [role, setRole] = useState(profile?.role || 'Lead Engineer');
  const [notifications, setNotifications] = useState(profile?.preferences?.notifications ?? true);
  const [theme, setTheme] = useState(profile?.preferences?.theme || 'rose');
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
        theme: theme as 'rose' | 'indigo' | 'fuchsia'
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
      className="p-8 flex flex-col space-y-8"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3 text-rose-50">
            <Settings className="w-6 h-6 text-rose-400" />
            User Settings
          </h3>
          <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">Neural Link Configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Section */}
        <div className="space-y-6 bg-black/40 p-6 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-rose-400" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-rose-50">Profile Identity</h4>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-rose-200/40">Display Name</label>
              <input 
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-colors"
                placeholder="Enter your name..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-rose-200/40">Mission Role</label>
              <select 
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-colors appearance-none"
              >
                <option value="Commander">Commander</option>
                <option value="Lead Engineer">Lead Engineer</option>
              </select>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="space-y-6 bg-black/40 p-6 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-50">Preferences</h4>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-rose-50">Neural Notifications</p>
                <p className="text-[10px] text-rose-200/40">Receive alerts for cosmic resonance</p>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  notifications ? "bg-rose-500" : "bg-white/10"
                )}
              >
                <motion.div 
                  animate={{ x: notifications ? 26 : 2 }}
                  className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-rose-50">Interface Theme</p>
              <div className="flex gap-3">
                {['rose', 'indigo', 'fuchsia'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t as any)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      theme === t ? "border-white scale-110" : "border-transparent opacity-50",
                      t === 'rose' ? "bg-rose-500" : t === 'indigo' ? "bg-indigo-500" : "bg-fuchsia-500"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Crew Sync Section */}
        <div className="md:col-span-2 space-y-6 bg-black/40 p-6 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-50">Crew Synchronization</h4>
            </div>
            {otherPresence && (
              <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Partner Linked</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-rose-200/40">Current Vessel ID</p>
              <p className="text-xs font-mono text-rose-100">{profile?.vesselId}</p>
            </div>

            {!otherPresence && (
              <div className="space-y-4">
                <p className="text-xs text-rose-200/60 leading-relaxed">
                  To synchronize with Hayden, generate an invitation link and share it. Once Hayden joins your vessel, all focus sessions, logs, and presence will be synchronized in real-time.
                </p>
                
                {inviteLink ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input 
                        readOnly
                        value={inviteLink}
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-xs font-mono text-rose-200/60"
                      />
                      <button 
                        onClick={() => copyToClipboard(inviteLink)}
                        className="p-2 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 hover:bg-rose-500/30 transition-all"
                      >
                        {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">Link generated. Send this to Hayden.</p>
                  </div>
                ) : (
                    <button 
                      onClick={generateInvite}
                      disabled={generatingInvite}
                      className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                      {generatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                      Generate Sync Link
                    </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Invite Partner Section */}
        <div className="space-y-6 bg-black/40 p-6 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.3)] backdrop-blur-sm md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <UserPlus className="w-5 h-5 text-fuchsia-400" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-fuchsia-50">Invite Partner</h4>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-rose-200/60 max-w-2xl">
              VESTA-11 is designed for exactly two souls. Generate a one-time invitation link to bring your partner into this shared vessel. Once they join, the link will expire.
            </p>

            {!inviteLink ? (
              <button 
                onClick={generateInvite}
                disabled={generatingInvite}
                className="px-6 py-2 bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-xs font-bold rounded-lg hover:bg-fuchsia-500/20 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(217,70,239,0.1)]"
              >
                {generatingInvite ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
                Generate Invitation Link
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-[10px] font-mono text-rose-200/60 truncate">
                  {inviteLink}
                </div>
                <button 
                  onClick={() => copyToClipboard(inviteLink)}
                  className={cn(
                    "p-2 rounded-lg transition-all flex items-center gap-2",
                    copySuccess ? "bg-gradient-to-r from-rose-500 to-indigo-500 text-white" : "bg-fuchsia-500 text-white hover:bg-fuchsia-400"
                  )}
                  title="Copy Link"
                >
                  {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copySuccess && <span className="text-[10px] font-bold uppercase">Copied</span>}
                </button>
                <button 
                  onClick={() => setInviteLink(null)}
                  className="p-2 bg-white/10 text-rose-200/60 rounded-lg hover:bg-white/20 transition-all"
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
          className="px-8 py-3 bg-gradient-to-r from-rose-500 to-indigo-500 text-white font-bold rounded-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Syncing...' : 'Save Configuration'}
        </button>

        {success && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-rose-400 text-xs font-mono uppercase tracking-widest"
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
  const [showSplash, setShowSplash] = useState(true);
  const [showFusion, setShowFusion] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'brain-dump' | 'astronaut' | 'time-warp' | 'parallax' | 'space' | 'secrets' | 'breath' | 'settings' | 'mission-log' | 'mission-control' | 'art' | 'thought-stream' | 'archive' | 'focus'>('brain-dump');
  const [showMore, setShowMore] = useState(false);
  const [otherPresence, setOtherPresence] = useState<Presence | null>(null);
  const [simulatePartner, setSimulatePartner] = useState(true);
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
    const loadBg = async () => {
      try {
        const img = await generateBackground();
        if (img) setBgImage(img);
      } catch (e) {
        console.error("Failed to generate background", e);
      }
    };
    loadBg();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Trigger fusion animation for Hayden
        if (firebaseUser.email === 'Haydena.forster@gmail.com') {
          const hasSeenFusion = sessionStorage.getItem('fusion_seen');
          if (!hasSeenFusion) {
            setShowFusion(true);
            sessionStorage.setItem('fusion_seen', 'true');
          }
        }

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
              theme: 'rose'
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
      if (simulatePartner) {
        setOtherPresence({
          uid: 'simulated_partner',
          lastSeen: serverTimestamp() as any,
          location: { lat: 40.7128, lng: -74.0060 }, // New York
          breathing: false,
          typing: false
        });
      } else {
        setOtherPresence(null);
      }
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
  }, [user, vessel, simulatePartner]);

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
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (showFusion) {
    return <FusionAnimation onComplete={() => setShowFusion(false)} />;
  }

  if (!user) {
    return <LoginScreen moonData={moonData} inviteError={inviteError} bgImage={bgImage} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-rose-50/90 font-sans selection:bg-rose-500/30 relative overflow-hidden">
      {/* Deep Space Background with Enhanced Radial Gradient */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/50 via-[#020205] to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(120,0,255,0.15),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(255,0,120,0.1),_transparent_50%)]" />
        <div 
          className="absolute inset-0 pointer-events-none opacity-30 animate-slow-pan"
          style={{ 
            backgroundImage: `url('${bgImage || 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2048&auto=format&fit=crop'}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.4) contrast(1.3) saturate(0.8)'
          }}
        />
      </div>
      
      <CosmicDust />

      <div className="relative z-10 h-screen flex flex-col">
        <Header 
          profile={profile} 
          vessel={vessel} 
          otherPresence={otherPresence}
          addSR={addSR}
          onSettingsClick={() => setActiveTab('settings')} 
        />
        
        <main className={cn("flex-1 relative scroll-smooth", (['space', 'brain-dump', 'thought-stream', 'breath', 'focus'].includes(activeTab)) ? "overflow-hidden" : "overflow-y-auto pb-32")}>
          <div className={cn("mx-auto", (['space', 'brain-dump', 'thought-stream', 'breath', 'focus'].includes(activeTab)) ? "w-full max-w-4xl h-full" : "max-w-md px-4 min-h-full")}>
            {skyContext?.current?.resonance?.active && activeTab !== 'space' && (
              <div className="sticky top-0 z-50 bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 flex items-center gap-3 backdrop-blur-md rounded-b-xl mb-4">
                <Zap className="w-3 h-3 text-rose-400 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400">
                  {skyContext.current.resonance.message}
                </span>
              </div>
            )}
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className={cn(['space', 'brain-dump', 'thought-stream', 'breath', 'focus'].includes(activeTab) ? "h-full flex flex-col" : "min-h-full w-full")}
              >
                {activeTab === 'brain-dump' && <BrainDumpView profile={profile} moonData={moonData} addSR={addSR} updateStreak={updateStreak} otherPresence={otherPresence} activeTab={activeTab} />}
                {activeTab === 'thought-stream' && profile && (
                  <ThoughtStream vesselId={profile.vesselId || ''} userId={profile.uid} userRole={profile.role} />
                )}
                {activeTab === 'space' && <SpaceView />}
                {activeTab === 'astronaut' && <AstronautView profile={profile} />}
                {activeTab === 'parallax' && <StellarParallaxView profile={profile} otherPresence={otherPresence} moonData={moonData} />}
                {activeTab === 'art' && <ArtView profile={profile} />}
                {activeTab === 'time-warp' && <TimeWarpView profile={profile} />}
                {activeTab === 'settings' && <SettingsView profile={profile} setProfile={setProfile} otherPresence={otherPresence} />}
                {activeTab === 'mission-log' && <MissionLogView profile={profile} addSR={addSR} />}
                {activeTab === 'mission-control' && <MissionControlView profile={profile} addSR={addSR} />}
                {activeTab === 'secrets' && <HalfLifeSecretsView profile={profile} addSR={addSR} />}
                {activeTab === 'breath' && <SyncBreathView profile={profile} otherPresence={otherPresence} />}
                {activeTab === 'archive' && <ArchiveView profile={profile} addSR={addSR} />}
                {activeTab === 'focus' && <DopamineRocketView profile={profile} otherPresence={otherPresence} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-24 left-4 right-4 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 z-40 grid grid-cols-3 gap-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <button onClick={() => { setActiveTab('parallax'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 text-rose-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Star</span>
              </button>
              <button onClick={() => { setActiveTab('mission-log'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5 text-rose-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Log</span>
              </button>
              <button onClick={() => { setActiveTab('mission-control'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ClipboardList className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Tasks</span>
              </button>
              <button onClick={() => { setActiveTab('secrets'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-fuchsia-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Lock className="w-5 h-5 text-fuchsia-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Secrets</span>
              </button>
              <button onClick={() => { setActiveTab('breath'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Wind className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Breath</span>
              </button>
              <button onClick={() => { setActiveTab('archive'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Archive className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Archive</span>
              </button>
              <button onClick={() => { setActiveTab('focus'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Radio className="w-5 h-5 text-orange-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Focus</span>
              </button>
              <button onClick={() => { setActiveTab('art'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Palette className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Art</span>
              </button>
              <button onClick={() => { setActiveTab('time-warp'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Time Warp</span>
              </button>
              <button onClick={() => { setActiveTab('settings'); setShowMore(false); audioService.playClick(); }} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Settings className="w-5 h-5 text-slate-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Settings</span>
              </button>
              <button 
                onClick={() => { 
                  audioService.playClick(); 
                  signOut(auth); 
                  setShowMore(false); 
                }} 
                className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LogOut className="w-5 h-5 text-rose-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100/60 group-hover:text-rose-100">Logout</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-black/60 backdrop-blur-2xl border-t border-white/5 pb-safe z-50">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between relative">
            {/* Log */}
            <button
              onClick={() => {
                audioService.playClick();
                setActiveTab('brain-dump');
                setShowMore(false);
              }}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300",
                activeTab === 'brain-dump' ? "text-white scale-110" : "text-white/30 hover:text-white/50"
              )}
            >
              <Brain className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-widest">Log</span>
            </button>

            {/* Astronaut */}
            <button
              onClick={() => {
                audioService.playClick();
                setActiveTab('astronaut');
                setShowMore(false);
              }}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300",
                activeTab === 'astronaut' ? "text-white scale-110" : "text-white/30 hover:text-white/50"
              )}
            >
              <User className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-widest">Astronaut</span>
            </button>

            {/* Space (Center) */}
            <div className="relative -top-8">
              <div className="absolute inset-0 bg-rose-500/30 blur-3xl rounded-full animate-pulse" />
              <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse delay-700" />
              <button
                onClick={() => {
                  audioService.playClick();
                  setActiveTab('space');
                  setShowMore(false);
                }}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 relative z-10",
                  "bg-gradient-to-br from-rose-500 via-purple-600 to-indigo-600 shadow-[0_0_40px_rgba(244,63,94,0.5)]",
                  "hover:shadow-[0_0_60px_rgba(244,63,94,0.7)] hover:scale-110 active:scale-95",
                  "border-2",
                  activeTab === 'space' ? "border-white" : "border-white/30"
                )}
              >
                <Rocket className="w-8 h-8 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]" />
              </button>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-mono uppercase tracking-[0.2em] text-rose-400 font-bold whitespace-nowrap drop-shadow-sm">
                Space
              </div>
            </div>

            {/* Stream */}
            <button
              onClick={() => {
                audioService.playClick();
                setActiveTab('thought-stream');
                setShowMore(false);
              }}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300",
                activeTab === 'thought-stream' ? "text-white scale-110" : "text-white/30 hover:text-white/50"
              )}
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-widest">Stream</span>
            </button>

            {/* More */}
            <button
              onClick={() => {
                audioService.playClick();
                setShowMore(!showMore);
              }}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300",
                showMore ? "text-rose-400 scale-110" : "text-white/30 hover:text-white/50"
              )}
            >
              <Atom className="w-5 h-5" />
              <span className="text-[8px] font-mono uppercase tracking-widest">More</span>
            </button>
          </div>
        </nav>

        <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] text-rose-200/40 font-mono flex items-center gap-4">
          <span>Singularity: 11.03.2026</span>
          <span className="w-1 h-1 bg-white/20 rounded-full" />
          <span>VESTA-11 Shared Orbit</span>
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
                className="bg-black/80 backdrop-blur-md border border-rose-500/30 shadow-lg shadow-rose-500/20 rounded-xl p-4 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider">{toast.message}</p>
                  <p className="text-[10px] text-rose-400 font-mono">+{toast.amount} SR</p>
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
              className="fixed bottom-12 right-12 max-w-sm p-6 bg-black/80 backdrop-blur-xl border border-rose-500/30 rounded-2xl shadow-[0_0_40px_rgba(244,114,182,0.2)] z-[100]"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-rose-500/10 rounded-lg">
                  <Rocket className="w-5 h-5 text-rose-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-widest text-rose-400">System Launch</p>
                  <p className="text-sm text-rose-100 leading-relaxed">{launchMessage}</p>
                  <button 
                    onClick={() => setLaunchMessage(null)}
                    className="text-[10px] font-mono uppercase tracking-widest text-rose-200/60 hover:text-rose-300 transition-colors"
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

function DopamineRocketView({ profile, otherPresence }: { profile: UserProfile | null, otherPresence: Presence | null }) {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [topic, setTopic] = useState('');
  const [radioMessages, setRadioMessages] = useState<string[]>([]);
  const [audioActive, setAudioActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.vesselId) return;
    console.log("Subscribing to focus_sessions for vessel:", profile.vesselId);
    const q = query(
      collection(db, 'focus_sessions'), 
      where('vesselId', '==', profile.vesselId),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as FocusSession;
        setSession({ id: snapshot.docs[0].id, ...data });
      } else {
        setSession(null);
        setRadioMessages([]); 
      }
    }, (error) => {
      console.error("Focus session snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, 'focus_sessions');
    });
    return () => {
      unsubscribe();
      audioService.stopAmbient();
    };
  }, [profile?.vesselId]);

  useEffect(() => {
    if (session?.active) {
      const triggerFirstMessage = async () => {
        if (profile) {
          try {
            const msg = await generateFocusMessage(profile.role, session.topic);
            setRadioMessages(prev => [msg, ...prev].slice(0, 10));
          } catch (err) {
            console.error("Failed to generate initial focus message:", err);
          }
        }
      };
      triggerFirstMessage();

      const interval = setInterval(async () => {
        if (profile) {
          try {
            const msg = await generateFocusMessage(profile.role, session.topic);
            setRadioMessages(prev => [msg, ...prev].slice(0, 10));
          } catch (err) {
            console.error("Failed to generate focus message:", err);
          }
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [session?.id, session?.active, session?.topic, profile?.role]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [radioMessages]);

  const toggleAudio = () => {
    const newState = !audioActive;
    setAudioActive(newState);
    if (newState) {
      audioService.startAmbient();
    } else {
      audioService.stopAmbient();
    }
  };

  const startSession = async () => {
    if (!topic.trim() || !profile?.vesselId) return;
    setLoading(true);
    try {
      console.log("Starting focus session for topic:", topic);
      await addDoc(collection(db, 'focus_sessions'), {
        vesselId: profile.vesselId,
        active: true,
        startTime: serverTimestamp(),
        participants: [profile?.uid],
        topic: topic.trim()
      });
      setTopic('');
    } catch (error) {
      console.error("Error starting focus session:", error);
      handleFirestoreError(error, OperationType.CREATE, 'focus_sessions');
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (session) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'focus_sessions', session.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `focus_sessions/${session.id}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const joinSession = async () => {
    if (session && profile && !session.participants.includes(profile.uid)) {
      setLoading(true);
      try {
        await updateDoc(doc(db, 'focus_sessions', session.id), {
          participants: [...session.participants, profile.uid]
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `focus_sessions/${session.id}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-8 flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-12">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3 text-rose-50">
            <Rocket className="w-6 h-6 text-rose-400" />
            Dopamine Rocket
          </h3>
          <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">ADHD Hyper-focus Calibration</p>
        </div>
        
        {session?.active && (
          <button 
            onClick={toggleAudio}
            className={cn(
              "p-3 rounded-full border transition-all shadow-[0_0_15px_rgba(0,0,0,0.2)]",
              audioActive ? "bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]" : "border-white/10 text-rose-200/40 hover:text-rose-200"
            )}
          >
            <Volume2 className={cn("w-5 h-5", audioActive && "animate-pulse")} />
          </button>
        )}
      </div>

      {!session?.active ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 min-h-0">
          <div className="w-full max-w-md space-y-4">
            <input 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Define focus trajectory (e.g., Coding Module 7)..."
              className="w-full bg-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-rose-500/50 text-rose-50"
            />
            <button 
              onClick={startSession}
              disabled={loading || !topic.trim()}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-indigo-500 text-white font-bold rounded-2xl uppercase tracking-widest hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(244,63,94,0.3)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Ignite Rocket'}
            </button>
          </div>
          <p className="text-rose-200/40 font-mono text-[10px] uppercase tracking-widest">Ambient Noise: Nuclear Reactor Hum (Standby)</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
          <div className="space-y-8 flex flex-col justify-center">
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-rose-400">Current Trajectory</p>
              <h4 className="text-3xl font-serif italic text-white">{session.topic}</h4>
            </div>
            
            <div className="p-6 bg-black/50 border border-white/10 rounded-2xl space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-200/40">Mission Duration</span>
                <span className="text-rose-400 font-mono">ACTIVE</span>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                    <User className="w-3 h-3 text-rose-400" />
                  </div>
                  <span className="text-[10px] font-mono text-rose-100 uppercase tracking-widest">
                    {session.participants.length} Crew Member(s) Onboard
                  </span>
                </div>

                {session.participants.includes(profile?.uid || '') ? (
                  <button 
                    onClick={endSession}
                    disabled={loading}
                    className="w-full py-3 border border-red-500/30 text-red-400/80 rounded-xl text-xs uppercase font-bold hover:bg-red-500/5 transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Abort Mission'}
                  </button>
                ) : (
                  <button 
                    onClick={joinSession}
                    disabled={loading}
                    className="w-full py-3 bg-rose-500 text-white rounded-xl text-xs uppercase font-bold hover:bg-rose-600 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Join Mission'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.3)] min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-400" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-200/40">Radio Comms Feed</span>
              </div>
              {audioActive && (
                <div className="flex gap-0.5 items-end h-3">
                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [4, 12, 4] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      className="w-0.5 bg-rose-400/60"
                    />
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar min-h-0" ref={scrollRef}>
              {radioMessages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 bg-rose-500/5 border-l-2 border-rose-500/30 text-xs italic text-rose-400/70"
                >
                  {msg}
                </motion.div>
              ))}
              {radioMessages.length === 0 && (
                <p className="text-rose-200/40 text-xs italic">Awaiting first transmission...</p>
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
      className="p-8 flex flex-col space-y-8"
    >
      <div className="space-y-1">
        <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-3 text-rose-50">
          <Lock className="w-6 h-6 text-rose-400" />
          The Half-Life of a Secret
        </h3>
        <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">Radioactive Emotional Decay</p>
      </div>

      <div className="bg-black/50 border border-white/10 rounded-2xl p-6 space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
        <textarea 
          value={newSecret}
          onChange={(e) => setNewSecret(e.target.value)}
          placeholder="Encrypt a secret..."
          className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none h-24 text-rose-50"
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
            className="px-6 py-2 bg-gradient-to-r from-rose-500 to-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(244,63,94,0.3)]"
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
  const [simulatedBreathing, setSimulatedBreathing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const presenceRef = doc(db, 'presence', profile.uid);
    updateDoc(presenceRef, { breathing: isBreathing });
    
    if (otherPresence?.uid === 'simulated_partner' && isBreathing) {
      const timer = setTimeout(() => setSimulatedBreathing(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setSimulatedBreathing(false);
    }
  }, [isBreathing, profile, otherPresence?.uid]);

  const bothBreathing = isBreathing && (otherPresence?.breathing || simulatedBreathing);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-8 flex flex-col items-center justify-center h-full space-y-12"
    >
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center justify-center gap-3 text-rose-50">
          <Wind className="w-6 h-6 text-rose-400" />
          Sync-Breath
        </h3>
        <p className="text-rose-200/40 font-mono text-xs uppercase tracking-widest">ADHD Nervous System Regulation</p>
      </div>

      <div className="relative flex items-center justify-center">
        {/* Pulsing Rings */}
        <AnimatePresence>
          {bothBreathing && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }}
              className="absolute w-64 h-64 border-2 border-rose-500 rounded-full shadow-[0_0_20px_rgba(244,63,94,0.3)]"
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
            borderColor: bothBreathing ? '#f43f5e' : 'rgba(255,255,255,0.1)'
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "w-64 h-64 rounded-full border-4 flex flex-col items-center justify-center gap-4 transition-all z-10 bg-black/40 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.5)]",
            isBreathing ? "shadow-[0_0_50px_rgba(244,63,94,0.2)]" : ""
          )}
        >
          <TreeDeciduous className={cn(
            "w-16 h-16 transition-colors",
            isBreathing ? "text-rose-500" : "text-rose-900/50"
          )} />
          <div className="text-center">
            <p className={cn(
              "text-[10px] font-mono uppercase tracking-[0.3em] transition-colors",
              isBreathing ? "text-rose-400" : "text-rose-200/40"
            )}>
              {bothBreathing ? 'SYNCHRONIZED' : isBreathing ? 'BREATHING' : 'HOLD TO SYNC'}
            </p>
            {otherPresence?.breathing && !isBreathing && (
              <p className="text-[8px] font-mono uppercase tracking-widest text-rose-500/50 mt-2 animate-pulse">
                The other is breathing...
              </p>
            )}
          </div>
        </motion.button>
      </div>

      <div className="max-w-md text-center text-sm italic text-rose-200/40 leading-relaxed">
        "In the silence between breaths, we occupy the same space. Two hearts, one frequency, across the light-years."
      </div>
    </motion.div>
  );
}

function OnboardingAnimation() {
  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center overflow-visible">
      {/* Olive Tree Background */}
      <motion.div
        className="absolute opacity-10"
        animate={{
          scale: [0.8, 1, 0.8],
          opacity: [0.05, 0.15, 0.05]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <TreeDeciduous className="w-48 h-48 text-emerald-500" />
      </motion.div>

      {/* Number 5 */}
      <motion.div
        className="absolute flex items-center justify-center"
        animate={{
          x: [-100, -15, 0, 0, 0, 0],
          y: [50, 0, 0, 0, 0, 0],
          rotate: [-45, 0, 0, 0, 0, 0],
          opacity: [0, 1, 0, 0, 0, 0],
          scale: [0.5, 1, 1, 1, 1, 1]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          times: [0, 0.25, 0.35, 0.5, 0.75, 1],
          ease: "easeInOut"
        }}
      >
        <div className="text-6xl font-bold italic text-rose-400">5</div>
      </motion.div>

      {/* Number 6 */}
      <motion.div
        className="absolute flex items-center justify-center"
        animate={{
          x: [100, 15, 0, 0, 0, 0],
          y: [-50, 0, 0, 0, 0, 0],
          rotate: [45, 0, 0, 0, 0, 0],
          opacity: [0, 1, 0, 0, 0, 0],
          scale: [0.5, 1, 1, 1, 1, 1]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          times: [0, 0.25, 0.35, 0.5, 0.75, 1],
          ease: "easeInOut"
        }}
      >
        <div className="text-6xl font-bold italic text-indigo-400">6</div>
      </motion.div>

      {/* Number 11 (Merged) */}
      <motion.div
        className="absolute flex items-center justify-center"
        animate={{
          opacity: [0, 0, 1, 0, 0, 0],
          scale: [0.5, 0.5, 1.2, 1, 1, 1]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          times: [0, 0.3, 0.35, 0.5, 0.75, 1],
          ease: "easeInOut"
        }}
      >
        <div className="flex -space-x-4">
          <div className="text-8xl font-bold italic text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">1</div>
          <div className="text-8xl font-bold italic text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">1</div>
        </div>
      </motion.div>

      {/* Heart Pulse when they merge */}
      <motion.div
        className="absolute flex items-center justify-center"
        animate={{
          scale: [0, 0, 1.5, 1, 0, 0],
          opacity: [0, 0, 0.8, 0.4, 0, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          times: [0, 0.32, 0.38, 0.5, 0.6, 1],
          ease: "easeOut"
        }}
      >
        <Heart className="w-24 h-24 text-rose-500 fill-rose-500 blur-[2px]" />
      </motion.div>

      {/* Left 1 -> Astronaut */}
      <motion.div
        className="absolute flex items-center justify-center"
        animate={{
          x: [0, 0, 0, -20, -20, -20],
          y: [0, 0, 0, 0, -100, -150],
          opacity: [0, 0, 0, 1, 1, 0],
          scale: [1, 1, 1, 1, 1, 0.8]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          times: [0, 0.35, 0.45, 0.55, 0.8, 1],
          ease: "easeInOut"
        }}
      >
        <motion.div
          animate={{ opacity: [1, 1, 1, 1, 0, 0], scale: [1, 1, 1, 1, 0.5, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.35, 0.45, 0.55, 0.65, 1] }}
          className="text-8xl font-bold italic text-white drop-shadow-[0_0_20px_rgba(251,113,133,0.8)] absolute"
        >
          1
        </motion.div>
        <motion.div
          animate={{ opacity: [0, 0, 0, 0, 1, 1], scale: [0.5, 0.5, 0.5, 0.5, 1, 1] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.35, 0.45, 0.55, 0.65, 1] }}
          className="absolute"
        >
          <User className="w-12 h-12 text-rose-300 drop-shadow-[0_0_15px_rgba(251,113,133,0.8)]" />
        </motion.div>
      </motion.div>

      {/* Right 1 -> Astronaut */}
      <motion.div
        className="absolute flex items-center justify-center"
        animate={{
          x: [0, 0, 0, 20, 20, 20],
          y: [0, 0, 0, 0, -100, -150],
          opacity: [0, 0, 0, 1, 1, 0],
          scale: [1, 1, 1, 1, 1, 0.8]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          times: [0, 0.35, 0.45, 0.55, 0.8, 1],
          ease: "easeInOut"
        }}
      >
        <motion.div
          animate={{ opacity: [1, 1, 1, 1, 0, 0], scale: [1, 1, 1, 1, 0.5, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.35, 0.45, 0.55, 0.65, 1] }}
          className="text-8xl font-bold italic text-white drop-shadow-[0_0_20px_rgba(129,140,248,0.8)] absolute"
        >
          1
        </motion.div>
        <motion.div
          animate={{ opacity: [0, 0, 0, 0, 1, 1], scale: [0.5, 0.5, 0.5, 0.5, 1, 1] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.35, 0.45, 0.55, 0.65, 1] }}
          className="absolute"
        >
          <User className="w-12 h-12 text-indigo-300 drop-shadow-[0_0_15px_rgba(129,140,248,0.8)]" />
        </motion.div>
      </motion.div>
      
      {/* Nuclear Core pulse when they merge */}
      <motion.div
        className="absolute w-48 h-48 bg-fuchsia-500/20 rounded-full blur-2xl"
        animate={{
          scale: [0, 0, 1.2, 0, 0],
          opacity: [0, 0, 1, 0, 0]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          times: [0, 0.25, 0.35, 0.5, 1],
          ease: "easeInOut"
        }}
      />
    </div>
  );
}

function LoginScreen({ moonData, inviteError, bgImage }: { moonData: any, inviteError: string | null, bgImage: string | null }) {
  const [typewriterText, setTypewriterText] = useState('');
  const fullText = "System check... Heartbeat synchronized. Navigation Locked. 11:03 is active.";

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
  const coreBrightness = 0.4 + (moonData.illumination * 0.6);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Deep Space Romantic Nebula Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-60 scale-110 animate-slow-pan"
        style={{ 
          backgroundImage: `url('${bgImage || 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2048&auto=format&fit=crop'}')`,
          filter: `brightness(${0.6 * coreBrightness}) contrast(1.1) saturate(1.2)`
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-purple-900/40 to-black/90" />

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
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-[400px] h-[400px] border border-rose-400/20 rounded-full" />
            <div className="absolute w-[300px] h-[300px] border border-indigo-400/20 rotate-45" />
            <div className="absolute w-[300px] h-[300px] border border-fuchsia-400/20 -rotate-45" />
          </motion.div>

          {/* Logo Container */}
          <OnboardingAnimation />
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
            <h1 className="text-7xl font-bold tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">VESTA-11</h1>
            <p className="text-rose-300/80 font-mono text-xs tracking-[0.4em] uppercase">Deep Space Connection Module</p>
          </div>
          
          <div className="h-6">
            <p className="text-rose-200/60 font-mono text-[10px] uppercase tracking-widest min-h-[1em]">
              {typewriterText}
              <span className="animate-pulse ml-1">_</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
          <button 
            onClick={handleLogin}
            className="group relative w-full px-10 py-5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-4 overflow-hidden shadow-[0_0_30px_rgba(251,113,133,0.15)] hover:shadow-[0_0_50px_rgba(251,113,133,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-indigo-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
            <span className="relative z-10 flex items-center gap-3">
              <TreeDeciduous className="w-5 h-5 rotate-45 text-rose-300 group-hover:text-white transition-colors" />
              <span className="tracking-widest uppercase text-sm flex flex-col items-start">
                <span>Initiate Shared Orbit</span>
                <span className="text-[10px] text-rose-200/70 group-hover:text-white/80">Login with Google</span>
              </span>
            </span>
          </button>
          
          <p className="text-[10px] font-mono text-rose-200/40 uppercase tracking-widest mt-4">
            By signing in, you agree to our{" "}
            <a href="https://terms.vesta11.space" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 underline underline-offset-4 transition-colors">Terms</a>
            {" "}and{" "}
            <a href="https://privacy.vesta11.space" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 underline underline-offset-4 transition-colors">Privacy Policy</a>
          </p>
        </div>

        <div className="pt-8 flex items-center justify-center gap-6">
          <a 
            href="https://privacy.vesta11.space" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-rose-200/40 hover:text-rose-300 text-[10px] font-mono uppercase tracking-widest transition-colors"
          >
            Privacy Policy
          </a>
          <span className="text-white/10">•</span>
          <a 
            href="https://terms.vesta11.space" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-rose-200/40 hover:text-rose-300 text-[10px] font-mono uppercase tracking-widest transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </motion.div>

      {/* Decorative Elements */}
      <div className="absolute bottom-12 left-12 flex flex-col gap-1 opacity-40 font-mono text-[8px] text-rose-300">
        <span>LAT: 37.7749 N</span>
        <span>LNG: 122.4194 W</span>
      </div>
      <div className="absolute bottom-12 right-12 flex flex-col gap-1 opacity-40 font-mono text-[8px] text-rose-300 text-right">
        <span>CORE TEMP: 15.7M K</span>
        <span>STATUS: HEARTS SYNCED</span>
      </div>
    </div>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 7000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      <div className="relative flex items-center justify-center w-full h-full">
        {/* 5 Energy */}
        <motion.div
          initial={{ x: -150, opacity: 0, scale: 0.5 }}
          animate={{ 
            x: [-150, -20, 0], 
            opacity: [0, 1, 0],
            scale: [0.5, 1, 1.2]
          }}
          transition={{ 
            duration: 2.5, 
            times: [0, 0.6, 1],
            ease: "easeOut" 
          }}
          className="absolute text-8xl font-bold italic text-indigo-500 drop-shadow-[0_0_20px_rgba(99,102,241,0.5)]"
        >
          5
        </motion.div>
        
        {/* 6 Energy */}
        <motion.div
          initial={{ x: 150, opacity: 0, scale: 0.5 }}
          animate={{ 
            x: [150, 20, 0], 
            opacity: [0, 1, 0],
            scale: [0.5, 1, 1.2]
          }}
          transition={{ 
            duration: 2.5, 
            times: [0, 0.6, 1],
            ease: "easeOut" 
          }}
          className="absolute text-8xl font-bold italic text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]"
        >
          6
        </motion.div>

        {/* Fusion Effect */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 2.5, 0], 
            opacity: [0, 1, 0] 
          }}
          transition={{ delay: 1.8, duration: 1.2 }}
          className="absolute bg-white rounded-full blur-3xl w-64 h-64"
        />

        {/* Resulting 11 and Transformation */}
        <motion.div 
          initial={{ y: 0, opacity: 0 }}
          animate={{ 
            y: [0, 0, -1000],
            opacity: [0, 1, 1, 0],
            scale: [0.8, 1, 1, 0.5]
          }}
          transition={{ 
            delay: 2.5, 
            duration: 5, 
            times: [0, 0.1, 0.8, 1], 
            ease: "easeInOut" 
          }}
          className="relative flex gap-16"
        >
          {/* First Astronaut (from first '1') */}
          <motion.div
            className="flex flex-col items-center relative"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.2] }}
              transition={{ delay: 2.5, duration: 1.5 }}
              className="text-9xl font-bold italic text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.8)]"
            >
              1
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 3.2, duration: 0.8 }}
              className="absolute top-1/2 -translate-y-1/2"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/50 blur-2xl rounded-full animate-pulse" />
                <User className="w-20 h-20 text-white relative z-10 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
              </div>
            </motion.div>
          </motion.div>

          {/* Second Astronaut (from second '1') */}
          <motion.div
            className="flex flex-col items-center relative"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.2] }}
              transition={{ delay: 2.5, duration: 1.5 }}
              className="text-9xl font-bold italic text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.8)]"
            >
              1
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 3.2, duration: 0.8 }}
              className="absolute top-1/2 -translate-y-1/2"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500/50 blur-2xl rounded-full animate-pulse" />
                <User className="w-20 h-20 text-white relative z-10 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ delay: 2.5, duration: 4, times: [0, 0.2, 0.9] }}
        className="absolute bottom-20 text-white/40 font-mono text-xs uppercase tracking-[0.3em] text-center"
      >
        The Singularity Alignment<br/>
        <span className="text-[10px] opacity-60">Arya & Hayden</span>
      </motion.div>
    </div>
  );
}

function CosmicDust() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: Math.random() * window.innerWidth, 
            y: Math.random() * window.innerHeight,
            opacity: Math.random() * 0.5,
            scale: Math.random() * 0.5 + 0.5
          }}
          animate={{ 
            y: [null, Math.random() * window.innerHeight],
            x: [null, Math.random() * window.innerWidth],
            opacity: [0.1, 0.5, 0.1]
          }}
          transition={{ 
            duration: Math.random() * 20 + 10, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute w-1 h-1 bg-white rounded-full blur-[1px]"
        />
      ))}
    </div>
  );
}

function NuclearOliveTree() {
  const singularityDate = new Date('2026-03-11');
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - singularityDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Growth logic: one leaf per day since singularity
  const leafCount = Math.max(1, Math.min(diffDays, 150)); 

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
          <radialGradient id="nuclearGradient">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="40%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#4f46e5" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Roots - anchoring into crescent earth */}
        <path d="M50 75 Q40 85 30 90 M50 75 Q50 88 50 95 M50 75 Q60 85 70 90" stroke="white" strokeWidth="0.5" fill="none" opacity="0.2" />
        <path d="M35 92 Q50 85 65 92" stroke="white" strokeWidth="1" fill="none" opacity="0.4" />

        {/* Trunk - Parallel lines forming 11 */}
        <motion.line x1="48" y1="75" x2="48" y2="45" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <motion.line x1="52" y1="75" x2="52" y2="45" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />

        {/* Nuclear Core - Pulsating Sun */}
        <motion.circle 
          cx="50" cy="60" r="5" 
          fill="url(#nuclearGradient)"
          filter="url(#glow)"
          animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Leaves - Silver-green cosmic dust */}
        {[...Array(leafCount)].map((_, i) => {
          const angle = (i * 137.5) % 360; 
          const radius = 8 + Math.sqrt(i) * 3.5;
          const x = 50 + radius * Math.cos(angle * Math.PI / 180);
          const y = 45 - radius * Math.sin(angle * Math.PI / 180);
          
          return (
            <motion.circle
              key={i}
              cx={x} cy={y} r="1.2"
              fill={i % 2 === 0 ? "#d1d5db" : "#a7f3d0"}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.2, 1] }}
              transition={{ 
                delay: i * 0.02, 
                duration: 2 + Math.random() * 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]"
            />
          );
        })}
      </svg>
    </div>
  );
}

function Header({ profile, vessel, otherPresence, addSR, onSettingsClick }: { 
  profile: UserProfile | null, 
  vessel: Vessel | null, 
  otherPresence: Presence | null,
  addSR: (amount: number, reason: string) => void,
  onSettingsClick: () => void 
}) {
  const sr = vessel?.sr || 0;
  
  let rank = "Interstellar Dust";
  let nextRankSR = 500;
  let prevRankSR = 0;
  let treeColor = "text-rose-200/40";
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
    treeColor = "text-rose-300";
    treeGlow = "drop-shadow-[0_0_10px_rgba(253,164,175,0.6)]";
  } else if (sr > 2000) {
    rank = "Main Sequence";
    nextRankSR = 5000;
    prevRankSR = 2000;
    treeColor = "text-rose-400";
    treeGlow = "drop-shadow-[0_0_8px_rgba(251,113,133,0.4)]";
  } else if (sr > 500) {
    rank = "Protostar";
    nextRankSR = 2000;
    prevRankSR = 500;
    treeColor = "text-rose-500";
    treeGlow = "drop-shadow-[0_0_5px_rgba(244,63,94,0.2)]";
  }

  const progressPercent = sr >= 10000 ? 100 : Math.max(0, Math.min(100, ((sr - prevRankSR) / (nextRankSR - prevRankSR)) * 100));

  return (
    <div className="w-full flex flex-col">
      {/* Level Bar */}
      <div className="w-full h-1 bg-black/50 relative overflow-hidden">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-rose-500 to-indigo-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
           <header className="border-b border-white/10 py-2 px-6 flex items-center justify-between max-w-7xl mx-auto w-full bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className={`transition-all duration-1000 ${treeGlow} scale-75 origin-left`}>
            <NuclearOliveTree />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-tight uppercase italic">VESTA-11</h2>
            <div className="flex items-center gap-2">
              <p className="text-[9px] text-rose-200/60 font-mono uppercase tracking-widest">
                {profile?.email === 'arya@eidosense.com' ? 'Commander Arya' : 'Commander Hayden'} // {profile?.role === 'Commander' ? '5' : '6'}
              </p>
              {otherPresence && (
                <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-white/10">
                  <div className={cn(
                    "w-1 h-1 rounded-full",
                    (otherPresence.lastSeen?.toDate?.() || new Date()) > new Date(Date.now() - 300000) 
                      ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" 
                      : "bg-rose-500/50"
                  )} />
                  <span className="text-[8px] font-mono uppercase tracking-widest text-rose-200/60">
                    Partner { (otherPresence.lastSeen?.toDate?.() || new Date()) > new Date(Date.now() - 300000) ? "Online" : "Offline" }
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {vessel?.members.length === 2 && (
            <FusionButton profile={profile} addSR={addSR} />
          )}
          
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-mono text-rose-200/40 uppercase tracking-tighter">{sr} SR</span>
            <div className="w-16 h-0.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
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
          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]" 
          : "text-rose-200/40 hover:text-rose-200 hover:bg-white/5"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function BrainDumpView({ profile, moonData, addSR, updateStreak, otherPresence, activeTab }: { profile: UserProfile | null, moonData: any, addSR: (amount: number, reason: string) => void, updateStreak: () => void, otherPresence: Presence | null, activeTab: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'entangled' | 'vesta'>('all');
  const [prediction, setPrediction] = useState<string | null>(null);
  const [generatingPrediction, setGeneratingPrediction] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setPrediction(null);
  }, [activeTab]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, prediction, otherPresence?.typing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!profile) return;

    // Update typing status
    const presenceRef = doc(db, 'presence', profile.uid);
    updateDoc(presenceRef, { typing: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(presenceRef, { typing: false });
    }, 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    if (!profile?.vesselId) {
      console.error("No vessel ID found for profile");
      // You might want to show a toast here if you have a toast system
      return;
    }

    setSending(true);
    try {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      await updateDoc(doc(db, 'presence', profile.uid), { typing: false });

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

  const handleClearLog = async () => {
    if (!profile?.vesselId || !window.confirm("Are you sure you want to clear the communication log? This will delete all messages for both commanders.")) return;
    
    try {
      const q = query(collection(db, 'messages'), where('vesselId', '==', profile.vesselId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      addSR(10, "Neural Log Purged");
    } catch (error) {
      console.error("Failed to clear log:", error);
    }
  };

  const handlePredictiveAnalysis = async () => {
    if (!profile) return;
    setGeneratingPrediction(true);
    try {
      const myRecent = messages.filter(m => m.senderId === profile.uid).slice(-5).map(m => m.content);
      const otherRecent = messages.filter(m => m.senderId !== profile.uid).slice(-5).map(m => m.content);
      
      const result = await generatePredictiveAnalysis(profile.role, myRecent, otherRecent);
      setPrediction(result);
    } catch (error) {
      console.error(error);
    } finally {
      setGeneratingPrediction(false);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'all') return true;
    if (filter === 'entangled') return msg.analysis?.includes('QUANTUM ENTANGLEMENT ALERT');
    if (filter === 'vesta') return !!msg.analysis;
    return true;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col h-full max-w-4xl mx-auto w-full pb-24"
    >
      <div className="p-4 border-b border-white/10 flex flex-col gap-2 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-white tracking-tighter uppercase italic">Subspace Communication Log</h3>
            <p className="text-[9px] text-rose-200/40 font-mono uppercase tracking-widest">Neural Link Active // Direct thought transmission & VESTA-11 analysis</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[8px] font-mono uppercase tracking-widest text-emerald-400">Neural Sync Active</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2">
            <button 
              onClick={() => setFilter('all')}
              className={cn("text-[10px] uppercase font-mono px-2 py-1 rounded", filter === 'all' ? "bg-white/20 text-white" : "text-white/50 hover:bg-white/10")}
            >
              All
            </button>
            <button 
              onClick={() => setFilter('entangled')}
              className={cn("text-[10px] uppercase font-mono px-2 py-1 rounded", filter === 'entangled' ? "bg-indigo-500/40 text-indigo-200" : "text-white/50 hover:bg-white/10")}
            >
              Entangled
            </button>
            <button 
              onClick={() => setFilter('vesta')}
              className={cn("text-[10px] uppercase font-mono px-2 py-1 rounded", filter === 'vesta' ? "bg-rose-500/40 text-rose-200" : "text-white/50 hover:bg-white/10")}
            >
              VESTA-11
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearLog}
              className="p-2 text-rose-200/40 hover:text-rose-400 transition-colors"
              title="Clear Communication Log"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handlePredictiveAnalysis}
              disabled={generatingPrediction || messages.length < 2}
              className="flex items-center gap-2 px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 rounded-lg text-indigo-200 text-[10px] font-mono uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              {generatingPrediction ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              Predictive Analysis
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
        {prediction && (
          <div className="max-w-[90%] mx-auto p-6 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-xs uppercase tracking-widest text-indigo-300">Mission Parameter Prediction</span>
              </div>
              <button onClick={() => setPrediction(null)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="prose prose-invert prose-indigo text-sm leading-relaxed">
              <Markdown>{prediction}</Markdown>
            </div>
          </div>
        )}

        {filteredMessages.map((msg) => (
          <div key={msg.id} className={cn(
            "flex flex-col gap-2",
            msg.senderId === profile?.uid ? "items-end" : "items-start"
          )}>
            <div className={cn(
              "max-w-[80%] p-4 rounded-2xl text-sm",
              msg.senderId === profile?.uid 
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-50 shadow-[0_0_15px_rgba(244,63,94,0.1)]" 
                : "bg-black/40 border border-white/10 text-rose-100/80"
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
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                  : "bg-rose-950/20 border-rose-500/10 text-rose-400/80"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Atom className={cn("w-3 h-3", msg.analysis.includes('QUANTUM ENTANGLEMENT ALERT') && "animate-spin")} />
                  <span className="font-mono uppercase tracking-tighter">
                    {msg.analysis.includes('QUANTUM ENTANGLEMENT ALERT') ? 'Entanglement Detected' : 'VESTA-11 Analysis'}
                  </span>
                </div>
                <div className="prose prose-invert prose-rose text-xs leading-relaxed">
                  <Markdown>
                    {msg.analysis}
                  </Markdown>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {(otherPresence?.typing) && (
          <div className="flex items-start gap-2">
            <div className="max-w-[80%] p-4 rounded-2xl text-sm bg-black/40 border border-white/10 text-rose-100/80">
              <p className="font-mono text-[10px] uppercase tracking-widest mb-2 opacity-50">
                {profile?.role === 'Commander' ? 'Lead Engineer' : 'Commander'} // Typing...
              </p>
              <div className="flex gap-1 items-center h-4">
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 bg-rose-400/60 rounded-full" />
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-rose-400/60 rounded-full" />
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-rose-400/60 rounded-full" />
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-black/20 backdrop-blur-sm border-t border-white/10 flex gap-2">
        <input 
          value={input}
          onChange={handleInputChange}
          placeholder="Transmit a message to the shared void..."
          className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-500/50 transition-colors text-rose-50"
        />
        <button 
          type="submit"
          disabled={sending || !input.trim()}
          className="p-2 bg-gradient-to-r from-rose-500 to-indigo-500 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity shadow-[0_0_15px_rgba(244,63,94,0.3)]"
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
    try {
      await addDoc(collection(db, 'tasks'), {
        vesselId: profile.vesselId,
        title: newTask,
        status: 'pending',
        category,
        createdAt: serverTimestamp(),
        assignedTo: profile?.uid
      });
      setNewTask('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      const isCompleting = task.status === 'pending';
      await updateDoc(doc(db, 'tasks', task.id), {
        status: isCompleting ? 'completed' : 'pending'
      });
      
      if (isCompleting && task.category === 'Life Support') {
        addSR(10, "Life Support Task Completed");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-6 space-y-8"
    >
      <div className="space-y-4">
        <h3 className="text-xl font-bold italic uppercase tracking-tight flex items-center gap-2 text-rose-50">
          <ClipboardList className="w-5 h-5 text-rose-400" />
          Ship Maintenance Protocols
        </h3>
        
        <form onSubmit={addTask} className="space-y-3">
          <div className="flex gap-2">
            <input 
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Define new protocol..."
              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-500/50 text-rose-50"
            />
            <button className="px-4 py-2 bg-gradient-to-r from-rose-500 to-indigo-500 text-white font-bold rounded-xl text-xs uppercase shadow-[0_0_15px_rgba(244,63,94,0.3)]">Add</button>
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
                    ? "bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]" 
                    : "border-white/10 text-rose-200/40 hover:border-white/20 hover:text-rose-200/60"
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
                ? "bg-black/20 border-white/5 opacity-50" 
                : "bg-black/40 border-white/10 hover:border-rose-500/30 hover:shadow-[0_0_15px_rgba(244,63,94,0.1)]"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                task.status === 'completed' ? "bg-rose-500 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" : "border-white/20 group-hover:border-rose-500/50"
              )}>
                {task.status === 'completed' && <Zap className="w-3 h-3 text-white" />}
              </div>
              <div>
                <p className={cn("text-sm font-medium text-rose-50", task.status === 'completed' && "line-through text-rose-200/40")}>
                  {task.title}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-rose-200/40">
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

const CONSTELLATIONS = [
  { id: 1, name: 'Orion', x: 25, y: 35, info: 'The Hunter. Contains Betelgeuse and Rigel.', link: 'https://en.wikipedia.org/wiki/Orion_(constellation)' },
  { id: 2, name: 'Ursa Major', x: 75, y: 25, info: 'The Great Bear. Contains the Big Dipper.', link: 'https://en.wikipedia.org/wiki/Ursa_Major' },
  { id: 3, name: 'Cassiopeia', x: 85, y: 75, info: 'The Queen. W-shaped constellation.', link: 'https://en.wikipedia.org/wiki/Cassiopeia_(constellation)' },
  { id: 4, name: 'Lyra', x: 35, y: 85, info: 'The Lyre. Contains the bright star Vega.', link: 'https://en.wikipedia.org/wiki/Lyra' },
  { id: 5, name: 'Cygnus', x: 55, y: 55, info: 'The Swan. Contains the Northern Cross.', link: 'https://en.wikipedia.org/wiki/Cygnus_(constellation)' },
];

function StellarParallaxView({ profile, otherPresence, moonData }: { profile: UserProfile | null, otherPresence: Presence | null, moonData: any }) {
  const [rotation, setRotation] = useState(0);
  const [selectedStar, setSelectedStar] = useState<typeof CONSTELLATIONS[0] | null>(null);
  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha) setRotation(e.alpha);
    };
    window.addEventListener('deviceorientation', handleOrientation);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
    
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  const getPhysicalDistance = () => {
    if (!myLocation || !otherPresence?.location) return "Scanning coordinates...";
    
    const lat1 = myLocation.lat;
    const lon1 = myLocation.lng;
    const lat2 = otherPresence.location.lat;
    const lon2 = otherPresence.location.lng;
    
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI/180);
    const dLon = (lon2 - lon1) * (Math.PI/180); 
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    
    const lightSeconds = d / 299792;
    // For very small distances, use micro light-seconds
    if (lightSeconds < 0.001) {
      return `${(lightSeconds * 1000000).toFixed(2)} µls (Micro Light-Seconds)`;
    }
    return `${lightSeconds.toFixed(6)} ls (Light-Seconds)`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-6 space-y-8 flex flex-col items-center relative"
    >
      {/* Background Star Map (2026) */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rose-500/20 via-transparent to-transparent" />
        {[...Array(50)].map((_, i) => (
          <Star 
            key={i} 
            className="absolute text-rose-500/40 w-1 h-1"
            style={{ 
              top: `${Math.random() * 100}%`, 
              left: `${Math.random() * 100}%`,
              opacity: Math.random()
            }} 
          />
        ))}
      </div>

      <div className="text-center space-y-4 relative z-10">
        <h3 className="text-2xl font-bold italic uppercase tracking-tight flex items-center justify-center gap-3 text-rose-50">
          <Star className="w-6 h-6 text-rose-400 animate-pulse" />
          Stellar Parallax
        </h3>
        <p className="text-rose-200/40 font-mono text-[10px] uppercase tracking-widest">Real-Time Orbital Alignment</p>
      </div>

      <div className="relative w-64 h-64 flex items-center justify-center z-10">
        {/* Singularity Map Overlay */}
        <motion.div 
          animate={{ rotate: rotation }}
          className="absolute inset-0 border border-rose-500/20 rounded-full flex items-center justify-center shadow-[inset_0_0_30px_rgba(244,63,94,0.1)]"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <Moon className="w-4 h-4 text-rose-400/50" />
            <span className="text-[8px] font-mono uppercase text-rose-400/40 mt-1">Sagittarius // 2026</span>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 flex flex-col items-center">
            <Atom className="w-4 h-4 text-indigo-400/50" />
            <span className="text-[8px] font-mono uppercase text-indigo-400/40 mt-1">Saturn-Neptune // Aries</span>
          </div>
          
          {/* Interactive Constellations */}
          {CONSTELLATIONS.map((star) => (
            <button
              key={star.id}
              onClick={() => setSelectedStar(star)}
              className="absolute w-4 h-4 -ml-2 -mt-2 group flex items-center justify-center"
              style={{ top: `${star.y}%`, left: `${star.x}%` }}
            >
              <div className="w-1.5 h-1.5 bg-rose-400 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.8)] group-hover:scale-150 transition-transform" />
              <span className="absolute top-full mt-1 text-[8px] font-mono text-rose-200/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {star.name}
              </span>
            </button>
          ))}
        </motion.div>

        {/* Current Sky Map */}
        <motion.div 
          animate={{ rotate: rotation * -0.5 }}
          className="w-48 h-48 border-2 border-rose-500/40 rounded-full flex items-center justify-center relative shadow-[0_0_30px_rgba(244,63,94,0.1)] pointer-events-none"
        >
          <div className="absolute top-4 right-4 flex flex-col items-center">
            <Moon className="w-6 h-6 text-rose-300" />
            <span className="text-[8px] font-mono uppercase text-rose-300 mt-1 text-center">
              {moonData.phaseName}<br/>
              <span className="text-rose-400/60">{moonData.zodiacSign}</span>
            </span>
          </div>
          
          <Compass className="w-12 h-12 text-rose-500/60" />
        </motion.div>
      </div>

      <div className="max-w-md text-center space-y-4 relative z-10 w-full px-4">
        <AnimatePresence mode="wait">
          {selectedStar ? (
            <motion.div
              key="star-info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl shadow-[0_0_20px_rgba(244,63,94,0.1)] backdrop-blur-md"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-bold text-rose-200 uppercase tracking-widest">{selectedStar.name}</h4>
                <button onClick={() => setSelectedStar(null)} className="text-rose-400 hover:text-rose-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-rose-200/70 mb-3 text-left">{selectedStar.info}</p>
              <a 
                href={selectedStar.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] text-rose-400 hover:text-rose-300 uppercase tracking-widest flex items-center gap-1"
              >
                View Database <Link className="w-3 h-3" />
              </a>
            </motion.div>
          ) : (
            <motion.div
              key="default-info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <p className="text-sm italic text-rose-200/60 leading-relaxed">
                "The stars shift, but the coordinates of the Singularity remain fixed. We are navigating by the same light that hit the Olive Tree."
              </p>
              <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.05)]">
                <p className="text-[10px] font-mono uppercase tracking-widest text-rose-400">
                  {otherPresence?.location ? 'Shared Sky Detected' : 'Scanning for Orbital Overlap...'}
                </p>
                <p className="text-[9px] text-rose-200/40 mt-1">
                  {getEmotionalDistance()}
                </p>
                <p className="text-[9px] text-emerald-400/60 mt-2 font-mono uppercase tracking-widest">
                  Physical Void: {getPhysicalDistance()}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function MissionLogView({ profile, addSR }: { profile: UserProfile | null, addSR: (amount: number, reason: string) => void }) {
  const [logs, setLogs] = useState<MissionLogEntry[]>([]);
  const [content, setContent] = useState('');
  const [type, setType] = useState<'activity' | 'observation' | 'thought'>('activity');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!profile?.vesselId) return;
    const q = query(
      collection(db, 'missionLogs'),
      where('vesselId', '==', profile.vesselId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissionLogEntry)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'missionLogs'));
    return () => unsubscribe();
  }, [profile]);

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !profile?.vesselId) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'missionLogs'), {
        vesselId: profile.vesselId,
        astronautId: profile.uid,
        astronautRole: profile.role,
        content,
        type,
        timestamp: serverTimestamp()
      });
      addSR(10, 'Mission Log Recorded');
      setContent('');
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col p-6 space-y-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <BookOpen className="w-6 h-6 text-rose-400" />
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-widest">Mission Log</h2>
          <p className="text-xs text-rose-200/60 font-mono">Record activities, observations, and thoughts</p>
        </div>
      </div>

      <form onSubmit={handleLog} className="space-y-4 bg-black/20 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
        <div className="flex gap-4">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-500/50 text-rose-50"
          >
            <option value="activity">Activity</option>
            <option value="observation">Observation</option>
            <option value="thought">Personal Thought</option>
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Log entry..."
          className="w-full h-24 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500/50 resize-none text-rose-50"
        />
        <button 
          type="submit"
          disabled={!content.trim() || sending}
          className="w-full py-3 bg-gradient-to-r from-rose-500 to-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[0_0_15px_rgba(244,63,94,0.3)] flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Record Entry
        </button>
      </form>

      <div className="space-y-4">
        {logs.map(log => (
          <div key={log.id} className="p-4 bg-black/40 border border-white/10 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px] font-mono uppercase px-2 py-1 rounded",
                  log.type === 'activity' ? "bg-blue-500/20 text-blue-300" :
                  log.type === 'observation' ? "bg-emerald-500/20 text-emerald-300" :
                  "bg-purple-500/20 text-purple-300"
                )}>
                  {log.type}
                </span>
                <span className="text-xs font-bold text-rose-100">{log.astronautRole}</span>
              </div>
              <span className="text-[10px] font-mono text-rose-200/40">
                {log.timestamp ? format(log.timestamp.toDate(), 'MMM dd, HH:mm') : '...'}
              </span>
            </div>
            <p className="text-sm text-rose-50/80 whitespace-pre-wrap">{log.content}</p>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center py-12 text-rose-200/40 text-sm italic">
            No logs recorded yet.
          </div>
        )}
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
      className="p-6 space-y-8"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold italic uppercase tracking-tight flex items-center gap-2 text-rose-50">
          <Archive className="w-5 h-5 text-rose-400" />
          The Olive Grove Archive
        </h3>
        <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.1)]">
          <Star className="w-3 h-3 text-rose-400" />
          <span className="text-[10px] font-mono uppercase text-rose-400">Singularity Map Active</span>
        </div>
      </div>

      {/* Singularity Map Visual */}
      <div className="p-8 bg-black/40 border border-white/10 rounded-3xl relative overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rose-500/30 via-transparent to-transparent" />
          <TreeDeciduous className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 text-rose-900/50" />
        </div>
        
        <div className="relative z-10 grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Moon className="w-6 h-6 text-rose-400" />
              <div>
                <p className="text-[10px] font-mono uppercase text-rose-200/40">Moon Position</p>
                <p className="text-sm font-bold text-rose-50">{SINGULARITY_SKY.moonSign}</p>
              </div>
            </div>
            <p className="text-xs italic text-rose-200/60">"Unaligned horizons, discovery, philosophy. The dream of the stars."</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Atom className="w-6 h-6 text-indigo-400" />
              <div>
                <p className="text-[10px] font-mono uppercase text-rose-200/40">Alignment</p>
                <p className="text-sm font-bold text-indigo-50">{SINGULARITY_SKY.conjunction}</p>
              </div>
            </div>
            <p className="text-xs italic text-rose-200/60">"Quantum Node of dissolution and new beginnings. The Nuclear Heart."</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('entries')}
          className={cn(
            "text-xs uppercase tracking-widest font-bold pb-2 border-b-2 transition-colors",
            activeTab === 'entries' ? "border-rose-500 text-rose-400" : "border-transparent text-rose-200/40 hover:text-rose-200/60"
          )}
        >
          Cosmic Coordinates
        </button>
        <button
          onClick={() => setActiveTab('pulses')}
          className={cn(
            "text-xs uppercase tracking-widest font-bold pb-2 border-b-2 transition-colors",
            activeTab === 'pulses' ? "border-rose-500 text-rose-400" : "border-transparent text-rose-200/40 hover:text-rose-200/60"
          )}
        >
          Fusion Pulses
        </button>
      </div>

      {activeTab === 'entries' && (
        <div className="space-y-8">
          <form onSubmit={handleArchive} className="space-y-4 bg-black/20 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
            <h4 className="text-sm font-bold uppercase tracking-widest text-rose-400 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Encrypt New Entry
            </h4>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Entry Title..."
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500/50 text-rose-50"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write your poem or message to be encrypted in the silver leaves..."
              className="w-full h-32 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500/50 resize-none text-rose-50"
            />
            <button 
              type="submit"
              disabled={!newTitle.trim() || !newContent.trim()}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(244,63,94,0.3)]"
            >
              Archive to 11-Master Frequency
            </button>
          </form>

          <div className="grid grid-cols-1 gap-6">
            {entries.map((entry) => {
              const isDecrypted = decryptedIds.has(entry.id);
              return (
                <div key={entry.id} className="p-6 bg-black/40 border border-white/10 rounded-2xl relative overflow-hidden group hover:border-rose-500/30 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TreeDeciduous className="w-24 h-24 text-rose-500" />
                  </div>
                  
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-rose-400">
                      <MapPin className="w-3 h-3" />
                      {entry.coordinates}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-200/40">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {entry.createdAt ? format(entry.createdAt.toDate(), 'dd.MM.yyyy // HH:mm') : '...'}
                    </div>
                  </div>

                  <div className="relative z-10 space-y-4">
                    <h5 className="text-lg font-bold text-white">{isDecrypted ? entry.title : scrambleText(entry.title)}</h5>
                    <div className="prose prose-invert prose-rose text-sm italic font-serif leading-relaxed">
                      <Markdown>
                        {isDecrypted ? entry.content : scrambleText(entry.content)}
                      </Markdown>
                    </div>
                    
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-rose-200/40">
                        Author: {entry.authorRole}
                      </span>
                      <button
                        onClick={() => toggleDecryption(entry.id)}
                        className="text-[10px] font-mono uppercase tracking-widest text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
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
              <p className="text-center text-rose-200/40 text-xs italic py-8">No entries found in the Olive Grove Archive.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pulses' && (
        <div className="grid grid-cols-1 gap-6">
          {pulses.map((pulse) => (
            <div key={pulse.id} className="p-6 bg-black/40 border border-white/10 rounded-2xl relative overflow-hidden group hover:border-rose-500/30 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TreeDeciduous className="w-24 h-24 text-rose-500" />
              </div>
              
              <div className="flex items-center gap-2 mb-4 text-[10px] font-mono uppercase tracking-[0.2em] text-rose-200/40">
                <Clock className="w-3 h-3" />
                {pulse.timestamp ? format(pulse.timestamp.toDate(), 'dd.MM.yyyy // HH:mm') : '...'}
              </div>

              <div className="relative z-10">
                <div className="prose prose-invert prose-rose text-lg italic font-serif leading-relaxed">
                  <Markdown>
                    {pulse.poem}
                  </Markdown>
                </div>
              </div>
            </div>
          ))}
          {pulses.length === 0 && (
            <p className="text-center text-rose-200/40 text-xs italic py-8">No fusion pulses recorded yet.</p>
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
    <div className="relative">
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
                className="w-64 h-64 bg-rose-500 rounded-full blur-[100px]"
              />
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center"
              >
                <Atom className="w-24 h-24 text-white animate-spin-slow mb-4" />
                <h2 className="text-4xl font-bold italic text-white tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]">Nuclear Fusion</h2>
                <p className="text-rose-400 font-mono text-sm tracking-widest mt-2 drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]">SYNCHRONIZATION COMPLETE</p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => {
          audioService.playClick();
          triggerPulseAttempt();
        }}
        disabled={fusing}
        className={cn(
          "w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all group relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.3)]",
          fusing 
            ? "border-rose-500 bg-rose-500/20 animate-pulse shadow-[0_0_30px_rgba(244,63,94,0.3)]" 
            : "border-rose-500/30 hover:border-rose-500/80 bg-black/60 backdrop-blur-md"
        )}
      >
        <Leaf className={cn(
          "w-6 h-6 transition-transform",
          fusing ? "scale-125 text-rose-400" : "text-rose-400 group-hover:text-rose-300"
        )} />
        
        {fusing && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 2, opacity: 0.5 }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 bg-rose-500 rounded-full blur-2xl"
          />
        )}
      </button>
    </div>
  );
}
