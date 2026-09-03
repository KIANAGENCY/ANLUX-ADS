const QUICK_QUESTIONS = [
  "Analiza mis campañas",
  "¿Cuál es mi mejor anuncio?",
  "¿Dónde estoy desperdiciando presupuesto?",
  "Compara este periodo con el anterior",
  "¿Qué debería optimizar primero?",
];

export function QuickQuestions({ onSelect, disabled }: { onSelect: (question: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_QUESTIONS.map((question) => (
        <button
          key={question}
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="rounded-full border border-border-subtle bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent-ai/40 hover:bg-accent-ai/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
