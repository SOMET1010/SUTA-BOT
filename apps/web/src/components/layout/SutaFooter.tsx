/** Pied de page institutionnel discret pour l'expérience publique SUTA. */
export function SutaFooter({ kiosk }: { kiosk: boolean }) {
  return (
    <footer className={`flex items-center justify-center gap-3 border-t border-white/60 bg-white/60 px-6 text-center text-[11px] text-ansut-text-muted backdrop-blur ${kiosk ? "py-2" : "py-3"}`}>
      <span>SUTA — par l&apos;ANSUT</span>
      <span aria-hidden="true">•</span>
      <span>www.ansut.ci</span>
      {!kiosk && <><span aria-hidden="true">•</span><span>Démonstrateur : certaines données peuvent être fictives ou non validées.</span></>}
    </footer>
  );
}
