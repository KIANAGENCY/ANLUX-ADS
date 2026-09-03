"use client";

import { Send, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { QuickQuestions } from "@/components/ai/quick-questions";
import { AssistantAnalysis, TypingIndicator, UserMessage } from "@/components/ai/chat-message";
import { useAIDrawer } from "@/components/ai/ai-drawer";

export default function AIAnalystPage() {
  const { messages, loading, askQuestion } = useAIDrawer();
  const [input, setInput] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    askQuestion(input);
    setInput("");
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl border border-accent-ai/30 bg-accent-ai/15">
            <Sparkles className="size-5.5 text-accent-ai" />
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
        </div>
      )}

      <div className="space-y-3 border-t border-border-subtle pt-4">
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
    </div>
  );
}
