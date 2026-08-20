/**
 * Pied de page public SUTA. Aucune donnée institutionnelle inventée
 * (adresse, réseaux sociaux, liens) : uniquement la mention de la source
 * des réponses de démonstration, conformément au principe anti-hallucination
 * du cahier des charges (sections 6 et 38).
 */
export function SutaFooter({ kiosk }: { kiosk: boolean }) {
  if (kiosk) return null;

  return (
    <footer className="border-t border-ansut-border bg-ansut-surface px-6 py-4 text-center text-xs text-ansut-text-muted sm:px-10">
      Réponses issues de la base de connaissances de démonstration (voir
      data/demo/ — contenu fictif, non validé par l&apos;ANSUT).
    </footer>
  );
}
