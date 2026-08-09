export function FondoGlobal() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <img src="/fondo.png" alt="" className="absolute inset-0 size-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/75 to-background" />
    </div>
  );
}