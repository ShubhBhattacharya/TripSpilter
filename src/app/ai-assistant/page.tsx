'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopHeader } from '../../components/layout/TopHeader';
import { BottomNav } from '../../components/layout/BottomNav';
import { useAuth } from '../../components/auth/AuthProvider';
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Bot,
  User as UserIcon,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

interface PendingAction {
  actionType: 'CREATE_TRIP' | 'UPDATE_ITINERARY' | 'CREATE_EXPENSE';
  summary: string;
  payload: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  toolsUsed?: string[];
  pendingConfirmations?: PendingAction[];
  confirmedAction?: boolean;
}

export default function AiAssistantPage() {
  const { user, isConfigured } = useAuth();
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [preferredProvider, setPreferredProvider] = useState<'auto' | 'openai' | 'gemini'>('auto');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Namaste! Ask me to plan trips across India, check destination weather, convert currencies, inspect your saved TripSplit expenses, or prepare a trip draft for confirmation.',
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const msgSeqRef = useRef(0);
  const nextId = (prefix: string) => {
    msgSeqRef.current += 1;
    return `${prefix}-${msgSeqRef.current}`;
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (textOverride?: string) => {
    const query = (textOverride ?? input).trim();
    if (!query || isSending) return;

    const userMsg: ChatMessage = { id: nextId('u'), role: 'user', content: query };
    const nextHistory = [...messages.filter((m) => m.id !== 'welcome'), userMsg];
    setMessages((prev) => [...prev, userMsg]);
    if (!textOverride) setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          language,
          preferredProvider,
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId('err'),
            role: 'assistant',
            content: data?.error || 'Unable to reach AI service.',
          },
        ]);
        return;
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: nextId('a'),
          role: 'assistant',
          content: data.reply,
          provider: data.provider,
          model: data.model,
          toolsUsed: (data.toolExecutions || []).map((t: { tool: string }) => t.tool),
          pendingConfirmations: data.pendingConfirmations || [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('err'),
          role: 'assistant',
          content: 'Network error communicating with TripSplit AI Companion.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmAction = async (msgId: string, action: PendingAction) => {
    if (action.actionType === 'CREATE_EXPENSE') {
      toast.info('Review vendor & member splits in Expense tab to confirm.');
      return;
    }

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
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Confirmation failed');
        return;
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, confirmedAction: true } : m))
      );
      toast.success('Approved action saved to database!');
    } catch {
      toast.error('Failed to persist approved action.');
    }
  };

  const quickSuggestions =
    language === 'hi'
      ? [
          'मनाली का मौसम और प्रमुख स्थान बताओ',
          '100 USD को INR में बदलो',
          'जयपुर के लिए 3 दिन की ट्रिप ड्राफ्ट बनाओ',
        ]
      : [
          'Check live weather and top spots for Manali',
          'Convert 100 USD to INR',
          'Prepare a 3-day trip draft for Jaipur',
        ];

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8 h-screen">
        <TopHeader title="AI Travel Companion" />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 max-w-4xl mx-auto w-full flex flex-col min-h-0 gap-4">
          {/* Controls Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5EAF1] shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-[#172B4D]">Central AI Travel Companion</h1>
                <p className="text-[11px] text-[#64748B]">
                  {isConfigured && !user
                    ? 'Sign in required when Supabase auth is enabled'
                    : 'OpenAI + Gemini with live tool calling & user confirmation gate'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={preferredProvider}
                onChange={(e) => setPreferredProvider(e.target.value as 'auto' | 'openai' | 'gemini')}
                className="px-2.5 py-1.5 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] text-xs font-semibold"
                aria-label="AI Provider"
              >
                <option value="auto">Auto (OpenAI → Gemini)</option>
                <option value="openai">OpenAI (GPT-4o mini)</option>
                <option value="gemini">Google Gemini</option>
              </select>

              <div className="inline-flex rounded-lg border border-[#E5EAF1] p-0.5 bg-[#F8FAFC]">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    language === 'en' ? 'bg-[#173B70] text-white' : 'text-[#64748B]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('hi')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    language === 'hi' ? 'bg-[#173B70] text-white' : 'text-[#64748B]'
                  }`}
                >
                  हिंदी
                </button>
              </div>
            </div>
          </div>

          {/* Chat Messages Window */}
          <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-[#E5EAF1] p-4 sm:p-5 space-y-4 shadow-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    msg.role === 'user'
                      ? 'bg-[#1685D4] text-white'
                      : 'bg-slate-900 text-amber-400'
                  }`}
                >
                  {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[82%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed space-y-2 ${
                    msg.role === 'user'
                      ? 'bg-[#1685D4] text-white'
                      : 'bg-[#F4F7FB] text-[#172B4D] border border-[#E5EAF1]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.toolsUsed.map((t, idx) => (
                        <span
                          key={`${t}-${idx}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-600"
                        >
                          <Wrench className="w-2.5 h-2.5" />
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.pendingConfirmations &&
                    msg.pendingConfirmations.map((act, idx) => (
                      <div
                        key={idx}
                        className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2"
                      >
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          User Confirmation Required
                        </div>
                        <p className="text-amber-800">{act.summary}</p>
                        {msg.confirmedAction ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirmed & Saved
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConfirmAction(msg.id, act)}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                          >
                            Confirm & Save Action
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 pl-11">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1685D4]" />
                Consulting AI & backend tools...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Chips + Input Bar */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {quickSuggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendMessage(q)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E5EAF1] text-xs font-medium text-[#173B70]"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
              className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-[#E5EAF1] shadow-xs"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  language === 'hi'
                    ? 'यात्रा, बजट, मौसम या खर्च के बारे में पूछें...'
                    : 'Ask about destinations, weather, currency, or your trips...'
                }
                className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="px-4 py-2 rounded-xl bg-[#1685D4] hover:bg-[#1270B5] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </form>
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
