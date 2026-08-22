import Image from "next/image";

/**
 * Identité institutionnelle sur scène de nuit : SUTA est le visage, l'ANSUT
 * reste l'émetteur. Le logo (bleu/orange sur fond clair) vit dans une pastille
 * blanche pour rester lisible ; le reste du header se fond dans la nuit —
 * pas de bandeau de site.
 */
export function SutaHeader({ kiosk }: { kiosk: boolean }) {
  return (
    <header className="relative z-20 flex w-full items-center justify-between gap-4 px-5 py-3 sm:px-10 sm:py-4">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span className="shrink-0 rounded-xl bg-white/95 px-2 py-1.5 shadow-sm">
          <Image
            src="/suta/brand/logo-ansut.png"
            alt="ANSUT — Agence Nationale du Service Universel des Télécommunications-TIC"
            width={900}
            height={320}
            priority
            className="h-6 w-auto sm:h-8"
          />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-[0.14em] text-white sm:text-lg">SUTA</span>
            <span className="truncate text-[11px] font-medium text-white/55 sm:text-xs">par l&apos;ANSUT</span>
          </div>
          {!kiosk && <span className="hidden text-[11px] text-white/40 sm:block">Votre assistant citoyen</span>}
        </div>
      </div>
    </header>
  );
}
