import Image from "next/image";

/** Identite institutionnelle : SUTA est le visage, l'ANSUT reste l'emetteur. */
export function SutaHeader({ kiosk }: { kiosk: boolean }) {
  return (
    <header className="relative z-20 flex w-full items-center justify-between gap-4 border-b border-white/60 bg-white/75 px-6 py-4 backdrop-blur-xl sm:px-10">
      <div className="flex items-center gap-4">
        <Image
          src="/suta/brand/logo-ansut.png"
          alt="ANSUT — Agence Nationale du Service Universel des Telecommunications-TIC"
          width={900}
          height={320}
          priority
          className="h-8 w-auto sm:h-10"
        />
        <span className="hidden h-8 w-px bg-ansut-border sm:block" aria-hidden="true" />
        <div className="leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-[0.12em] text-ansut-blue">SUTA</span>
            <span className="text-xs font-medium text-ansut-text-muted">par l&apos;ANSUT</span>
          </div>
          {!kiosk && <span className="text-[11px] text-ansut-text-muted">Assistant citoyen — demonstrateur</span>}
        </div>
      </div>
      <div className="hidden items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] sm:flex">
        <span className="text-ansut-blue">Connecter</span><span className="h-1 w-1 rounded-full bg-ansut-orange" />
        <span className="text-ansut-blue">Equiper</span><span className="h-1 w-1 rounded-full bg-ansut-orange" />
        <span className="text-ansut-blue">Former</span>
      </div>
    </header>
  );
}
