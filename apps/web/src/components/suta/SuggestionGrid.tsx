/** Questions suggérées — thème clair ANSUT. Remplace `components/ExampleQuestions.tsx`. */
export function SuggestionGrid({
  questions,
  onSelect,
  disabled,
}: {
  questions: readonly string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 sm:max-w-none">
      <p className="text-sm text-ansut-text-muted">Essayez, par exemple :</p>
      <div className="grid w-full grid-cols-1 gap-2">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="rounded-xl border border-ansut-border bg-ansut-surface px-4 py-2.5 text-left text-sm text-ansut-blue transition-colors hover:border-ansut-orange hover:bg-ansut-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
