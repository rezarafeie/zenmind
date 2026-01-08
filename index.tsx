import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { 
  Wind, 
  Home, 
  Sparkles, 
  Play, 
  Pause, 
  Brain, 
  Activity,
  Volume2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  X,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Disc,
  Calendar,
  Clock,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Plus,
  Share2,
  Globe,
  Mic,
  Music,
  Waves,
  Zap,
  CloudRain,
  Flower,
  Info,
  Download
} from 'lucide-react';

// --- CONFIGURATION & TYPES ---

const API_KEY = process.env.API_KEY;

type ViewState = 'onboarding' | 'home' | 'meditate' | 'generating' | 'breathe' | 'journal' | 'player';
type AppLanguage = 'en' | 'fa';
type VoiceOption = 'Kore' | 'Zephyr' | 'Charon' | 'Fenrir' | 'Puck';
type AmbientType = 'none' | 'drone' | 'stream' | 'theta' | 'zen';

interface MeditationConfig {
  goal: string;
  duration: number;
  voice: VoiceOption;
  language: 'English' | 'Farsi';
}

interface SessionData {
  id: string;
  date: string;
  timestamp: number;
  config: MeditationConfig;
  script: string;
  title: string;
  durationSec: number;
  ambient: AmbientType;
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
  ambient?: AmbientType;
  audioBuffer?: ArrayBuffer | null;
  progressMessage: string;
  errorDetail?: string; // Added to store specific error messages
}

interface LyricLine {
  text: string;
  start: number;
  end: number;
  id: number;
}

interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  duration: number;
  isReady: boolean;
  currentTrackId: string | null;
  error: string | null;
  volume: number;
  ambientVolume: number;
  ambientType: AmbientType;
}

// --- TRANSLATIONS ---

const TRANSLATIONS = {
  en: {
    greeting_morning: "Good Morning",
    greeting_afternoon: "Good Afternoon",
    greeting_evening: "Good Evening",
    date_locale: 'en-US',
    new_session: "New Session",
    new_session_sub: "Generate a guided meditation",
    breathe: "Breathe",
    breathe_sub: "4-7-8 Breathing exercise",
    journal: "Journal",
    journal_sub: "History of your mindful moments",
    create_meditation: "Create Meditation",
    intention: "Intention",
    other: "Other",
    other_placeholder: "What would you like to focus on?",
    duration: "Duration",
    guide_voice: "Guide Voice",
    minutes: "Minutes",
    min_short: "min",
    generating_title: "Weaving your journey...",
    generating_ready: "Your journey awaits.",
    generating_failed: "Something went wrong.",
    generating_quota_error: "Daily AI limit reached. Please try again later.", // Added specific error msg
    generating_msg_script: "Weaving your session script...",
    generating_msg_voice: "Synthesizing voice guidance...",
    generating_msg_ready: "Your personalized meditation session has been created successfully.",
    begin_journey: "Begin Journey",
    back_dashboard: "Go back to Dashboard",
    now_playing: "Now Playing",
    tap_start: "Tap to start",
    session_ready: "Session Ready",
    creating: "Creating...",
    share_session: "Share Session",
    download_audio: "Download Audio",
    playing_from: "Playing from Session",
    breathe_title: "4-7-8 Breathing",
    breathe_desc: "Calm your mind and body",
    inhale: "Inhale",
    hold: "Hold",
    exhale: "Exhale",
    start: "Start",
    stop: "Stop",
    reset: "Reset",
    ready: "Ready",
    no_sessions: "No sessions yet. Start your first journey.",
    onboarding_title: "ZenMind AI",
    onboarding_desc: "Your personalized path to peace, powered by intelligence.",
    soundscapes: "Soundscapes",
    sound_none: "Silence",
    sound_drone: "Deep Space",
    sound_stream: "Flow",
    sound_theta: "Theta Waves",
    sound_zen: "Zen Garden",
    background_volume: "Background Volume",
    ai_sound_tooltip: "AI selected this soundscape for you",
    loading_breath_tip: "Take a deep breath while we prepare your session...",
    goals: {
      'Stress Relief': 'Stress Relief',
      'Better Sleep': 'Better Sleep',
      'Focus': 'Focus',
      'Anxiety': 'Anxiety',
      'Morning Energy': 'Morning Energy'
    }
  },
  fa: {
    greeting_morning: "صبح بخیر",
    greeting_afternoon: "عصر بخیر",
    greeting_evening: "شب بخیر",
    date_locale: 'fa-IR',
    new_session: "جلسه جدید",
    new_session_sub: "ایجاد مدیتیشن هدایت شده",
    breathe: "تنفس",
    breathe_sub: "تمرین تنفس ۴-۷-۸",
    journal: "دفترچه",
    journal_sub: "تاریخچه لحظات آگاهانه شما",
    create_meditation: "ساخت مدیتیشن",
    intention: "نیت",
    other: "دیگر",
    other_placeholder: "می‌خواهید روی چه چیزی تمرکز کنید؟",
    duration: "مدت زمان",
    guide_voice: "صدای راهنما",
    minutes: "دقیقه",
    min_short: "دقیقه",
    generating_title: "در حال بافتن سفر شما...",
    generating_ready: "سفر شما آماده است.",
    generating_failed: "مشکلی پیش آمد.",
    generating_quota_error: "محدودیت روزانه هوش مصنوعی تمام شد. لطفاً بعداً تلاش کنید.", // Added specific error msg
    generating_msg_script: "نوشتن متن جلسه...",
    generating_msg_voice: "تولید صدای راهنما...",
    generating_msg_ready: "جلسه مدیتیشن شخصی شما با موفقیت ایجاد شد.",
    begin_journey: "شروع سفر",
    back_dashboard: "بازگشت به داشبورد",
    now_playing: "در حال پخش",
    tap_start: "برای شروع ضربه بزنید",
    session_ready: "جلسه آماده است",
    creating: "در حال ساخت...",
    share_session: "اشتراک‌گذاری جلسه",
    download_audio: "دانلود فایل صوتی",
    playing_from: "پخش از جلسه",
    breathe_title: "تنفس ۴-۷-۸",
    breathe_desc: "آرامش ذهن و بدن",
    inhale: "دم",
    hold: "نگه دارید",
    exhale: "بازدم",
    start: "شروع",
    stop: "توقف",
    reset: "بازنشانی",
    ready: "آماده",
    no_sessions: "هنوز جلسه‌ای نیست. اولین سفر خود را شروع کنید.",
    onboarding_title: "ذن مایند هوشمند",
    onboarding_desc: "مسیر شخصی شما به سوی آرامش، با قدرت هوش مصنوعی.",
    soundscapes: "صداهای محیطی",
    sound_none: "سکوت",
    sound_drone: "فضای عمیق",
    sound_stream: "جریان آب",
    sound_theta: "امواج تتا",
    sound_zen: "باغ زن",
    background_volume: "صدای پس‌زمینه",
    ai_sound_tooltip: "هوش مصنوعی این صدا را برای شما انتخاب کرد",
    loading_breath_tip: "نفس عمیقی بکشید تا جلسه شما آماده شود...",
    goals: {
      'Stress Relief': 'کاهش استرس',
      'Better Sleep': 'خواب بهتر',
      'Focus': 'تمرکز',
      'Anxiety': 'اضطراب',
      'Morning Energy': 'انرژی صبحگاهی'
    }
  }
};

const VOICE_DETAILS = {
  'Kore': { desc_en: 'Soothing & Gentle', desc_fa: 'آرام‌بخش و ملایم' },
  'Zephyr': { desc_en: 'Soft & Airy', desc_fa: 'نرم و سبک' },
  'Charon': { desc_en: 'Deep & Grounded', desc_fa: 'عمیق و محکم' },
  'Fenrir': { desc_en: 'Resonant & Calm', desc_fa: 'طنین‌انداز و آرام' },
  'Puck': { desc_en: 'Clean & Clear', desc_fa: 'شفاف و واضح' },
};

// --- INDEXED DB SERVICE ---

class DBService {
  private dbName = 'ZenMindDB_V2';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror = () => reject("Database failed to open");
      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve();
      };
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio', { keyPath: 'id' });
        }
      };
    });
  }

  async saveSession(session: SessionData, audioBuffer: ArrayBuffer): Promise<void> {
    await this.performTransaction('sessions', 'readwrite', (store) => store.put(session));
    await this.performTransaction('audio', 'readwrite', (store) => store.put({ id: session.id, blob: audioBuffer }));
  }

  async getAllSessions(): Promise<SessionData[]> {
    return this.performTransaction('sessions', 'readonly', (store) => store.getAll());
  }

  async getSessionAudio(id: string): Promise<ArrayBuffer | undefined> {
    const data = await this.performTransaction('audio', 'readonly', (store) => store.get(id));
    return data?.blob;
  }

  private async performTransaction(storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<any> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

const dbService = new DBService();

// --- UTILS ---

function getGreeting(lang: AppLanguage) {
  const t = TRANSLATIONS[lang];
  const hour = new Date().getHours();
  if (hour < 12) return t.greeting_morning;
  if (hour < 18) return t.greeting_afternoon;
  return t.greeting_evening;
}

function getFormattedDate(lang: AppLanguage) {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString(TRANSLATIONS[lang].date_locale, options);
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: ArrayBuffer, ctx: AudioContext): Promise<AudioBuffer> {
  try {
    const bufferCopy = data.slice(0); 
    return await ctx.decodeAudioData(bufferCopy);
  } catch (e) {
    const pcmData = new Uint8Array(data);
    const sampleRate = 24000;
    const numChannels = 1;
    const byteLength = pcmData.length - (pcmData.length % 2);
    const dataInt16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, byteLength / 2);
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
}

// --- AUDIO SYNTHESIS UTILS ---
const createPinkNoise = (ctx: AudioContext) => {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0, b1, b2, b3, b4, b5, b6;
  b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
  for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11; 
      b6 = white * 0.115926;
  }
  return buffer;
};

// --- HOOKS ---

const useAudioPlayer = () => {
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    isLoading: false,
    duration: 0,
    isReady: false,
    currentTrackId: null,
    error: null,
    volume: 1.0,
    ambientVolume: 0.15,
    ambientType: 'none'
  });

  const ctxRef = useRef<AudioContext | null>(null);
  
  // Voice Nodes
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // Ambient Nodes
  const ambientNodesRef = useRef<AudioNode[]>([]);
  const ambientGainRef = useRef<GainNode | null>(null);
  const zenTimeoutRef = useRef<any>(null);

  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  
  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new AudioContextClass();
    }
    return ctxRef.current;
  }, []);

  const getCurrentTime = useCallback(() => {
    if (!bufferRef.current || !ctxRef.current) return 0;
    if (state.isPlaying) {
      const elapsed = ctxRef.current.currentTime - startTimeRef.current;
      return Math.min(Math.max(0, elapsed), bufferRef.current.duration);
    } else {
      return pauseOffsetRef.current;
    }
  }, [state.isPlaying]);

  // Ambient Synthesis Engine
  const stopAmbient = useCallback(() => {
    // Stop Zen generator
    if (zenTimeoutRef.current) {
        clearTimeout(zenTimeoutRef.current);
        zenTimeoutRef.current = null;
    }

    // Stop continuous nodes
    ambientNodesRef.current.forEach(node => {
      try { (node as any).stop && (node as any).stop(); } catch(e){}
      try { node.disconnect(); } catch(e){}
    });
    ambientNodesRef.current = [];

    // Disconnect master ambient gain to silence trails of zen bells
    if (ambientGainRef.current) {
        try { ambientGainRef.current.disconnect(); } catch(e) {}
        ambientGainRef.current = null;
    }
  }, []);

  const playAmbient = useCallback(() => {
    if (state.ambientType === 'none') return;
    stopAmbient();
    const ctx = getCtx();
    
    if (!ambientGainRef.current) {
      ambientGainRef.current = ctx.createGain();
      ambientGainRef.current.connect(ctx.destination);
    }
    ambientGainRef.current.gain.setValueAtTime(state.ambientVolume, ctx.currentTime);

    const nodes: AudioNode[] = [];

    if (state.ambientType === 'drone') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.frequency.value = 55;
      osc2.frequency.value = 55.5;
      gain.gain.value = 0.5;
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ambientGainRef.current);
      osc1.start();
      osc2.start();
      nodes.push(osc1, osc2, gain);
    } 
    else if (state.ambientType === 'stream') {
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = createPinkNoise(ctx);
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.1;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      noise.connect(filter);
      filter.connect(ambientGainRef.current);
      noise.start();
      lfo.start();
      nodes.push(noise, filter, lfo, lfoGain);
    }
    else if (state.ambientType === 'theta') {
      const merger = ctx.createChannelMerger(2);
      const leftOsc = ctx.createOscillator();
      leftOsc.frequency.value = 200;
      const leftGain = ctx.createGain();
      leftGain.gain.value = 0.5;
      const rightOsc = ctx.createOscillator();
      rightOsc.frequency.value = 204;
      const rightGain = ctx.createGain();
      rightGain.gain.value = 0.5;
      const pannerL = ctx.createStereoPanner();
      pannerL.pan.value = -1;
      leftOsc.connect(leftGain).connect(pannerL).connect(ambientGainRef.current);
      const pannerR = ctx.createStereoPanner();
      pannerR.pan.value = 1;
      rightOsc.connect(rightGain).connect(pannerR).connect(ambientGainRef.current);
      leftOsc.start();
      rightOsc.start();
      nodes.push(leftOsc, leftGain, pannerL, rightOsc, rightGain, pannerR);
    }
    else if (state.ambientType === 'zen') {
        const scheduleZenNote = () => {
             const osc = ctx.createOscillator();
             const gain = ctx.createGain();
             const freqs = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
             const freq = freqs[Math.floor(Math.random() * freqs.length)];
             const octave = Math.random() > 0.7 ? 2 : Math.random() > 0.4 ? 1 : 0.5;
             osc.frequency.value = freq * octave;
             osc.type = 'sine';
             const now = ctx.currentTime;
             gain.gain.setValueAtTime(0, now);
             gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
             gain.gain.exponentialRampToValueAtTime(0.001, now + 4);
             osc.connect(gain);
             if (ambientGainRef.current) {
                 gain.connect(ambientGainRef.current);
             }
             osc.start(now);
             osc.stop(now + 5);
             const nextTime = 2000 + Math.random() * 4000;
             zenTimeoutRef.current = setTimeout(() => scheduleZenNote(), nextTime);
        };
        scheduleZenNote();
    }

    ambientNodesRef.current = nodes;
  }, [state.ambientType, state.ambientVolume, getCtx, stopAmbient]);

  useEffect(() => {
    if (ambientGainRef.current && ctxRef.current) {
      ambientGainRef.current.gain.setTargetAtTime(state.ambientVolume, ctxRef.current.currentTime, 0.1);
    }
  }, [state.ambientVolume]);

  const setAmbientType = useCallback((type: AmbientType) => {
    setState(prev => ({ ...prev, ambientType: type }));
  }, []);
  
  useEffect(() => {
    if (state.isPlaying) {
      playAmbient();
    } else {
      stopAmbient();
    }
  }, [state.ambientType, state.isPlaying]); 

  const load = useCallback(async (audioData: ArrayBuffer | string, trackId: string) => {
    try {
      if (state.currentTrackId === trackId && state.isReady) return;
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
        sourceRef.current = null;
      }
      setState(prev => ({ ...prev, isLoading: true, isReady: false, currentTrackId: trackId, error: null, isPlaying: false }));
      const ctx = getCtx();
      let arrayBuffer: ArrayBuffer;
      if (typeof audioData === 'string') {
        arrayBuffer = decodeBase64(audioData).buffer;
      } else {
        arrayBuffer = audioData;
      }
      const buffer = await decodeAudioData(arrayBuffer, ctx);
      bufferRef.current = buffer;
      pauseOffsetRef.current = 0;
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        isReady: true, 
        duration: buffer.duration, 
        isPlaying: false, 
        error: null
      }));
    } catch (e: any) {
      console.error("Audio load failed", e);
      setState(prev => ({ ...prev, isLoading: false, currentTrackId: null, error: "Failed to load audio" }));
    }
  }, [state.currentTrackId, state.isReady, getCtx]);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setState(prev => ({ ...prev, volume: clamped }));
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(clamped, getCtx().currentTime);
    }
  }, [getCtx]);

  const setAmbientVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setState(prev => ({ ...prev, ambientVolume: clamped }));
  }, []);

  const play = useCallback(async () => {
    try {
      if (!bufferRef.current) return;
      const ctx = getCtx();
      if (ctx.state === 'suspended') await ctx.resume();
      if (sourceRef.current) {
          try { sourceRef.current.stop(); sourceRef.current.disconnect(); } catch(e) {}
      }
      if (!gainNodeRef.current) {
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.gain.value = state.volume;
        gainNodeRef.current.connect(ctx.destination);
      }
      const source = ctx.createBufferSource();
      source.buffer = bufferRef.current;
      source.connect(gainNodeRef.current);
      if (pauseOffsetRef.current >= bufferRef.current.duration - 0.1) {
        pauseOffsetRef.current = 0;
      }
      startTimeRef.current = ctx.currentTime - pauseOffsetRef.current;
      source.start(0, pauseOffsetRef.current);
      sourceRef.current = source;
      source.onended = () => {
         const elapsed = ctx.currentTime - startTimeRef.current;
         if (elapsed >= (bufferRef.current?.duration || 0)) {
            setState(prev => ({ ...prev, isPlaying: false }));
            pauseOffsetRef.current = 0;
            stopAmbient(); 
         }
      };
      setState(prev => ({ ...prev, isPlaying: true }));
    } catch (e) {
      console.error("Playback error", e);
      setState(prev => ({ ...prev, error: "Playback failed" }));
    }
  }, [getCtx, state.volume, playAmbient, stopAmbient]);

  const pause = useCallback(() => {
    if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch (e) {}
        sourceRef.current = null;
    }
    const ctx = getCtx();
    pauseOffsetRef.current = ctx.currentTime - startTimeRef.current;
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [getCtx]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
        sourceRef.current = null;
    }
    pauseOffsetRef.current = 0;
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);
  
  const seek = useCallback((time: number) => {
      const buffer = bufferRef.current;
      if (!buffer) return;
      const newTime = Math.max(0, Math.min(time, buffer.duration));
      pauseOffsetRef.current = newTime;
      if (state.isPlaying) play(); 
  }, [state.isPlaying, play]);
  
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
      }
      stopAmbient();
    };
  }, []);

  return { 
    ...state, 
    load, 
    play, 
    pause, 
    stop, 
    seek, 
    setVolume, 
    getCurrentTime,
    setAmbientVolume,
    setAmbientType 
  };
};

// --- SERVICES ---

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async generateGreeting(lang: AppLanguage): Promise<string> {
    try {
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
      const languageInstruction = lang === 'fa' ? 'Write in Farsi (Persian).' : 'Write in English.';
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Write a very short, warm, poetic greeting for a user opening a mindfulness app in the ${timeOfDay}. ${languageInstruction} Max 8 words. No quotation marks.`,
      });
      let text = response.text?.trim() || "";
      return text || `${getGreeting(lang)}.`;
    } catch (e) {
      return `${getGreeting(lang)}.`;
    }
  }

  // --- CLIENT-SIDE POST-PROCESSING FOR SHORT LINES ---
  private enforceShortLines(script: string): string {
    return script.split('\n').flatMap(line => {
      const words = line.trim().split(/\s+/);
      if (words.length <= 8) return [line.trim()];
      const chunks = [];
      let currentChunk: string[] = [];
      words.forEach(word => {
        currentChunk.push(word);
        if (currentChunk.length >= 6 || /[.,;!?؟]$/.test(word)) {
           chunks.push(currentChunk.join(' '));
           currentChunk = [];
        }
      });
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
      }
      return chunks;
    }).filter(l => l.length > 0).join('\n');
  }

  async generateMeditationScript(config: MeditationConfig): Promise<{script: string, ambient: AmbientType}> {
    const targetWordCount = Math.max(config.duration * 100, 100); 

    const languageInstruction = config.language === 'Farsi' 
      ? 'Write the script in Farsi (Persian). STRICTLY do not use English characters, words or numbers. Write numbers in Farsi script (e.g. یک, دو). Use short, poetic phrases suitable for meditation.' 
      : 'Write the script in English.';

    const prompt = `
    You are an expert meditation guide with a warm, empathetic, and deeply human presence.
    Write a script for a ${config.duration}-minute guided meditation focused on "${config.goal}".
    
    Also, choose the BEST background ambient sound for this meditation from this list:
    - drone (good for deep sleep, anxiety, space)
    - stream (good for nature, flow, relaxation)
    - theta (good for focus, deep meditation, brainwaves)
    - zen (good for general mindfulness, bells)

    STRICT CONSTRAINTS:
    - ${languageInstruction}
    - Target Word Count: Approximately ${targetWordCount} words.
    - Format: MICRO-LINES. MAX 3-6 WORDS per line. 
    - Treat this like karaoke lyrics. 
    - Split every sentence into small, breath-sized phrases on new lines.
    - NEVER write paragraphs.
    - Tone: Deeply emotional, grounding, poetic, and soothing. 
    - Do not include stage directions like [pause] or *music starts*, just the spoken words.
    `;

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING },
            ambientSound: { type: Type.STRING, enum: ['drone', 'stream', 'theta', 'zen', 'none'] }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    const rawScript = json.script || "Rest in this moment.";
    
    const formattedScript = this.enforceShortLines(rawScript);

    return {
      script: formattedScript,
      ambient: (json.ambientSound as AmbientType) || 'none'
    };
  }

  async generateSpeech(text: string, voiceName: string): Promise<ArrayBuffer> {
    const cleanText = text.replace(/[\*\#\[\]]/g, '').trim();
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });
      const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64) throw new Error("No audio data returned from API.");
      return decodeBase64(base64).buffer;
    } catch (e: any) {
      console.error("TTS Error:", e);
      throw new Error("Failed to generate voice audio.");
    }
  }
}

const gemini = new GeminiService();

// --- COMPONENTS ---

const Card = ({ children, className = "", onClick }: any) => (
  <div 
    onClick={onClick}
    className={`bg-white/60 dark:bg-slate-900/30 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 transition-all duration-300 shadow-sm dark:shadow-none ${className}`}
  >
    {children}
  </div>
);

const Button = ({ children, variant = 'primary', onClick, disabled, className = "", size = "md", type="button" }: any) => {
  const base = "rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95";
  const sizes = {
    sm: "py-2 px-5 text-sm",
    md: "py-4 px-8 w-full",
    lg: "py-5 px-10 text-lg w-full"
  };
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 shadow-xl shadow-indigo-500/10 dark:shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm dark:shadow-lg disabled:opacity-50",
    ghost: "bg-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size as keyof typeof sizes]} ${variants[variant as keyof typeof variants]} ${className}`}>
      {children}
    </button>
  );
};

const Toast = ({ msg, onDismiss }: { msg: ToastMessage, onDismiss: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [msg, onDismiss]);

  const bg = msg.type === 'error' 
    ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/20 dark:border-rose-500/50 dark:text-white' 
    : 'bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-500/20 dark:border-teal-500/50 dark:text-white';

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] ${bg} border backdrop-blur-2xl px-6 py-3 rounded-full shadow-2xl flex items-center justify-between animate-fade-in min-w-[300px]`}>
      <span className="font-medium text-sm pr-2">{msg.message}</span>
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100"><X size={16} /></button>
    </div>
  );
};

const GenerationProgressCard = ({ 
  task, 
  onPlay, 
  onDismiss,
  onViewDetails,
  lang
}: { 
  task: GenerationTask, 
  onPlay: () => void, 
  onDismiss: () => void,
  onViewDetails: () => void,
  lang: AppLanguage
}) => {
  if (!task) return null;
  const t = TRANSLATIONS[lang];
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
           <div className={`absolute -inset-0.5 rounded-[2rem] opacity-30 blur-xl transition-all duration-700 ${
            isReady ? 'bg-teal-500' : isFailed ? 'bg-rose-500' : 'bg-indigo-500'
           }`}></div>
          
           <div className="relative bg-white/90 dark:bg-black/60 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[2rem] p-3 pl-4 flex items-center gap-4 shadow-2xl">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isReady ? 'bg-teal-500 text-white' : 
                isFailed ? 'bg-rose-500 text-white' : 
                'bg-slate-100 text-indigo-500 dark:bg-white/10 dark:text-indigo-300'
              }`}>
                {isReady ? <Play size={18} fill="currentColor" className="ml-0.5 rtl:mr-0.5 rtl:ml-0" /> : 
                 isFailed ? <AlertCircle size={18} /> :
                 <Loader2 size={18} className="animate-spin" />
                }
              </div>

              <div className="flex-1 min-w-0 text-left rtl:text-right">
                <h4 className="text-slate-900 dark:text-white font-medium text-sm truncate">
                  {isReady ? t.session_ready : isFailed ? "Failed" : t.creating}
                </h4>
                <p className="text-xs text-slate-500 dark:text-white/50 truncate mt-0.5">
                  {isReady ? t.tap_start : task.progressMessage}
                </p>
                {isFailed && task.errorDetail && (
                   <p className="text-[10px] text-rose-500 mt-1">{task.errorDetail}</p>
                )}
              </div>

              {isReady ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); onPlay(); }}
                  className="px-5 py-2 bg-slate-900 text-white dark:bg-white dark:text-black text-xs font-bold rounded-full hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
                >
                  {lang === 'fa' ? 'باز کردن' : 'Open'}
                </button>
              ) : isFailed ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-400 dark:text-white/50 hover:text-slate-900 dark:hover:text-white"
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

const MiniPlayer = ({ title, player, onClick, lang }: { title: string, player: ReturnType<typeof useAudioPlayer>, onClick: () => void, lang: AppLanguage }) => {
  if (!player.isReady || !player.isPlaying) return null;
  const t = TRANSLATIONS[lang];
  
  return (
      <div 
        className="fixed bottom-24 md:bottom-28 left-4 right-4 z-40 animate-slide-up cursor-pointer flex justify-center"
        onClick={onClick}
      >
        <div className="w-full max-w-sm bg-white/90 dark:bg-black/60 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[2rem] p-2 pl-3 flex items-center gap-3 shadow-2xl">
             <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0">
               <Activity size={16} className="text-teal-500 dark:text-teal-400" />
             </div>
             
             <div className="flex-1 min-w-0 text-left rtl:text-right">
               <h4 className="text-slate-900 dark:text-white text-xs font-medium truncate">{t.now_playing}</h4>
               <p className="text-[10px] text-slate-500 dark:text-white/60 truncate">{title}</p>
             </div>
             
             <button 
               onClick={(e) => { e.stopPropagation(); player.isPlaying ? player.pause() : player.play(); }}
               className="w-10 h-10 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black flex items-center justify-center hover:bg-slate-700 dark:hover:bg-slate-200"
             >
               {player.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5 rtl:mr-0.5 rtl:ml-0" />}
             </button>
        </div>
      </div>
  );
};

const HomeScreen = ({ onNavigate, greeting, lang }: any) => {
  const t = TRANSLATIONS[lang as AppLanguage];
  
  return (
  <div className="flex flex-col min-h-full p-6 pb-48 animate-fade-in max-w-lg mx-auto">
    <header className="mt-8 mb-8 flex justify-between items-start">
      <div>
        <p className="text-xs font-medium tracking-widest text-indigo-600 dark:text-indigo-400 uppercase mb-2 opacity-80">{getFormattedDate(lang)}</p>
        <h1 className="text-4xl font-light text-slate-900 dark:text-white leading-tight min-h-[1.2em]">
          {greeting ? greeting : <span className="animate-pulse bg-slate-200 dark:bg-white/10 rounded w-2/3 block h-full">&nbsp;</span>}
        </h1>
      </div>
    </header>

    <div className="grid grid-cols-1 gap-4">
      <button 
        onClick={() => onNavigate('meditate')}
        className="group relative h-32 rounded-[2rem] bg-white border border-slate-200 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:border-white/5 backdrop-blur-2xl transition-all duration-300 overflow-hidden flex items-center px-8 gap-6 active:scale-98 shadow-xl shadow-indigo-100/50 dark:shadow-none"
      >
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shrink-0">
           <Brain size={28} className="text-indigo-500 dark:text-indigo-300" />
        </div>
        <div className="text-left rtl:text-right flex-1">
           <span className="text-lg font-medium text-slate-900 dark:text-white block">{t.new_session}</span>
           <span className="text-sm text-slate-500 dark:text-slate-400">{t.new_session_sub}</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 rtl:translate-x-2 rtl:group-hover:translate-x-0">
           {lang === 'fa' ? <ChevronLeft className="text-slate-400 dark:text-white/50" /> : <ChevronRight className="text-slate-400 dark:text-white/50" />}
        </div>
      </button>

      <button 
        onClick={() => onNavigate('breathe')}
        className="group relative h-32 rounded-[2rem] bg-white border border-slate-200 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 dark:border-white/5 backdrop-blur-2xl transition-all duration-300 overflow-hidden flex items-center px-8 gap-6 active:scale-98 shadow-xl shadow-teal-100/50 dark:shadow-none"
      >
        <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shrink-0">
           <Wind size={28} className="text-teal-500 dark:text-teal-300" />
        </div>
        <div className="text-left rtl:text-right flex-1">
           <span className="text-lg font-medium text-slate-900 dark:text-white block">{t.breathe}</span>
           <span className="text-sm text-slate-500 dark:text-slate-400">{t.breathe_sub}</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 rtl:translate-x-2 rtl:group-hover:translate-x-0">
           {lang === 'fa' ? <ChevronLeft className="text-slate-400 dark:text-white/50" /> : <ChevronRight className="text-slate-400 dark:text-white/50" />}
        </div>
      </button>
    </div>
  </div>
)};

const GeneratorScreen = ({ onGenerate, onBack, lang }: any) => {
  const t = TRANSLATIONS[lang as AppLanguage];
  const [config, setConfig] = useState<MeditationConfig>({
    goal: 'Stress Relief',
    duration: 3,
    voice: 'Kore',
    language: lang === 'fa' ? 'Farsi' : 'English'
  });
  const [isCustomGoal, setIsCustomGoal] = useState(false);

  // Map English keys to translated values
  const goalKeys = Object.keys(t.goals);
  const voices: VoiceOption[] = ['Kore', 'Zephyr', 'Charon', 'Fenrir', 'Puck'];

  // Update config language if global lang changes
  useEffect(() => {
    setConfig(prev => ({ ...prev, language: lang === 'fa' ? 'Farsi' : 'English' }));
  }, [lang]);

  return (
    <div className="flex flex-col min-h-full p-6 pb-48 animate-fade-in max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-8 mt-2">
        <button onClick={onBack} className="p-3 bg-white/50 dark:bg-white/5 rounded-full hover:bg-white/80 dark:hover:bg-white/10 backdrop-blur-md transition-colors text-slate-900 dark:text-white">
           {lang === 'fa' ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        </button>
        <h2 className="text-xl font-light text-slate-900 dark:text-white">{t.create_meditation}</h2>
      </div>

      <div className="space-y-10">
        <section>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block mx-1">{t.intention}</label>
          <div className="flex flex-wrap gap-2">
            {goalKeys.map(key => (
              <button
                key={key}
                onClick={() => {
                  setIsCustomGoal(false);
                  setConfig({...config, goal: key});
                }}
                className={`px-5 py-2.5 rounded-full text-sm transition-all duration-300 ${
                  !isCustomGoal && config.goal === key 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-lg font-medium' 
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:bg-white/5 dark:border-transparent dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
                }`}
              >
                {t.goals[key as keyof typeof t.goals]}
              </button>
            ))}
            <button
              onClick={() => {
                setIsCustomGoal(true);
                setConfig({...config, goal: ''});
              }}
              className={`px-5 py-2.5 rounded-full text-sm transition-all duration-300 flex items-center gap-1 ${
                isCustomGoal
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-lg font-medium' 
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:bg-white/5 dark:border-transparent dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              <Plus size={14} /> {t.other}
            </button>
          </div>
          
          {isCustomGoal && (
            <div className="mt-3 animate-fade-in">
              <input
                type="text"
                value={config.goal}
                onChange={(e) => setConfig({...config, goal: e.target.value})}
                placeholder={t.other_placeholder}
                className="w-full bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-slate-500 rounded-2xl px-5 py-4 focus:outline-none focus:border-teal-500/50 focus:bg-white dark:focus:bg-white/10 transition-all text-sm"
                autoFocus
              />
            </div>
          )}
        </section>

        <section>
          <div className="flex justify-between items-center mb-4 mx-1">
             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.duration}</label>
             <span className="text-teal-600 dark:text-teal-400 font-medium text-sm flex items-center gap-1">
                <Clock size={12} /> {config.duration} {t.minutes}
             </span>
          </div>
          
          {/* LTR Container for Slider to fix RTL direction issue */}
          <div className="px-2" dir="ltr">
             <input 
               type="range" 
               min="1" 
               max="10" 
               step="1"
               value={config.duration}
               onChange={(e) => setConfig({...config, duration: parseInt(e.target.value)})}
               className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-500 hover:accent-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
             />
             <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest mt-2">
                <span>1 {t.min_short}</span>
                <span>5 {t.min_short}</span>
                <span>10 {t.min_short}</span>
             </div>
          </div>
        </section>

        <section>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block mx-1">{t.guide_voice}</label>
          <div className="grid grid-cols-1 gap-2">
             {voices.map(v => {
               const detail = VOICE_DETAILS[v];
               return (
               <button 
                 key={v}
                 onClick={() => setConfig({...config, voice: v})}
                 className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 border ${
                    config.voice === v 
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white/10 dark:border-white/20 dark:text-white' 
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                 }`}
               >
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.voice === v ? 'bg-white text-black' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                    <Volume2 size={16} />
                 </div>
                 <div className="flex flex-col text-left rtl:text-right">
                    <span className="text-sm font-bold uppercase tracking-wider">{v}</span>
                    <span className="text-xs opacity-70">{lang === 'fa' ? detail.desc_fa : detail.desc_en}</span>
                 </div>
                 <div className="ml-auto rtl:mr-auto">
                    {config.voice === v && <div className="w-2 h-2 rounded-full bg-teal-500"></div>}
                 </div>
               </button>
             )})}
          </div>
        </section>

        <Button 
          onClick={() => {
             const finalGoal = isCustomGoal ? config.goal : t.goals[config.goal as keyof typeof t.goals] || config.goal;
             onGenerate({...config, goal: finalGoal});
          }} 
          disabled={!config.goal.trim()}
          className="mt-8 shadow-2xl shadow-indigo-500/20"
        >
          <Sparkles size={18} />
          <span>{t.create_meditation}</span>
        </Button>
      </div>
    </div>
  );
};

const GeneratingScreen = ({ 
  task, 
  onBackToDash,
  onPlay,
  lang 
}: { 
  task: GenerationTask | null, 
  onBackToDash: () => void,
  onPlay: () => void,
  lang: AppLanguage
}) => {
  if (!task) return null;
  const t = TRANSLATIONS[lang];
  const isReady = task.status === 'ready';
  const isFailed = task.status === 'failed';
  const [progress, setProgress] = useState(0);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');

  // Breathing Loop
  useEffect(() => {
    if (!task || isReady || isFailed) return;
    
    const cycle = () => {
      setBreathPhase('Inhale');
      setTimeout(() => {
        setBreathPhase('Hold');
        setTimeout(() => {
          setBreathPhase('Exhale');
        }, 4000); 
      }, 4000); 
    };
    
    cycle();
    const interval = setInterval(cycle, 12000); // 4-4-4 cycle for loading ease
    return () => clearInterval(interval);
  }, [task?.status, isReady, isFailed]);

  // Progress Simulation
  useEffect(() => {
    if (!task || isFailed) return;
    let target = 0;
    if (task.status === 'scripting') target = 40;
    if (task.status === 'synthesizing') target = 90;
    if (isReady) target = 100;

    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= target) return p;
        const diff = target - p;
        const step = Math.max(0.2, diff * 0.05); 
        return Math.min(target, p + step);
      });
    }, 50);
    return () => clearInterval(timer);
  }, [task?.status, isReady, isFailed]);

  let displayMessage = task.progressMessage;
  if (task.status === 'scripting') displayMessage = t.generating_msg_script;
  if (task.status === 'synthesizing') displayMessage = t.generating_msg_voice;
  if (isReady) displayMessage = t.generating_msg_ready;

  // Helper to translate breath phase text
  const getBreathDisplay = (phase: string) => {
    if (phase === 'Inhale') return t.inhale;
    if (phase === 'Hold') return t.hold;
    if (phase === 'Exhale') return t.exhale;
    return phase;
  };

  // Dynamic Styles based on breath phase
  const orbScale = breathPhase === 'Inhale' ? 'scale-125' : breathPhase === 'Exhale' ? 'scale-75' : 'scale-100';
  const orbColor = breathPhase === 'Inhale' ? 'bg-teal-500/30' : breathPhase === 'Hold' ? 'bg-indigo-500/30' : 'bg-slate-500/30';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-center animate-fade-in overflow-hidden transition-colors duration-700">
       <div className="absolute inset-0 z-0 pointer-events-none transition-all duration-1000">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full blur-[100px] transition-colors duration-1000 ${
            isReady ? 'bg-teal-500/20' : isFailed ? 'bg-rose-500/20' : 'bg-indigo-500/10'
          }`}></div>
       </div>

       <div className="relative z-10 flex flex-col items-center max-w-lg w-full p-8">
          
          <div className="w-64 h-64 mb-10 relative flex items-center justify-center">
             {isReady ? (
               <div className="w-24 h-24 bg-teal-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(45,212,191,0.5)] animate-scale-in">
                  <Play size={40} fill="currentColor" className="text-white ml-1 rtl:mr-1 rtl:ml-0" />
               </div>
             ) : isFailed ? (
               <div className="w-24 h-24 bg-rose-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(244,63,94,0.5)] animate-scale-in">
                  <AlertCircle size={40} className="text-white" />
               </div>
             ) : (
               <div className="relative flex items-center justify-center w-full h-full">
                  {/* Breathing Orb */}
                  <div className={`absolute inset-0 rounded-full border border-slate-300 dark:border-white/10 transition-transform duration-[4000ms] ease-in-out ${orbScale} opacity-50`}></div>
                  <div className={`w-32 h-32 rounded-full backdrop-blur-md border border-slate-200 dark:border-white/10 flex items-center justify-center transition-all duration-[4000ms] ease-in-out ${orbScale} ${orbColor}`}>
                     <div className={`w-full h-full rounded-full opacity-50 mix-blend-overlay bg-gradient-to-tr from-white/40 to-transparent`}></div>
                  </div>
                  <span className="absolute text-xl font-light tracking-[0.2em] uppercase text-slate-400 dark:text-white/60 transition-all duration-1000">
                     {getBreathDisplay(breathPhase)}
                  </span>
               </div>
             )}
          </div>

          <div className="space-y-2 mb-12">
             <h2 className="text-3xl font-light text-slate-900 dark:text-white">
                {isReady ? t.generating_ready : isFailed ? t.generating_failed : `${Math.round(progress)}%`}
             </h2>
             <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed text-sm">
                {isReady ? displayMessage : isFailed ? (task.errorDetail || "Please try again.") : t.loading_breath_tip}
             </p>
             {!isReady && !isFailed && (
                <p className="text-xs text-slate-400 dark:text-slate-600 animate-pulse uppercase tracking-wider mt-4">
                   {displayMessage}
                </p>
             )}
          </div>

          {isReady ? (
            <Button onClick={onPlay} className="shadow-[0_0_30px_rgba(45,212,191,0.3)]">
               {t.begin_journey}
            </Button>
          ) : (
            <button 
               onClick={onBackToDash}
               className="px-8 py-3 bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-full text-sm text-slate-500 dark:text-white/80 backdrop-blur-md transition-all"
            >
               {t.back_dashboard}
            </button>
          )}
       </div>
    </div>
  );
};

const PlayerScreen = ({ 
  session,
  audioBuffer,
  onBack, 
  player,
  lang 
}: { 
  session: SessionData,
  audioBuffer: ArrayBuffer | null,
  onBack: () => void,
  player: ReturnType<typeof useAudioPlayer>,
  lang: AppLanguage
}) => {
  const t = TRANSLATIONS[lang];
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const timeLabelRef = useRef<HTMLDivElement>(null);
  const durationLabelRef = useRef<HTMLDivElement>(null);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showSoundscape, setShowSoundscape] = useState(false);
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const lyrics: LyricLine[] = useMemo(() => {
    const lines = session.script.split('\n').filter(l => l.trim().length > 0);
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
  }, [session.script, player.duration]);

  useEffect(() => {
    if (audioBuffer && session.id) {
      player.load(audioBuffer, session.id);
      
      // Auto-set ambient sound preference from session
      if (session.ambient && session.ambient !== 'none') {
         player.setAmbientType(session.ambient);
         setShowAiTooltip(true);
         setTimeout(() => setShowAiTooltip(false), 4000);
      } else {
         player.setAmbientType('none');
      }
    }
  }, [audioBuffer, session.id]);

  useEffect(() => {
    let animId: number;
    const update = () => {
       if (!isDragging) {
         const time = player.getCurrentTime();
         const percent = player.duration > 0 ? (time / player.duration) * 100 : 0;
         
         if (progressBarRef.current) {
           progressBarRef.current.style.width = `${percent}%`;
         }
         
         if (timeLabelRef.current) {
           const m = Math.floor(time / 60);
           const s = Math.floor(time % 60).toString().padStart(2, '0');
           timeLabelRef.current.innerText = `${m}:${s}`;
         }
         
         const currentLineIndex = lyrics.findIndex(l => time >= l.start && time < l.end);
         if (currentLineIndex !== -1 && currentLineIndex !== activeLineIndex) {
            setActiveLineIndex(currentLineIndex);
         }
       } else {
         if (progressBarRef.current) {
           progressBarRef.current.style.width = `${dragProgress}%`;
         }
         if (timeLabelRef.current) {
           const time = (dragProgress / 100) * player.duration;
           const m = Math.floor(time / 60);
           const s = Math.floor(time % 60).toString().padStart(2, '0');
           timeLabelRef.current.innerText = `${m}:${s}`;
         }
       }
       
       if (durationLabelRef.current && player.duration > 0) {
          const m = Math.floor(player.duration / 60);
          const s = Math.floor(player.duration % 60).toString().padStart(2, '0');
          durationLabelRef.current.innerText = `-${m}:${s}`;
       }

       animId = requestAnimationFrame(update);
    };
    
    if (player.isReady) {
      animId = requestAnimationFrame(update);
    }
    
    return () => cancelAnimationFrame(animId);
  }, [player.isPlaying, player.isReady, player.duration, lyrics, activeLineIndex, isDragging, dragProgress]);

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

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    updateDrag(e);
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (isDragging) updateDrag(e);
  };

  const handleDragEnd = (e: MouseEvent | TouchEvent) => {
    if (isDragging) {
      setIsDragging(false);
      const time = (dragProgress / 100) * player.duration;
      player.seek(time);
    }
  };

  const updateDrag = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const rect = (e.target as HTMLElement).closest('.progress-container')?.getBoundingClientRect();
    if (rect) {
      const x = lang === 'fa' ? rect.right - clientX : clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setDragProgress(percent);
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: `Meditation: ${session.title}`,
      text: `${session.title} - ZenMind Meditation\n${url}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        navigator.clipboard.writeText(`${shareData.text}\n\n${session.script}`);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
    setShowMenu(false);
  };

  const handleDownload = () => {
    if (!audioBuffer) return;
    const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.replace(/\s+/g, '_')}_ZenMind.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-black z-50 font-sans overflow-hidden transition-colors duration-500">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none opacity-50">
         <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] bg-indigo-200/40 dark:bg-indigo-600/30 blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-20%] right-[-20%] w-[120%] h-[120%] bg-teal-200/40 dark:bg-teal-600/30 blur-[120px] animation-delay-2000"></div>
         <div className="absolute top-[40%] left-[20%] w-[80%] h-[80%] bg-fuchsia-200/30 dark:bg-fuchsia-600/10 blur-[150px] animate-blob"></div>
      </div>

      {/* Top Bar - Absolute */}
      <div className="absolute top-0 left-0 right-0 z-40 flex justify-between items-center px-6 pt-6 pb-2 bg-gradient-to-b from-slate-50/80 via-slate-50/0 to-transparent dark:from-black/80 dark:via-black/0">
         <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md text-slate-900 dark:text-white/80 active:scale-95 transition-transform">
           {lang === 'fa' ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
         </button>
         <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/50 font-bold">{t.playing_from}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{session.title}</span>
         </div>
         <div className="relative">
           <button 
             onClick={() => setShowMenu(!showMenu)} 
             className="w-10 h-10 flex items-center justify-center rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md text-slate-900 dark:text-white/80 active:scale-95 transition-transform"
            >
             <MoreHorizontal size={20} />
           </button>
           
           {showMenu && (
             <div className="absolute right-0 rtl:left-0 rtl:right-auto top-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl p-2 w-56 shadow-2xl animate-fade-in backdrop-blur-xl z-50">
               <button 
                 onClick={handleShare}
                 className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-left rtl:text-right"
               >
                 <Share2 size={16} />
                 {t.share_session}
               </button>
               <button 
                 onClick={handleDownload}
                 className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-left rtl:text-right"
               >
                 <Download size={16} />
                 {t.download_audio}
               </button>
             </div>
           )}
         </div>
      </div>

      {/* Lyrics Area (Main Content) - Absolute Inset */}
      <div className="absolute inset-0 z-10 overflow-hidden">
         <div 
           ref={lyricsContainerRef} 
           className="h-full overflow-y-auto no-scrollbar px-8 pt-32 pb-96 space-y-10 text-center" 
         >
            {lyrics.map((line, i) => {
               const isActive = i === activeLineIndex;
               return (
                  <p 
                    key={i}
                    dir="auto" 
                    className={`transition-all duration-700 ease-out origin-center
                      ${isActive 
                        ? 'text-3xl md:text-4xl font-bold text-slate-900 dark:text-white scale-100 opacity-100 blur-0' 
                        : 'text-2xl md:text-3xl font-semibold text-slate-400 dark:text-white/40 scale-95 opacity-40 blur-[1px]'
                      }`}
                  >
                    {line.text}
                  </p>
               );
            })}
         </div>
      </div>

      {/* Liquid Glass Player Controls (Bottom Sheet) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pt-6 pb-10 px-8 bg-white/20 dark:bg-black/40 backdrop-blur-xl border-t border-white/20 dark:border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all duration-500">
        
        {/* Progress Bar */}
        <div 
          className="progress-container group relative h-3 w-full mb-3 cursor-pointer flex items-center" 
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
           <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
             <div 
                ref={progressBarRef} 
                className="h-full bg-slate-800 dark:bg-white/90 rounded-full w-0 transition-all duration-75 relative ltr:left-0 rtl:right-0"
                style={{ [lang === 'fa' ? 'right' : 'left']: 0 }}
             ></div>
           </div>
           
           {/* Scrubber Knob */}
           <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900 dark:bg-white rounded-full shadow-lg transition-transform duration-100 scale-0 group-hover:scale-100"
              style={{ 
                [lang === 'fa' ? 'right' : 'left']: `${isDragging ? dragProgress : (player.duration > 0 ? (player.getCurrentTime() / player.duration * 100) : 0)}%` 
              }}
           ></div>
        </div>
        
        {/* Time Labels */}
        <div className="flex justify-between text-[10px] font-medium text-slate-400 dark:text-white/40 mb-6 font-mono tracking-wider">
           <span ref={timeLabelRef} style={{direction: 'ltr'}}>0:00</span>
           <span ref={durationLabelRef} style={{direction: 'ltr'}}>-0:00</span>
        </div>

        {/* Media Controls */}
        <div className="flex items-center justify-between max-w-xs mx-auto" style={{direction: 'ltr'}}>
            <button 
              className="text-slate-400 hover:text-slate-900 dark:text-white/50 dark:hover:text-white transition-colors active:scale-90 flex flex-col items-center gap-1" 
              onClick={() => player.seek(player.getCurrentTime() - 15)}
            >
              <RotateCcw size={28} className="opacity-80" />
              <span className="text-[10px] font-bold">15</span>
            </button>

            <button 
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.1)] dark:shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all"
            >
              {player.isPlaying ? 
                <Pause size={28} fill="currentColor" /> : 
                (player.isLoading ? <Loader2 size={28} className="animate-spin" /> : <Play size={28} fill="currentColor" className="ml-1" />)
              }
            </button>

            <button 
              className="text-slate-400 hover:text-slate-900 dark:text-white/50 dark:hover:text-white transition-colors active:scale-90 flex flex-col items-center gap-1" 
              onClick={() => player.seek(player.getCurrentTime() + 15)}
            >
               <RotateCw size={28} className="opacity-80" />
               <span className="text-[10px] font-bold">15</span>
            </button>
        </div>
        
        {/* Bottom Accessories (Volume & Music) */}
        <div className="flex justify-between items-center mt-8 px-4" style={{direction: 'ltr'}}>
           <div className="flex items-center gap-3 text-slate-400 dark:text-white/40 w-full max-w-[150px]">
              <Volume2 size={16} />
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={player.volume}
                onChange={(e) => player.setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-white/20 rounded-full appearance-none cursor-pointer accent-slate-900 dark:accent-white hover:accent-teal-500"
              />
           </div>
           
           <div className="relative">
             {showAiTooltip && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 bg-teal-500 text-white text-[10px] font-bold p-2 rounded-lg shadow-lg text-center animate-bounce-short z-50">
                   {t.ai_sound_tooltip}
                   <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-teal-500"></div>
                </div>
             )}
             <button 
                onClick={() => setShowSoundscape(!showSoundscape)}
                className={`p-2 rounded-full transition-colors ${player.ambientType !== 'none' ? 'bg-slate-200 text-slate-900 dark:bg-white/20 dark:text-white' : 'text-slate-400 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'}`}
             >
                <Music size={20} />
             </button>
           </div>
        </div>

        {/* Soundscape Mixer Modal */}
        {showSoundscape && (
           <div className="absolute bottom-full mb-4 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 shadow-2xl animate-slide-up origin-bottom z-40">
              <div className="flex justify-between items-center mb-4">
                 <h4 className="text-slate-900 dark:text-white font-medium text-sm">{t.soundscapes}</h4>
                 <button onClick={() => setShowSoundscape(false)}><X size={16} className="text-slate-400 dark:text-white/50 hover:text-slate-900 dark:hover:text-white" /></button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-6">
                 {(['none', 'drone', 'stream', 'theta', 'zen'] as AmbientType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => player.setAmbientType(type)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                         player.ambientType === type 
                         ? 'bg-teal-500/10 border-teal-500 text-teal-600 dark:bg-teal-500/20 dark:text-white' 
                         : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/10'
                      }`}
                    >
                       {type === 'none' && <X size={20} className="mb-2 opacity-70" />}
                       {type === 'drone' && <Waves size={20} className="mb-2 opacity-70" />}
                       {type === 'stream' && <CloudRain size={20} className="mb-2 opacity-70" />}
                       {type === 'theta' && <Zap size={20} className="mb-2 opacity-70" />}
                       {type === 'zen' && <Flower size={20} className="mb-2 opacity-70" />}
                       <span className="text-[10px] uppercase font-bold tracking-wider">
                          {type === 'none' ? t.sound_none : type === 'drone' ? t.sound_drone : type === 'stream' ? t.sound_stream : type === 'theta' ? t.sound_theta : t.sound_zen}
                       </span>
                    </button>
                 ))}
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between text-[10px] text-slate-400 dark:text-white/50 uppercase font-bold tracking-wider">
                    <span>{t.background_volume}</span>
                    <span>{Math.round(player.ambientVolume * 100)}%</span>
                 </div>
                 <input 
                   type="range"
                   min="0"
                   max="0.8"
                   step="0.01"
                   value={player.ambientVolume}
                   onChange={(e) => player.setAmbientVolume(parseFloat(e.target.value))}
                   className="w-full h-1 bg-slate-200 dark:bg-white/20 rounded-full appearance-none cursor-pointer accent-teal-500"
                 />
              </div>
           </div>
        )}

      </div>
    </div>
  );
};


const BreathingScreen = ({ onBack, lang }: any) => {
  const t = TRANSLATIONS[lang as AppLanguage];
  const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Ready'>('Ready');
  const [countdown, setCountdown] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startBreathing = useCallback(() => {
    setIsActive(true);
    let currentPhase = 'Inhale';
    let timeLeft = 4;
    setPhase('Inhale');
    setCountdown(4);
    
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
    }

    const tick = () => {
      timeLeft--;
      setCountdown(timeLeft);
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
         navigator.vibrate(20);
      }

      if (timeLeft <= 0) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([50, 30, 50]);
        }
        
        if (currentPhase === 'Inhale') {
          currentPhase = 'Hold';
          timeLeft = 7;
        } else if (currentPhase === 'Hold') {
          currentPhase = 'Exhale';
          timeLeft = 8;
        } else {
          currentPhase = 'Inhale';
          timeLeft = 4;
        }
        setPhase(currentPhase as any);
        setCountdown(timeLeft);
      }
    };

    timerRef.current = setInterval(tick, 1000);
  }, []);

  const stopBreathing = useCallback(() => {
    setIsActive(false);
    setPhase('Ready');
    setCountdown(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const getPhaseText = (p: string) => {
    if (p === 'Ready') return t.ready;
    if (p === 'Inhale') return t.inhale;
    if (p === 'Hold') return t.hold;
    if (p === 'Exhale') return t.exhale;
    return p;
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'Inhale': return 'text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]';
      case 'Hold': return 'text-fuchsia-600 dark:text-fuchsia-400 drop-shadow-[0_0_15px_rgba(232,121,249,0.5)]';
      case 'Exhale': return 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]';
      default: return 'text-slate-400 dark:text-white/50';
    }
  };

  const orbScale = phase === 'Inhale' ? 'scale-150' : phase === 'Exhale' ? 'scale-75' : 'scale-125';
  const orbColor = phase === 'Inhale' 
    ? 'bg-cyan-500/20 shadow-[0_0_100px_rgba(6,182,212,0.4)]' 
    : phase === 'Hold' 
      ? 'bg-fuchsia-500/20 shadow-[0_0_100px_rgba(217,70,239,0.4)]' 
      : 'bg-indigo-500/20 shadow-[0_0_80px_rgba(99,102,241,0.3)]';
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center font-sans overflow-hidden bg-slate-50 dark:bg-[#020617] transition-colors duration-500">
       <div className="absolute inset-0 w-full h-full pointer-events-none">
          <div className={`absolute top-0 left-0 w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] rounded-full blur-[100px] transition-all duration-[4000ms] opacity-40 mix-blend-multiply dark:mix-blend-screen
             ${phase === 'Inhale' ? 'bg-cyan-200 dark:bg-cyan-900 translate-x-10 translate-y-10' : phase === 'Hold' ? 'bg-fuchsia-200 dark:bg-fuchsia-900 -translate-x-10' : 'bg-indigo-200 dark:bg-indigo-900 translate-y-20'}
          `}></div>
          <div className={`absolute bottom-0 right-0 w-[80vw] h-[80vw] md:w-[50vw] md:h-[50vw] rounded-full blur-[120px] transition-all duration-[4000ms] opacity-30 mix-blend-multiply dark:mix-blend-screen
             ${phase === 'Inhale' ? 'bg-teal-200 dark:bg-teal-900 -translate-x-20 -translate-y-20' : phase === 'Hold' ? 'bg-purple-200 dark:bg-purple-900 translate-x-10' : 'bg-blue-200 dark:bg-blue-900 -translate-y-10'}
          `}></div>
       </div>

       <button onClick={onBack} className="absolute top-6 left-6 rtl:right-6 rtl:left-auto z-50 p-3 bg-white/50 dark:bg-white/5 rounded-full backdrop-blur-md border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
          {lang === 'fa' ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
       </button>

       <div className="relative z-10 flex flex-col items-center justify-center">
          
          <div className="relative flex items-center justify-center w-80 h-80">
             <div className={`absolute inset-0 rounded-full border border-slate-300 dark:border-white/5 ${orbScale} transition-transform duration-[4000ms] ease-in-out opacity-50`}></div>
             <div className={`absolute inset-4 rounded-full border border-slate-300 dark:border-white/10 ${orbScale} transition-transform duration-[4000ms] delay-75 ease-in-out opacity-60`}></div>
             
             <div className={`w-48 h-48 rounded-full backdrop-blur-md border border-slate-200 dark:border-white/10 flex items-center justify-center transition-all duration-[4000ms] ease-in-out ${orbScale} ${orbColor}`}>
                <div className={`w-full h-full rounded-full opacity-50 mix-blend-overlay bg-gradient-to-tr from-white/40 to-transparent`}></div>
             </div>

             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={`text-4xl font-light tracking-[0.2em] uppercase transition-all duration-1000 ${getPhaseColor()}`}>
                   {getPhaseText(phase)}
                </span>
                {isActive && (
                   <span className="text-6xl font-thin text-slate-700 dark:text-white mt-4 font-variant-numeric tabular-nums animate-fade-in">
                      {countdown}
                   </span>
                )}
             </div>
          </div>
          
          <div className="mt-24 w-full max-w-sm mx-auto px-6">
             <div className="bg-white/60 dark:bg-white/5 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 flex items-center justify-between shadow-xl dark:shadow-2xl">
                <div className="text-left rtl:text-right">
                   <h3 className="text-slate-900 dark:text-white font-medium">{t.breathe_title}</h3>
                   <p className="text-xs text-slate-500 dark:text-white/40 mt-1">{t.breathe_desc}</p>
                </div>
                
                <button 
                  onClick={isActive ? stopBreathing : startBreathing}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                    isActive 
                      ? 'bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-white/20' 
                      : 'bg-slate-900 text-white dark:bg-white dark:text-black hover:scale-105'
                  }`}
                >
                  {isActive ? <RotateCcw size={20} /> : <Play size={20} className="ml-1 rtl:mr-1 rtl:ml-0" />}
                </button>
             </div>
          </div>

       </div>
    </div>
  );
};

const JournalScreen = ({ sessions, onSelectSession, lang, toggleLang }: { sessions: SessionData[], onSelectSession: (s: SessionData) => void, lang: AppLanguage, toggleLang: () => void }) => {
  const t = TRANSLATIONS[lang];
  
  return (
    <div className="flex flex-col min-h-full p-6 pb-48 animate-fade-in max-w-lg mx-auto">
      <header className="mt-8 mb-8 flex justify-between items-center">
         <div>
            <h2 className="text-3xl font-light text-slate-900 dark:text-white">{t.journal}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t.journal_sub}</p>
         </div>
         <button 
            onClick={toggleLang} 
            className="p-3 bg-white/50 dark:bg-white/5 rounded-full hover:bg-white/80 dark:hover:bg-white/10 transition-colors backdrop-blur-md border border-slate-200 dark:border-white/5"
         >
            <Globe size={20} className="text-slate-700 dark:text-white/70" />
         </button>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card className="flex flex-col items-center justify-center py-6">
           <span className="text-3xl font-light text-slate-900 dark:text-white mb-2">{Math.floor(sessions.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60)}</span>
           <span className="text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-wider font-bold">{t.minutes}</span>
        </Card>
        <Card className="flex flex-col items-center justify-center py-6">
           <span className="text-3xl font-light text-slate-900 dark:text-white mb-2">{sessions.length}</span>
           <span className="text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-wider font-bold">Sessions</span>
        </Card>
      </div>

      <div className="space-y-3">
         {sessions.length === 0 ? (
           <div className="p-8 text-center border border-slate-200 dark:border-white/5 rounded-3xl border-dashed">
              <p className="text-slate-500 text-sm">{t.no_sessions}</p>
           </div>
         ) : (
           sessions.slice().reverse().map((session) => (
             <div 
               key={session.id}
               onClick={() => onSelectSession(session)}
               className="group flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 rounded-2xl transition-all cursor-pointer active:scale-98"
             >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center">
                      <Disc size={16} className="text-indigo-500 dark:text-indigo-300" />
                   </div>
                   <div>
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white">{session.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar size={10}/> {new Date(session.timestamp).toLocaleDateString(t.date_locale)}</span>
                        <span className="text-[10px] text-slate-500">• {session.config.duration} {t.min_short}</span>
                      </div>
                   </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white dark:group-hover:text-black transition-colors">
                   <Play size={12} fill="currentColor" className="ml-0.5 rtl:mr-0.5 rtl:ml-0 text-slate-400 dark:text-white/70 group-hover:text-inherit" />
                </div>
             </div>
           ))
         )}
      </div>
    </div>
  );
};

const GlassDock = ({ currentView, onNavigate, lang }: { currentView: ViewState, onNavigate: (v: ViewState) => void, lang: AppLanguage }) => {
  const t = TRANSLATIONS[lang];
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'meditate', icon: Sparkles, label: 'Create' },
    { id: 'breathe', icon: Wind, label: 'Breathe' },
    { id: 'journal', icon: BookOpen, label: 'Journal' }
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
       <div className="flex items-center gap-2 p-2 bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-full shadow-2xl">
          {tabs.map((tab) => {
             const isActive = currentView === tab.id || (tab.id === 'meditate' && currentView === 'generating');
             const Icon = tab.icon;
             return (
               <button
                 key={tab.id}
                 onClick={() => onNavigate(tab.id as ViewState)}
                 className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-lg scale-110 -translate-y-2' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
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
  const [lang, setLang] = useState<AppLanguage>('en');
  const [userSessions, setUserSessions] = useState<SessionData[]>([]);
  
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [activeAudio, setActiveAudio] = useState<ArrayBuffer | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [greeting, setGreeting] = useState<string>("");
  
  const [genTask, setGenTask] = useState<GenerationTask | null>(null);
  const player = useAudioPlayer();
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const init = async () => {
      try {
        await dbService.init();
        const onboarded = localStorage.getItem('zenmind_onboarded');
        if (onboarded) {
           setView('home');
           loadSessions();
        }
      } catch (e) {
        console.error("DB Init failed", e);
      }
    };
    init();
  }, []);

  // Refresh greeting when language changes
  useEffect(() => {
     // Clear previous greeting immediately to avoid language mismatch flash
     setGreeting("");
     gemini.generateGreeting(lang).then(g => setGreeting(g));
  }, [lang]);

  const loadSessions = async () => {
    try {
      const sessions = await dbService.getAllSessions();
      setUserSessions(sessions);
    } catch (e) { console.error("Failed to load sessions", e); }
  };

  const handleStartApp = () => {
    localStorage.setItem('zenmind_onboarded', 'true');
    setView('home');
    loadSessions();
  };

  const showToast = (msg: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ id: Date.now().toString(), message: msg, type });
  };

  const handleStartGeneration = async (config: MeditationConfig) => {
    setView('generating');
    
    const taskId = Date.now().toString();
    const newTask: GenerationTask = {
      id: taskId,
      status: 'scripting',
      config,
      progressMessage: 'Starting...'
    };
    setGenTask(newTask);

    try {
       const { script, ambient } = await gemini.generateMeditationScript(config);
       setGenTask(prev => prev ? ({ ...prev, status: 'synthesizing', script, ambient }) : null);

       const audioBuffer = await gemini.generateSpeech(script, config.voice);
       
       const session: SessionData = {
         id: taskId,
         date: getFormattedDate(lang),
         timestamp: Date.now(),
         config: config,
         script: script,
         title: config.goal,
         durationSec: 0,
         ambient: ambient
       };
       
       await dbService.saveSession(session, audioBuffer);
       loadSessions(); 

       setGenTask(prev => prev ? ({ ...prev, status: 'ready', audioBuffer, ambient }) : null);
       
    } catch (e: any) {
       console.error(e);
       setGenTask(prev => prev ? ({ ...prev, status: 'failed' }) : null);
       showToast("Failed to create session. Please try again.", 'error');
    }
  };

  const handleOpenSession = async (session?: SessionData) => {
    if (!session && genTask && genTask.status === 'ready' && genTask.audioBuffer) {
        const tempSession: SessionData = {
           id: genTask.id,
           date: getFormattedDate(lang),
           timestamp: Date.now(),
           config: genTask.config,
           script: genTask.script!,
           title: genTask.config.goal,
           durationSec: 0,
           ambient: genTask.ambient || 'none'
        };
        setActiveSession(tempSession);
        setActiveAudio(genTask.audioBuffer);
        setView('player');
        setGenTask(null);
        return;
    }

    if (session) {
      try {
        const audio = await dbService.getSessionAudio(session.id);
        if (!audio) throw new Error("Audio file not found locally.");
        setActiveSession(session);
        setActiveAudio(audio);
        setView('player');
      } catch (e) {
        showToast("Could not load audio for this session.", "error");
      }
    }
  };

  return (
    <div 
       className="app-container min-h-screen relative overflow-hidden text-slate-900 dark:text-slate-50 bg-slate-50 dark:bg-slate-950 transition-colors duration-500 selection:bg-teal-500/30"
       dir={lang === 'fa' ? 'rtl' : 'ltr'}
    >
      
      <div className="fixed inset-0 pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-[120px] animate-blob"></div>
         <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-teal-300/30 dark:bg-teal-900/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
         <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-slate-200/50 dark:bg-slate-800/30 rounded-full blur-[120px] animate-blob animation-delay-4000"></div>
      </div>

      {view === 'onboarding' && <div className="flex flex-col items-center justify-center min-h-full p-8 text-center animate-fade-in relative z-10 max-w-lg mx-auto">
        <div className="mb-8 relative"><div className="w-20 h-20 bg-white dark:bg-white/10 rounded-[2rem] backdrop-blur-xl flex items-center justify-center shadow-2xl border border-slate-200 dark:border-white/10 rotate-3"><Wind size={40} className="text-teal-600 dark:text-white" /></div></div>
        <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white mb-4">{t.onboarding_title}</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mb-12 font-light leading-relaxed max-w-xs">{t.onboarding_desc}</p>
        <div className="flex gap-4 w-full">
            <Button onClick={() => { setLang('en'); handleStartApp(); }}>English</Button>
            <Button onClick={() => { setLang('fa'); handleStartApp(); }}>فارسی</Button>
        </div>
      </div>}
      
      {view === 'home' && (
        <HomeScreen 
          onNavigate={setView} 
          greeting={greeting}
          lang={lang}
        />
      )}

      {view === 'meditate' && (
        <GeneratorScreen 
          onGenerate={handleStartGeneration} 
          onBack={() => setView('home')}
          lang={lang}
        />
      )}

      {view === 'generating' && (
        <GeneratingScreen 
          task={genTask} 
          onBackToDash={() => setView('home')} 
          onPlay={() => handleOpenSession()}
          lang={lang}
        />
      )}

      {view === 'player' && activeSession && (
        <PlayerScreen 
          session={activeSession}
          audioBuffer={activeAudio}
          onBack={() => setView('home')} 
          player={player}
          lang={lang}
        />
      )}

      {view === 'breathe' && (
        <BreathingScreen onBack={() => setView('home')} lang={lang} />
      )}

      {view === 'journal' && (
        <JournalScreen 
            sessions={userSessions} 
            onSelectSession={handleOpenSession} 
            lang={lang}
            toggleLang={() => setLang(l => l === 'en' ? 'fa' : 'en')}
        />
      )}

      {(view === 'home' || view === 'journal' || view === 'meditate' || view === 'breathe') && (
        <GlassDock currentView={view} onNavigate={setView} lang={lang} />
      )}

      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}

      {view !== 'generating' && genTask && (
        <GenerationProgressCard 
           task={genTask} 
           onPlay={() => handleOpenSession()} 
           onDismiss={() => setGenTask(null)}
           onViewDetails={() => setView('generating')}
           lang={lang}
        />
      )}

      {view !== 'player' && view !== 'onboarding' && activeSession && (
         <MiniPlayer 
            title={activeSession.title} 
            player={player} 
            onClick={() => setView('player')}
            lang={lang}
         />
      )}

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);