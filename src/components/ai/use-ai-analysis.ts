"use client";

import { useRef, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { AIAnalysis } from "@/lib/types";

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text?: string;
  analysis?: AIAnalysis;
}

/**
 * Lógica de conversación del AI Performance Analyst.
 *
 * Extraída sin cambios de `app/(dashboard)/ai-analyst/page.tsx` para que la
 * página y el drawer compartan exactamente la misma llamada a
 * `POST /api/ai/analyze` — misma ruta, mismo cuerpo, mismo manejo de error.
 * No hay una segunda integración de IA ni un segundo contrato de API.
 */
export function useAIAnalysis() {
  const { clientId, dateRange } = useFilters();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function askQuestion(question: string) {
    if (!question.trim() || loading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: question }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, dateRange, question }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo generar el análisis.");
      }
      const analysis: AIAnalysis = data;
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", analysis }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          analysis: {
            summary:
              err instanceof Error ? err.message : "No se pudo generar el análisis. Intenta de nuevo en unos segundos.",
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

  return { messages, loading, askQuestion, scrollRef };
}
