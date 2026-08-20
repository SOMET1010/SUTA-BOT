export function BrandHeader({ kiosk }: { kiosk: boolean }) {
  return (
    <header className="flex w-full items-center justify-between px-6 py-5 sm:px-10">
      <span className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-text/70">
        ANSUT CONNECTE
      </span>
      {!kiosk && (
        <span className="text-xs text-brand-text/40">Démonstrateur — MVP Salon</span>
      )}
    </header>
  );
}
