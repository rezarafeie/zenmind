import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { 
  Wind, 
  Home, 
  Sparkles, 
  User, 
  Play, 
  Pause, 
  Check, 
  Brain, 
  Moon, 
  Sun, 
  Heart,
  Smile,
  Meh,
  Frown,
  Activity,
  Calendar,
  Volume2,
  Clock,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  X,
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  FileText,
  History,
  Maximize2,
  Minimize2,
  Zap
} from 'lucide-react';

// --- TYPES & CONFIGURATION ---

const API_KEY = process.env.API_KEY;

type ViewState = 'onboarding' | 'auth' | 'home' | 'meditate' | 'generating' | 'breathe' | 'profile' | 'player';

interface DailyContent {
  tip: string;
  affirmation: string;
  gratitude: string;
  date: string;
}

interface MeditationConfig {
  goal: string;
  duration: string;
  voice: 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr';
}

interface SessionHistoryItem {
  id: string;
  date: string;
  timestamp: number;
  config: MeditationConfig;
  script: string;
}

interface MoodEntry {
  date: string;
  mood: 'happy' | 'neutral' | 'sad';
}

interface UserStats {
  name?: string;
  totalMinutes: number;
  sessionsCompleted: number;
  streak: number;
  lastActive: string;
  moodHistory: MoodEntry[];
  history: SessionHistoryItem[];
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
}

interface GenerationTask {
  id: string;
  status: 'scripting' | 'synthesizing' | 'ready' | 'failed';
  config: MeditationConfig;
  script?: string;
  audio?: string | null;
  progressMessage: string;
}

interface LyricLine {
  text: string;
  start: number;
  end: number;
  id: number;
}

interface AudioPlayerState {
  isPlaying: boolean;
  duration: number;
  isReady: boolean;
  currentTime: number;
}

// --- UTILS ---

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function getFormattedDate() {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const pcmData = decodeBase64(base64);
  const sampleRate = 24000;
  const numChannels = 1;
  const dataInt16 = new Int16Array(pcmData.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- HOOKS ---

const useAudioPlayer = () => {
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    duration: 0,
    isReady: false,
    currentTime: 0
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  
  const getCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return ctxRef.current;
  };

  const load = async (base64Audio: string) => {
    try {
      if (state.isPlaying) stop();
      const ctx = getCtx();
      const buffer = await decodeAudioData(base64Audio, ctx);
      bufferRef.current = buffer;
      pauseOffsetRef.current = 0;
      setState(prev => ({ ...prev, isReady: true, duration: buffer.duration, isPlaying: false, currentTime: 0 }));
    } catch (e) {
      console.error("Audio load failed", e);
    }
  };

  const play = async () => {
    const ctx = getCtx();
    if (!bufferRef.current) return;
    
    if (ctx.state === 'suspended') await ctx.resume();
    
    if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
    }

    const source = ctx.createBufferSource();
    source.buffer = bufferRef.current;
    source.connect(ctx.destination);
    
    startTimeRef.current = ctx.currentTime - pauseOffsetRef.current;
    source.start(0, pauseOffsetRef.current);
    sourceRef.current = source;
    
    setState(prev => ({ ...prev, isPlaying: true }));
    
    source.onended = () => {
       if (ctx.currentTime >= startTimeRef.current + bufferRef.current!.duration - 0.2) {
           setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
           pauseOffsetRef.current = 0;
       }
    };
  };

  const pause = () => {
    if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch (e) {}
        sourceRef.current = null;
    }
    const ctx = getCtx();
    pauseOffsetRef.current = ctx.currentTime - startTimeRef.current;
    setState(prev => ({ ...prev, isPlaying: false }));
  };

  const stop = () => {
    if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
        sourceRef.current = null;
    }
    pauseOffsetRef.current = 0;
    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  };
  
  const seek = (time: number) => {
      pauseOffsetRef.current = Math.max(0, Math.min(time, state.duration));
      if (state.isPlaying) {
          play();
      } else {
          // just update time reference
      }
  };
  
  const getCurrentTime = () => {
      if (!ctxRef.current) return 0;
      if (state.isPlaying) return ctxRef.current.currentTime - startTimeRef.current;
      return pauseOffsetRef.current;
  };

  return { 
    ...state, 
    load, 
    play, 
    pause, 
    stop, 
    seek, 
    getCurrentTime 
  };
};

// --- SERVICES ---

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async generateDailyContent(): Promise<DailyContent> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a daily mindfulness content piece in JSON format with three fields: 'tip' (short mindfulness tip), 'affirmation' (powerful I am statement), and 'gratitude' (a simple question to reflect on).`,
        config: { responseMimeType: 'application/json' }
      });
      
      let text = response.text || '{}';
      const startIndex = text.indexOf('{');
      const endIndex = text.lastIndexOf('}');
      
      if (startIndex !== -1 && endIndex !== -1) {
        text = text.substring(startIndex, endIndex + 1);
      } else {
        text = text.replace(/```json|```/g, '').trim();
      }
      
      const data = JSON.parse(text);
      return { ...data, date: getTodayString() };
    } catch (e) {
      console.error("Daily content error", e);
      return {
        tip: "Take a deep breath and center yourself in the present moment.",
        affirmation: "I am calm, centered, and at peace.",
        gratitude: "What is one small thing that made you smile today?",
        date: getTodayString()
      };
    }
  }

  async generateMeditationScript(config: MeditationConfig): Promise<string> {
    const prompt = `Write a VERY SHORT, soothing guided meditation script for ${config.goal}. 
    Target duration: ${config.duration} (but keep text brief).
    CRITICAL: The script must be less than 100 words.
    FORMATTING RULES:
    1. Break the text into short, separate lines. 
    2. Each line should be a single phrase or short sentence (max 8-10 words).
    3. Use a new line for every pause or thought.
    4. Plain text only. No bold, no italics. No [pause] or (notes).
    5. Just the spoken words, warm and gentle.`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    let text = response.text || "Sit comfortably and close your eyes.\nBreathe in deep.\nBreathe out slow.\nYou are safe here.";
    
    const lineCount = text.split('\n').length;
    if (lineCount < 3) {
      text = text.replace(/([.!?])\s+/g, '$1\n').replace(/,\s+/g, ',\n');
    }

    return text;
  }

  async generateSpeech(text: string, voiceName: string): Promise<string> {
    const cleanText = text.replace(/[\*\#\[\]\(\)]/g, '').trim();
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) throw new Error("No audio data returned from API.");
      return audioData;
    } catch (e: any) {
      console.error("TTS Error Full:", e);
      throw new Error(e.message || "TTS Service Error");
    }
  }
}

const gemini = new GeminiService();

// --- COMPONENTS ---

// Premium Liquid Glass Card
const Card = ({ children, className = "", onClick }: any) => (
  <div 
    onClick={onClick}
    className={`bg-slate-900/30 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-2xl p-6 transition-all duration-300 ${className}`}
  >
    {children}
  </div>
);

// Glass/Solid Button Hybrid
const Button = ({ children, variant = 'primary', onClick, disabled, className = "", size = "md" }: any) => {
  const base = "rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95";
  const sizes = {
    sm: "py-2 px-5 text-sm",
    md: "py-4 px-8 w-full",
    lg: "py-5 px-10 text-lg w-full"
  };
  const variants = {
    primary: "bg-white text-slate-950 hover:bg-slate-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "bg-white/10 text-white hover:bg-white/20 border border-white/10 backdrop-blur-md shadow-lg disabled:opacity-50",
    ghost: "bg-transparent text-slate-400 hover:text-white"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size as keyof typeof sizes]} ${variants[variant as keyof typeof variants]} ${className}`}>
      {children}
    </button>
  );
};

const Toast = ({ msg, onDismiss }: { msg: ToastMessage, onDismiss: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [msg, onDismiss]);

  const bg = msg.type === 'error' ? 'bg-rose-500/20 border-rose-500/50' : 'bg-teal-500/20 border-teal-500/50';

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] ${bg} border backdrop-blur-2xl px-6 py-3 rounded-full shadow-2xl flex items-center justify-between animate-fade-in min-w-[300px]`}>
      <span className="font-medium text-sm text-white pr-2">{msg.message}</span>
      <button onClick={onDismiss} className="text-white/70 hover:text-white"><X size={16} /></button>
    </div>
  );
};

// Liquid Glass Progress Card
const GenerationProgressCard = ({ 
  task, 
  onPlay, 
  onDismiss,
  onViewDetails 
}: { 
  task: GenerationTask, 
  onPlay: () => void, 
  onDismiss: () => void,
  onViewDetails: () => void 
}) => {
  if (!task) return null;

  const isReady = task.status === 'ready';
  const isFailed = task.status === 'failed';

  return (
    <div className="fixed bottom-24 md:bottom-28 left-4 right-4 z-50 animate-slide-up flex justify-center pointer-events-none">
      <div className="w-full max-w-sm pointer-events-auto">
        <div 
          className="relative group cursor-pointer" 
          onClick={() => {
            if (isReady) onPlay();
            else if (!isFailed) onViewDetails();
          }}
        >
           {/* Subtle Glow */}
           <div className={`absolute -inset-0.5 rounded-[2rem] opacity-30 blur-xl transition-all duration-700 ${
            isReady ? 'bg-teal-500' : isFailed ? 'bg-rose-500' : 'bg-indigo-500'
           }`}></div>
          
           {/* Glass Body */}
           <div className="relative bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-3 pl-4 flex items-center gap-4 shadow-2xl">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isReady ? 'bg-teal-500 text-white' : 
                isFailed ? 'bg-rose-500 text-white' : 
                'bg-white/10 text-indigo-300'
              }`}>
                {isReady ? <Play size={18} fill="currentColor" className="ml-0.5" /> : 
                 isFailed ? <AlertCircle size={18} /> :
                 <Loader2 size={18} className="animate-spin" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium text-sm truncate">
                  {isReady ? "Session Ready" : isFailed ? "Failed" : "Creating..."}
                </h4>
                <p className="text-xs text-white/50 truncate mt-0.5">
                  {isReady ? "Tap to start" : task.progressMessage}
                </p>
              </div>

              {isReady ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); onPlay(); }}
                  className="px-5 py-2 bg-white text-black text-xs font-bold rounded-full hover:bg-slate-200 transition-colors"
                >
                  Open
                </button>
              ) : isFailed ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                  className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white"
                >
                  <X size={18} />
                </button>
              ) : null}
           </div>
        </div>
      </div>
    </div>
  );
};

const MiniPlayer = ({ title, player, onClick }: { title: string, player: ReturnType<typeof useAudioPlayer>, onClick: () => void }) => {
  if (!player.isReady || player.isPlaying === false) return null;
  
  return (
      <div 
        className="fixed bottom-24 md:bottom-28 left-4 right-4 z-40 animate-slide-up cursor-pointer flex justify-center"
        onClick={onClick}
      >
        <div className="w-full max-w-sm bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-2 pl-3 flex items-center gap-3 shadow-2xl">
             {/* EQ Visualizer Static */}
             <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
               <Activity size={16} className="text-teal-400" />
             </div>
             
             <div className="flex-1 min-w-0">
               <h4 className="text-white text-xs font-medium truncate">Now Playing</h4>
               <p className="text-[10px] text-white/60 truncate">{title}</p>
             </div>
             
             <button 
               onClick={(e) => { e.stopPropagation(); player.isPlaying ? player.pause() : player.play(); }}
               className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-slate-200"
             >
               {player.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
             </button>
        </div>
      </div>
  );
};

const OnboardingScreen = ({ onComplete }: any) => (
  <div className="flex flex-col items-center justify-center min-h-full p-8 text-center animate-fade-in relative z-10 max-w-lg mx-auto">
    <div className="w-32 h-32 bg-gradient-to-tr from-teal-400 to-indigo-500 rounded-full blur-3xl opacity-20 absolute top-1/4 animate-pulse"></div>
    
    <div className="mb-8 relative">
      <div className="w-20 h-20 bg-white/10 rounded-[2rem] backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/10 rotate-3">
         <Wind size={40} className="text-white" />
      </div>
    </div>
    
    <h1 className="text-4xl font-light tracking-tight text-white mb-4">ZenMind AI</h1>
    <p className="text-lg text-slate-400 mb-12 font-light leading-relaxed max-w-xs">
      Your personalized path to peace, powered by intelligence.
    </p>
    
    <Button onClick={onComplete} className="w-full">
      Begin Journey
    </Button>
  </div>
);

const AuthScreen = ({ onComplete }: { onComplete: (name: string) => void }) => {
  const [name, setName] = useState('');

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 animate-fade-in max-w-lg mx-auto">
      <Card className="w-full max-w-sm">
        <h2 className="text-2xl font-light text-center mb-2">Welcome</h2>
        <p className="text-center text-slate-400 mb-8 text-sm">Create your sacred space</p>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 ml-4 mb-2 block">YOUR NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-white/20 transition-all text-center"
            />
          </div>
          
          <Button 
            onClick={() => onComplete(name || 'Traveler')}
            disabled={!name.trim()}
          >
            Continue
          </Button>
          
          <button 
            onClick={() => onComplete('Traveler')}
            className="w-full py-3 text-xs text-slate-500 hover:text-white transition-colors"
          >
            Continue as Guest
          </button>
        </div>
      </Card>
    </div>
  );
};

const HomeScreen = ({ user, onNavigate, dailyContent, onStartSession }: any) => (
  <div className="flex flex-col min-h-full p-6 pb-48 animate-fade-in max-w-lg mx-auto">
    {/* Header */}
    <header className="text-center mt-8 mb-12">
      <p className="text-xs font-medium tracking-widest text-indigo-400 uppercase mb-3 opacity-80">{getFormattedDate()}</p>
      <h1 className="text-4xl md:text-5xl font-light text-white mb-1 leading-tight tracking-tight">
        {getGreeting()},<br />
        <span className="font-normal text-white/90">{user.name}</span>
      </h1>
      
      {/* Streak Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10 mt-4 backdrop-blur-md">
        <Activity size={14} className="text-teal-400" />
        <span className="text-xs font-medium text-white/80">{user.streak} Day Streak</span>
      </div>
    </header>

    {/* Hero Insight */}
    <div className="flex-1 flex flex-col justify-center mb-12 relative">
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px] pointer-events-none"></div>
       <div className="text-center relative z-10">
          <Sparkles className="w-8 h-8 text-amber-300 mx-auto mb-6 opacity-80" />
          <h2 className="text-2xl md:text-3xl font-light leading-relaxed text-white/90 italic">
            "{dailyContent?.affirmation || "I am present and open to the peace within me."}"
          </h2>
          <div className="w-12 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto mt-8 mb-8"></div>
          <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
            {dailyContent?.tip || "Take three slow, deep breaths, noticing the sensation of each inhale and exhale."}
          </p>
       </div>
    </div>

    {/* Primary Actions */}
    <div className="grid grid-cols-2 gap-4">
      <button 
        onClick={() => onNavigate('meditate')}
        className="group relative h-40 rounded-[2.5rem] bg-indigo-500/10 hover:bg-indigo-500/20 border border-white/5 backdrop-blur-2xl transition-all duration-300 overflow-hidden flex flex-col items-center justify-center gap-3 active:scale-95"
      >
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
           <Sparkles size={24} className="text-indigo-300" />
        </div>
        <span className="text-sm font-medium text-white">Meditate</span>
      </button>

      <button 
        onClick={() => onNavigate('breathe')}
        className="group relative h-40 rounded-[2.5rem] bg-teal-500/10 hover:bg-teal-500/20 border border-white/5 backdrop-blur-2xl transition-all duration-300 overflow-hidden flex flex-col items-center justify-center gap-3 active:scale-95"
      >
        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
           <Wind size={24} className="text-teal-300" />
        </div>
        <span className="text-sm font-medium text-white">Breathe</span>
      </button>
    </div>
  </div>
);

const GeneratorScreen = ({ onGenerate, onBack }: any) => {
  const [config, setConfig] = useState<MeditationConfig>({
    goal: 'Stress Relief',
    duration: '5 min',
    voice: 'Kore'
  });

  const goals = ['Stress Relief', 'Better Sleep', 'Focus', 'Anxiety', 'Morning Energy'];
  const voices = ['Kore', 'Puck', 'Fenrir', 'Zephyr'];

  return (
    <div className="flex flex-col min-h-full p-6 animate-fade-in max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-8 mt-2">
        <button onClick={onBack} className="p-3 bg-white/5 rounded-full hover:bg-white/10 backdrop-blur-md transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-light">New Session</h2>
      </div>

      <div className="space-y-10">
        <section>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block ml-1">Intention</label>
          <div className="flex flex-wrap gap-2">
            {goals.map(g => (
              <button
                key={g}
                onClick={() => setConfig({...config, goal: g})}
                className={`px-5 py-2.5 rounded-full text-sm transition-all duration-300 ${
                  config.goal === g 
                    ? 'bg-white text-black shadow-lg font-medium' 
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block ml-1">Duration</label>
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/5 backdrop-blur-md">
             {['3 min', '5 min', '10 min'].map(d => (
               <button
                 key={d}
                 onClick={() => setConfig({...config, duration: d})}
                 className={`flex-1 py-3 rounded-full text-sm transition-all duration-300 ${
                   config.duration === d
                     ? 'bg-white text-black shadow-md font-medium'
                     : 'text-slate-400 hover:text-white'
                 }`}
               >
                 {d}
               </button>
             ))}
          </div>
        </section>

        <section>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block ml-1">Guide Voice</label>
          <div className="grid grid-cols-4 gap-2">
             {voices.map(v => (
               <button 
                 key={v}
                 onClick={() => setConfig({...config, voice: v as any})}
                 className={`flex flex-col items-center gap-2 py-3 rounded-2xl transition-all duration-300 ${
                    config.voice === v 
                      ? 'bg-white/10 border-white/20 text-white' 
                      : 'bg-transparent border-transparent text-slate-500 hover:bg-white/5'
                 } border`}
               >
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.voice === v ? 'bg-white text-black' : 'bg-white/10'}`}>
                    <Volume2 size={14} />
                 </div>
                 <span className="text-[10px] uppercase font-bold tracking-wider">{v}</span>
               </button>
             ))}
          </div>
        </section>

        <Button onClick={() => onGenerate(config)} className="mt-8 shadow-2xl shadow-indigo-500/20">
          <Sparkles size={18} />
          <span>Create Meditation</span>
        </Button>
      </div>
    </div>
  );
};

const GeneratingScreen = ({ 
  task, 
  onBackToDash,
  onPlay 
}: { 
  task: GenerationTask | null, 
  onBackToDash: () => void,
  onPlay: () => void
}) => {
  if (!task) return null;

  const isReady = task.status === 'ready';
  const isFailed = task.status === 'failed';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-center animate-fade-in overflow-hidden">
       {/* Background Ambience - Full viewport */}
       <div className="absolute inset-0 z-0 pointer-events-none transition-all duration-1000">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full blur-[120px] transition-colors duration-1000 ${
            isReady ? 'bg-teal-500/30' : isFailed ? 'bg-rose-500/20' : 'bg-indigo-500/20 animate-pulse'
          }`}></div>
          <div className="absolute top-1/3 left-1/4 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-white/5 rounded-full blur-[100px]"></div>
       </div>

       <div className="relative z-10 flex flex-col items-center max-w-lg w-full p-8">
          <div className="w-24 h-24 mb-12 relative flex items-center justify-center">
             {isReady ? (
               <div className="w-full h-full bg-teal-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(45,212,191,0.5)] animate-fade-in">
                  <Play size={40} fill="currentColor" className="text-white ml-1" />
               </div>
             ) : isFailed ? (
               <div className="w-full h-full bg-rose-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(244,63,94,0.5)]">
                  <AlertCircle size={40} className="text-white" />
               </div>
             ) : (
               <>
                 <div className="absolute inset-0 border-t-2 border-r-2 border-white/20 rounded-full animate-spin"></div>
                 <div className="absolute inset-2 border-b-2 border-l-2 border-teal-500/40 rounded-full animate-spin reverse duration-1000"></div>
                 <Brain size={32} className="text-white/80 animate-pulse" />
               </>
             )}
          </div>

          <h2 className="text-3xl font-light text-white mb-4">
             {isReady ? "Your journey awaits." : isFailed ? "Something went wrong." : "Weaving your journey..."}
          </h2>
          <p className="text-slate-400 max-w-xs mx-auto mb-16 leading-relaxed">
             {isReady 
                ? "Your personalized meditation session has been created successfully." 
                : task.progressMessage}
          </p>

          {isReady ? (
            <Button onClick={onPlay} className="shadow-[0_0_30px_rgba(45,212,191,0.3)]">
               Begin Journey
            </Button>
          ) : (
            <button 
               onClick={onBackToDash}
               className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/80 backdrop-blur-md transition-all"
            >
               {isFailed ? "Go back to Dashboard" : "Go back to Dashboard"}
            </button>
          )}
          
          {!isReady && !isFailed && (
            <p className="mt-6 text-xs text-slate-500">
               We'll notify you when it's ready.
            </p>
          )}
       </div>
    </div>
  );
};

const PlayerScreen = ({ 
  audioData, 
  script, 
  title, 
  onBack, 
  player 
}: { 
  audioData: string, 
  script: string, 
  title: string, 
  onBack: () => void,
  player: ReturnType<typeof useAudioPlayer> 
}) => {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const timeLabelRef = useRef<HTMLDivElement>(null);
  const [activeLineIndex, setActiveLineIndex] = useState(0);

  // Parse Script into Lines
  const lyrics: LyricLine[] = useMemo(() => {
    const lines = script.split('\n').filter(l => l.trim().length > 0);
    const totalDuration = player.duration || (lines.length * 4); 
    const charCounts = lines.map(l => l.length);
    const totalChars = charCounts.reduce((a, b) => a + b, 0);
    
    let currentTime = 0;
    return lines.map((line, i) => {
      const lineDuration = (charCounts[i] / totalChars) * totalDuration;
      const item = {
        id: i,
        text: line,
        start: currentTime,
        end: currentTime + lineDuration
      };
      currentTime += lineDuration;
      return item;
    });
  }, [script, player.duration]);

  // Load Audio
  useEffect(() => {
    if (audioData && !player.isReady) {
      player.load(audioData);
    }
  }, [audioData, player.isReady]);

  // Animation Loop for Progress & Lyrics
  useEffect(() => {
    let animId: number;
    const update = () => {
       const time = player.getCurrentTime();
       const percent = (time / player.duration) * 100;
       
       if (progressBarRef.current) {
         progressBarRef.current.style.width = `${percent}%`;
       }
       
       if (timeLabelRef.current) {
         const m = Math.floor(time / 60);
         const s = Math.floor(time % 60).toString().padStart(2, '0');
         timeLabelRef.current.innerText = `${m}:${s}`;
       }
       
       // Update Lyrics State less frequently to avoid re-renders
       const currentLineIndex = lyrics.findIndex(l => time >= l.start && time < l.end);
       if (currentLineIndex !== -1 && currentLineIndex !== activeLineIndex) {
          setActiveLineIndex(currentLineIndex);
       }

       animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [player, lyrics, activeLineIndex]);

  // Auto-Scroll Lyrics
  useEffect(() => {
    if (lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.children[activeLineIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex]);

  const togglePlay = () => {
    if (player.isPlaying) player.pause();
    else player.play();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    player.seek(percent * player.duration);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col animate-fade-in max-w-lg mx-auto left-0 right-0">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] bg-indigo-900/10 blur-[100px] animate-pulse"></div>
      </div>

      {/* Navbar */}
      <div className="relative z-10 flex items-center justify-between p-6">
         <button onClick={onBack} className="w-12 h-12 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10 transition-colors">
            <X size={20} />
         </button>
         <span className="text-xs font-medium tracking-widest text-slate-500 uppercase">Now Playing</span>
         <div className="w-12"></div> {/* Spacer */}
      </div>

      {/* Lyrics Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative z-10 px-8 py-12 mask-image-gradient">
         <div ref={lyricsContainerRef} className="space-y-12 py-[40vh]">
            {lyrics.map((line, i) => {
               const isActive = i === activeLineIndex;
               return (
                  <p 
                    key={i} 
                    className={`text-2xl md:text-3xl font-medium text-center transition-all duration-700 leading-normal ${
                       isActive 
                         ? 'text-white scale-100 blur-0' 
                         : 'text-slate-600 scale-95 blur-[2px]'
                    }`}
                  >
                    {line.text}
                  </p>
               );
            })}
         </div>
      </div>

      {/* Floating Controls Island */}
      <div className="fixed bottom-8 left-6 right-6 z-20 md:absolute md:bottom-12">
        <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl">
           
           {/* Title */}
           <div className="text-center mb-6">
              <h3 className="text-white font-medium">{title}</h3>
              <p className="text-xs text-slate-400 mt-1">Guided Meditation</p>
           </div>

           {/* Progress */}
           <div 
             className="h-1.5 bg-white/10 rounded-full mb-6 cursor-pointer relative overflow-hidden group"
             onClick={handleSeek}
           >
              <div ref={progressBarRef} className="absolute top-0 left-0 h-full bg-white rounded-full w-0" />
           </div>

           {/* Controls */}
           <div className="flex items-center justify-between px-4">
              <span ref={timeLabelRef} className="text-[10px] font-medium text-slate-500 w-10">0:00</span>
              
              <div className="flex items-center gap-6">
                 <button onClick={() => player.seek(player.getCurrentTime() - 10)} className="text-white/50 hover:text-white transition-colors">
                    <ChevronLeft size={24} />
                 </button>
                 
                 <button 
                   onClick={togglePlay}
                   className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                 >
                    {player.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                 </button>

                 <button onClick={() => player.seek(player.getCurrentTime() + 10)} className="text-white/50 hover:text-white transition-colors">
                    <ChevronRight size={24} />
                 </button>
              </div>
              
              <span className="text-[10px] font-medium text-slate-500 w-10 text-right">
                 {Math.floor(player.duration / 60)}:{Math.floor(player.duration % 60).toString().padStart(2, '0')}
              </span>
           </div>
        </div>
      </div>
    </div>
  );
};

const BreathingScreen = ({ onBack }: any) => {
  const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  
  useEffect(() => {
    const cycle = async () => {
      while(true) {
        setPhase('Inhale');
        await new Promise(r => setTimeout(r, 4000));
        setPhase('Hold');
        await new Promise(r => setTimeout(r, 7000));
        setPhase('Exhale');
        await new Promise(r => setTimeout(r, 8000));
      }
    };
    cycle();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 animate-fade-in max-w-lg mx-auto relative overflow-hidden">
       {/* Background */}
       <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-500/20 rounded-full blur-[100px] transition-all duration-[4000ms] ${phase === 'Inhale' ? 'w-[600px] h-[600px] opacity-100' : 'w-32 h-32 opacity-30'}`}></div>
       </div>

       <button onClick={onBack} className="absolute top-6 left-6 z-20 p-3 bg-white/5 rounded-full backdrop-blur-md">
          <ArrowLeft size={20} />
       </button>

       <div className="relative z-10 flex flex-col items-center">
          <div className={`w-64 h-64 rounded-full border-2 border-white/20 flex items-center justify-center relative transition-all duration-[4000ms] ${phase === 'Inhale' ? 'scale-110 border-teal-400/50' : phase === 'Exhale' ? 'scale-90 border-indigo-400/50' : 'scale-100'}`}>
             <div className={`w-48 h-48 bg-gradient-to-tr from-teal-400 to-indigo-500 rounded-full transition-all duration-[4000ms] shadow-[0_0_50px_rgba(45,212,191,0.3)] ${phase === 'Inhale' ? 'scale-100 opacity-100' : phase === 'Exhale' ? 'scale-75 opacity-80' : 'scale-90 opacity-90'}`}></div>
             <span className="absolute text-2xl font-light tracking-widest uppercase text-white drop-shadow-lg">{phase}</span>
          </div>
          
          <div className="mt-16 text-center space-y-2">
             <h2 className="text-3xl font-light text-white">4-7-8 Breathing</h2>
             <p className="text-slate-400">Calm your mind and body</p>
          </div>
       </div>
    </div>
  );
};

const ProfileScreen = ({ user }: { user: UserStats }) => {
  const [selectedSession, setSelectedSession] = useState<SessionHistoryItem | null>(null);

  return (
    <div className="flex flex-col min-h-full p-6 pb-48 animate-fade-in max-w-lg mx-auto">
      <header className="mt-8 mb-8 flex items-center justify-between">
         <h2 className="text-3xl font-light">Your Journey</h2>
         <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <User size={20} />
         </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card className="flex flex-col items-center justify-center py-8">
           <span className="text-4xl font-light text-white mb-2">{user.totalMinutes}</span>
           <span className="text-xs text-slate-400 uppercase tracking-wider">Mindful Mins</span>
        </Card>
        <Card className="flex flex-col items-center justify-center py-8">
           <span className="text-4xl font-light text-white mb-2">{user.sessionsCompleted}</span>
           <span className="text-xs text-slate-400 uppercase tracking-wider">Sessions</span>
        </Card>
      </div>

      {/* Archive List */}
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 ml-1">Recent Sessions</h3>
      <div className="space-y-3">
         {user.history.length === 0 ? (
           <div className="p-8 text-center border border-white/5 rounded-3xl border-dashed">
              <p className="text-slate-500 text-sm">No sessions yet. Start your first journey.</p>
           </div>
         ) : (
           user.history.slice().reverse().map((session) => (
             <div 
               key={session.id}
               onClick={() => setSelectedSession(session)}
               className="group flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-3xl border border-white/5 transition-all cursor-pointer active:scale-98"
             >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <FileText size={16} className="text-indigo-300" />
                   </div>
                   <div>
                      <h4 className="text-sm font-medium text-white">{session.config.goal}</h4>
                      <p className="text-xs text-slate-500">{session.date} • {session.config.duration}</p>
                   </div>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-white" />
             </div>
           ))
         )}
      </div>

      {/* Script Reader Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col p-6 animate-fade-in">
           <div className="flex items-center justify-between mb-8">
              <button onClick={() => setSelectedSession(null)} className="p-3 bg-white/5 rounded-full">
                 <ArrowLeft size={20} />
              </button>
              <span className="text-sm font-medium text-slate-400">Archived Script</span>
              <div className="w-10"></div>
           </div>
           <div className="flex-1 overflow-y-auto no-scrollbar">
              <h2 className="text-2xl font-light text-white mb-8 leading-relaxed">{selectedSession.config.goal}</h2>
              <p className="text-lg text-slate-300 leading-loose whitespace-pre-line font-light">
                 {selectedSession.script}
              </p>
           </div>
        </div>
      )}
    </div>
  );
};

const GlassDock = ({ currentView, onNavigate }: { currentView: ViewState, onNavigate: (v: ViewState) => void }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'meditate', icon: Sparkles, label: 'Create' },
    { id: 'breathe', icon: Wind, label: 'Breathe' },
    { id: 'profile', icon: User, label: 'Profile' }
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
       <div className="flex items-center gap-2 p-2 bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl">
          {tabs.map((tab) => {
             const isActive = currentView === tab.id || (tab.id === 'meditate' && currentView === 'generating');
             const Icon = tab.icon;
             return (
               <button
                 key={tab.id}
                 onClick={() => onNavigate(tab.id as ViewState)}
                 className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] scale-110 -translate-y-2' 
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                 }`}
               >
                 <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
               </button>
             );
          })}
       </div>
    </div>
  );
};

// --- MAIN APP ---

const App = () => {
  const [view, setView] = useState<ViewState>('onboarding');
  const [user, setUser] = useState<UserStats>(() => {
    const saved = localStorage.getItem('zenmind_user');
    return saved ? JSON.parse(saved) : { 
      totalMinutes: 0, 
      sessionsCompleted: 0, 
      streak: 0, 
      lastActive: getTodayString(), 
      moodHistory: [],
      history: []
    };
  });
  const [dailyContent, setDailyContent] = useState<DailyContent | null>(null);
  const [activeSession, setActiveSession] = useState<{ audio: string, script: string, title: string } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  
  // Background Generation State
  const [genTask, setGenTask] = useState<GenerationTask | null>(null);

  // Global Audio Player
  const player = useAudioPlayer();

  // Load User & Check Onboarding
  useEffect(() => {
    const hasOnboarded = localStorage.getItem('zenmind_onboarded');
    if (hasOnboarded && user.name) {
      setView('home');
      checkDailyStreak();
    } else if (hasOnboarded) {
      setView('auth');
    }
  }, []);

  // Persist User
  useEffect(() => {
    localStorage.setItem('zenmind_user', JSON.stringify(user));
  }, [user]);

  // Load Daily Content
  useEffect(() => {
    const loadDaily = async () => {
      const saved = localStorage.getItem(`daily_${getTodayString()}`);
      if (saved) {
        setDailyContent(JSON.parse(saved));
      } else {
        const content = await gemini.generateDailyContent();
        setDailyContent(content);
        localStorage.setItem(`daily_${getTodayString()}`, JSON.stringify(content));
      }
    };
    if (view === 'home') loadDaily();
  }, [view]);

  const checkDailyStreak = () => {
    const today = getTodayString();
    if (user.lastActive !== today) {
       // logic to check consecutive days could go here
       const isConsecutive = new Date(today).getTime() - new Date(user.lastActive).getTime() <= 86400000 * 2; 
       setUser(u => ({
         ...u,
         lastActive: today,
         streak: isConsecutive ? u.streak + 1 : 1
       }));
    }
  };

  const handleAuthComplete = (name: string) => {
    setUser(u => ({ ...u, name }));
    localStorage.setItem('zenmind_onboarded', 'true');
    setView('home');
    checkDailyStreak();
  };

  const showToast = (msg: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ id: Date.now().toString(), message: msg, type });
  };

  const handleStartGeneration = async (config: MeditationConfig) => {
    // Navigate to Generating Screen immediately
    setView('generating');
    
    // Create Task
    const taskId = Date.now().toString();
    const newTask: GenerationTask = {
      id: taskId,
      status: 'scripting',
      config,
      progressMessage: 'Weaving your session script...'
    };
    setGenTask(newTask);

    try {
       // 1. Script
       const script = await gemini.generateMeditationScript(config);
       setGenTask(prev => prev ? ({ ...prev, status: 'synthesizing', script, progressMessage: 'Synthesizing voice guidance...' }) : null);

       // 2. Audio
       const audio = await gemini.generateSpeech(script, config.voice);
       
       // 3. Ready
       setGenTask(prev => prev ? ({ ...prev, status: 'ready', audio, progressMessage: 'Ready to begin.' }) : null);
       
    } catch (e: any) {
       console.error(e);
       setGenTask(prev => prev ? ({ ...prev, status: 'failed', progressMessage: 'Generation failed.' }) : null);
       showToast(e.message || "Failed to create session", 'error');
       // Don't auto-redirect, let the failed UI handle it
    }
  };

  const handleOpenSession = () => {
    if (genTask && genTask.status === 'ready' && genTask.audio && genTask.script) {
       setActiveSession({
         audio: genTask.audio,
         script: genTask.script,
         title: genTask.config.goal
       });
       
       // Save to History
       const historyItem: SessionHistoryItem = {
         id: genTask.id,
         date: getFormattedDate(),
         timestamp: Date.now(),
         config: genTask.config,
         script: genTask.script
       };
       
       setUser(u => ({
         ...u,
         sessionsCompleted: u.sessionsCompleted + 1,
         totalMinutes: u.totalMinutes + parseInt(genTask.config.duration),
         history: [...u.history, historyItem]
       }));

       setView('player');
       
       // Clear task after opening
       setGenTask(null);
    }
  };

  return (
    <div className="app-container min-h-screen relative overflow-hidden text-slate-50 selection:bg-teal-500/30">
      
      {/* Global Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px] animate-blob"></div>
         <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-teal-900/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
         <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-slate-800/30 rounded-full blur-[120px] animate-blob animation-delay-4000"></div>
      </div>

      {view === 'onboarding' && <OnboardingScreen onComplete={() => setView('auth')} />}
      
      {view === 'auth' && <AuthScreen onComplete={handleAuthComplete} />}

      {view === 'home' && (
        <HomeScreen 
          user={user} 
          dailyContent={dailyContent}
          onNavigate={setView} 
        />
      )}

      {view === 'meditate' && (
        <GeneratorScreen 
          onGenerate={handleStartGeneration} 
          onBack={() => setView('home')} 
        />
      )}

      {view === 'generating' && (
        <GeneratingScreen 
          task={genTask} 
          onBackToDash={() => setView('home')} 
          onPlay={handleOpenSession}
        />
      )}

      {view === 'player' && activeSession && (
        <PlayerScreen 
          {...activeSession} 
          onBack={() => setView('home')} 
          player={player}
        />
      )}

      {view === 'breathe' && (
        <BreathingScreen onBack={() => setView('home')} />
      )}

      {view === 'profile' && (
        <ProfileScreen user={user} />
      )}

      {/* Global Persistent Elements */}
      
      {/* Dock (only on main tabs) */}
      {(view === 'home' || view === 'profile' || view === 'meditate' || view === 'breathe') && (
        <GlassDock currentView={view} onNavigate={setView} />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}

      {/* Background Generation Progress */}
      {view !== 'generating' && genTask && (
        <GenerationProgressCard 
           task={genTask} 
           onPlay={handleOpenSession} 
           onDismiss={() => setGenTask(null)}
           onViewDetails={() => setView('generating')}
        />
      )}

      {/* Mini Player (when playing background audio and not on player screen) */}
      {view !== 'player' && view !== 'onboarding' && view !== 'auth' && (
         <MiniPlayer 
            title={activeSession?.title || "Meditation"} 
            player={player} 
            onClick={() => setView('player')} 
         />
      )}

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);