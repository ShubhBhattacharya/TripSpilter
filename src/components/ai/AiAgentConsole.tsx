'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Send,
  Mic,
  MicOff,
  Square,
  RotateCcw,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Plus,
  History,
  Search,
  Paperclip,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Maximize2,
  Minimize2,
  X,
  Languages,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { AiRichCards } from './AiRichCards';
import { AiOrbGraphic } from './AiOrbGraphic';
import type {
  AILanguage,
  PendingConfirmationAction,
  StructuredCard,
} from '../../lib/ai/types';

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  toolExecutions?: Array<{ tool: string; ok: boolean }>;
  pendingConfirmations?: PendingConfirmationAction[];
  structuredCards?: StructuredCard[];
  missingCredentials?: string[];
}

interface ConversationThread {
  id: string;
  title: string;
  serverConversationId: string | null;
  messages: UiMessage[];
}

interface SpeechRecognitionResultItem {
  0?: { transcript?: string };
  isFinal?: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultItem>;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export interface AiAgentConsoleProps {
  mode: 'compact' | 'expanded' | 'embedded';
  onToggleExpand?: () => void;
  onClose?: () => void;
}

function getContextSuggestions(pathname: string, language: AILanguage): string[] {
  if (language === 'hi') {
    if (pathname.startsWith('/3d-experience')) {
      return [
        'Manali ka 3-din ka trip plan banao',
        'Jaipur ka mausam kaisa hai?',
        'Pahadi safar ke liye safety helplines batao',
        '100 USD ko INR mein convert karein',
      ];
    }
    if (pathname.startsWith('/qr-split') || pathname.startsWith('/trips')) {
      return [
        'Mere saved trips aur budgets dikhao',
        'Goa ka 4-din ka trip draft banao ₹25000',
        '100 USD ko INR mein convert karein',
        'Rishikesh ke liye train aur bus links dikhao',
      ];
    }
    return [
      'Manali ka 3-din ka trip plan banao',
      'Jaipur ka mausam aur safety tips batao',
      'Top Indian destinations dikhao',
      '100 USD to INR FX rate check karein',
    ];
  }

  if (pathname.startsWith('/3d-experience')) {
    return [
      'Plan a 3-day trip to Manali',
      'Current weather in Jaipur',
      'Travel safety helplines & tips',
      'Check train & bus transit to Goa',
    ];
  }
  if (pathname.startsWith('/qr-split') || pathname.startsWith('/trips')) {
    return [
      'Show my saved trips',
      'Create a 4-day Goa trip budget ₹25000',
      'Convert 100 USD to INR',
      'Check Bookings Vault',
    ];
  }
  return [
    'Plan a 3-day trip to Manali',
    'Current weather in Udaipur',
    'Convert 100 USD to INR',
    'Safety helplines & transit options to Rishikesh',
  ];
}

function getContextBadgeLabel(pathname: string): string {
  if (pathname.startsWith('/3d-experience')) return 'Context: 3D Tour';
  if (pathname.startsWith('/trips')) return 'Context: Trips & Splits';
  if (pathname.startsWith('/qr-split')) return 'Context: Direct UPI Split';
  if (pathname.startsWith('/explore')) return 'Context: 60 Destinations';
  if (pathname.startsWith('/profile')) return 'Context: Profile & Settings';
  if (pathname.startsWith('/ai-assistant')) return 'Workspace: Full AI Agent';
  return 'Context: Dashboard';
}

function createWelcomeMessage(language: AILanguage, pathname: string): UiMessage {
  return {
    id: 'welcome-init',
    role: 'assistant',
    content:
      language === 'hi'
        ? `Namaste! Main aapka TripSplit AI Travel Agent hoon (${getContextBadgeLabel(pathname)}). Main 60 Indian cities ka day-by-day plan, live weather, currency FX, safety helplines, transit links, aur group expense drafts taiyar kar sakta hoon.`
        : `Hi! I'm your TripSplit AI Travel Agent (${getContextBadgeLabel(pathname)}). Ask me for day-by-day itineraries across 60 destinations, live weather, USD→INR rates, safety helplines, hotel/flight checks, or to draft trips & expense splits.`,
  };
}

export const AiAgentConsole: React.FC<AiAgentConsoleProps> = ({
  mode,
  onToggleExpand,
  onClose,
}) => {
  const pathname = usePathname() || '/';
  const { user, setShowOnboarding } = useAuth();
  const counterRef = useRef<number>(10);
  const nextId = useCallback((prefix: string) => {
    counterRef.current += 1;
    return `${prefix}-${counterRef.current}`;
  }, []);

  const activeTripId = useMemo(() => {
    const match = pathname.match(/^\/trips\/([0-9a-f-]{36})/i);
    return match?.[1] || undefined;
  }, [pathname]);

  const storageKey = useMemo(
    () => `tripsplit_ai_threads_v1:${user?.id || 'guest'}`,
    [user?.id]
  );

  const [language, setLanguage] = useState<AILanguage>('en');
  const [preferredProvider, setPreferredProvider] = useState<'auto' | 'openai' | 'gemini'>('auto');
  const [threads, setThreads] = useState<ConversationThread[]>(() => [
    {
      id: 'thread-default',
      title: 'New Travel Plan',
      serverConversationId: null,
      messages: [createWelcomeMessage('en', pathname)],
    },
  ]);
  const [activeThreadId, setActiveThreadId] = useState<string>('thread-default');
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [voiceMuted, setVoiceMuted] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmedKeys, setConfirmedKeys] = useState<Record<string, boolean>>({});
  const [confirmBusyKey, setConfirmBusyKey] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
  );

  // Hydrate persisted threads safely via microtask to stay clean under React 19 hooks rules
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      await Promise.resolve();
      if (cancelled) return;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as ConversationThread[];
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.messages) {
            setThreads(parsed);
            setActiveThreadId(parsed[0].id);
            return;
          }
        }
      } catch {
        // Ignore corrupt localStorage cleanly
      }
      if (user?.id) {
        try {
          const res = await fetch('/api/ai/chat');
          if (res.ok) {
            const json = (await res.json()) as {
              conversations?: Array<{ id: string; title: string }>;
            };
            if (!cancelled && json.conversations && json.conversations.length > 0) {
              const serverThreads: ConversationThread[] = json.conversations.map((c) => ({
                id: `srv-${c.id}`,
                title: c.title || 'Saved Conversation',
                serverConversationId: c.id,
                messages: [createWelcomeMessage(language, pathname)],
              }));
              setThreads(serverThreads);
              setActiveThreadId(serverThreads[0].id);
            }
          }
        } catch {
          // Non-fatal offline tolerance
        }
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [storageKey, user?.id, language, pathname]);

  // Persist threads locally on update
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(threads.slice(0, 15)));
    } catch {
      // Storage quota tolerance
    }
  }, [threads, storageKey]);

  // Clean up audio / recognition on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.abort();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Smooth scroll on new messages
  useEffect(() => {
    bottomScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThread?.messages.length, loading]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setSpeakingMsgId(null);
  }, []);

  const speakText = useCallback(
    async (text: string, msgId: string) => {
      if (voiceMuted) return;
      stopSpeaking();
      const cleaned = text.replace(/\[(?:Mode Notice|Guest Mode):[^\]]*\]/g, '').trim();
      if (!cleaned) return;

      setSpeakingMsgId(msgId);
      try {
        const res = await fetch('/api/guide/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleaned.slice(0, 1200), language }),
        });
        if (res.ok && res.headers.get('content-type')?.includes('audio/')) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            setSpeakingMsgId(null);
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            setSpeakingMsgId(null);
          };
          await audio.play();
          return;
        }
      } catch {
        // Fallback to browser SpeechSynthesis below
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(cleaned.slice(0, 1200));
        const voices = window.speechSynthesis.getVoices();
        const targetLang = language === 'hi' ? 'hi' : 'en';
        const matchVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang));
        if (matchVoice) utter.voice = matchVoice;
        utter.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        utter.onend = () => setSpeakingMsgId(null);
        utter.onerror = () => setSpeakingMsgId(null);
        window.speechSynthesis.speak(utter);
      } else {
        setSpeakingMsgId(null);
      }
    },
    [language, stopSpeaking, voiceMuted]
  );

  const sendPrompt = useCallback(
    async (rawPrompt: string, customHistory?: UiMessage[]) => {
      const text = rawPrompt.trim();
      if (!text || loading) return;

      const userMsg: UiMessage = {
        id: nextId('usr'),
        role: 'user',
        content: text,
      };

      const targetThreadId = activeThread.id;
      const baseMessages = customHistory ?? activeThread.messages;
      const nextMessages = [...baseMessages, userMsg];

      setThreads((prev) =>
        prev.map((t) =>
          t.id === targetThreadId
            ? {
                ...t,
                title: t.messages.length <= 1 ? text.slice(0, 44) : t.title,
                messages: nextMessages,
              }
            : t
        )
      );
      if (!customHistory) setInput('');
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const historyPayload = nextMessages
          .filter((m) => m.id !== 'welcome-init')
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            conversationId: activeThread.serverConversationId || undefined,
            tripId: activeTripId,
            language,
            preferredProvider,
            currentPath: pathname,
            messages: historyPayload,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        const aiMsg: UiMessage = {
          id: nextId('ai'),
          role: 'assistant',
          content: data.reply || 'Done.',
          provider: data.provider,
          model: data.model,
          toolExecutions: data.toolExecutions,
          pendingConfirmations: data.pendingConfirmations,
          structuredCards: data.structuredCards,
          missingCredentials: data.missingCredentials,
        };

        setThreads((prev) =>
          prev.map((t) =>
            t.id === targetThreadId
              ? {
                  ...t,
                  serverConversationId: data.conversationId || t.serverConversationId,
                  messages: [...nextMessages, aiMsg],
                }
              : t
          )
        );
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') {
          toast.info('Generation stopped.');
          return;
        }
        const msg = err instanceof Error ? err.message : 'Unable to reach AI Travel Agent.';
        toast.error(msg);
      } finally {
        abortRef.current = null;
        setLoading(false);
      }
    },
    [
      activeThread,
      activeTripId,
      language,
      loading,
      nextId,
      pathname,
      preferredProvider,
    ]
  );

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const handleRegenerate = useCallback(() => {
    if (loading) return;
    const msgs = activeThread.messages;
    const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = msgs.length - 1 - lastUserIdx;
    const lastUserText = msgs[actualIdx].content;
    const trimmedPrior = msgs.slice(0, actualIdx);
    void sendPrompt(lastUserText, trimmedPrior);
  }, [activeThread.messages, loading, sendPrompt]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1600);
    } catch {
      toast.error('Clipboard copy unavailable');
    }
  }, []);

  const handleNewChat = useCallback(() => {
    stopSpeaking();
    const id = nextId('thread');
    const fresh: ConversationThread = {
      id,
      title: language === 'hi' ? 'Nayi Yatra Chat' : 'New Travel Plan',
      serverConversationId: null,
      messages: [createWelcomeMessage(language, pathname)],
    };
    setThreads((prev) => [fresh, ...prev]);
    setActiveThreadId(id);
    setShowHistory(false);
  }, [language, nextId, pathname, stopSpeaking]);

  const handleDeleteThread = useCallback(
    (id: string) => {
      setThreads((prev) => {
        const remaining = prev.filter((t) => t.id !== id);
        if (remaining.length === 0) {
          const fallback: ConversationThread = {
            id: nextId('thread'),
            title: 'New Travel Plan',
            serverConversationId: null,
            messages: [createWelcomeMessage(language, pathname)],
          };
          setActiveThreadId(fallback.id);
          return [fallback];
        }
        if (id === activeThreadId) {
          setActiveThreadId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeThreadId, language, nextId, pathname]
  );

  const toggleVoiceInput = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const RecCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!RecCtor) {
      toast.error('Voice microphone input is not supported in this browser.');
      return;
    }

    const recognition = new RecCtor();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i]?.[0]?.transcript || '';
      }
      setInput(transcript.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error('Microphone capture stopped or permission denied.');
    };
    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [language, listening]);

  const handleReceiptUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be 5 MB or smaller.');
        return;
      }

      setOcrLoading(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read image'));
          reader.readAsDataURL(file);
        });

        const res = await fetch('/api/ocr/parse-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        });
        const json = await res.json();

        if (!res.ok || json.configured === false) {
          toast.info(
            json.error ||
              'Receipt OCR requires GEMINI_API_KEY on the server. Enter merchant & amount cleanly in chat.'
          );
          return;
        }

        const parsedAmount = Number(json.totalAmount || json.amount || 0);
        const merchant = String(json.merchant || json.vendorName || file.name);
        const suggestion =
          parsedAmount > 0
            ? `Add expense ₹${parsedAmount} for ${merchant}`
            : `Review scanned receipt from ${merchant}`;
        setInput(suggestion);
        toast.success(`Receipt parsed: ${merchant}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Receipt scan failed.');
      } finally {
        setOcrLoading(false);
      }
    },
    []
  );

  const handleApproveAction = useCallback(
    async (action: PendingConfirmationAction, key: string) => {
      if (!user) {
        toast.info('Please sign in first to execute saved trip or expense actions.');
        setShowOnboarding(true);
        return;
      }
      setConfirmBusyKey(key);
      try {
        const res = await fetch('/api/ai/confirm-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionType: action.actionType,
            approved: true,
            payload: action.payload,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Confirmation failed');
        }
        setConfirmedKeys((prev) => ({ ...prev, [key]: true }));
        toast.success(json.message || 'Action confirmed & saved to TripSplit!');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not confirm action');
      } finally {
        setConfirmBusyKey(null);
      }
    },
    [setShowOnboarding, user]
  );

  const filteredThreads = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [historySearch, threads]);

  const suggestions = useMemo(
    () => getContextSuggestions(pathname, language),
    [pathname, language]
  );

  const hasUserMessages = activeThread.messages.some((m) => m.role === 'user');

  return (
    <div className="flex flex-col h-full bg-white text-[#172B4D] overflow-hidden">
      {/* Header Bar */}
      <div className="shrink-0 px-3 py-2.5 bg-gradient-to-r from-[#0F172A] via-[#173B70] to-[#1E3A8A] text-white flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <AiOrbGraphic size={32} listening={listening} thinking={loading} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-bold tracking-tight truncate">TripSplit AI</h3>
              {mode !== 'compact' && (
                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-300/30">
                  <Sparkles className="w-2.5 h-2.5" /> Live
                </span>
              )}
            </div>
            <p className="text-[10px] text-cyan-100/90 truncate">{getContextBadgeLabel(pathname)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setLanguage((l) => (l === 'en' ? 'hi' : 'en'))}
            title="Switch Language (English / Hindi)"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold transition-colors"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'हिन्दी' : 'EN'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!voiceMuted) stopSpeaking();
              setVoiceMuted((m) => !m);
            }}
            title={voiceMuted ? 'Unmute Voice Output' : 'Mute Voice Output'}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Toggle Voice Mute"
          >
            {voiceMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-300" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setShowHistory((h) => !h)}
            title="Conversation History"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              showHistory ? 'bg-cyan-400/30 text-white' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{threads.length}</span>
          </button>

          <button
            type="button"
            onClick={handleNewChat}
            title="New Chat"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              title={mode === 'expanded' ? 'Compact Drawer' : 'Expand Workspace'}
              className="hidden sm:inline-flex p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Toggle Expand"
            >
              {mode === 'expanded' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Minimize AI Assistant"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-500/80 transition-colors"
              aria-label="Close AI Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-bar: Provider + History Drawer toggle */}
      <div className="shrink-0 px-3.5 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500 font-medium shrink-0">Engine:</span>
          <select
            value={preferredProvider}
            onChange={(e) => setPreferredProvider(e.target.value as 'auto' | 'openai' | 'gemini')}
            aria-label="AI Engine"
            className="bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
          >
            <option value="auto">Auto + Tools</option>
            <option value="openai">OpenAI GPT-4o-mini</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>

        {mode !== 'embedded' && (
          <Link
            href="/ai-assistant"
            onClick={onClose}
            className="text-[11px] font-semibold text-[#1685D4] hover:underline shrink-0"
          >
            Open Full Page →
          </Link>
        )}
      </div>

      {/* Collapsible History & Search Panel */}
      {showHistory && (
        <div className="shrink-0 bg-slate-100/90 border-b border-slate-200 p-2.5 space-y-2 max-h-52 overflow-y-auto">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search past chats..."
              className="flex-1 text-xs bg-transparent outline-none"
            />
          </div>
          <div className="space-y-1">
            {filteredThreads.map((thread) => (
              <div
                key={thread.id}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                  thread.id === activeThread.id
                    ? 'bg-[#173B70] text-white font-semibold'
                    : 'bg-white text-slate-700 hover:bg-indigo-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setShowHistory(false);
                  }}
                  className="flex-1 text-left truncate"
                >
                  {thread.title} ({thread.messages.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteThread(thread.id)}
                  className="opacity-70 hover:opacity-100 p-0.5"
                  aria-label="Delete thread"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice Listening Banner */}
      {listening && (
        <div className="shrink-0 px-3.5 py-2 bg-gradient-to-r from-indigo-950 via-slate-900 to-cyan-950 text-white flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-semibold">
              {language === 'hi' ? 'Sun raha hoon... Boliye' : 'Listening... Speak your travel query'}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleVoiceInput}
            className="px-2 py-0.5 rounded bg-rose-500 text-white text-[11px] font-semibold"
          >
            Stop Mic
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#F8FAFC]">
        {activeThread.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                msg.role === 'user'
                  ? 'bg-[#173B70] text-white rounded-br-sm'
                  : 'bg-white border border-slate-200/90 text-[#172B4D] rounded-bl-sm'
              }`}
            >
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>

              {/* Rich Visual Structured Cards */}
              {msg.structuredCards && msg.structuredCards.length > 0 && (
                <AiRichCards
                  cards={msg.structuredCards}
                  onQuickPrompt={(p) => void sendPrompt(p)}
                />
              )}

              {/* Explicit Mutation Confirmation Cards */}
              {msg.pendingConfirmations?.map((act, idx) => {
                const key = `${msg.id}-${idx}`;
                const done = Boolean(confirmedKeys[key]);
                const busy = confirmBusyKey === key;
                return (
                  <div
                    key={key}
                    className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-amber-900">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                        Confirmation Required ({act.actionType})
                      </span>
                    </div>
                    <p className="text-xs text-slate-800">{act.summary}</p>
                    <button
                      type="button"
                      disabled={done || busy}
                      onClick={() => void handleApproveAction(act, key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        done
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#173B70] hover:bg-[#1685D4] text-white disabled:opacity-60'
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {done ? 'Confirmed & Saved' : 'Approve & Execute'}
                    </button>
                  </div>
                );
              })}

              {/* Assistant Action Strip: Speak / Copy / Tool badges */}
              {msg.role === 'assistant' && msg.id !== 'welcome-init' && (
                <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        speakingMsgId === msg.id
                          ? stopSpeaking()
                          : void speakText(msg.content, msg.id)
                      }
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-600 font-medium"
                    >
                      {speakingMsgId === msg.id ? (
                        <>
                          <Square className="w-2.5 h-2.5 text-rose-500 fill-rose-500" /> Stop
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" /> Listen
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy(msg.content, msg.id)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-600 font-medium"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                    <span className="text-[10px] font-medium text-emerald-700 truncate max-w-[180px]">
                      Tools: {msg.toolExecutions.map((t) => t.tool).join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center justify-between gap-2 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-slate-600 shadow-xs">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#1685D4]" />
              <span>Orchestrating tools & travel adapters...</span>
            </div>
            <button
              type="button"
              onClick={handleStopGeneration}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold hover:bg-rose-100"
            >
              <Square className="w-2.5 h-2.5 fill-rose-600" /> Stop
            </button>
          </div>
        )}

        <div ref={bottomScrollRef} />
      </div>

      {/* Page-Context Suggested Prompts & Regenerate */}
      <div className="shrink-0 px-3 pt-2 pb-1 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto">
        {hasUserMessages && !loading && (
          <button
            type="button"
            onClick={handleRegenerate}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
          >
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        )}
        {suggestions.map((q) => (
          <button
            key={q}
            type="button"
            disabled={loading}
            onClick={() => void sendPrompt(q)}
            className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 hover:bg-cyan-50 text-slate-700 hover:text-[#173B70] border border-slate-200 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Composer Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendPrompt(input);
        }}
        className="shrink-0 p-2.5 bg-white border-t border-slate-200 flex items-center gap-1.5"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleReceiptUpload}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={ocrLoading || loading}
          title="Scan Receipt or Bill Image"
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 shrink-0"
          aria-label="Upload Receipt Image"
        >
          {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={toggleVoiceInput}
          title="Voice Input (English / Hindi)"
          className={`p-2 rounded-xl border shrink-0 transition-colors ${
            listening
              ? 'bg-rose-500 border-rose-500 text-white animate-pulse'
              : 'border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
          aria-label="Voice Input"
        >
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            language === 'hi'
              ? 'Poochein: Manali plan, Mausam, USD→INR, Kharcha...'
              : 'Ask anything: Plan Goa 4d, Weather, FX, Split bill...'
          }
          className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1685D4]/30 focus:border-[#1685D4]"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-[#173B70] to-[#1685D4] text-white hover:opacity-95 disabled:opacity-40 transition-all shrink-0 shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
