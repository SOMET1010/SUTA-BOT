import Image from "next/image";

/** Identite institutionnelle : SUTA est le visage, l'ANSUT reste l'emetteur. */
export function SutaHeader({ kiosk }: { kiosk: boolean }) {
  return (
    <header className="relative z-20 flex w-full items-center justify-between gap-4 border-b border-white/50 bg-white/70 px-5 py-3 backdrop-blur-2xl sm:px-10 sm:py-4">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Image
          src="/suta/brand/logo-ansut.png"
          alt="ANSUT — Agence Nationale du Service Universel des Télécommunications-TIC"
          width={900}
          height={320}
          priority
          className="h-7 w-auto shrink-0 sm:h-10"
        />
        <span className="hidden h-8 w-px bg-ansut-border sm:block" aria-hidden="true" />
        <div className="min-w-0 leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-[0.14em] text-ansut-blue sm:text-lg">SUTA</span>
            <span className="truncate text-[11px] font-medium text-ansut-text-muted sm:text-xs">par l&apos;ANSUT</span>
          </div>
          {!kiosk && <span className="hidden text-[11px] text-ansut-text-muted sm:block">Votre assistant citoyen</span>}
        </div>
      </div>
      {/* Pas de rappel des piliers ici : la rangée de puces sous le header
          les porte déjà, avec l'état actif — les doubler ferait « site web ». */}
    </header>
  );
}
