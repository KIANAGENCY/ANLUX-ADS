"use client";

import { useRef, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { AIAnalysis } from "@/lib/types";

/** Modos del AI Analyst, tal como viajan al endpoint. */
export type AnalysisMode = "general" | "performance";

export const ANALYSIS_MODE_LABELS: Record<AnalysisMode, string> = {
  general: "Consulta estratégica",
  performance: "Analizar rendimiento",
};

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text?: string;
  analysis?: AIAnalysis;
  /** Modo con el que se pidió este análisis, para poder etiquetarlo en la UI. */
  mode?: AnalysisMode;
}

/**
 * Lógica de conversación del AI Performance Analyst.
 *
 * La página y el drawer comparten exactamente la misma llamada a
 * `POST /api/ai/analyze` — misma ruta, mismo cuerpo, mismo manejo de error.
 * No hay una segunda integración de IA ni un segundo contrato de API.
 *
 * El modo se envía **explícito** en cada petición y el servidor lo valida:
 * la separación entre consulta estratégica y análisis de rendimiento no
 * depende de heurísticas sobre el texto de la pregunta.
 */
export function useAIAnalysis() {
  const { clientId, dateRange } = useFilters();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function askQuestion(question: string, mode: AnalysisMode) {
    if (!question.trim() || loading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: question }]);
    setLoading(true);

    try {
      // En modo estratégico no se envían cuenta ni periodo: el servidor los
      // ignoraría de todos modos, porque ese modo nunca consulta Meta.
      const body =
        mode === "performance" ? { mode, clientId, dateRange, question } : { mode, question };

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo generar el análisis.");
      }
      const analysis: AIAnalysis = data;
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", analysis, mode }]);
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
