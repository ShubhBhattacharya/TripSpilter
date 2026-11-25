export type TTSLanguage = 'hi' | 'en';

export type TTSPlaybackStatus =
  | 'idle'
  | 'preparing'
  | 'generating'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'blocked'
  | 'unavailable';

export interface TTSCallbacks {
  onStatusChange: (status: TTSPlaybackStatus, error?: string | null) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onProviderChange?: (provider: 'server-audio' | 'browser-speech') => void;
}

/**
 * Splits long explanations into clean sentences so Chromium's Web Speech API
 * never drops utterances silently after ~15 seconds and pause/stop stay responsive.
 */
function chunkTextForSpeech(text: string, maxLen = 175): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const rawSentences = cleaned
    .split(/(?<=[।.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';

  for (const sentence of rawSentences) {
    if (sentence.length > maxLen) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }
      const subParts = sentence.split(/,\s*/);
      let subBuf = '';
      for (const part of subParts) {
        if ((subBuf + ', ' + part).length > maxLen && subBuf) {
          chunks.push(subBuf);
          subBuf = part;
        } else {
          subBuf = subBuf ? `${subBuf}, ${part}` : part;
        }
      }
      if (subBuf) chunks.push(subBuf);
      continue;
    }

    if ((buffer + ' ' + sentence).trim().length > maxLen && buffer) {
      chunks.push(buffer);
      buffer = sentence;
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

/**
 * Picks the best available system/browser voice matching the exact requested language.
 */
export function selectVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  language: TTSLanguage
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (language === 'hi') {
    const hiVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('hi'));
    if (hiVoices.length > 0) {
      return (
        hiVoices.find((v) => /google|microsoft|swara|madhur|natural/i.test(v.name)) ||
        hiVoices[0]
      );
    }
    return null;
  }

  // English mode: prefer Indian English / Natural English voices, never Hindi voices
  const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (enVoices.length > 0) {
    return (
      enVoices.find((v) => v.lang.toLowerCase() === 'en-in' && /google|microsoft|natural|neerja|prabhat/i.test(v.name)) ||
      enVoices.find((v) => v.lang.toLowerCase() === 'en-in') ||
      enVoices.find((v) => /google|microsoft|natural|samantha|aria|jenny/i.test(v.name)) ||
      enVoices[0]
    );
  }
  return null;
}

/**
 * Singleton-safe audio narration engine managing both Server TTS (`<audio>`)
 * and Browser Web SpeechSynthesis (`window.speechSynthesis`), preventing:
 * - Duplicate overlapping streams
 * - Chrome `getVoices()` empty initial array bug
 * - Chrome utterance garbage collection dropping `onend`
 * - Chromium 15s cutoff on long paragraphs
 * - False "playing" status when autoplay is blocked
 */
export class GuideVoiceController {
  private sequenceId = 0;
  private activeAudio: HTMLAudioElement | null = null;
  private activeAudioUrl: string | null = null;
  private activeUtterances: SpeechSynthesisUtterance[] = [];
  private isPausedFlag = false;
  private isMutedFlag = false;
  private lastText = '';
  private lastLanguage: TTSLanguage = 'hi';
  private callbacks: TTSCallbacks;

  constructor(callbacks: TTSCallbacks) {
    this.callbacks = callbacks;
  }

  public setMuted(muted: boolean) {
    this.isMutedFlag = muted;
    if (this.activeAudio) {
      this.activeAudio.muted = muted;
    }
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // SpeechSynthesis doesn't support volume change mid-utterance in Chrome; stop speech cleanly when muted
      this.stop();
    }
  }

  public async waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) return existing;

    return new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(window.speechSynthesis.getVoices());
      };
      const onVoicesChanged = () => done();
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      setTimeout(done, timeoutMs);
    });
  }

  public stop() {
    this.sequenceId += 1;
    this.isPausedFlag = false;

    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
        this.activeAudio.onplay = null;
        this.activeAudio.onpause = null;
        this.activeAudio.onended = null;
        this.activeAudio.onerror = null;
      } catch {
        // ignore cleanup errors
      }
      this.activeAudio = null;
    }

    if (this.activeAudioUrl) {
      URL.revokeObjectURL(this.activeAudioUrl);
      this.activeAudioUrl = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.activeUtterances = [];
    this.callbacks.onSpeakingChange(false);
    this.callbacks.onStatusChange('idle', null);
  }

  public pause() {
    if (this.activeAudio && !this.activeAudio.paused) {
      this.activeAudio.pause();
      this.isPausedFlag = true;
      this.callbacks.onSpeakingChange(false);
      this.callbacks.onStatusChange('paused', null);
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.isPausedFlag = true;
      this.callbacks.onSpeakingChange(false);
      this.callbacks.onStatusChange('paused', null);
    }
  }

  public resume() {
    if (!this.isPausedFlag) return;
    if (this.activeAudio) {
      this.activeAudio
        .play()
        .then(() => {
          this.isPausedFlag = false;
          this.callbacks.onSpeakingChange(true);
          this.callbacks.onStatusChange('playing', null);
        })
        .catch(() => {
          this.callbacks.onSpeakingChange(false);
          this.callbacks.onStatusChange('blocked', 'Tap to resume guide audio');
        });
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      this.isPausedFlag = false;
      this.callbacks.onSpeakingChange(true);
      this.callbacks.onStatusChange('playing', null);
    }
  }

  public async replay() {
    if (!this.lastText) return;
    await this.speak(this.lastText, this.lastLanguage);
  }

  public async speak(text: string, language: TTSLanguage): Promise<void> {
    const cleanText = text.trim();
    if (!cleanText) return;

    this.lastText = cleanText;
    this.lastLanguage = language;

    // Cancel any existing audio stream first
    this.stop();
    const mySeq = ++this.sequenceId;

    if (this.isMutedFlag) {
      this.callbacks.onSpeakingChange(false);
      this.callbacks.onStatusChange('paused', 'Audio is muted');
      return;
    }

    this.callbacks.onStatusChange('preparing', null);

    // 1. Try Server-Side TTS endpoint first if configured (OpenAI TTS mp3)
    try {
      const res = await fetch('/api/guide/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, language }),
      });

      if (mySeq !== this.sequenceId) return;

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('audio/')) {
        const blob = await res.blob();
        if (mySeq !== this.sequenceId) return;
        const objectUrl = URL.createObjectURL(blob);
        this.activeAudioUrl = objectUrl;
        const audio = new Audio(objectUrl);
        audio.muted = this.isMutedFlag;
        this.activeAudio = audio;
        this.callbacks.onProviderChange?.('server-audio');

        audio.onplay = () => {
          if (mySeq !== this.sequenceId) return;
          this.callbacks.onSpeakingChange(true);
          this.callbacks.onStatusChange('playing', null);
        };
        audio.onpause = () => {
          if (mySeq !== this.sequenceId || audio.ended) return;
          this.callbacks.onSpeakingChange(false);
          if (this.isPausedFlag) this.callbacks.onStatusChange('paused', null);
        };
        audio.onended = () => {
          if (mySeq !== this.sequenceId) return;
          this.callbacks.onSpeakingChange(false);
          this.callbacks.onStatusChange('completed', null);
        };
        audio.onerror = () => {
          if (mySeq !== this.sequenceId) return;
          this.callbacks.onSpeakingChange(false);
          this.callbacks.onStatusChange('unavailable', 'Audio playback failed');
        };

        try {
          await audio.play();
          return;
        } catch (err) {
          const name = err instanceof Error ? err.name : '';
          if (name === 'NotAllowedError') {
            this.callbacks.onSpeakingChange(false);
            this.callbacks.onStatusChange('blocked', 'Tap to start guide audio');
            return;
          }
          // Fall through to SpeechSynthesis on non-autoplay errors
        }
      }
    } catch {
      // Fall back smoothly to Web SpeechSynthesis
    }

    if (mySeq !== this.sequenceId) return;

    // 2. Browser Web SpeechSynthesis Provider
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.callbacks.onSpeakingChange(false);
      this.callbacks.onStatusChange('unavailable', 'Speech synthesis not supported in this browser');
      return;
    }

    this.callbacks.onProviderChange?.('browser-speech');
    const voices = await this.waitForVoices();
    if (mySeq !== this.sequenceId) return;

    const selectedVoice = selectVoiceForLanguage(voices, language);
    const chunks = chunkTextForSpeech(cleanText);
    if (chunks.length === 0) {
      this.callbacks.onStatusChange('idle', null);
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }

    let started = false;
    const watchdog = setTimeout(() => {
      if (mySeq !== this.sequenceId || started) return;
      // SpeechSynthesis stayed silent (commonly due to browser autoplay block before interaction)
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      this.callbacks.onSpeakingChange(false);
      this.callbacks.onStatusChange('blocked', 'Tap to start guide audio');
    }, 1800);

    const speakChunk = (index: number) => {
      if (mySeq !== this.sequenceId) {
        clearTimeout(watchdog);
        return;
      }
      if (index >= chunks.length) {
        clearTimeout(watchdog);
        this.callbacks.onSpeakingChange(false);
        this.callbacks.onStatusChange('completed', null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = language === 'hi' ? 'hi-IN' : selectedVoice?.lang || 'en-IN';
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = language === 'hi' ? 0.96 : 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Retain reference to prevent Chromium GC mid-sentence
      this.activeUtterances.push(utterance);

      utterance.onstart = () => {
        if (mySeq !== this.sequenceId) return;
        started = true;
        clearTimeout(watchdog);
        this.callbacks.onSpeakingChange(true);
        this.callbacks.onStatusChange('playing', null);
      };

      utterance.onend = () => {
        if (mySeq !== this.sequenceId) return;
        speakChunk(index + 1);
      };

      utterance.onerror = (event) => {
        clearTimeout(watchdog);
        if (mySeq !== this.sequenceId) return;
        const errCode = event?.error || '';
        if (errCode === 'canceled' || errCode === 'interrupted') {
          return;
        }
        this.callbacks.onSpeakingChange(false);
        if (errCode === 'not-allowed') {
          this.callbacks.onStatusChange('blocked', 'Tap to start guide audio');
        } else {
          this.callbacks.onStatusChange('unavailable', `Voice error: ${errCode || 'audio unavailable'}`);
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakChunk(0);
  }
}
