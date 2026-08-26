"use client";

import { Send, Sparkles } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { QuickQuestions } from "@/components/ai/quick-questions";
import { AssistantAnalysis, TypingIndicator, UserMessage } from "@/components/ai/chat-message";
import type { AIAnalysis } from "@/lib/types";

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text?: string;
  analysis?: AIAnalysis;
}

export default function AIAnalystPage() {
  const { clientId, dateRange } = useFilters();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function askQuestion(question: string) {
    if (!question.trim() || loading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, dateRange, question }),
      });
      const analysis: AIAnalysis = await res.json();
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", analysis }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          analysis: {
            summary: "No se pudo generar el análisis. Intenta de nuevo en unos segundos.",
            issues: [],
            opportunities: [],
            recommendations: [],
            priority: "low",
            generatedAt: new Date().toISOString(),
          },
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    askQuestion(input);
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full gradient-accent">
            <Sparkles className="size-5.5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">AI Performance Analyst</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Pregunta sobre el performance de tu cuenta. El análisis se genera a partir de las métricas del
              periodo seleccionado.
            </p>
          </div>
          <QuickQuestions onSelect={askQuestion} disabled={loading} />
        </div>
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto pb-4">
          {messages.map((m) =>
            m.role === "user" ? (
              <UserMessage key={m.id} text={m.text!} />
            ) : (
              <AssistantAnalysis key={m.id} analysis={m.analysis!} />
            )
          )}
          {loading && <TypingIndicator />}
          <div ref={scrollRef} />
        </div>
      )}

      <div className="space-y-3 border-t border-white/8 pt-4">
        {messages.length > 0 && <QuickQuestions onSelect={askQuestion} disabled={loading} />}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta algo sobre tu cuenta..."
            className="flex-1 rounded-lg border border-white/10 bg-white/4 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg gradient-accent text-white disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
