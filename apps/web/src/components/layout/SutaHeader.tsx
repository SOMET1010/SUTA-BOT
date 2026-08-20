import Image from "next/image";

/**
 * En-tête public SUTA (thème clair ANSUT). Logo officiel ANSUT fourni par
 * l'équipe (`public/suta/brand/logo-ansut.png`, extrait du fichier vecteur
 * `logo_ANSUT_def.pdf` communiqué) — voir `public/suta/brand/README.md`.
 * Le wordmark « ANSUT CONNECTE » est le nom du produit (texte), distinct
 * du logo graphique.
 *
 * L'encart événement (Salon) est affiché dans `SutaIntroduction`, pas ici
 * — voir `lib/event-config.ts`.
 */
export function SutaHeader({ kiosk }: { kiosk: boolean }) {
  return (
    <header className="flex w-full items-center justify-between gap-4 border-b border-ansut-border bg-ansut-surface px-6 py-4 sm:px-10">
      <div className="flex items-center gap-3">
        <Image
          src="/suta/brand/logo-ansut.png"
          alt="ANSUT — Agence Nationale du Service Universel des Télécommunications-TIC"
          width={900}
          height={320}
          priority
          className="h-8 w-auto sm:h-9"
        />
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
