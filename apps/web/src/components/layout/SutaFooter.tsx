/** Pied de page discret de la scène de nuit — une seule ligne. */
export function SutaFooter({ kiosk }: { kiosk: boolean }) {
  // Hash court du commit servi, injecté au build (next.config.ts) : la
  // preuve immédiate que le déploiement vu est bien le dernier poussé.
  const version = process.env.NEXT_PUBLIC_SUTA_VERSION ?? "dev";
  return (
    <footer className={`flex items-center justify-center gap-3 px-6 text-center text-[11px] text-white/35 ${kiosk ? "py-2" : "py-3"}`}>
      <span className="whitespace-nowrap">SUTA — par l&apos;ANSUT</span>
      <span aria-hidden="true">·</span>
      <span className="whitespace-nowrap">www.ansut.ci</span>
      <span aria-hidden="true">·</span>
      <span className="whitespace-nowrap" title="Version déployée (commit)">v-{version}</span>
      {/* La mention complète reste sur grand écran ; sur mobile elle
          déséquilibrait le pied de page sur trois lignes. */}
      {!kiosk && <><span aria-hidden="true" className="hidden sm:inline">·</span><span className="hidden sm:inline">Démonstrateur : certaines données peuvent être fictives ou non validées.</span><span className="sm:hidden" aria-hidden="true">·</span><span className="whitespace-nowrap sm:hidden">Démonstrateur</span></>}
    </footer>
  );
}
