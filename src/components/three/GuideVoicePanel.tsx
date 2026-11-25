'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Loader2,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { useTrip3DStore } from '@/store/useTrip3DStore';
import { GuideVoiceController } from '@/lib/audio/guide-tts';

export function GuideVoicePanel({ onNextSpot }: { onNextSpot: () => void }) {
  const {
    stage,
    guideLanguage,
    setGuideLanguage,
    autoNarrate,
    setAutoNarrate,
    isAudioEnabled,
    toggleAudio,
    isSpeaking,
    speechStatus,
    currentExplanation,
    lastSpeechError,
    setSpeechState,
    getSelectedCity,
    getCurrentSpot,
  } = useTrip3DStore();

  const city = getSelectedCity();
  const currentSpot = getCurrentSpot();

  const [questionInput, setQuestionInput] = useState('');
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [providerLabel, setProviderLabel] = useState<'server-audio' | 'browser-speech'>('browser-speech');

  const controllerRef = useRef<GuideVoiceController | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestRequestId = useRef(0);

  // Initialize singleton voice controller once on mount, clean up on unmount
  if (!controllerRef.current && typeof window !== 'undefined') {
    controllerRef.current = new GuideVoiceController({
      onStatusChange: (status, err) => {
        setSpeechState({
          speechStatus: status,
          lastSpeechError: err ?? null,
        });
      },
      onSpeakingChange: (speaking) => {
        setSpeechState({ isSpeaking: speaking });
      },
      onProviderChange: (provider) => {
        setProviderLabel(provider);
      },
    });
  }

  // Sync mute state immediately with audio controller
  useEffect(() => {
    controllerRef.current?.setMuted(!isAudioEnabled);
  }, [isAudioEnabled]);

  // Stop speech cleanly on component unmount or leaving virtual tour
  useEffect(() => {
    if (stage !== 'virtual-tour') {
      controllerRef.current?.stop();
    }
    return () => {
      abortRef.current?.abort();
      controllerRef.current?.stop();
    };
  }, [stage]);

  const fetchAndSpeak = useCallback(
    async (question?: string, forceSpeak = false) => {
      if (stage !== 'virtual-tour') return;

      const reqId = ++latestRequestId.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      controllerRef.current?.stop();
      setIsLoadingText(true);
      setSpeechState({
        speechStatus: 'generating',
        lastSpeechError: null,
        isSpeaking: false,
      });

      try {
        const res = await fetch('/api/guide/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({
            cityId: city.id,
            cityName: city.name,
            state: city.state,
            region: city.region,
            tagline: city.tagline,
            cityDescription: city.description,
            spotName: currentSpot.name,
            spotSubtitle: currentSpot.subtitle,
            spotDescription: currentSpot.description,
            spotCategory: currentSpot.category,
            bestTime: currentSpot.bestTime,
            duration: currentSpot.duration,
            cost: currentSpot.cost,
            wikiTitle: currentSpot.wikiTitle,
            nearbySpots: city.spots.map((s) => s.name),
            language: guideLanguage,
            ...(question ? { question } : {}),
          }),
        });

        if (reqId !== latestRequestId.current) return;

        if (!res.ok) {
          throw new Error('Failed to generate explanation');
        }

        const data = await res.json();
        if (reqId !== latestRequestId.current) return;

        const explanationText: string =
          data?.explanation || currentSpot.guideMessage || currentSpot.speechQuote;

        setSpeechState({ currentExplanation: explanationText });
        setIsLoadingText(false);

        const shouldSpeak = forceSpeak || (autoNarrate && isAudioEnabled);
        if (shouldSpeak && controllerRef.current) {
          await controllerRef.current.speak(explanationText, guideLanguage);
        } else {
          setSpeechState({ speechStatus: 'idle', isSpeaking: false });
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError' || reqId !== latestRequestId.current) return;
        setIsLoadingText(false);
        const fallback = currentSpot.guideMessage || currentSpot.speechQuote;
        setSpeechState({ currentExplanation: fallback });
        if ((forceSpeak || (autoNarrate && isAudioEnabled)) && controllerRef.current) {
          await controllerRef.current.speak(fallback, guideLanguage);
        } else {
          setSpeechState({ speechStatus: 'unavailable', lastSpeechError: 'Unable to load voice explanation' });
        }
      }
    },
    [
      stage,
      city.id,
      city.name,
      city.state,
      city.region,
      city.tagline,
      city.description,
      city.spots,
      currentSpot.name,
      currentSpot.subtitle,
      currentSpot.description,
      currentSpot.category,
      currentSpot.bestTime,
      currentSpot.duration,
      currentSpot.cost,
      currentSpot.wikiTitle,
      currentSpot.guideMessage,
      currentSpot.speechQuote,
      guideLanguage,
      autoNarrate,
      isAudioEnabled,
      setSpeechState,
    ]
  );

  // Trigger fresh explanation + narration whenever Spot or Language changes in Stage 3
  useEffect(() => {
    if (stage !== 'virtual-tour') return;
    void fetchAndSpeak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentSpot.id, guideLanguage]);

  const handlePlayOrResume = () => {
    if (!isAudioEnabled) {
      toggleAudio();
    }
    if (speechStatus === 'paused') {
      controllerRef.current?.resume();
      return;
    }
    const textToSpeak = currentExplanation || currentSpot.guideMessage || currentSpot.speechQuote;
    void controllerRef.current?.speak(textToSpeak, guideLanguage);
  };

  const handlePause = () => {
    controllerRef.current?.pause();
  };

  const handleStop = () => {
    controllerRef.current?.stop();
  };

  const handleReplay = () => {
    if (!isAudioEnabled) {
      toggleAudio();
    }
    const textToSpeak = currentExplanation || currentSpot.guideMessage || currentSpot.speechQuote;
    void controllerRef.current?.speak(textToSpeak, guideLanguage);
  };

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const q = questionInput.trim();
    if (!q) return;
    setQuestionInput('');
    void fetchAndSpeak(q, true);
  };

  const statusText = (() => {
    if (isLoadingText || speechStatus === 'generating') return 'Generating audio...';
    if (speechStatus === 'preparing') return 'Preparing voice...';
    if (speechStatus === 'playing') return 'Playing...';
    if (speechStatus === 'paused') return 'Paused';
    if (speechStatus === 'completed') return 'Completed';
    if (speechStatus === 'blocked') return 'Audio blocked by browser';
    if (speechStatus === 'unavailable') return 'Audio unavailable';
    return 'Ready';
  })();

  const quickPrompts =
    guideLanguage === 'hi'
      ? ['इस जगह का इतिहास बताओ', 'घूमने का सबसे अच्छा समय?']
      : ['Tell me the history', 'What is special here?'];

  return (
    <div
      data-testid="guide-voice-panel"
      className="pointer-events-auto relative p-3.5 rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/60 shadow-2xl text-slate-900 w-full max-w-[340px] md:mr-36 lg:mr-44 mb-1 md:mb-3 flex flex-col gap-2.5"
    >
      {/* Top Row: Two-Language Switch (हिंदी | English) + Auto Narration ON/OFF */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div
          role="group"
          aria-label="Guide Language"
          className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/80 border border-slate-300"
        >
          <button
            type="button"
            onClick={() => setGuideLanguage('hi')}
            className={`cursor-pointer px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
              guideLanguage === 'hi'
                ? 'bg-amber-500 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            हिंदी
          </button>
          <button
            type="button"
            onClick={() => setGuideLanguage('en')}
            className={`cursor-pointer px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
              guideLanguage === 'en'
                ? 'bg-amber-500 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English
          </button>
        </div>

        <button
          type="button"
          onClick={() => setAutoNarrate(!autoNarrate)}
          className={`cursor-pointer px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition-all flex items-center gap-1 ${
            autoNarrate
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}
          title="Toggle Automatic Narration"
        >
          <Sparkles className="w-3 h-3" />
          Auto: {autoNarrate ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Real Playback Status Row */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px]">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          {speechStatus === 'generating' || speechStatus === 'preparing' ? (
            <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
          ) : isSpeaking ? (
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          ) : speechStatus === 'blocked' || speechStatus === 'unavailable' ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          ) : null}
          <span data-testid="voice-status-label">{statusText}</span>
        </div>

        <span className="text-[10px] text-slate-500 font-semibold">
          {providerLabel === 'server-audio' ? 'HD Voice' : guideLanguage === 'hi' ? 'Hindi Voice' : 'English Voice'}
        </span>
      </div>

      {/* Autoplay Blocked Clear Action */}
      {speechStatus === 'blocked' && (
        <button
          type="button"
          onClick={handlePlayOrResume}
          className="cursor-pointer w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold text-xs shadow-md hover:brightness-105 transition-all"
        >
          Tap to start guide audio
        </button>
      )}

      {/* Unavailable + Retry Action */}
      {speechStatus === 'unavailable' && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
          <span className="truncate">{lastSpeechError || 'Voice playback unavailable'}</span>
          <button
            type="button"
            onClick={handleReplay}
            className="cursor-pointer px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Voice Controls: Play / Pause / Resume / Stop / Replay / Mute */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          {isSpeaking ? (
            <button
              type="button"
              onClick={handlePause}
              className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold"
              title="Pause"
            >
              <Pause className="w-3 h-3" />
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePlayOrResume}
              className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
              title={speechStatus === 'paused' ? 'Resume' : 'Play'}
            >
              <Play className="w-3 h-3" />
              {speechStatus === 'paused' ? 'Resume' : 'Play'}
            </button>
          )}

          <button
            type="button"
            onClick={handleStop}
            className="cursor-pointer inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-bold"
            title="Stop"
          >
            <Square className="w-3 h-3" />
            Stop
          </button>

          <button
            type="button"
            onClick={handleReplay}
            className="cursor-pointer inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-bold"
            title="Replay"
          >
            <RotateCcw className="w-3 h-3" />
            Replay
          </button>
        </div>

        <button
          type="button"
          onClick={toggleAudio}
          className={`cursor-pointer p-1.5 rounded-xl border text-xs ${
            isAudioEnabled
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-rose-50 border-rose-300 text-rose-700'
          }`}
          title={isAudioEnabled ? 'Mute Guide Voice' : 'Unmute Guide Voice'}
        >
          {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Explanation Transcript */}
      <div className="max-h-28 overflow-y-auto pr-1 text-xs font-medium text-slate-800 leading-relaxed">
        {currentExplanation || currentSpot.speechQuote}
      </div>

      {/* Follow-up Contextual Question Input + Quick Chips */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void fetchAndSpeak(prompt, true)}
              className="cursor-pointer px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[10px] font-semibold text-sky-800 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form onSubmit={handleAskQuestion} className="flex items-center gap-1.5">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder={guideLanguage === 'hi' ? 'कुछ पूछें (जैसे इतिहास)...' : 'Ask about this spot...'}
            className="flex-1 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <button
            type="submit"
            disabled={!questionInput.trim() || isLoadingText}
            className="cursor-pointer p-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white transition-colors"
            title="Ask Guide"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Next Spot Navigation Link */}
      <button
        type="button"
        onClick={onNextSpot}
        className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline self-start"
      >
        <span>[Next Spot: {currentSpot.nextSpotName} →]</span>
      </button>
    </div>
  );
}
