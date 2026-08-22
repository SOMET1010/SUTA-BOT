/** Pied de page discret de la scène de nuit — une seule ligne. */
export function SutaFooter({ kiosk }: { kiosk: boolean }) {
  return (
    <footer className={`flex items-center justify-center gap-3 px-6 text-center text-[11px] text-white/35 ${kiosk ? "py-2" : "py-3"}`}>
      <span className="whitespace-nowrap">SUTA — par l&apos;ANSUT</span>
      <span aria-hidden="true">·</span>
      <span className="whitespace-nowrap">www.ansut.ci</span>
      {/* La mention complète reste sur grand écran ; sur mobile elle
          déséquilibrait le pied de page sur trois lignes. */}
      {!kiosk && <><span aria-hidden="true" className="hidden sm:inline">·</span><span className="hidden sm:inline">Démonstrateur : certaines données peuvent être fictives ou non validées.</span><span className="sm:hidden" aria-hidden="true">·</span><span className="whitespace-nowrap sm:hidden">Démonstrateur</span></>}
    </footer>
  );
}
