import { AlertTriangle, Lightbulb, ListChecks, Sparkles, User } from "lucide-react";
import type { AIAnalysis } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const PRIORITY_CONFIG = {
  low: { label: "Prioridad baja", variant: "neutral" as const },
  medium: { label: "Prioridad media", variant: "warning" as const },
  high: { label: "Prioridad alta", variant: "negative" as const },
};

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end gap-2.5">
      <div className="max-w-lg rounded-2xl rounded-tr-sm border border-border-subtle bg-surface-2 px-4 py-2.5 text-sm text-foreground">{text}</div>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-2">
        <User className="size-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

export function AssistantAnalysis({ analysis }: { analysis: AIAnalysis }) {
  return (
    <div className="flex gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-accent-ai/30 bg-accent-ai/15">
        <Sparkles className="size-3.5 text-accent-ai" />
      </div>
      <div className="max-w-2xl space-y-3 rounded-2xl rounded-tl-sm border border-border-subtle bg-surface px-4 py-3.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">AI Performance Analyst</span>
          <Badge variant={PRIORITY_CONFIG[analysis.priority].variant}>{PRIORITY_CONFIG[analysis.priority].label}</Badge>
        </div>

        <p className="leading-relaxed text-foreground/90">{analysis.summary}</p>

        <AnalysisSection icon={AlertTriangle} title="Problemas detectados" items={analysis.issues} tone="negative" />
        <AnalysisSection icon={Lightbulb} title="Oportunidades" items={analysis.opportunities} tone="positive" />
        <AnalysisSection icon={ListChecks} title="Recomendaciones" items={analysis.recommendations} tone="accent" />
      </div>
    </div>
  );
}

function AnalysisSection({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof AlertTriangle;
  title: string;
  items: string[];
  tone: "negative" | "positive" | "accent";
}) {
  if (items.length === 0) return null;
  const toneColor = { negative: "text-negative", positive: "text-positive", accent: "text-accent-light" }[tone];

  return (
    <div className="space-y-1.5 border-t border-border-subtle pt-3">
      <p className={cn("flex items-center gap-1.5 text-xs font-medium", toneColor)}>
        <Icon className="size-3.5" />
        {title}
      </p>
      <ul className="space-y-1 text-xs leading-relaxed text-foreground/75">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-muted-foreground">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-accent-ai/30 bg-accent-ai/15">
        <Sparkles className="size-3.5 text-accent-ai" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border-subtle bg-surface px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
