/**
 * En-tête public SUTA (thème clair ANSUT). Le logo officiel ANSUT n'a pas
 * été fourni à ce jour — voir public/suta/brand/README.md : on affiche donc
 * un placeholder clairement identifié plutôt qu'une recréation
 * approximative du logo (consigne UI, jamais de fabrication de logo).
 * Le wordmark « ANSUT CONNECTE » est le nom du produit (texte), pas un
 * logo graphique, et n'est donc pas concerné par cette limitation.
 *
 * L'encart événement (Salon) est affiché dans `SutaIntroduction`, pas ici
 * — voir `lib/event-config.ts`.
 */
export function SutaHeader({ kiosk }: { kiosk: boolean }) {
  return (
    <header className="flex w-full items-center justify-between gap-4 border-b border-ansut-border bg-ansut-surface px-6 py-4 sm:px-10">
      <div className="flex items-center gap-3">
        <LogoPlaceholder />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-[0.18em] text-ansut-blue">
            ANSUT CONNECTE
          </span>
          {!kiosk && (
            <span className="text-xs text-ansut-text-muted">Démonstrateur — MVP Salon</span>
          )}
        </div>
      </div>
    </header>
  );
}

/** Placeholder explicite en attendant le logo officiel ANSUT (bordure pointillée, non un logo). */
function LogoPlaceholder() {
  return (
    <div
      role="img"
      aria-label="Emplacement du logo ANSUT (non fourni)"
      title="Logo ANSUT officiel non fourni — voir public/suta/brand/README.md"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-ansut-blue/40 bg-ansut-background text-[10px] font-semibold text-ansut-blue/50"
    >
      A
    </div>
  );
}
