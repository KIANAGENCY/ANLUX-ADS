"use client";

import { Send, Sparkles, X } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { QuickQuestions } from "./quick-questions";
import { AssistantAnalysis, TypingIndicator, UserMessage } from "./chat-message";
import { useAIAnalysis, type ChatEntry } from "./use-ai-analysis";
import type { AIAnalysis } from "@/lib/types";

interface AIAnalystContextValue {
  messages: ChatEntry[];
  loading: boolean;
  askQuestion: (question: string) => void;
  /** Último análisis devuelto por `/api/ai/analyze`, o `null` si aún no se generó ninguno. */
  lastAnalysis: AIAnalysis | null;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const AIAnalystContext = createContext<AIAnalystContextValue | null>(null);

/**
 * Estado único del AI Performance Analyst para todo el dashboard: la página
 * `/ai-analyst`, el drawer y la card de ANLUX Intelligence del Overview
 * comparten la misma conversación y la misma llamada a `/api/ai/analyze`.
 *
 * Debe montarse **dentro** de `FiltersProvider`: `useAIAnalysis()` lee
 * `clientId` y `dateRange` de ese contexto.
 */
export function AIDrawerProvider({ children }: { children: ReactNode }) {
  const { messages, loading, askQuestion, scrollRef } = useAIAnalysis();
  const [isOpen, setIsOpen] = useState(false);

  const lastAnalysis = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant" && messages[i].analysis) return messages[i].analysis!;
    }
    return null;
  }, [messages]);

  const value = useMemo<AIAnalystContextValue>(
    () => ({
      messages,
      loading,
      askQuestion,
      lastAnalysis,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    // `askQuestion` se recrea en cada render del provider; el resto son los datos reales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, loading, lastAnalysis, isOpen]
  );

  return (
    <AIAnalystContext.Provider value={value}>
      {children}
      <AIDrawer scrollRef={scrollRef} />
    </AIAnalystContext.Provider>
  );
}

export function useAIDrawer(): AIAnalystContextValue {
  const ctx = useContext(AIAnalystContext);
  if (!ctx) throw new Error("useAIDrawer debe usarse dentro de <AIDrawerProvider>");
  return ctx;
}

function AIDrawer({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const { messages, loading, askQuestion, isOpen, close } = useAIDrawer();
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    askQuestion(input);
    setInput("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="ANLUX Intelligence"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={close} />

      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-border-subtle bg-background shadow-2xl">
        <header className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
          <span className="flex size-8 items-center justify-center rounded-lg border border-accent-ai/30 bg-accent-ai/15">
            <Sparkles className="size-4 text-accent-ai" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">ANLUX Intelligence</p>
            <p className="text-[11px] text-muted-foreground-2">Análisis del cliente y periodo seleccionados</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                Pregunta sobre el performance de tu cuenta. El análisis se genera a partir de las métricas del
                periodo seleccionado.
              </p>
              <QuickQuestions onSelect={askQuestion} disabled={loading} />
            </div>
          ) : (
            <>
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserMessage key={m.id} text={m.text!} />
                ) : (
                  <AssistantAnalysis key={m.id} analysis={m.analysis!} />
                )
              )}
              {loading && <TypingIndicator />}
              <div ref={scrollRef} />
            </>
          )}
        </div>

        <div className="space-y-3 border-t border-border-subtle px-5 py-4">
          {messages.length > 0 && <QuickQuestions onSelect={askQuestion} disabled={loading} />}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta algo sobre tu cuenta..."
              className="flex-1 rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground-2 focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-2 disabled:opacity-40 disabled:hover:bg-accent"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
