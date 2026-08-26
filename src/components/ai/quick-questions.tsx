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
          className="rounded-full border border-white/10 bg-white/4 px-3.5 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
