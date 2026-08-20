export function ExampleQuestions({
  questions,
  onSelect,
  disabled,
}: {
  questions: readonly string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-3">
      <p className="text-sm text-brand-text/60">Essayez, par exemple :</p>
      <div className="flex flex-wrap justify-center gap-2">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-brand-text/90 transition-colors hover:border-brand-secondary hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            « {question} »
          </button>
        ))}
      </div>
    </div>
  );
}
